import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { secureCompare } from '@/lib/secureCompare'
import {
  decryptRefreshToken, refreshAccessToken,
  getOrCreateProcessedLabelId, listLeadMessageIds, getLeadMessage, markMessageProcessed,
} from '@/lib/googleContacts'
import { parseLeadEmail } from '@/lib/gmailLeads'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// Triggered daily by Vercel Cron (vercel.json) — once/day is this project's
// current Vercel plan ceiling for cron frequency (both existing cron jobs
// are daily too); go more frequent only after upgrading the plan.
// Manually: GET /api/gmail-leads-sync with Authorization: Bearer <CRON_SECRET>
export const maxDuration = 60

const CRON_SECRET = process.env.CRON_SECRET
function verifyCronAuth(req: NextRequest): boolean {
  if (!CRON_SECRET) return false
  return secureCompare(req.headers.get('authorization') ?? '', `Bearer ${CRON_SECRET}`)
}

// Per-agent, not per-agency — loops every agent with a Google connection
// (same table Contacts-tag sync uses; one OAuth grant covers both, see
// lib/googleContacts.ts), each reading only their OWN Gmail inbox. No
// "first agency" shortcut: an agent with no connection is simply skipped,
// not substituted with anyone else's.
export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: connections } = await sb.from('google_contacts_connections')
    .select('agent_id, agency_id, refresh_token_encrypted')
  const results: Array<{ agent_id: string; ok: boolean; processed?: number; created?: number; message?: string }> = []

  for (const conn of connections || []) {
    try {
      const accessToken = await refreshAccessToken(decryptRefreshToken(conn.refresh_token_encrypted))
      const labelId = await getOrCreateProcessedLabelId(accessToken)
      const messageIds = await listLeadMessageIds(accessToken, labelId)

      let created = 0
      for (const messageId of messageIds) {
        try {
          const msg = await getLeadMessage(accessToken, messageId)
          const parsed = parseLeadEmail(msg)

          let interestedPropertyId: string | null = null
          if (parsed.propertyCode) {
            const { data: prop } = await sb.from('meeting_properties')
              .select('id').eq('agency_id', conn.agency_id).eq('ilist_id', parsed.propertyCode).maybeSingle()
            interestedPropertyId = prop?.id ?? null
          }

          // Name/phone/email are never in the email itself (see
          // lib/gmailLeads.ts) — this is a stub the agent completes after
          // clicking the preserved reveal link themselves; everything
          // that *is* reliably known goes in notes so nothing is lost even
          // if the property-code match above didn't find anything.
          const noteLines = [
            parsed.propertyCode ? `Ακίνητο: #${parsed.propertyCode}` : null,
            parsed.message ? `Μήνυμα: «${parsed.message}»` : null,
            parsed.revealUrl ? `Στοιχεία επικοινωνίας: ${parsed.revealUrl}` : null,
            `Πηγή: Gmail lead${msg.subject ? ` — ${msg.subject}` : ''}`,
          ].filter(Boolean).join('\n')

          // Insert before labeling: a crash between the two leaves the
          // message unlabeled and this lead recreated next run (a harmless
          // duplicate card) rather than labeled-but-never-saved (a client
          // inquiry silently lost) — same ordering principle as every
          // other multi-step write in this app.
          const { error: insErr } = await sb.from('contacts').insert({
            agency_id: conn.agency_id, agent_id: conn.agent_id,
            type: 'lead', sources: ['gmail_lead'],
            interested_property_id: interestedPropertyId,
            notes: noteLines,
          })
          if (!insErr) created++
          else console.error('[gmail-leads-sync] contact insert failed (non-fatal)', insErr)

          await markMessageProcessed(accessToken, messageId, labelId)
        } catch (e) {
          console.error('[gmail-leads-sync] per-message failed (non-fatal)', messageId, e)
        }
      }

      results.push({ agent_id: conn.agent_id, ok: true, processed: messageIds.length, created })
    } catch (e: any) {
      results.push({ agent_id: conn.agent_id, ok: false, message: e?.message })
    }
  }

  return NextResponse.json({ ok: results.every(r => r.ok), results })
}
