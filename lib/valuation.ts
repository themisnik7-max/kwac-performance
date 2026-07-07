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
