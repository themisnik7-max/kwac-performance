import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthedAgent, canActAs } from '@/lib/auth'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const caller = await getAuthedAgent(req)
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const agent_id = req.nextUrl.searchParams.get('agent_id')
  if (!agent_id || !(await canActAs(caller, agent_id))) {
    return NextResponse.json({ error: 'Δεν μπορείς να δεις τους στόχους άλλου μεσίτη' }, { status: 403 })
  }

  const { data: goal } = await supabase.from('gps_goals').select('*').eq('agent_id', agent_id).eq('agency_id', caller.agency_id).single()

  // Get real conversion rates from the last 12 weeks of submissions. Was
  // reading week_start/follow_up_calls/first_appointments/second_appointments/
  // listings_taken/contracts_signed — none of those columns exist on
  // weekly_submissions (see app/submit/page.jsx for the real field names),
  // so this query errored on the nonexistent week_start filter and realRates
  // was silently always null. submitted_at is the closest real timestamp to
  // range against; week_number/year aren't dates so can't be range-filtered directly.
  const twelveWeeksAgo = new Date()
  twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84)
  const { data: submissions } = await supabase
    .from('weekly_submissions')
    .select('*')
    .eq('agent_id', agent_id)
    .eq('agency_id', caller.agency_id)
    .gte('submitted_at', twelveWeeksAgo.toISOString())
    .order('submitted_at', { ascending: false })

  let realRates = null
  if (submissions && submissions.length > 0) {
    const totCalls = submissions.reduce((s,r) => s + (r.cold_calls||0) + (r.follow_up||0), 0)
    const totAppt1 = submissions.reduce((s,r) => s + (r.meet1_seller_live||0) + (r.meet1_seller_phone||0) + (r.meet1_buyer_live||0) + (r.meet1_buyer_phone||0) + (r.meet1_tenant_live||0) + (r.meet1_tenant_phone||0), 0)
    const totAppt2 = submissions.reduce((s,r) => s + (r.meet2_seller||0), 0)
    const totList  = submissions.reduce((s,r) => s + (r.excl_listing_sale||0) + (r.simple_listing_sale||0) + (r.excl_rental_high||0) + (r.excl_rental_low||0) + (r.simple_rental||0), 0)
    const totDeals = submissions.reduce((s,r) => s + (r.contract_seller||0) + (r.contract_buyer||0), 0)
    // Clamped to [1,95] — sparse weekly data can produce a stage-to-stage
    // ratio over 100% (e.g. a mandate logged the same week as a 2nd
    // appointment from a different, earlier deal); uncapped it both misreads
    // as a bug and breaks the GPS page's sliders (max 90).
    const rate = (num: number, den: number) => den > 0 ? Math.max(1, Math.min(95, Math.round((num / den) * 100))) : null
    realRates = {
      cr_call_appt1: rate(totAppt1, totCalls),
      cr_appt1_appt2: rate(totAppt2, totAppt1),
      cr_appt2_listing: rate(totList, totAppt2),
      cr_listing_deal: rate(totDeals, totList),
      weeks_of_data: submissions.length
    }
  }

  return NextResponse.json({ goal, realRates })
}

export async function POST(req: NextRequest) {
  const caller = await getAuthedAgent(req)
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await req.json()
  const { agent_id, ...rest } = body

  if (!(await canActAs(caller, agent_id))) {
    return NextResponse.json({ error: 'Δεν μπορείς να ορίσεις στόχους για άλλον μεσίτη' }, { status: 403 })
  }

  const { data, error } = await supabase.from('gps_goals').upsert(
    { agent_id, agency_id: caller.agency_id, ...rest, updated_at: new Date().toISOString() },
    { onConflict: 'agent_id' }
  ).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
