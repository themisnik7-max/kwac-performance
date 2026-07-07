import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthedAgent, isCeoOrAdmin } from '@/lib/auth'
import { estimatePpsqm, floorMultiplier, conditionMultiplier, ageMultiplier, confidenceScore, estimateSaleProbability } from '@/lib/valuation'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Only admin/CEO trigger a valuation — this is what sets "the price" for a
// property in Meeting Ακινήτων, and that's explicitly an admin-only action.
export async function POST(req: NextRequest) {
  const caller = await getAuthedAgent(req)
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (!isCeoOrAdmin(caller)) return NextResponse.json({ error: 'Μόνο Admin/CEO μπορεί να εκτελέσει εκτίμηση' }, { status: 403 })

  const { property_id } = await req.json()
  const { data: prop } = await sb
    .from('meeting_properties').select('*').eq('id', property_id).eq('agency_id', caller.agency_id).single()
  if (!prop) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // properties.price doesn't exist on the live schema (price_asking/
  // price_final do) — this query previously errored on every call, silently
  // returning zero comps for every valuation ever run. price_final (actual
  // closed price) is preferred when the deal is done; price_asking covers
  // still-active listings so the comp pool isn't limited to closed sales only.
  const { data: rawPropsComps } = await sb
    .from('properties')
    .select('area, price_asking, price_final, sqm, year_built, floor, condition, property_type, created_at, agent_name')
    .eq('deal_type', 'sale').eq('area', prop.area).eq('agency_id', caller.agency_id)
    .not('sqm', 'is', null).gt('sqm', 0)
    .gte('created_at', new Date(Date.now() - 3 * 365 * 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false }).limit(30)

  const rawComps = (rawPropsComps || [])
    .map(c => ({ ...c, price: c.price_final ?? c.price_asking }))
    .filter(c => (c.price ?? 0) > 0)

  const { comps, outlierCount, avgPpsqm, hasComps } = estimatePpsqm(rawComps)

  const floorMult = floorMultiplier(prop.floor)
  const condMult  = conditionMultiplier(prop.condition)
  const ageMult   = ageMultiplier(prop.year_built)

  // No comps means no comp-based estimate — null, not 0, so it can never be
  // silently blended in as "the comps say ~€0" (see blending below) and never
  // gets averaged into future analytics as a real zero-priced valuation.
  let recommended: number | null = hasComps ? avgPpsqm * (prop.sqm || 0) * floorMult * condMult * ageMult : null
  const conf = confidenceScore(comps, avgPpsqm)

  const min   = recommended != null ? Math.round(recommended * 0.90 / 1000) * 1000 : null
  const max   = recommended != null ? Math.round(recommended * 1.10 / 1000) * 1000 : null
  recommended = recommended != null ? Math.round(recommended / 1000) * 1000 : null
  const ppsqm = recommended != null && prop.sqm ? Math.round(recommended / prop.sqm) : null

  // Probability of selling within 6 months at the recommended price, from
  // historical closed sales in the area — an empirical frequency table (see
  // lib/valuation.ts), not a fitted model. Reports "insufficient data"
  // honestly rather than a confident-looking number when the closed-sale
  // sample is too thin, which it currently is agency-wide (see CLAUDE.md:
  // validate against a holdout set, no black box).
  const { data: closedComps } = await sb
    .from('properties')
    .select('address, area, sqm, price_asking, price_final, days_on_market, condition, listed_at')
    .eq('deal_type', 'sale').eq('area', prop.area).eq('agency_id', caller.agency_id).eq('status', 'sold')
    .not('price_final', 'is', null).not('days_on_market', 'is', null)

  const saleProbability = estimateSaleProbability(ppsqm ?? avgPpsqm, closedComps || [])

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
  let agentConsensus: number | null = null
  let blendCompWeight: number | null = null
  let blendFeedbackWeight: number | null = null
  const validFeedback = (feedbackRows || []).filter(f => f.agent_estimate > 0)

  if (validFeedback.length >= 2) {
    const feedbackWithWeights = validFeedback.map(f => ({ estimate: f.agent_estimate, weight: producerWeightMap[f.agent_id] ?? (f.feedback_weight || 0.8) }))
    const totalFW = feedbackWithWeights.reduce((s, f) => s + f.weight, 0)
    agentConsensus = feedbackWithWeights.reduce((s, f) => s + f.estimate * f.weight, 0) / totalFW
    // No comp basis (recommended === null) => go with agent consensus alone,
    // don't blend it against a comp estimate that doesn't exist.
    if (recommended != null) {
      blendCompWeight = 0.60
      blendFeedbackWeight = 0.40
      blended = Math.round((recommended * blendCompWeight + agentConsensus * blendFeedbackWeight) / 1000) * 1000
    } else {
      blended = Math.round(agentConsensus / 1000) * 1000
    }
    blendedConf = Math.min(conf + 0.05 * Math.min(validFeedback.length, 3), 0.95)
  }

  const adjustments: string[] = []
  if (floorMult !== 1.0) adjustments.push(`ορόφου (×${floorMult.toFixed(2)})`)
  if (condMult  !== 1.0) adjustments.push(`κατάστασης (×${condMult.toFixed(2)})`)
  if (ageMult   !== 1.0) adjustments.push(`παλαιότητας (×${ageMult.toFixed(2)})`)

  // Cite the top comp by name when we actually have one on file — never
  // fabricate a name; owner_name is null on almost every historical comp
  // today, so this usually falls back to address-only.
  const topCompSentence = saleProbability.top_comp
    ? (() => {
        const c = saleProbability.top_comp!
        const where = c.address || c.area
        const cond = c.condition ? ` (${c.condition === 'excellent' ? 'άριστη κατάσταση' : c.condition === 'good' ? 'καλή κατάσταση' : c.condition})` : ''
        return `Κορυφαίο δεδομένο: πώληση στην ${where}${cond}, ${c.sqm}τ.μ., σε ${c.days_on_market} ημέρες.`
      })()
    : ''

  const probabilitySentence = saleProbability.probability != null
    ? `Πιθανότητα πώλησης εντός 6 μηνών σε αυτή την τιμή: ${Math.round(saleProbability.probability * 100)}% (${saleProbability.note}).`
    : `Πιθανότητα πώλησης: ${saleProbability.note}`

  const reasoning = comps.length > 0
    ? [`Βάση: ${comps.length} συγκρίσιμες πωλήσεις στην περιοχή ${prop.area}`,
       `(${outlierCount > 0 ? outlierCount + ' ακραίες τιμές αφαιρέθηκαν, ' : ''}μεσ. σταθμισμένο ${Math.round(avgPpsqm).toLocaleString('el-GR')} €/τ.μ.).`,
       adjustments.length > 0 ? `Εφαρμόστηκαν διορθώσεις ${adjustments.join(', ')}.` : '',
       validFeedback.length >= 2 ? `Συνεκτιμήθηκαν εκτιμήσεις ${validFeedback.length} παραγωγών (40% βάρος).` : '',
       `Εμπιστοσύνη: ${Math.round(blendedConf * 100)}%.`,
       topCompSentence, probabilitySentence,
      ].filter(Boolean).join(' ')
    : `Ανεπαρκή συγκρίσιμα στοιχεία για ${prop.area}. Η εκτίμηση είναι ενδεικτική. ${topCompSentence} ${probabilitySentence}`.trim()

  await sb.from('meeting_valuations').upsert({
    property_id, agency_id: caller.agency_id,
    ai_min: min, ai_max: max, ai_recommended: recommended, ai_price_per_sqm: ppsqm,
    ai_reasoning: reasoning, comparables: comps.slice(0, 5), top_producers: topProducers?.slice(0, 3) || [],
    confidence_score: conf, blended_recommended: blended, blended_confidence: blendedConf,
    feedback_count: validFeedback.length, last_feedback_sync: new Date().toISOString(),
    sale_probability: saleProbability.probability, sale_probability_sample_size: saleProbability.sample_size,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'property_id' })

  // Append-only audit trail — every blend gets a row, so weight/output history
  // is visible even though the upsert above overwrites the live valuation.
  const { error: logErr } = await sb.from('valuation_calibration_log').insert({
    agency_id: caller.agency_id, property_id,
    comp_recommended: recommended, comp_confidence: conf, comp_count: comps.length,
    agent_consensus: agentConsensus, feedback_count: validFeedback.length,
    blend_comp_weight: blendCompWeight, blend_feedback_weight: blendFeedbackWeight,
    producer_weight_map: producerWeightMap,
    blended_recommended: blended, blended_confidence: blendedConf,
  })
  if (logErr) console.error('[meeting-valuation] calibration log insert failed (non-fatal)', logErr)

  if (validFeedback.length > 0) {
    await sb.from('meeting_comments').update({ feedback_processed: true })
      .eq('property_id', property_id).not('agent_estimate', 'is', null)
  }

  await sb.from('meeting_properties').update({ status: 'estimated' }).eq('id', property_id)

  return NextResponse.json({
    success: true,
    valuation: {
      min, max, recommended, blended_recommended: blended, price_per_sqm: ppsqm, confidence: blendedConf, reasoning,
      outliers_removed: outlierCount, feedback_incorporated: validFeedback.length,
      sale_probability: saleProbability.probability, sale_probability_sample_size: saleProbability.sample_size,
    },
    top_producers: topProducers?.slice(0, 3) || [],
    comparables: comps.slice(0, 5),
  })
}