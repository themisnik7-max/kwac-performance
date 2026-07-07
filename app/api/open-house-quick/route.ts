// app/api/open-house-quick/route.ts
// 1-click OpenHouse creation from Dashboard — writes directly to open_houses table

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthedAgent, canActAs } from '@/lib/auth'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const caller = await getAuthedAgent(req)
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { property_id, agent_id, date, start_time, end_time } = await req.json()
  if (!property_id || !agent_id || !date) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }
  if (!(await canActAs(caller, agent_id))) {
    return NextResponse.json({ error: 'Δεν μπορείς να δημιουργήσεις open house για άλλον μεσίτη' }, { status: 403 })
  }

  const { data: prop } = await sb
    .from('properties')
    .select('address, area, sqm, price_asking, ilist_id, agency_id')
    .eq('id', property_id)
    .single()

  if (!prop || prop.agency_id !== caller.agency_id) {
    return NextResponse.json({ error: 'Property not found' }, { status: 404 })
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
    agency_id:  caller.agency_id,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, open_house: data })
}
