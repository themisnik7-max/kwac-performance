// Single source of truth for turning a property row into the MiniNet's
// input vector — used identically by training (app/api/pricing-model/train)
// and inference (app/api/meeting-valuation), so the two can never drift
// apart on feature order or encoding.
//
// Source data reality check (2026-07, live DB): properties.lat/lng exists
// but is populated on ~5 rows agency-wide; meeting_properties and the
// government registry (market_transactions) carry no coordinates at all;
// balcony/utilization_score exist on meeting_properties but not on
// properties or market_transactions. So several of the requested features
// (exact-address distances, balcony, utilization) will carry close to zero
// training signal until: (a) meeting_properties rows get geocoded via
// lib/geocode.ts as agents save addresses, and (b) enough of the agency's
// own closed sales (properties.status=sold) accumulate with those fields
// filled in. The network still accepts all of them today, with explicit
// missing-indicators, so it improves automatically as that data fills in —
// no retrain-time schema change needed later.

import { AREA_CENTROIDS, ACROPOLIS, COASTLINE_POINTS, METRO_STATIONS, resolveCoords, minDistanceKm, haversineKm } from './geo'

export const AREA_LIST = Object.keys(AREA_CENTROIDS) // fixed order — do not resort
const AREA_INDEX: Record<string, number> = Object.fromEntries(AREA_LIST.map((a, i) => [a, i]))
const OTHER_AREA_IDX = AREA_LIST.length // trailing "unknown area" bucket

export const FEATURE_NAMES: string[] = [
  'sqm_log', 'floor', 'age_years', 'renovated', 'condition', 'balcony', 'utilization_score',
  'dist_metro_km', 'dist_sea_km', 'dist_acropolis_km', 'competing_listings_log',
  'age_missing', 'condition_missing', 'balcony_missing', 'utilization_missing', 'competing_missing',
  ...AREA_LIST.map(a => `area:${a}`), 'area:other',
]

// Greek labels for the subset of features worth surfacing in the AI
// reasoning text (feature-contribution breakdown) — the rest (missing-flags,
// one-hot area dims) are implementation detail, not agent-facing.
export const FEATURE_LABELS_EL: Record<string, string> = {
  sqm_log: 'τετραγωνικά', floor: 'όροφος', age_years: 'παλαιότητα', renovated: 'ανακαίνιση',
  condition: 'κατάσταση', balcony: 'μπαλκόνι', utilization_score: 'αξιοποίηση χώρου',
  dist_metro_km: 'απόσταση από μετρό', dist_sea_km: 'απόσταση από θάλασσα',
  dist_acropolis_km: 'απόσταση από Ακρόπολη', competing_listings_log: 'ανταγωνιστικά ακίνητα προς πώληση',
}

export type PricingInputRow = {
  area?: string | null
  sqm: number
  floor?: string | null
  year_built?: number | null
  year_renovated?: number | null
  condition?: string | null // 'excellent' | 'good' | 'fair' | 'needs_work'
  balcony?: boolean | null
  utilization_score?: number | null // 1-5, agent-entered
  lat?: number | null
  lng?: number | null
  competing_listings_count?: number | null
  asOf?: number // for age_years; defaults to now
}

const CONDITION_ORDINAL: Record<string, number> = { needs_work: 0, fair: 1, good: 2, excellent: 3 }

function parseFloorNum(floor: string | null | undefined): number | null {
  if (!floor) return null
  const f = parseInt(floor, 10)
  return isNaN(f) ? null : f
}

export function buildFeatureVector(row: PricingInputRow): number[] {
  const asOf = row.asOf ?? Date.now()
  const sqmLog = Math.log(Math.max(row.sqm, 1))

  const floorNum = parseFloorNum(row.floor)
  const floorFeature = floorNum ?? 0

  const ageMissing = row.year_built == null
  const ageYears = row.year_built ? new Date(asOf).getFullYear() - row.year_built : 0

  const renovated = row.year_renovated != null ? 1 : 0

  const conditionMissing = !row.condition || !(row.condition in CONDITION_ORDINAL)
  const conditionOrdinal = conditionMissing ? 2 : CONDITION_ORDINAL[row.condition as string]

  const balconyMissing = row.balcony == null
  const balconyFeature = row.balcony ? 1 : 0

  const utilizationMissing = row.utilization_score == null
  const utilizationFeature = utilizationMissing ? 0.5 : (row.utilization_score as number) / 5

  const { point } = resolveCoords({ lat: row.lat, lng: row.lng, area: row.area })
  const distMetro = minDistanceKm(point, METRO_STATIONS)
  const distSea = minDistanceKm(point, COASTLINE_POINTS)
  const distAcropolis = haversineKm(point, ACROPOLIS)

  const competingMissing = row.competing_listings_count == null
  const competingLog = competingMissing ? 0 : Math.log1p(Math.max(row.competing_listings_count as number, 0))

  const areaKey = row.area?.trim()
  const areaOneHot = new Array(AREA_LIST.length + 1).fill(0)
  areaOneHot[areaKey && areaKey in AREA_INDEX ? AREA_INDEX[areaKey] : OTHER_AREA_IDX] = 1

  return [
    sqmLog, floorFeature, ageYears, renovated, conditionOrdinal, balconyFeature, utilizationFeature,
    distMetro, distSea, distAcropolis, competingLog,
    ageMissing ? 1 : 0, conditionMissing ? 1 : 0, balconyMissing ? 1 : 0, utilizationMissing ? 1 : 0, competingMissing ? 1 : 0,
    ...areaOneHot,
  ]
}
