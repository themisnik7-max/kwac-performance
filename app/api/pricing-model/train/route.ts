import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthedAgent, isCeoOrAdmin } from '@/lib/auth'
import { MiniNet } from '@/lib/miniNet'
import { buildFeatureVector, FEATURE_NAMES, PricingInputRow } from '@/lib/pricingFeatures'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

type TrainRow = { input: PricingInputRow; ppsqm: number; weight: number; isRealSale: boolean }

// Trains the small neural-net pricing model (lib/miniNet.ts) on every real
// price this agency and the government registry can supply, plus agent
// feedback estimates as lower-weighted soft examples — the concrete
// mechanism behind "reinforced by agent feedback": each retrain literally
// folds meeting_comments.agent_estimate into the gradient, weighted below
// real closed sales. Admin/CEO-triggered (matches valuation-backtest,
// import-registry) rather than automatic, since a retrain changes what price
// every future valuation suggests — that's a deliberate action, not a
// background job.
export async function POST(req: NextRequest) {
  const caller = await getAuthedAgent(req)
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (!isCeoOrAdmin(caller)) return NextResponse.json({ error: 'Μόνο Admin/CEO μπορεί να εκπαιδεύσει το μοντέλο' }, { status: 403 })

  const rows: TrainRow[] = []

  // 1. The agency's own real closed sales — highest-trust signal, but today
  // only a couple of rows exist (see route comment history / ARCHITECTURE.md).
  const { data: ownSales } = await sb
    .from('properties')
    .select('area, sqm, floor, year_built, year_renovated, condition, balcony, utilization_score, lat, lng, price_final, price_asking, created_at')
    .eq('agency_id', caller.agency_id).eq('deal_type', 'sale').eq('status', 'sold')
    .not('sqm', 'is', null).gt('sqm', 0)
  for (const r of ownSales || []) {
    const price = r.price_final ?? r.price_asking
    if (!price || price <= 0) continue
    rows.push({
      input: { area: r.area, sqm: r.sqm, floor: r.floor, year_built: r.year_built, year_renovated: r.year_renovated, condition: r.condition, balcony: r.balcony, utilization_score: r.utilization_score, lat: r.lat, lng: r.lng, asOf: new Date(r.created_at).getTime() },
      ppsqm: price / r.sqm, weight: 1.0, isRealSale: true,
    })
  }

  // 2. Government registry — real transaction prices, no condition/balcony/
  // utilization/coordinates, but the volume (tens of thousands of rows) is
  // what actually makes this a trainable network rather than a curve fit
  // through two points.
  const { data: registryRows } = await sb
    .from('market_transactions')
    .select('area, sqm_main, floor, year_built, price, contract_date')
    .not('area', 'is', null).not('sqm_main', 'is', null).gt('sqm_main', 0).gt('price', 0)
    .limit(25000)
  for (const r of registryRows || []) {
    rows.push({
      input: { area: r.area, sqm: r.sqm_main, floor: r.floor, year_built: r.year_built, asOf: new Date(r.contract_date).getTime() },
      ppsqm: r.price / r.sqm_main, weight: 1.0, isRealSale: true,
    })
  }

  // 3. Agent feedback (meeting_comments.agent_estimate) — opinions, not
  // closed sales, so weighted well below real prices and never used for
  // holdout evaluation (see split below).
  const { data: feedbackRows } = await sb
    .from('meeting_comments')
    .select('agent_estimate, meeting_properties!inner(area, sqm, floor, year_built, year_renovated, condition, balcony, utilization_score, lat, lng, agency_id)')
    .eq('meeting_properties.agency_id', caller.agency_id)
    .not('agent_estimate', 'is', null).gt('agent_estimate', 0)
  const feedbackTrainRows: TrainRow[] = []
  for (const c of (feedbackRows as any[]) || []) {
    const p = c.meeting_properties
    if (!p?.sqm || p.sqm <= 0) continue
    feedbackTrainRows.push({
      input: { area: p.area, sqm: p.sqm, floor: p.floor, year_built: p.year_built, year_renovated: p.year_renovated, condition: p.condition, balcony: p.balcony, utilization_score: p.utilization_score, lat: p.lat, lng: p.lng },
      ppsqm: c.agent_estimate / p.sqm, weight: 0.3, isRealSale: false,
    })
  }

  const realRows = rows.filter(r => r.ppsqm > 300 && r.ppsqm < 50000) // same sanity band as lib/valuation.ts estimatePpsqm
  if (realRows.length < 30) {
    return NextResponse.json({ error: `Ανεπαρκή δεδομένα εκπαίδευσης (${realRows.length} πραγματικές πωλήσεις, χρειάζονται τουλάχιστον 30).` }, { status: 400 })
  }

  // Seeded shuffle + 85/15 split — holdout drawn only from real sales, so
  // the reported accuracy reflects price prediction against actual prices,
  // never against agent opinions.
  const seed = Math.floor(Math.random() * 1e9)
  const rng = mulberry32ForSplit(seed)
  const shuffled = [...realRows].sort(() => rng() - 0.5)
  const holdoutSize = Math.max(10, Math.floor(shuffled.length * 0.15))
  const holdout = shuffled.slice(0, holdoutSize)
  const trainReal = shuffled.slice(holdoutSize)
  const trainAll = [...trainReal, ...feedbackTrainRows]

  const X = trainAll.map(r => buildFeatureVector(r.input))
  const rawTargets = trainAll.map(r => Math.log(r.ppsqm))
  const sampleWeights = trainAll.map(r => r.weight)

  const featureMeans = FEATURE_NAMES.map((_, i) => mean(X.map(x => x[i])))
  const featureStds = FEATURE_NAMES.map((_, i) => std(X.map(x => x[i]), featureMeans[i]))
  const targetMean = mean(rawTargets)
  const targetStd = std(rawTargets, targetMean) || 1
  const yNorm = rawTargets.map(t => (t - targetMean) / targetStd)

  const net = new MiniNet(FEATURE_NAMES.length, [16, 8], seed)
  net.setNormalization(featureMeans, featureStds, targetMean, targetStd)
  net.train(X, yNorm, sampleWeights, { steps: 4000, batchSize: 64, lr: 0.01, l2: 0.001, seed })

  // Holdout evaluation — real sale prices only, honest even if the number is bad.
  const errors: number[] = []
  const actuals: number[] = []
  const predicted: number[] = []
  for (const r of holdout) {
    const x = buildFeatureVector(r.input)
    const predLogPpsqm = net.predict(x)
    const predPpsqm = Math.exp(predLogPpsqm)
    predicted.push(predPpsqm); actuals.push(r.ppsqm)
    errors.push(Math.abs(predPpsqm - r.ppsqm) / r.ppsqm)
  }
  const maePct = errors.length ? Math.round(median(errors) * 1000) / 10 : null
  const r2 = errors.length ? computeR2(actuals, predicted) : null

  await sb.from('pricing_model_runs').update({ is_active: false }).eq('agency_id', caller.agency_id).eq('is_active', true)

  const { data: inserted, error: insertErr } = await sb.from('pricing_model_runs').insert({
    agency_id: caller.agency_id, seed, feature_names: FEATURE_NAMES, model_json: net.toJSON(),
    train_sample_size: trainReal.length, holdout_sample_size: holdout.length,
    feedback_sample_size: feedbackTrainRows.length, holdout_mae_pct: maePct, holdout_r2: r2, is_active: true,
  }).select('id, trained_at').single()
  if (insertErr) return NextResponse.json({ error: `Αποτυχία αποθήκευσης μοντέλου: ${insertErr.message}` }, { status: 500 })

  return NextResponse.json({
    success: true, run_id: inserted.id, trained_at: inserted.trained_at,
    train_sample_size: trainReal.length, holdout_sample_size: holdout.length,
    feedback_folded_in: feedbackTrainRows.length,
    holdout_median_abs_pct_error: maePct, holdout_r2: r2,
  })
}

function mulberry32ForSplit(seed: number): () => number {
  let a = seed
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function mean(xs: number[]): number { return xs.reduce((s, x) => s + x, 0) / (xs.length || 1) }
function std(xs: number[], m: number): number { return Math.sqrt(mean(xs.map(x => (x - m) ** 2))) }
function median(xs: number[]): number { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)] }
function computeR2(actual: number[], predicted: number[]): number {
  const m = mean(actual)
  const ssRes = actual.reduce((s, a, i) => s + (a - predicted[i]) ** 2, 0)
  const ssTot = actual.reduce((s, a) => s + (a - m) ** 2, 0)
  return ssTot > 0 ? Math.round((1 - ssRes / ssTot) * 1000) / 1000 : 0
}
