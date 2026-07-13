import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { decodeState, exchangeCodeForTokens, emailFromIdToken, encryptRefreshToken } from '@/lib/googleContacts'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// GET — this is Google redirecting the user's browser back to us, not an
// authedFetch call, so there's no Authorization header to check; identity
// comes from the signed `state` round-tripped through the consent flow
// (see lib/googleContacts.ts). Always redirects back into the app rather
// than rendering raw JSON, since a real browser lands here.
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin
  const code = req.nextUrl.searchParams.get('code')
  const state = req.nextUrl.searchParams.get('state')
  const errorParam = req.nextUrl.searchParams.get('error')

  if (errorParam) return NextResponse.redirect(`${origin}/personal-admin?google=denied`)
  if (!code || !state) return NextResponse.redirect(`${origin}/personal-admin?google=error`)

  const decoded = decodeState(state)
  if (!decoded) return NextResponse.redirect(`${origin}/personal-admin?google=error`)

  try {
    const redirectUri = `${origin}/api/google-contacts/callback`
    const tokens = await exchangeCodeForTokens(code, redirectUri)

    const { data: agent } = await sb.from('agents').select('id,agency_id').eq('id', decoded.agent_id).single()
    if (!agent) return NextResponse.redirect(`${origin}/personal-admin?google=error`)

    if (tokens.refresh_token) {
      // Google only issues a refresh_token on first consent (or when
      // prompt=consent forces re-issue, which connect/route.ts always
      // sets) — this is always the reconnect-or-fresh-connect path.
      await sb.from('google_contacts_connections').upsert({
        agent_id: agent.id, agency_id: agent.agency_id,
        refresh_token_encrypted: encryptRefreshToken(tokens.refresh_token),
        google_email: emailFromIdToken(tokens.id_token),
        connected_at: new Date().toISOString(),
      }, { onConflict: 'agent_id' })
    }

    return NextResponse.redirect(`${origin}/personal-admin?google=connected`)
  } catch (e) {
    console.error('[google-contacts/callback]', e)
    return NextResponse.redirect(`${origin}/personal-admin?google=error`)
  }
}
