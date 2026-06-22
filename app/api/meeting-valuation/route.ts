import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthedAgent } from '@/lib/auth'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

function timeWeight(d: string) {
  const m = (Date.now() - new Date(d).getTime()) / (1000*60*60*24*30)
  return m<=3?1.0:m<=6?0.85:m<=12?0.70:m<=24?0.50:0.30
}

// This is the one canonical Εκτιμητής for Meeting Ακινήτων — comp-based,
// weighted by recency, with real "top producers in this area" pulled from
// actual sales. (valuation-v2 and lib/valuation-engine.js were unused
// duplicates with schema drift — removed rather than merged.)
export async function POST(req: NextRequest) {
  const caller = await getAuthedAgent(req)
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { property_id } = await req.json()
  const { data: prop } = await sb.from('meeting_properties').select('*').eq('id', property_id).eq('agency_id', caller.agency_id).single()
  if (!prop) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: comps } = await sb.from('properties')
    .select('area,price,sqm,year_built,property_type,created_at,agent_name')
    .eq('deal_type','sale').eq('area',prop.area).eq('agency_id', caller.agency_id)
    .not('price','is',null).not('sqm','is',null)
    .order('created_at',{ascending:false}).limit(20)

  const { data: allSales } = await sb.from('properties')
    .select('agent_name,agent_email,area,price,created_at')
    .eq('area',prop.area).eq('deal_type','sale').eq('agency_id', caller.agency_id)
    .gte('created_at',new Date(Date.now()-365*24*60*60*1000).toISOString())
    .not('agent_name','is',null)

  const agentMap: Record<string,{name:string,email:string,count:number,prices:number[]}> = {}
  allSales?.forEach(s => {
    if (!s.agent_name) return
    if (!agentMap[s.agent_name]) agentMap[s.agent_name]={name:s.agent_name,email:s.agent_email||'',count:0,prices:[]}
    agentMap[s.agent_name].count++
    if(s.price) agentMap[s.agent_name].prices.push(s.price)
  })
  const top3 = Object.values(agentMap).sort((a,b)=>b.count-a.count).slice(0,3)
    .map(a=>({...a,avg_price:a.prices.length?Math.round(a.prices.reduce((s,p)=>s+p,0)/a.prices.length):0}))

  const wComps = (comps||[]).map(c=>({...c,w:timeWeight(c.created_at),ppsqm:c.sqm?Math.round(c.price/c.sqm):0})).filter(c=>c.ppsqm>0)
  const totalW = wComps.reduce((s,c)=>s+c.w,0)
  const avgPpsqm = totalW>0 ? wComps.reduce((s,c)=>s+(c.ppsqm*c.w),0)/totalW : 0

  let recommended = avgPpsqm * (prop.sqm||0)
  if (prop.year_built && prop.year_built < 1990) recommended *= 0.92
  if (prop.condition === 'excellent') recommended *= 1.05
  if (prop.condition === 'needs_work') recommended *= 0.88
  const min = Math.round(recommended * 0.90 / 1000) * 1000
  const max = Math.round(recommended * 1.10 / 1000) * 1000
  recommended = Math.round(recommended / 1000) * 1000
  const conf = wComps.length >= 5 ? 0.80 : wComps.length >= 3 ? 0.65 : wComps.length >= 1 ? 0.50 : 0.30

  const ppsqm = prop.sqm ? Math.round(recommended/prop.sqm) : 0
  const reasoning = wComps.length > 0
    ? `Βασιστηκε σε ${wComps.length} συγκρισιμες πωλησεις στην περιοχη ${prop.area} με μεσο βαρισμενο ${Math.round(avgPpsqm).toLocaleString('el-GR')} ευρω/τμ. ${prop.year_built&&prop.year_built<1990?'Εχει εφαρμοστει εκπτωση 8% λογω παλαιοτητας. ':''}Εκτιμωμενη αξια €${recommended.toLocaleString('el-GR')} (±10%). Εμπιστοσυνη ${Math.round(conf*100)}%.`
    : `Δεν υπαρχουν αρκετα συγκρισιμα στοιχεια για ${prop.area}. Η εκτιμηση ειναι ενδεικτικη.`

  await sb.from('meeting_valuations').upsert({
    property_id, agency_id: caller.agency_id, ai_min:min, ai_max:max, ai_recommended:recommended,
    ai_price_per_sqm:ppsqm, ai_reasoning:reasoning,
    comparables:wComps.slice(0,5), top_producers:top3,
    confidence_score:conf, updated_at:new Date().toISOString()
  },{onConflict:'property_id'})
  await sb.from('meeting_properties').update({status:'estimated'}).eq('id',property_id)

  return NextResponse.json({success:true,valuation:{min,max,recommended,price_per_sqm:ppsqm,confidence:conf,reasoning},top_producers:top3,comparables:wComps.slice(0,5)})
}
