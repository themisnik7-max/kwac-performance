import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthedAgent } from '@/lib/auth'
import { canAccessGpiClient, type GpiClientRow } from '@/lib/gpi'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export const UNIT_FIELDS = [
  'sqm', 'floor', 'project', 'address', 'unit_name', 'expected_rent',
  'brochure_sent', 'exclusive_agreement_sent', 'exclusive_agreement_date', 'rented',
  'energy_certificate', 'advertisement', 'ad_link', 'project_delivered', 'keys_received',
] as const

// POST — create a unit under an existing GPI client.
export async function POST(req: NextRequest) {
  const caller = await getAuthedAgent(req)
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  if (!body.client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })

  const { data: client } = await db.from('gpi_clients').select('*').eq('id', body.client_id).single()
  if (!client || !canAccessGpiClient(caller, client as GpiClientRow)) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const insert: Record<string, unknown> = { agency_id: client.agency_id, agent_id: client.agent_id, client_id: client.id }
  for (const f of UNIT_FIELDS) if (body[f] !== undefined) insert[f] = body[f]

  const { data, error } = await db.from('gpi_units').insert(insert).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ unit: data })
}
