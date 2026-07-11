import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { buildAgreementData, type GpiClientRow, type GpiUnitRow } from '@/lib/gpi'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// Never cache this response. The unused `_req` param meant nothing here
// forced Next's dynamic-rendering opt-in automatically, and this document
// carries TIN/National ID plus a real expiry check that must re-run on
// every request, not be served from a stale cached response.
export const dynamic = 'force-dynamic'

// GET — public, no auth. The recipient (an external landlord) has no login;
// the unguessable token itself is the access control, not a session. Only
// ever reads gpi_agreement_shares by exact token match — never lists them,
// never accepts a client/unit id directly.
export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const { data: share } = await db.from('gpi_agreement_shares').select('*').eq('token', params.token).single()
  if (!share) return NextResponse.json({ error: 'Δεν βρέθηκε' }, { status: 404 })
  if (share.expires_at && new Date(share.expires_at) < new Date())
    return NextResponse.json({ error: 'Ο σύνδεσμος έχει λήξει' }, { status: 410 })

  const { data: unit } = await db.from('gpi_units').select('*').eq('id', share.unit_id).single()
  if (!unit) return NextResponse.json({ error: 'Δεν βρέθηκε' }, { status: 404 })
  const { data: client } = await db.from('gpi_clients').select('*').eq('id', unit.client_id).single()
  if (!client) return NextResponse.json({ error: 'Δεν βρέθηκε' }, { status: 404 })

  let agentFullName: string | null = null
  if (client.agent_id) {
    const { data: agent } = await db.from('agents').select('full_name').eq('id', client.agent_id).single()
    agentFullName = agent?.full_name || null
  }

  if (!share.viewed_at) await db.from('gpi_agreement_shares').update({ viewed_at: new Date().toISOString() }).eq('id', share.id)

  return NextResponse.json({ data: buildAgreementData(client as GpiClientRow, unit as GpiUnitRow, agentFullName) })
}
