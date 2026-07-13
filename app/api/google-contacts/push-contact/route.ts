import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthedAgent } from '@/lib/auth'
import { googleOAuthConfigured, decryptRefreshToken, refreshAccessToken, pushContactToGoogle } from '@/lib/googleContacts'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// POST — pushes one contact (typically a Gmail lead the agent just filled
// in a name/phone for) into the caller's own Google Contacts, tagged KWAC.
// Called as a non-fatal side effect right after a contact save
// (app/contacts/[id]/page.tsx) — a missing connection or a Google API
// hiccup here should never block the save itself, so every failure mode
// returns a clean ok:false rather than a 500.
export async function POST(req: NextRequest) {
  const caller = await getAuthedAgent(req)
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { contact_id } = await req.json()
  if (!contact_id) return NextResponse.json({ error: 'contact_id required' }, { status: 400 })

  if (!googleOAuthConfigured()) return NextResponse.json({ ok: false, reason: 'not_configured' })

  const { data: contact } = await sb.from('contacts')
    .select('id,agent_id,full_name,phone,email,google_resource_name,sources').eq('id', contact_id).single()
  if (!contact || contact.agent_id !== caller.id) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!contact.full_name && !contact.phone) return NextResponse.json({ ok: false, reason: 'nothing_to_push' })

  const { data: conn } = await sb.from('google_contacts_connections')
    .select('refresh_token_encrypted').eq('agent_id', caller.id).maybeSingle()
  if (!conn) return NextResponse.json({ ok: false, reason: 'not_connected' })

  try {
    const accessToken = await refreshAccessToken(decryptRefreshToken(conn.refresh_token_encrypted))
    const resourceName = await pushContactToGoogle(
      accessToken,
      { fullName: contact.full_name, phone: contact.phone, email: contact.email },
      contact.google_resource_name
    )
    const sources = Array.from(new Set([...(contact.sources || []), 'google_contacts']))
    await sb.from('contacts').update({ google_resource_name: resourceName, kwac_tag: true, sources }).eq('id', contact_id)
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('[google-contacts/push-contact]', e)
    return NextResponse.json({ ok: false, reason: 'push_failed', message: e?.message })
  }
}
