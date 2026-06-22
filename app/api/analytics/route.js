import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getAuthedAgent, isCeoOrAdmin } from '@/lib/auth'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Was using the anon key with no user session attached at all — under RLS
// that resolves to "no agency", so this route was actually broken (would
// return empty data) the moment the multi-tenancy RLS went in. Also: per
// PRODUCT_SPEC.md, aggregate analytics across all agents is CEO/Admin only —
// that wasn't enforced here before either.
export async function GET(req) {
  const caller = await getAuthedAgent(req)
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (!isCeoOrAdmin(caller)) return NextResponse.json({ error: 'Μόνο CEO/Admin βλέπουν συγκεντρωτικά analytics' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') || 'summary'

  if(type === 'export') {
    const { data } = await supabase
      .from('weekly_submissions')
      .select('*, agents(full_name, email, team)')
      .eq('agency_id', caller.agency_id)
      .order('year', {ascending:true})
      .order('week_number', {ascending:true})

    if(!data) return NextResponse.json({error:'No data'}, {status:400})

    const headers = ['Έτος','Εβδομάδα','Όνομα','Email','Team','Cold Calls','Follow Up','1ο Ραντεβού (ζωντανά)','1ο Ραντεβού (τηλεφ.)','2ο Ραντεβού','Αποκλ. Ανάθεση','Απλή Ανάθεση','Συμβόλαιο Πωλητή','Συμβόλαιο Αγοραστή','XP']
    const rows = data.map(r => [
      r.year, r.week_number,
      r.agents?.full_name||'', r.agents?.email||'', r.agents?.team||'',
      r.cold_calls||0, r.follow_up||0,
      r.meet1_seller_live||0, r.meet1_seller_phone||0, r.meet2_seller||0,
      r.excl_listing_sale||0, r.simple_listing_sale||0,
      r.contract_seller||0, r.contract_buyer||0, r.xp_earned||0
    ])

    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    return new Response(csv, {headers:{'Content-Type':'text/csv','Content-Disposition':'attachment; filename=kwac_data.csv'}})
  }

  if(type === 'summary') {
    const { data } = await supabase
      .from('weekly_submissions')
      .select('week_number, year, cold_calls, follow_up, meet1_seller_live, meet2_seller, excl_listing_sale, contract_seller, xp_earned, agent_id')
      .eq('agency_id', caller.agency_id)
      .order('year', {ascending:false})
      .order('week_number', {ascending:false})
      .limit(600) // 50 agents × 12 weeks

    if(!data) return NextResponse.json({summary:[]})

    const byWeek = {}
    data.forEach(r => {
      const key = r.year+'-W'+r.week_number
      if(!byWeek[key]) byWeek[key] = {week:r.week_number,year:r.year,agents:0,calls:0,follow_up:0,meet1:0,meet2:0,excl:0,contracts:0,xp:0}
      byWeek[key].agents++
      byWeek[key].calls += r.cold_calls||0
      byWeek[key].follow_up += r.follow_up||0
      byWeek[key].meet1 += r.meet1_seller_live||0
      byWeek[key].meet2 += r.meet2_seller||0
      byWeek[key].excl += r.excl_listing_sale||0
      byWeek[key].contracts += r.contract_seller||0
      byWeek[key].xp += r.xp_earned||0
    })

    return NextResponse.json({summary: Object.values(byWeek).slice(0,12)})
  }

  if(type === 'agents') {
    const { data } = await supabase
      .from('weekly_submissions')
      .select('agent_id, cold_calls, follow_up, meet1_seller_live, meet2_seller, excl_listing_sale, contract_seller, xp_earned, week_number, year, agents(full_name, team)')
      .eq('agency_id', caller.agency_id)
      .order('year', {ascending:false})
      .order('week_number', {ascending:false})
      .limit(1000)

    if(!data) return NextResponse.json({agents:[]})

    const byAgent = {}
    data.forEach(r => {
      const id = r.agent_id
      if(!byAgent[id]) byAgent[id] = {id,name:r.agents?.full_name||id,team:r.agents?.team||'',weeks:0,calls:0,meet1:0,meet2:0,excl:0,contracts:0,xp:0,conversion:[]}
      byAgent[id].weeks++
      byAgent[id].calls += r.cold_calls||0
      byAgent[id].meet1 += r.meet1_seller_live||0
      byAgent[id].meet2 += r.meet2_seller||0
      byAgent[id].excl += r.excl_listing_sale||0
      byAgent[id].contracts += r.contract_seller||0
      byAgent[id].xp += r.xp_earned||0
      if(r.meet1_seller_live > 0) byAgent[id].conversion.push(r.meet2_seller/r.meet1_seller_live)
    })

    Object.values(byAgent).forEach(a => {
      a.avg_calls = a.weeks ? Math.round(a.calls/a.weeks) : 0
      a.conversion_rate = a.conversion.length ? Math.round(a.conversion.reduce((s,v)=>s+v,0)/a.conversion.length*100) : 0
    })

    return NextResponse.json({agents: Object.values(byAgent)})
  }

  return NextResponse.json({error:'Unknown type'})
}
