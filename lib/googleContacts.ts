// Google Contacts sync — an agent connects their own Google account (OAuth)
// and can pull in anyone tagged "KWAC" in their Google Contacts label list.
// Per-agent, not per-agency: these are each agent's own personal Google
// contacts, matching how contacts.agent_id already scopes ownership. Only
// the OAuth mechanics + People/Gmail API calls live here — routes under
// app/api/google-contacts/ and app/api/gmail-leads-sync handle
// request/response and DB access.
//
// Scope covers three directions sharing one connection/consent: read
// Contacts (the KWAC-tag pull sync), write Contacts (push a completed
// Gmail lead back out — see pushContactToGoogle), and read+label Gmail
// (gmail-leads-sync). `contacts` (not `contacts.readonly`) and
// `gmail.modify` (superset of read, needed to label processed messages) are
// both "sensitive" scopes in Google's OAuth console — fine for this team's
// size in Testing publishing status (no verification review needed up to
// 100 test users), just don't publish this OAuth client to Production
// without reading what that review requires first.
import { encryptSecret, decryptSecret } from './crypto'

const GOOGLE_AUTH_URL  = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const PEOPLE_API       = 'https://people.googleapis.com/v1'
const GMAIL_API        = 'https://gmail.googleapis.com/gmail/v1'
const SCOPES = [
  'https://www.googleapis.com/auth/contacts',
  'https://www.googleapis.com/auth/gmail.modify',
  'openid', 'email',
].join(' ')

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

// ── Write-back: push a completed lead into Google Contacts ────────────
// Only called once a Gmail-captured lead has at least a name or phone
// filled in (see app/api/google-contacts/push-contact) — pushing a blank
// stub would just be noise in the agent's real contacts.

async function getOrCreateKwacGroup(accessToken: string): Promise<string> {
  const existing = await findKwacGroupResourceName(accessToken)
  if (existing) return existing
  const res = await fetch(`${PEOPLE_API}/contactGroups`, {
    method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ contactGroup: { name: 'KWAC' } }),
  })
  if (!res.ok) throw new Error(`Google contactGroups.create failed: ${res.status}`)
  const data = await res.json()
  return data.resourceName
}

async function addToKwacGroup(accessToken: string, personResourceName: string) {
  const groupResourceName = await getOrCreateKwacGroup(accessToken)
  const res = await fetch(`${PEOPLE_API}/${groupResourceName}:modify`, {
    method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ resourceNamesToAdd: [personResourceName] }),
  })
  if (!res.ok) throw new Error(`Google contactGroups.members.modify failed: ${res.status}`)
}

export type PushableContact = { fullName: string | null; phone: string | null; email: string | null }

