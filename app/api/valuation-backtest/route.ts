import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthedAgent, isCeoOrAdmin } from '@/lib/auth'
import { estimatePpsqm, floorMultiplier, conditionMultiplier, ageMultiplier, type CompRow } from '@/lib/valuation'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const LOOKBACK_MS = 3 * 365 * 24 * 60 * 60 * 1000 // matches the live route's comp window
const MIN_COMPS = 3

type PropRow = CompRow & { area: string; property_type?: string | null; actualPrice: number }

// GET — holdout backtest for the comp-based pricing model: for every sold
// property in the agency's history, predict its price using only comps that
// existed before it sold, then compare to the actual sale price. Answers
// "how accurate is the live valuation formula, really?" per CLAUDE.md's
// requirement to validate against a holdout set. Admin/CEO only — this is an
// analysis tool, not something every agent needs to trigger.
export async function GET(req: NextRequest) {
  const caller = await getAuthedAgent(req)
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (!isCeoOrAdmin(caller)) return NextResponse.json({ error: 'Admin/CEO only' }, { status: 403 })

  // properties.price doesn't exist on the live schema — price_asking/
  // price_final do. This query previously errored on every call, so the
  // backtest always reported "not enough data" regardless of what was
  // actually on record.
  const { data: sold } = await sb
    .from('properties')
    .select('area, price_asking, price_final, sqm, year_built, floor, condition, property_type, created_at')
    .eq('agency_id', caller.agency_id)
    .eq('deal_type', 'sale')
    .eq('status', 'sold')
    .not('price_final', 'is', null).not('sqm', 'is', null).gt('sqm', 0).gt('price_final', 0)
    .order('created_at', { ascending: true })

  // For the comp pool (what the model would have seen), fall back to
  // price_asking on rows without a final price; for the target itself,
  // actualPrice is always price_final (guaranteed non-null by the filter above).
  const targets = (sold || []).map(p => ({
    ...p, price: p.price_final ?? p.price_asking, actualPrice: p.price_final as number,
  })) as PropRow[]
  if (targets.length < 5) {
    return NextResponse.json({ ok: false, message: `Only ${targets.length} sold properties on record — need at least 5 to backtest.` })
  }

  let skipped = 0
  const errors: number[] = []       // signed % error, predicted vs actual
  const details: Array<{ area: string; predicted: number; actual: number; pct_error: number; sold_at: string }> = []

  for (const target of targets) {
    const asOf = new Date(target.created_at).getTime()
    const pool = targets.filter(p =>
      p !== target &&
      p.area === target.area &&
      new Date(p.created_at).getTime() < asOf &&
      new Date(p.created_at).getTime() >= asOf - LOOKBACK_MS
    ).slice(-30) // same 30-comp cap as the live route, most recent first

    const { avgPpsqm, hasComps, comps } = estimatePpsqm(pool, asOf)
    if (!hasComps || comps.length < MIN_COMPS) { skipped++; continue }

    const predicted = avgPpsqm * target.sqm
      * floorMultiplier(target.floor)
      * conditionMultiplier(target.condition)
      * ageMultiplier(target.year_built, asOf)

    const pctError = (predicted - target.actualPrice) / target.actualPrice
    errors.push(pctError)
    details.push({ area: target.area, predicted: Math.round(predicted), actual: target.actualPrice, pct_error: Math.round(pctError * 1000) / 10, sold_at: target.created_at })
  }

  if (errors.length === 0) {
    return NextResponse.json({ ok: false, message: `No target had ${MIN_COMPS}+ prior same-area comps — can't backtest yet.`, skipped })
  }

  const abs = errors.map(e => Math.abs(e))
  const mean = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length
  const median = (arr: number[]) => { const s = [...arr].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }
  const fractionWithin = (pct: number) => abs.filter(e => e <= pct).length / abs.length

  const result = {
    sample_size: errors.length,
    skipped_insufficient_comps: skipped,
    mean_pct_error: Math.round(mean(errors) * 1000) / 10,
    mean_abs_pct_error: Math.round(mean(abs) * 1000) / 10,
    median_abs_pct_error: Math.round(median(abs) * 1000) / 10,
    pct_within_10: Math.round(fractionWithin(0.10) * 1000) / 10,
    pct_within_20: Math.round(fractionWithin(0.20) * 1000) / 10,
  }

  await sb.from('valuation_backtest_results').insert({
    agency_id: caller.agency_id,
    ...result,
    details: details.slice(0, 200),
  })

  return NextResponse.json({ ok: true, ...result, sample_details: details.slice(0, 20) })
}
