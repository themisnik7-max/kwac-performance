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

  // Get real conversion rates from last 12 weeks of submissions
  const twelveWeeksAgo = new Date()
  twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84)
  const { data: submissions } = await supabase
    .from('weekly_submissions')
    .select('*')
    .eq('agent_id', agent_id)
    .eq('agency_id', caller.agency_id)
    .gte('week_start', twelveWeeksAgo.toISOString())
    .order('week_start', { ascending: false })

  let realRates = null
  if (submissions && submissions.length > 0) {
    const totCalls = submissions.reduce((s,r) => s + (r.cold_calls||0) + (r.follow_up_calls||0), 0)
    const totAppt1 = submissions.reduce((s,r) => s + (r.first_appointments||0), 0)
    const totAppt2 = submissions.reduce((s,r) => s + (r.second_appointments||0), 0)
    const totList  = submissions.reduce((s,r) => s + (r.listings_taken||0), 0)
    const totDeals = submissions.reduce((s,r) => s + (r.contracts_signed||0), 0)
    realRates = {
      cr_call_appt1: totCalls > 0 ? Math.round((totAppt1/totCalls)*100) : null,
      cr_appt1_appt2: totAppt1 > 0 ? Math.round((totAppt2/totAppt1)*100) : null,
      cr_appt2_listing: totAppt2 > 0 ? Math.round((totList/totAppt2)*100) : null,
      cr_listing_deal: totList > 0 ? Math.round((totDeals/totList)*100) : null,
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