// Creates (or updates, if this contact was already pushed once — tracked by
// contacts.google_resource_name) the person in Google Contacts, tags it
// KWAC, and returns the resourceName to store back on the row. Always
// re-adds to the KWAC group even on update — cheap and idempotent, and
// covers the case where the agent removed the label manually on Google's
// side since the last push.
export async function pushContactToGoogle(
  accessToken: string, contact: PushableContact, existingResourceName?: string | null
): Promise<string> {
  const body = {
    names: contact.fullName ? [{ unstructuredName: contact.fullName }] : undefined,
    phoneNumbers: contact.phone ? [{ value: contact.phone }] : undefined,
    emailAddresses: contact.email ? [{ value: contact.email }] : undefined,
  }

  let resourceName = existingResourceName
  if (resourceName) {
    const personId = resourceName.replace(/^people\//, '')
    const updateFields = ['names', 'phoneNumbers', 'emailAddresses'].filter(f => (body as any)[f]).join(',')
    const res = await fetch(`${PEOPLE_API}/people/${personId}:updateContact?updatePersonFields=${updateFields}`, {
      method: 'PATCH', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`Google people.updateContact failed: ${res.status}`)
  } else {
    const res = await fetch(`${PEOPLE_API}/people:createContact`, {
      method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`Google people.createContact failed: ${res.status}`)
    const data = await res.json()
    resourceName = data.resourceName
  }

  await addToKwacGroup(accessToken, resourceName!)
  return resourceName!
}

// ── Gmail: find, read, and label lead-notification emails ─────────────

export type GmailLeadMessage = { id: string; subject: string; bodyText: string; bodyHtml: string }

const LEAD_LABEL_NAME = 'KWAC-Lead-Processed'

export async function getOrCreateProcessedLabelId(accessToken: string): Promise<string> {
  const res = await fetch(`${GMAIL_API}/users/me/labels`, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!res.ok) throw new Error(`Gmail labels.list failed: ${res.status}`)
  const data = await res.json()
  const existing = (data.labels || []).find((l: any) => l.name === LEAD_LABEL_NAME)
  if (existing) return existing.id

  const createRes = await fetch(`${GMAIL_API}/users/me/labels`, {
    method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: LEAD_LABEL_NAME, labelListVisibility: 'labelHide', messageListVisibility: 'hide' }),
  })
  if (!createRes.ok) throw new Error(`Gmail labels.create failed: ${createRes.status}`)
  const created = await createRes.json()
  return created.id
}

// Query matches either portal's subject wording seen so far (Spitogatos:
// "εκδήλωση ενδιαφέροντος"; xe.gr uses the same phrase per a live example —
// see ARCHITECTURE.md's Gmail-leads section) and excludes anything already
// labeled, so a message is only ever processed once regardless of how often
// the cron runs.
export async function listLeadMessageIds(accessToken: string, labelId: string): Promise<string[]> {
  const q = `-label:${labelId} (subject:"εκδήλωση ενδιαφέροντος" OR subject:"νέος πελάτης")`
  const res = await fetch(`${GMAIL_API}/users/me/messages?${new URLSearchParams({ q, maxResults: '25' })}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`Gmail messages.list failed: ${res.status}`)
  const data = await res.json()
  return (data.messages || []).map((m: any) => m.id)
}

function decodeBase64Url(s: string): string {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
}

// Returns raw HTML (or plain text if that's all the message has) —
// stripping tags here would destroy <a href="..."> URLs, which
// gmailLeads.ts's parser needs to find the reveal link (the visible button
// text alone isn't enough; see its comment).
function extractRawBody(payload: any): { text: string; isHtml: boolean } {
  if (!payload) return { text: '', isHtml: false }
  if (payload.body?.data && payload.mimeType === 'text/html') return { text: decodeBase64Url(payload.body.data), isHtml: true }
  if (payload.body?.data && payload.mimeType === 'text/plain') return { text: decodeBase64Url(payload.body.data), isHtml: false }
  // Prefer an HTML part over a plain-text one when both exist (multipart/alternative) — hrefs only survive in HTML.
  const parts = payload.parts || []
  for (const part of parts) { const r = extractRawBody(part); if (r.text && r.isHtml) return r }
  for (const part of parts) { const r = extractRawBody(part); if (r.text) return r }
  return { text: '', isHtml: false }
}

export async function getLeadMessage(accessToken: string, messageId: string): Promise<GmailLeadMessage> {
  const res = await fetch(`${GMAIL_API}/users/me/messages/${messageId}?format=full`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`Gmail messages.get failed: ${res.status}`)
  const data = await res.json()
  const subject = (data.payload?.headers || []).find((h: any) => h.name === 'Subject')?.value || ''
  const { text: raw, isHtml } = extractRawBody(data.payload)
  const bodyHtml = isHtml ? raw : ''
  const bodyText = (isHtml
    ? raw.replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ')
    : raw
  ).replace(/\s+/g, ' ').trim()
  return { id: messageId, subject, bodyText, bodyHtml }
}

export async function markMessageProcessed(accessToken: string, messageId: string, labelId: string) {
  const res = await fetch(`${GMAIL_API}/users/me/messages/${messageId}/modify`, {
    method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ addLabelIds: [labelId] }),
  })
  if (!res.ok) throw new Error(`Gmail messages.modify failed: ${res.status}`)
}
