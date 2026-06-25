import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthedAgent } from '@/lib/auth'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const LAMBDA = Math.LN2 / 6
function timeWeight(dateStr: string): number {
  const months = (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24 * 30)
  return Math.exp(-LAMBDA * months)
}

function filterOutliers<T extends { ppsqm: number }>(items: T[]): T[] {
  if (items.length < 4) return items
  const sorted = [...items].sort((a, b) => a.ppsqm - b.ppsqm)
  const q1 = sorted[Math.floor(sorted.length * 0.25)].ppsqm
  const q3 = sorted[Math.floor(sorted.length * 0.75)].ppsqm
  const iqr = q3 - q1
  return items.filter(c => c.ppsqm >= q1 - 1.5 * iqr && c.ppsqm <= q3 + 1.5 * iqr)
}

function floorMultiplier(floor: string | null | undefined): number {
  if (!floor) return 1.0
  const f = parseInt(floor)
  if (isNaN(f)) return 1.0
  if (f === 0) return 0.95
  return Math.min(1.0 + (f - 1) * 0.02, 1.12)
}

function conditionMultiplier(condition: string | null | undefined): number {
  switch (condition) {
    case 'excellent':  return 1.07
    case 'good':       return 1.00
    case 'fair':       return 0.94
    case 'needs_work': return 0.87
    default:           return 1.00
  }
}

function ageMultiplier(yearBuilt: number | null | undefined): number {
  if (!yearBuilt) return 1.0
  const age = new Date().getFullYear() - yearBuilt
  if (age <= 5)  return 1.05
  if (age <= 15) return 1.00
  if (age <= 30) return 0.95
  if (age <= 45) return 0.91
  return 0.87
}

function confidenceScore(comps: { ppsqm: number; w: number }[], mean: number): number {
  if (comps.length === 0) return 0.25
  const variance = comps.reduce((s, c) => s + Math.pow(c.ppsqm - mean, 2) * c.w, 0) /
                   comps.reduce((s, c) => s + c.w, 0)
  const cv = Math.sqrt(variance) / mean
  const sizeScore = comps.length >= 8 ? 1.0 : comps.length >= 5 ? 0.85 : comps.length >= 3 ? 0.70 : 0.55
  const varScore  = cv < 0.10 ? 1.0 : cv < 0.20 ? 0.85 : cv < 0.35 ? 0.65 : 0.45
  return Math.round(sizeScore * varScore * 100) / 100
}

