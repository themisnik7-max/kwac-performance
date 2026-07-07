// Shared comp-scoring primitives used by both the live valuation route
// (app/api/meeting-valuation/route.ts) and the holdout backtest
// (app/api/valuation-backtest/route.ts). Keeping these in one place means the
// backtest measures the accuracy of what's actually deployed, not a parallel
// reimplementation that can silently drift from production behavior.

export const LAMBDA = Math.LN2 / 6

export function timeWeight(dateStr: string, asOf: number = Date.now()): number {
  const months = (asOf - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24 * 30)
  return Math.exp(-LAMBDA * months)
}

export function filterOutliers<T extends { ppsqm: number }>(items: T[]): T[] {
  if (items.length < 4) return items
  const sorted = [...items].sort((a, b) => a.ppsqm - b.ppsqm)
  const q1 = sorted[Math.floor(sorted.length * 0.25)].ppsqm
  const q3 = sorted[Math.floor(sorted.length * 0.75)].ppsqm
  const iqr = q3 - q1
  return items.filter(c => c.ppsqm >= q1 - 1.5 * iqr && c.ppsqm <= q3 + 1.5 * iqr)
}

export function floorMultiplier(floor: string | null | undefined): number {
  if (!floor) return 1.0
  const f = parseInt(floor)
  if (isNaN(f)) return 1.0
  if (f === 0) return 0.95
  return Math.min(1.0 + (f - 1) * 0.02, 1.12)
}

export function conditionMultiplier(condition: string | null | undefined): number {
  switch (condition) {
    case 'excellent':  return 1.07
    case 'good':       return 1.00
    case 'fair':       return 0.94
    case 'needs_work': return 0.87
    default:           return 1.00
  }
}

export function ageMultiplier(yearBuilt: number | null | undefined, asOf: number = Date.now()): number {
  if (!yearBuilt) return 1.0
  const age = new Date(asOf).getFullYear() - yearBuilt
  if (age <= 5)  return 1.05
  if (age <= 15) return 1.00
  if (age <= 30) return 0.95
  if (age <= 45) return 0.91
  return 0.87
}

export function confidenceScore(comps: { ppsqm: number; w: number }[], mean: number): number {
  if (comps.length === 0) return 0.25
  const variance = comps.reduce((s, c) => s + Math.pow(c.ppsqm - mean, 2) * c.w, 0) /
                   comps.reduce((s, c) => s + c.w, 0)
  const cv = Math.sqrt(variance) / mean
  const sizeScore = comps.length >= 8 ? 1.0 : comps.length >= 5 ? 0.85 : comps.length >= 3 ? 0.70 : 0.55
  const varScore  = cv < 0.10 ? 1.0 : cv < 0.20 ? 0.85 : cv < 0.35 ? 0.65 : 0.45
  return Math.round(sizeScore * varScore * 100) / 100
}

export type CompRow = {
  price: number; sqm: number; created_at: string
  year_built?: number | null; floor?: string | null; condition?: string | null
}

// Comp-based price/sqm estimate as of a given moment, from a pre-filtered pool
// of same-area comps. `asOf` controls both the recency weighting and (for the
// backtest) which comps are even visible, so a target's own future sales
// can't leak into its own estimate.
export function estimatePpsqm(rawComps: CompRow[], asOf: number = Date.now()) {
  const enriched = rawComps
    .map(c => ({ ...c, w: timeWeight(c.created_at, asOf), ppsqm: Math.round(c.price / c.sqm) }))
    .filter(c => c.ppsqm > 500 && c.ppsqm < 50000)

  const comps = filterOutliers(enriched)
  const outlierCount = enriched.length - comps.length
  const totalW = comps.reduce((s, c) => s + c.w, 0)
  const avgPpsqm = totalW > 0 ? comps.reduce((s, c) => s + c.ppsqm * c.w, 0) / totalW : 0

  return { comps, outlierCount, avgPpsqm, hasComps: comps.length > 0 }
}

export type ClosedComp = {
  address: string | null; area: string; sqm: number
  price_asking: number; price_final: number; days_on_market: number | null
  condition?: string | null; listed_at: string
}

export type SaleProbabilityEstimate = {
  probability: number | null   // 0-1, null when there isn't enough real data to trust a number
  sample_size: number
  threshold_days: number
  top_comp: ClosedComp | null
  note: string
}

// Below this many closed comps, an empirical price-vs-probability split is
// just noise dressed up as a percentage — report the gap honestly (see
// meeting-valuation route) instead of a confident-looking fake number.
const MIN_SAMPLE_FOR_PROBABILITY = 8

// Empirical "did it sell within N days" rate among historical closed sales
// priced at or below the target's €/sqm — a plain frequency table, not a
// fitted model, so it's directly explainable (CLAUDE.md: no black box).
// asking-price ratio is the signal, not final price, because the question
// this answers is forward-looking: "if we list at price X, how likely is a
// sale within N months" — final price is only known after the fact.
export function estimateSaleProbability(
  targetPpsqm: number,
  closedComps: ClosedComp[],
  thresholdDays = 183,
): SaleProbabilityEstimate {
  const valid = closedComps.filter(c => c.sqm > 0 && c.price_asking > 0 && c.days_on_market != null)
  const topComp = valid.length
    ? [...valid].sort((a, b) => new Date(b.listed_at).getTime() - new Date(a.listed_at).getTime())[0]
    : null

  if (valid.length === 0) {
    return { probability: null, sample_size: 0, threshold_days: thresholdDays, top_comp: null, note: 'Δεν υπάρχουν ιστορικές κλεισμένες πωλήσεις για σύγκριση.' }
  }
  if (valid.length < MIN_SAMPLE_FOR_PROBABILITY) {
    return {
      probability: null, sample_size: valid.length, threshold_days: thresholdDays, top_comp: topComp,
      note: `Ανεπαρκή δεδομένα για αξιόπιστη πιθανότητα πώλησης (χρειάζονται τουλάχιστον ${MIN_SAMPLE_FOR_PROBABILITY} κλεισμένες πωλήσεις, υπάρχουν ${valid.length}).`,
    }
  }

  const withRatio = valid.map(c => ({ ...c, askPpsqm: c.price_asking / c.sqm, soldWithin: (c.days_on_market as number) <= thresholdDays }))
  const atOrBelow = withRatio.filter(c => c.askPpsqm <= targetPpsqm)
  const pool = atOrBelow.length >= 3 ? atOrBelow : withRatio
  const probability = pool.filter(c => c.soldWithin).length / pool.length

  return {
    probability: Math.round(probability * 100) / 100,
    sample_size: pool.length, threshold_days: thresholdDays, top_comp: topComp,
    note: `Βάσει ${pool.length} ιστορικών πωλήσεων με τιμολόγηση ίση ή χαμηλότερη ανά τ.μ.`,
  }
}
