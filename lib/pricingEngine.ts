import { SupabaseClient } from '@supabase/supabase-js'
import { estimatePpsqm, floorMultiplier, conditionMultiplier, ageMultiplier, confidenceScore, estimateSaleProbability } from './valuation'
import { MiniNet } from './miniNet'
import { buildFeatureVector, FEATURE_NAMES, FEATURE_LABELS_EL } from './pricingFeatures'

export type ValuationResult = {
  success: true
  valuation: {
    min: number | null; max: number | null; recommended: number | null; blended_recommended: number | null
    price_per_sqm: number | null; confidence: number; reasoning: string
    outliers_removed: number; feedback_incorporated: number
    sale_probability: number | null; sale_probability_sample_size: number
    nn_recommended: number | null; nn_weight: number | null; nn_model_holdout_mae_pct: number | null
  }
  top_producers: any[]
  comparables: any[]
} | { success: false; error: string }

// The pricing engine's full computation — comp-based estimate (government
// registry only) + small NN model + top-producer feedback, blended and
// persisted. Factored out of app/api/meeting-valuation's POST handler so it
// has exactly one implementation, callable both from that admin-gated manual
// "re-run" route AND automatically the moment a property enters for_appraisal
// (app/api/meeting-properties/set-status) — no per-caller permission check
// in here, that's the caller's job, since "should this run at all" and "is
// the computation correct" are different concerns.
export async function runValuation(sb: SupabaseClient, propertyId: string, agencyId: string): Promise<ValuationResult> {
  const { data: prop } = await sb
    .from('meeting_properties').select('*').eq('id', propertyId).eq('agency_id', agencyId).single()
  if (!prop) return { success: false, error: 'Not found' }

  // Comp basis is the government registry ONLY (Ministry of Finance "Μητρώο
  // Αξιών Μεταβιβάσεων Ακινήτων") — by explicit product decision, the
  // agency's own `properties` rows (mostly still-active asking prices, not
  // proven sales) no longer feed the price the model recommends. Only real
  // closed transactions (this registry) and top-producer feedback (below)
  // are allowed to move the number. See lib/mamaRegistry.ts.
  const { data: registryRows } = await sb
    .from('market_transactions')
    .select('sqm_main, year_built, floor, contract_date, price')
    .eq('area', prop.area)
    .order('contract_date', { ascending: false }).limit(30)

  const registryComps = (registryRows || []).map(r => ({
    sqm: r.sqm_main, year_built: r.year_built, floor: r.floor,
    condition: null, created_at: r.contract_date, price: r.price,
  }))

  const { comps, outlierCount, avgPpsqm, hasComps } = estimatePpsqm(registryComps)

  const floorMult = floorMultiplier(prop.floor)
  const condMult  = conditionMultiplier(prop.condition)
  const ageMult   = ageMultiplier(prop.year_built)

  let recommended: number | null = hasComps ? avgPpsqm * (prop.sqm || 0) * floorMult * condMult * ageMult : null
  const conf = confidenceScore(comps, avgPpsqm)

  const min   = recommended != null ? Math.round(recommended * 0.90 / 1000) * 1000 : null
  const max   = recommended != null ? Math.round(recommended * 1.10 / 1000) * 1000 : null
  recommended = recommended != null ? Math.round(recommended / 1000) * 1000 : null
  const ppsqm = recommended != null && prop.sqm ? Math.round(recommended / prop.sqm) : null

  const { data: closedComps } = await sb
    .from('properties')
    .select('address, area, sqm, price_asking, price_final, days_on_market, condition, listed_at')
    .eq('deal_type', 'sale').eq('area', prop.area).eq('agency_id', agencyId).eq('status', 'sold')
    .not('price_final', 'is', null).not('days_on_market', 'is', null)

  const saleProbability = estimateSaleProbability(ppsqm ?? avgPpsqm, closedComps || [])

  const { data: feedbackRows } = await sb
    .from('meeting_comments').select('agent_id, agent_estimate, agrees_with_ai, feedback_weight')
    .eq('property_id', propertyId).not('agent_estimate', 'is', null)

  const { data: topProducers } = await sb.rpc('top_producers_by_area', { p_area: prop.area })

  const { data: modelRun } = await sb
    .from('pricing_model_runs').select('*')
    .eq('agency_id', agencyId).eq('is_active', true)
    .order('trained_at', { ascending: false }).limit(1).maybeSingle()

  let nnRecommended: number | null = null
  let nnWeight = 0
  let topFactors: { label: string; pctEffect: number }[] = []
  if (modelRun && prop.sqm) {
    const { count: competingCount } = await sb
      .from('properties').select('id', { count: 'exact', head: true })
      .eq('agency_id', agencyId).eq('area', prop.area).eq('deal_type', 'sale')
      .neq('status', 'sold').gte('sqm', prop.sqm * 0.8).lte('sqm', prop.sqm * 1.2)

    const net = MiniNet.fromJSON(modelRun.model_json)
    const x = buildFeatureVector({
      area: prop.area, sqm: prop.sqm, floor: prop.floor, year_built: prop.year_built,
      year_renovated: prop.year_renovated, condition: prop.condition, balcony: prop.balcony,
      utilization_score: prop.utilization_score, lat: prop.lat, lng: prop.lng,
      competing_listings_count: competingCount ?? null,
    })
    const nnPpsqm = Math.exp(net.predict(x))
    nnRecommended = Math.round(nnPpsqm * prop.sqm)
    nnWeight = Math.max(0, Math.min(0.30, 0.05 + Math.max(0, modelRun.holdout_r2 ?? 0) * 0.35))

    const contributions = net.featureContributions(x)
    topFactors = FEATURE_NAMES
      .map((name, i) => ({ label: FEATURE_LABELS_EL[name], pctEffect: (Math.exp(contributions[i]) - 1) * 100 }))
      .filter(c => c.label)
      .sort((a, b) => Math.abs(b.pctEffect) - Math.abs(a.pctEffect))
      .slice(0, 2) // 2, not 3 — the whole report has to fit in ~5-6 lines
  }

  const producerWeightMap: Record<string, number> = {}
  topProducers?.forEach((tp: any, i: number) => {
    if (tp.agent_id) producerWeightMap[tp.agent_id] = i === 0 ? 1.5 : i === 1 ? 1.25 : 1.0
  })

  let blended = recommended
  let blendedConf = conf
  let agentConsensus: number | null = null
  let blendCompWeight: number | null = null
  let blendFeedbackWeight: number | null = null
  // By explicit product decision, only top producers of this property's area
  // move the price — anyone can comment/vote in Meeting Ακινήτων (see
  // /api/meeting-comments), but non-top-producer feedback is history only,
  // filtered out here rather than at write time.
  const validFeedback = (feedbackRows || []).filter(f => f.agent_estimate > 0 && producerWeightMap[f.agent_id] != null)

  if (validFeedback.length >= 2) {
    const feedbackWithWeights = validFeedback.map(f => ({ estimate: f.agent_estimate, weight: producerWeightMap[f.agent_id] ?? (f.feedback_weight || 0.8) }))
    const totalFW = feedbackWithWeights.reduce((s, f) => s + f.weight, 0)
    agentConsensus = feedbackWithWeights.reduce((s, f) => s + f.estimate * f.weight, 0) / totalFW
    blendedConf = Math.min(conf + 0.05 * Math.min(validFeedback.length, 3), 0.95)
  }

  const signals: { value: number; weight: number }[] = []
  if (recommended != null) signals.push({ value: recommended, weight: 0.60 })
  if (nnRecommended != null) signals.push({ value: nnRecommended, weight: nnWeight })
  if (agentConsensus != null && validFeedback.length >= 2) signals.push({ value: agentConsensus, weight: 0.40 })

  if (signals.length > 0) {
    const totalW = signals.reduce((s, x) => s + x.weight, 0)
    blended = totalW > 0 ? Math.round(signals.reduce((s, x) => s + x.value * x.weight, 0) / totalW / 1000) * 1000 : blended
    if (nnRecommended != null) {
      blendCompWeight = recommended != null ? Math.round((0.60 / totalW) * 100) / 100 : null
      blendFeedbackWeight = agentConsensus != null ? Math.round((0.40 / totalW) * 100) / 100 : null
      blendedConf = Math.min(blendedConf + nnWeight * 0.2, 0.95)
    }
  }

  // ── Compact report: a handful of short, scannable lines, not a paragraph.
  // Each item is one line; the whole thing is meant to read in a few
  // seconds, inspired by "Opinion of Value"-style reports but condensed —
  // the full detail (multipliers, exact weights) still lives in
  // valuation_calibration_log for anyone who wants to dig in.
  const lines: string[] = []
  lines.push(comps.length > 0
    ? `📊 ${comps.length} συγκρίσιμες πωλήσεις (Μητρώο Αξιών) στην ${prop.area}${outlierCount > 0 ? `, ${outlierCount} ακραίες αφαιρέθηκαν` : ''} — μεσ. ${Math.round(avgPpsqm).toLocaleString('el-GR')} €/τ.μ.`
    : `📊 Ανεπαρκή συγκρίσιμα στοιχεία για ${prop.area} — ενδεικτική εκτίμηση.`)
  if (saleProbability.top_comp) {
    const c = saleProbability.top_comp
    lines.push(`🏆 Κορυφαίο δεδομένο: ${c.address || c.area}, ${c.sqm}τ.μ., ${c.days_on_market} ημέρες στην αγορά.`)
  }
  if (topFactors.length) {
    lines.push(`🧠 ΝΝ (€${nnRecommended!.toLocaleString('el-GR')}, ${Math.round(nnWeight * 100)}% βάρος): ${topFactors.map(f => `${f.label} ${f.pctEffect >= 0 ? '+' : ''}${f.pctEffect.toFixed(1)}%`).join(', ')}.`)
  }
  lines.push(saleProbability.probability != null
    ? `📈 ${Math.round(saleProbability.probability * 100)}% πιθανότητα πώλησης εντός 6 μηνών.`
    : `📈 Πιθανότητα πώλησης: ανεπαρκή δεδομένα (${saleProbability.sample_size}/8 πωλήσεις).`)
  if (validFeedback.length >= 2) {
    lines.push(`⭐ ${validFeedback.length} εκτιμήσεις top producers συνεκτιμήθηκαν (40% βάρος).`)
  }
  const reasoning = lines.join('\n')

  const { error: valuationErr } = await sb.from('meeting_valuations').upsert({
    property_id: propertyId, agency_id: agencyId,
    ai_min: min, ai_max: max, ai_recommended: recommended, ai_price_per_sqm: ppsqm,
    ai_reasoning: reasoning, comparables: comps.slice(0, 5), top_producers: topProducers?.slice(0, 3) || [],
    confidence_score: conf, blended_recommended: blended, blended_confidence: blendedConf,
    feedback_count: validFeedback.length, last_feedback_sync: new Date().toISOString(),
    sale_probability: saleProbability.probability, sale_probability_sample_size: saleProbability.sample_size,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'property_id' })
  if (valuationErr) {
    console.error('[pricingEngine] meeting_valuations upsert failed', valuationErr)
    return { success: false, error: `Αποτυχία αποθήκευσης εκτίμησης: ${valuationErr.message}` }
  }

  const { error: logErr } = await sb.from('valuation_calibration_log').insert({
    agency_id: agencyId, property_id: propertyId,
    comp_recommended: recommended, comp_confidence: conf, comp_count: comps.length,
    agent_consensus: agentConsensus, feedback_count: validFeedback.length,
    blend_comp_weight: blendCompWeight, blend_feedback_weight: blendFeedbackWeight,
    blend_nn_weight: nnRecommended != null ? nnWeight : null, nn_recommended: nnRecommended,
    pricing_model_run_id: modelRun?.id ?? null,
    producer_weight_map: producerWeightMap,
    blended_recommended: blended, blended_confidence: blendedConf,
  })
  if (logErr) console.error('[pricingEngine] calibration log insert failed (non-fatal)', logErr)

  if (validFeedback.length > 0) {
    await sb.from('meeting_comments').update({ feedback_processed: true })
      .eq('property_id', propertyId).not('agent_estimate', 'is', null)
  }

  await sb.from('meeting_properties').update({ status: 'estimated' }).eq('id', propertyId)

  return {
    success: true,
    valuation: {
      min, max, recommended, blended_recommended: blended, price_per_sqm: ppsqm, confidence: blendedConf, reasoning,
      outliers_removed: outlierCount, feedback_incorporated: validFeedback.length,
      sale_probability: saleProbability.probability, sale_probability_sample_size: saleProbability.sample_size,
      nn_recommended: nnRecommended, nn_weight: nnRecommended != null ? nnWeight : null,
      nn_model_holdout_mae_pct: modelRun?.holdout_mae_pct ?? null,
    },
    top_producers: topProducers?.slice(0, 3) || [],
    comparables: comps.slice(0, 5),
  }
}
