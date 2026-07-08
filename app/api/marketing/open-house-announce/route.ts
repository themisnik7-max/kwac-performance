import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthedAgent } from '@/lib/auth'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// Called from MarketingKitPanel's "Open House" brochure action — generating
// the brochure is also what schedules the event and posts it to the Board's
// Ανακοινώσεις tab with a 2-slot volunteer signup (/api/open-house-volunteers
// already enforces the 2-agent cap; this route just creates the two linked
// rows). Always created as the caller themselves — unlike open-house-quick,
// there's no on-behalf-of case here, an agent is always generating their own
// property's brochure.
export async function POST(req: NextRequest) {
  const caller = await getAuthedAgent(req)
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { address, area, ilist_code, property_type, sqm, price, date, start_time, end_time } = await req.json()
  if (!address || !date) return NextResponse.json({ error: 'address, date required' }, { status: 400 })

  const { data: openHouse, error: ohErr } = await sb.from('open_houses').insert({
    agent_id: caller.id, agency_id: caller.agency_id,
    address, area: area || null, ilist_code: ilist_code || null, property_type: property_type || null,
    sqm: sqm || null, price: price || null, date,
    start_time: start_time || '11:00', end_time: end_time || '13:00',
  }).select('id').single()
  if (ohErr) return NextResponse.json({ error: ohErr.message }, { status: 500 })

  const dateLabel = new Date(date).toLocaleDateString('el-GR', { weekday: 'long', day: 'numeric', month: 'long' })
  const { data: announcement, error: annErr } = await sb.from('announcements').insert({
    agent_id: caller.id, agency_id: caller.agency_id, open_house_id: openHouse.id,
    title: `📣 Open House: ${address}`,
    content: `${dateLabel}, ${start_time || '11:00'}–${end_time || '13:00'}. Χρειάζονται έως 2 εθελοντές για βοήθεια — δήλωσε συμμετοχή παρακάτω.`,
    is_system: false,
  }).select('id').single()
  if (annErr) return NextResponse.json({ error: annErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, open_house_id: openHouse.id, announcement_id: announcement.id })
}
