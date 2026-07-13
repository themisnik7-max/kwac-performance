import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthedAgent } from '@/lib/auth'
import { decryptRefreshToken, refreshAccessToken, fetchKwacTaggedPeople, googleOAuthConfigured, type GooglePerson } from '@/lib/googleContacts'
import { splitName } from '@/lib/contacts'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// POST — pulls everyone tagged "KWAC" in the calling agent's own Google
// Contacts and upserts them into `contacts`, owned by that agent. Manual
// "Sync now" trigger for now, not a background cron — see CLAUDE.md's
// standing warning about background jobs and per-tenant/per-agent config;
// a scheduled version would need real per-agent looping infrastructure this
// doesn't have yet, so it's deliberately left as an explicit user action.
export async function POST(req: NextRequest) {
  const caller = await getAuthedAgent(req)
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!googleOAuthConfigured()) {
    return NextResponse.json({ error: 'not_configured', message: 'Το Google Contacts sync δεν έχει ρυθμιστεί ακόμα.' }, { status: 501 })
  }

  const { data: conn } = await sb.from('google_contacts_connections')
    .select('refresh_token_encrypted').eq('agent_id', caller.id).maybeSingle()
  if (!conn) return NextResponse.json({ error: 'not_connected', message: 'Δεν έχεις συνδέσει ακόμα το Google Contacts.' }, { status: 404 })

  let accessToken: string
  let people: GooglePerson[]
  let groupFound: boolean
  try {
    accessToken = await refreshAccessToken(decryptRefreshToken(conn.refresh_token_encrypted))
    ;({ people, groupFound } = await fetchKwacTaggedPeople(accessToken))
  } catch (e: any) {
    const message = e?.message || 'Άγνωστο σφάλμα'
    await sb.from('google_contacts_connections').update({ last_sync_error: message }).eq('agent_id', caller.id)
    return NextResponse.json({ error: 'sync_failed', message }, { status: 502 })
  }

  if (!groupFound) {
    const message = 'Δεν βρέθηκε ετικέτα "KWAC" στις Επαφές Google — δημιούργησε την ετικέτα εκεί και βάλε σε αυτήν τους πελάτες που θες να συγχρονίζονται.'
    await sb.from('google_contacts_connections').update({ last_synced_at: new Date().toISOString(), last_sync_count: 0, last_sync_error: message }).eq('agent_id', caller.id)
    return NextResponse.json({ ok: true, group_found: false, synced: 0, message })
  }

  let created = 0, updated = 0, skipped = 0
  for (const person of people) {
    if (!person.fullName && !person.phone && !person.email) { skipped++; continue }
    try {
      const { data: existingByResource } = await sb.from('contacts')
        .select('id,sources').eq('agent_id', caller.id).eq('google_resource_name', person.resourceName).maybeSingle()

      let target = existingByResource
      if (!target && person.phone) {
        const { data: byPhone } = await sb.from('contacts')
          .select('id,sources').eq('agent_id', caller.id).or(`phone.eq.${person.phone},phone2.eq.${person.phone}`).maybeSingle()
        target = byPhone
      }

      const { first_name, last_name } = person.firstName || person.lastName
        ? { first_name: person.firstName, last_name: person.lastName }
        : splitName(person.fullName || '')
      const sources = Array.from(new Set([...(target?.sources || []), 'google_contacts']))

      if (target) {
        await sb.from('contacts').update({
          full_name: person.fullName, first_name: first_name || null, last_name: last_name || null,
          phone: person.phone, email: person.email,
          google_resource_name: person.resourceName, kwac_tag: true, sources,
        }).eq('id', target.id)
        updated++
      } else {
        await sb.from('contacts').insert({
          agency_id: caller.agency_id, agent_id: caller.id,
          full_name: person.fullName, first_name: first_name || null, last_name: last_name || null,
          phone: person.phone, email: person.email,
          google_resource_name: person.resourceName, kwac_tag: true, sources, type: 'contact',
        })
        created++
      }
    } catch (e) {
      console.error('[google-contacts/sync] per-person upsert failed (non-fatal)', person.resourceName, e)
      skipped++
    }
  }

  await sb.from('google_contacts_connections').update({
    last_synced_at: new Date().toISOString(), last_sync_count: created + updated, last_sync_error: null,
  }).eq('agent_id', caller.id)

  return NextResponse.json({ ok: true, group_found: true, synced: created + updated, created, updated, skipped })
}
