// app/api/open-house-quick/route.ts
// 1-click OpenHouse creation from Dashboard — writes directly to open_houses table

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const { property_id, agent_id, date, start_time, end_time } = await req.json()
  if (!property_id || !agent_id || !date) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const [{ data: prop }, { data: agent }] = await Promise.all([
    sb.from('properties').select('address, area, sqm, price_asking, ilist_id').eq('id', property_id).single(),
    sb.from('agents').select('agency_id, full_name').eq('id', agent_id).single(),
  ])

  if (!prop || !agent) {
    return NextResponse.json({ error: 'Property or agent not found' }, { status: 404 })
  }

  const { data, error } = await sb.from('open_houses').insert({
    address:    prop.address || prop.area || 'Ακίνητο',
    date,
    start_time: start_time || '11:00',
    end_time:   end_time   || '13:00',
    agent_id,
    ilist_code: prop.ilist_id || null,
    price:      prop.price_asking || null,
    sqm:        prop.sqm || null,
    agency_id:  agent.agency_id,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, open_house: data })
}
