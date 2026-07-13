// Google Contacts sync — an agent connects their own Google account (OAuth,
// contacts.readonly) and can pull in anyone tagged "KWAC" in their Google
// Contacts label list. Per-agent, not per-agency: these are each agent's own
// personal Google contacts, matching how contacts.agent_id already scopes
// ownership. Only the OAuth mechanics + People API calls live here — routes
// under app/api/google-contacts/ handle request/response and DB access.
import { encryptSecret, decryptSecret } from './crypto'

const GOOGLE_AUTH_URL  = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const PEOPLE_API       = 'https://people.googleapis.com/v1'
const SCOPES = ['https://www.googleapis.com/auth/contacts.readonly', 'openid', 'email'].join(' ')

export function googleOAuthConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
}

function requireCreds() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not configured')
  return { clientId, clientSecret }
}

// State carries the connecting agent's identity across the Google redirect
// (this app keeps sessions in the browser, not an httpOnly cookie the
// callback could read — see lib/auth.ts). AES-GCM both hides and
// authenticates it: decrypt throws on any tampering, so a successful parse
// IS the integrity check, no separate signature needed.
export function encodeState(agentId: string): string {
  return encryptSecret(JSON.stringify({ agent_id: agentId, ts: Date.now() }))
}

export function decodeState(state: string): { agent_id: string } | null {
  try {
    const parsed = JSON.parse(decryptSecret(state))
    if (!parsed?.agent_id || typeof parsed.ts !== 'number') return null
    if (Date.now() - parsed.ts > 15 * 60 * 1000) return null // 15 min to complete the consent flow
    return { agent_id: parsed.agent_id }
  } catch {
    return null
  }
}

export function buildAuthUrl(state: string, redirectUri: string): string {
  const { clientId } = requireCreds()
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',   // request a refresh_token
    prompt: 'consent',        // ...every time, so reconnecting after a revoke still gets one
    state,
  })
  return `${GOOGLE_AUTH_URL}?${params.toString()}`
}

type TokenResponse = { access_token: string; refresh_token?: string; expires_in: number; id_token?: string }

export async function exchangeCodeForTokens(code: string, redirectUri: string): Promise<TokenResponse> {
  const { clientId, clientSecret } = requireCreds()
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code, client_id: clientId, client_secret: clientSecret,
      redirect_uri: redirectUri, grant_type: 'authorization_code',
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`Google token exchange failed: ${data.error_description || data.error || res.status}`)
  return data
}

export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const { clientId, clientSecret } = requireCreds()
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken, client_id: clientId, client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`Google token refresh failed: ${data.error_description || data.error || res.status}`)
  return data.access_token
}

// Decodes the id_token's payload (JWT) just to pull the email for display
// ("connected as x@gmail.com") — not used for auth, so no signature
// verification needed; Google already gave it to us directly over TLS.
export function emailFromIdToken(idToken: string | undefined): string | null {
  if (!idToken) return null
  try {
    const payload = idToken.split('.')[1]
    const json = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    return json.email ?? null
  } catch {
    return null
  }
}

export function encryptRefreshToken(token: string): string { return encryptSecret(token) }
export function decryptRefreshToken(payload: string): string { return decryptSecret(payload) }

// Finds the contactGroup (Google's term for a label) named exactly "KWAC"
// (case-insensitive) among the agent's own Google contact groups.
export async function findKwacGroupResourceName(accessToken: string): Promise<string | null> {
  const res = await fetch(`${PEOPLE_API}/contactGroups?pageSize=200`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`Google contactGroups.list failed: ${res.status}`)
  const data = await res.json()
  const group = (data.contactGroups || []).find(
    (g: any) => (g.formattedName || g.name || '').trim().toLowerCase() === 'kwac'
  )
  return group?.resourceName ?? null
}

export type GooglePerson = {
  resourceName: string
  fullName: string | null
  firstName: string | null
  lastName: string | null
  phone: string | null
  email: string | null
}

async function fetchGroupMemberResourceNames(accessToken: string, groupResourceName: string): Promise<string[]> {
  const res = await fetch(`${PEOPLE_API}/${groupResourceName}?maxMembers=2000`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`Google contactGroups.get failed: ${res.status}`)
  const data = await res.json()
  return (data.memberResourceNames || []) as string[]
}

function parsePerson(p: any): GooglePerson {
  const name = (p.names || [])[0]
  const phone = (p.phoneNumbers || [])[0]
  const email = (p.emailAddresses || [])[0]
  return {
    resourceName: p.resourceName,
    fullName: name?.displayName ?? null,
    firstName: name?.givenName ?? null,
    lastName: name?.familyName ?? null,
    phone: phone?.canonicalForm ?? phone?.value ?? null,
    email: email?.value ?? null,
  }
}

// people.getBatchGet caps at 50 resourceNames per call.
export async function batchGetPeople(accessToken: string, resourceNames: string[]): Promise<GooglePerson[]> {
  const out: GooglePerson[] = []
  for (let i = 0; i < resourceNames.length; i += 50) {
    const chunk = resourceNames.slice(i, i + 50)
    const params = new URLSearchParams({ personFields: 'names,phoneNumbers,emailAddresses' })
    for (const rn of chunk) params.append('resourceNames', rn)
    const res = await fetch(`${PEOPLE_API}/people:batchGet?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) throw new Error(`Google people.batchGet failed: ${res.status}`)
    const data = await res.json()
    for (const r of data.responses || []) {
      if (r.person) out.push(parsePerson(r.person))
    }
  }
  return out
}

export async function fetchKwacTaggedPeople(accessToken: string): Promise<{ people: GooglePerson[]; groupFound: boolean }> {
  const groupResourceName = await findKwacGroupResourceName(accessToken)
  if (!groupResourceName) return { people: [], groupFound: false }
  const memberNames = await fetchGroupMemberResourceNames(accessToken, groupResourceName)
  if (!memberNames.length) return { people: [], groupFound: true }
  const people = await batchGetPeople(accessToken, memberNames)
  return { people, groupFound: true }
}
