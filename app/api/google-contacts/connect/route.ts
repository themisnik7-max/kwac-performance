import { NextRequest, NextResponse } from 'next/server'
import { getAuthedAgent } from '@/lib/auth'
import { googleOAuthConfigured, buildAuthUrl, encodeState } from '@/lib/googleContacts'

// POST (not a bare redirect) — the client needs its Bearer token read
// before we know which agent is connecting (see lib/googleContacts.ts's
// encodeState comment), so this returns the Google consent URL as JSON and
// the browser navigates there itself, rather than this route 302ing
// directly (which an authedFetch call can't act on anyway).
export async function POST(req: NextRequest) {
  const caller = await getAuthedAgent(req)
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!googleOAuthConfigured()) {
    return NextResponse.json({ error: 'not_configured', message: 'Το Google Contacts sync δεν έχει ρυθμιστεί ακόμα (λείπουν τα GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).' }, { status: 501 })
  }

  const redirectUri = `${req.nextUrl.origin}/api/google-contacts/callback`
  const url = buildAuthUrl(encodeState(caller.id), redirectUri)
  return NextResponse.json({ url })
}