export async function POST(req: NextRequest) {
  const caller = await getAuthedAgent(req)
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { property_id } = await req.json()
  const { data: prop } = await sb
    .from('meeting_properties').select('*').eq('id', property_id).eq('agency_id', caller.agency_id).single()
  if (!prop) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: rawComps } = await sb
    .from('properties')
    .select('area, price, sqm, year_built, floor, condition, property_type, created_at, agent_name')
    .eq('deal_type', 'sale').eq('area', prop.area).eq('agency_id', caller.agency_id)
    .not('price', 'is', null).not('sqm', 'is', null).gt('sqm', 0).gt('price', 0)
    .gte('created_at', new Date(Date.now() - 3 * 365 * 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false }).limit(30)

  const enriched = (rawComps || []).map(c => ({ ...c, w: timeWeight(c.created_at), ppsqm: Math.round(c.price / c.sqm) }))
    .filter(c => c.ppsqm > 500 && c.ppsqm < 50000)

  const comps = filterOutliers(enriched)
  const outlierCount = enriched.length - comps.length

  const totalW = comps.reduce((s, c) => s + c.w, 0)
  const avgPpsqm = totalW > 0 ? comps.reduce((s, c) => s + c.ppsqm * c.w, 0) / totalW : 0

  const floorMult = floorMultiplier(prop.floor)
  const condMult  = conditionMultiplier(prop.condition)
  const ageMult   = ageMultiplier(prop.year_built)

  let recommended = avgPpsqm * (prop.sqm || 0) * floorMult * condMult * ageMult
  const conf = confidenceScore(comps, avgPpsqm)

  const min   = Math.round(recommended * 0.90 / 1000) * 1000
  const max   = Math.round(recommended * 1.10 / 1000) * 1000
  recommended = Math.round(recommended / 1000) * 1000
  const ppsqm = prop.sqm ? Math.round(recommended / prop.sqm) : 0

  const { data: feedbackRows } = await sb
    .from('meeting_comments').select('agent_id, agent_estimate, agrees_with_ai, feedback_weight')
    .eq('property_id', property_id).not('agent_estimate', 'is', null)

  const { data: topProducers } = await sb.rpc('top_producers_by_area', { p_area: prop.area })

  const producerWeightMap: Record<string, number> = {}
  topProducers?.forEach((tp: any, i: number) => {
    if (tp.agent_id) producerWeightMap[tp.agent_id] = i === 0 ? 1.5 : i === 1 ? 1.25 : 1.0
  })

  let blended = recommended
  let blendedConf = conf
  const validFeedback = (feedbackRows || []).filter(f => f.agent_estimate > 0)

  if (validFeedback.length >= 2) {
    const feedbackWithWeights = validFeedback.map(f => ({ estimate: f.agent_estimate, weight: producerWeightMap[f.agent_id] ?? (f.feedback_weight || 0.8) }))
    const totalFW = feedbackWithWeights.reduce((s, f) => s + f.weight, 0)
    const agentConsensus = feedbackWithWeights.reduce((s, f) => s + f.estimate * f.weight, 0) / totalFW
    blended = Math.round((recommended * 0.60 + agentConsensus * 0.40) / 1000) * 1000
    blendedConf = Math.min(conf + 0.05 * Math.min(validFeedback.length, 3), 0.95)
  }

  const adjustments: string[] = []
  if (floorMult !== 1.0) adjustments.push(`ορόφου (×${floorMult.toFixed(2)})`)
  if (condMult  !== 1.0) adjustments.push(`κατάστασης (×${condMult.toFixed(2)})`)
  if (ageMult   !== 1.0) adjustments.push(`παλαιότητας (×${ageMult.toFixed(2)})`)

  const reasoning = comps.length > 0
    ? [`Βάση: ${comps.length} συγκρίσιμες πωλήσεις στην περιοχή ${prop.area}`,
       `(${outlierCount > 0 ? outlierCount + ' ακραίες τιμές αφαιρέθηκαν, ' : ''}μεσ. σταθμισμένο ${Math.round(avgPpsqm).toLocaleString('el-GR')} €/τ.μ.).`,
       adjustments.length > 0 ? `Εφαρμόστηκαν διορθώσεις ${adjustments.join(', ')}.` : '',
       validFeedback.length >= 2 ? `Συνεκτιμήθηκαν εκτιμήσεις ${validFeedback.length} παραγωγών (40% βάρος).` : '',
       `Εμπιστοσύνη: ${Math.round(blendedConf * 100)}%.`,
      ].filter(Boolean).join(' ')
    : `Ανεπαρκή συγκρίσιμα στοιχεία για ${prop.area}. Η εκτίμηση είναι ενδεικτική.`

  await sb.from('meeting_valuations').upsert({
    property_id, agency_id: caller.agency_id,
    ai_min: min, ai_max: max, ai_recommended: recommended, ai_price_per_sqm: ppsqm,
    ai_reasoning: reasoning, comparables: comps.slice(0, 5), top_producers: topProducers?.slice(0, 3) || [],
    confidence_score: conf, blended_recommended: blended, blended_confidence: blendedConf,
    feedback_count: validFeedback.length, last_feedback_sync: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'property_id' })

  if (validFeedback.length > 0) {
    await sb.from('meeting_comments').update({ feedback_processed: true })
      .eq('property_id', property_id).not('agent_estimate', 'is', null)
  }

  await sb.from('meeting_properties').update({ status: 'estimated' }).eq('id', property_id)

  return NextResponse.json({
    success: true,
    valuation: { min, max, recommended, blended_recommended: blended, price_per_sqm: ppsqm, confidence: blendedConf, reasoning, outliers_removed: outlierCount, feedback_incorporated: validFeedback.length },
    top_producers: topProducers?.slice(0, 3) || [],
    comparables: comps.slice(0, 5),
  })
}