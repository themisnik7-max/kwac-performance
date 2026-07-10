import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthedAgent } from '@/lib/auth'
import { canAccessGpiClient, buildAgreementData, type GpiClientRow, type GpiUnitRow } from '@/lib/gpi'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// GET — the agent's own authenticated preview of the filled agreement for one unit.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const caller = await getAuthedAgent(req)
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: unit } = await db.from('gpi_units').select('*').eq('id', params.id).single()
  if (!unit) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: client } = await db.from('gpi_clients').select('*').eq('id', unit.client_id).single()
  if (!client || !canAccessGpiClient(caller, client as GpiClientRow)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let agentFullName: string | null = null
  if (client.agent_id) {
    const { data: agent } = await db.from('agents').select('full_name').eq('id', client.agent_id).single()
    agentFullName = agent?.full_name || null
  }

  return NextResponse.json({ data: buildAgreementData(client as GpiClientRow, unit as GpiUnitRow, agentFullName) })
}
