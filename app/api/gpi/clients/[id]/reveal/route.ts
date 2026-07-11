import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthedAgent } from '@/lib/auth'
import { decryptGpiCredentials, canAccessGpiClient, hasGpiFeatureAccess, type GpiClientRow } from '@/lib/gpi'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// A compromised admin/ceo session can legitimately pass canAccessGpiClient
// for every client in the agency — this cap is what actually stops a
// scripted loop from exfiltrating every landlord's taxisnet credentials in
// one burst. 10/agent/hour comfortably covers real onboarding/support use.
const HOURLY_REVEAL_CAP = 10

// Separate from GET /clients/[id] on purpose: taxisnet credentials should
// never come back with a routine page load, only on an explicit "show"
// action in the UI — and every reveal is logged (gpi_credential_access_log).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const caller = await getAuthedAgent(req)
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasGpiFeatureAccess(caller)) return NextResponse.json({ error: 'GPI δεν είναι διαθέσιμο για τον λογαριασμό σου' }, { status: 403 })

  const { data: client } = await db.from('gpi_clients').select('*').eq('id', params.id).single()
  if (!client || !canAccessGpiClient(caller, client as GpiClientRow)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: revealCount } = await db.rpc('increment_gpi_reveal_usage', {
    p_agent_id: caller.id, p_agency_id: caller.agency_id,
  })

  if (typeof revealCount === 'number' && revealCount > HOURLY_REVEAL_CAP) {
    // Still logged (blocked attempts are exactly what an admin needs to see),
    // just without ever decrypting/returning the credentials.
    await db.from('gpi_credential_access_log').insert({
      agency_id: caller.agency_id, client_id: params.id, accessed_by: caller.id,
    })
    if (revealCount === HOURLY_REVEAL_CAP + 1) {
      // Fire once per burst, not once per subsequent blocked call.
      await db.from('announcements').insert({
        agency_id: caller.agency_id,
        agent_id: caller.id,
        title: '⚠️ Ασυνήθιστη δραστηριότητα σε GPI credentials',
        content: `${caller.full_name || caller.email} ξεπέρασε το όριο αποκάλυψης taxisnet credentials (${HOURLY_REVEAL_CAP}/ώρα). Ελέγξτε το gpi_credential_access_log.`,
        is_system: true,
      })
    }
    return NextResponse.json({ error: 'Too many credential reveals — try again later' }, { status: 429 })
  }

  await db.from('gpi_credential_access_log').insert({
    agency_id: caller.agency_id, client_id: params.id, accessed_by: caller.id,
  })

  return NextResponse.json(decryptGpiCredentials(client as GpiClientRow))
}
