// Location-distance features for the pricing model (lib/pricingModel.ts).
//
// Precise per-address coordinates barely exist today: properties.lat/lng is
// populated on only ~5 rows agency-wide, meeting_properties has no lat/lng
// column at all, and the government registry (market_transactions) never
// carries coordinates — only a municipality/district name. So distance
// features are computed from a curated neighborhood-centroid table by
// default, and upgraded to the real point automatically whenever a row does
// carry lat/lng (see resolveCoords below). Centroids are approximate
// (well-known plateia/town-center points), which is the right precision for
// a "how close to the sea/metro/Acropolis" real-estate signal — this is not
// survey-grade geocoding.

export type LatLng = { lat: number; lng: number }

export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371
  const dLat = (b.lat - a.lat) * Math.PI / 180
  const dLng = (b.lng - a.lng) * Math.PI / 180
  const la1 = a.lat * Math.PI / 180
  const la2 = b.lat * Math.PI / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

export const ACROPOLIS: LatLng = { lat: 37.9715, lng: 23.7257 }

// A few points tracing the Attica coastline near the areas this app deals
// with — "distance to sea" is the min distance to any of these, not one
// fixed point.
export const COASTLINE_POINTS: LatLng[] = [
  { lat: 37.9483, lng: 23.6420 }, // Πειραιάς
  { lat: 37.9280, lng: 23.6750 }, // Φάληρο
  { lat: 37.9105, lng: 23.6976 }, // Άλιμος
  { lat: 37.8858, lng: 23.7503 }, // Γλυφάδα
  { lat: 37.8306, lng: 23.7975 }, // Βάρη - Βάρκιζα
  { lat: 37.8103, lng: 23.7793 }, // Βουλιαγμένη
]

// Approximate stations across Metro Lines 1/2/3 and the tram, chosen to
// cover the areas actually in use in this app. Good enough for a "distance
// to nearest station" proximity signal, not a routing-grade dataset.
export const METRO_STATIONS: LatLng[] = [
  { lat: 37.9483, lng: 23.6420 }, // Πειραιάς
  { lat: 37.9757, lng: 23.7215 }, // Θησείο
  { lat: 37.9764, lng: 23.7259 }, // Μοναστηράκι
  { lat: 37.9838, lng: 23.7275 }, // Ομόνοια
  { lat: 37.9808, lng: 23.7328 }, // Πανεπιστήμιο
  { lat: 37.9755, lng: 23.7348 }, // Σύνταγμα
  { lat: 37.9767, lng: 23.7460 }, // Ευαγγελισμός
  { lat: 37.9757, lng: 23.7514 }, // Μέγαρο Μουσικής
  { lat: 37.9878, lng: 23.7592 }, // Αμπελόκηποι
  { lat: 37.9911, lng: 23.7660 }, // Πανόρμου
  { lat: 37.9967, lng: 23.7778 }, // Κατεχάκη
  { lat: 37.9686, lng: 23.7264 }, // Ακρόπολη
  { lat: 37.9622, lng: 23.7231 }, // Συγγρού - Φιξ
  { lat: 37.9614, lng: 23.7278 }, // Νέος Κόσμος
  { lat: 37.9364, lng: 23.7222 }, // Άγιος Δημήτριος
  { lat: 37.9339, lng: 23.7597 }, // Ηλιούπολη (Δάφνη branch)
  { lat: 38.0231, lng: 23.8004 }, // Χαλάνδρι
  { lat: 38.0031, lng: 23.8281 }, // Δουκίσσης Πλακεντίας
  { lat: 38.0347, lng: 23.7517 }, // Νέα Ιωνία
  { lat: 37.9463, lng: 23.7144 }, // Νέα Σμύρνη (tram)
  { lat: 37.9558, lng: 23.7014 }, // Καλλιθέα (tram)
]

// Neighborhood centroids for every area name seen in properties /
// meeting_properties / market_transactions (lib/mamaRegistry.ts). Anything
// not listed falls back to a citywide-average point with a missing-data
// flag rather than a guessed coordinate — see resolveCoords.
export const AREA_CENTROIDS: Record<string, LatLng> = {
  'Γλυφάδα': { lat: 37.8858, lng: 23.7503 },
  'Χαλάνδρι': { lat: 38.0214, lng: 23.7997 },
  'Κέντρο': { lat: 37.9838, lng: 23.7275 },
  'Κυψέλη': { lat: 37.9958, lng: 23.7367 },
  'Εξάρχεια - Νεάπολη': { lat: 37.9885, lng: 23.7333 },
  'Υμηττός': { lat: 37.9522, lng: 23.7594 },
  'Αμπελόκηποι - Πεντάγωνο': { lat: 37.9889, lng: 23.7644 },
  'Βάρη - Βάρκιζα': { lat: 37.8306, lng: 23.7975 },
  'Λεωφ. Πατησίων': { lat: 38.0006, lng: 23.7278 },
  'Νέα Σμύρνη': { lat: 37.9463, lng: 23.7144 },
  'Ηλιούπολη': { lat: 37.9339, lng: 23.7583 },
  'Κουκάκι - Μακρυγιάννη': { lat: 37.9663, lng: 23.7247 },
  'Καλλιθέα': { lat: 37.9558, lng: 23.7014 },
  'Νέος Κόσμος': { lat: 37.9614, lng: 23.7275 },
  'Παγκράτι': { lat: 37.9679, lng: 23.7511 },
  'Νέα Ιωνία': { lat: 38.0333, lng: 23.7500 },
  'Σύνταγμα': { lat: 37.9755, lng: 23.7348 },
  'Κολωνάκι': { lat: 37.9776, lng: 23.7442 },
}

const ATHENS_CENTROID: LatLng = { lat: 37.9755, lng: 23.7348 }

// Prefer a row's own coordinates when present (properties.lat/lng today;
// meeting_properties.lat/lng once geocoded — see lib/geocode.ts), else fall
// back to the area's centroid, else the citywide average with hasCoords=false
// so callers/the model can down-weight a feature it can't really trust.
export function resolveCoords(row: { lat?: number | null; lng?: number | null; area?: string | null }): { point: LatLng; hasCoords: boolean } {
  if (row.lat != null && row.lng != null) return { point: { lat: row.lat, lng: row.lng }, hasCoords: true }
  const area = row.area?.trim()
  if (area && AREA_CENTROIDS[area]) return { point: AREA_CENTROIDS[area], hasCoords: true }
  return { point: ATHENS_CENTROID, hasCoords: false }
}

export function minDistanceKm(point: LatLng, targets: LatLng[]): number {
  return Math.min(...targets.map(t => haversineKm(point, t)))
}
