// Best-effort address -> lat/lng via OpenStreetMap Nominatim (free, no API
// key). Used when saving a property so meeting_properties gains real
// coordinates over time instead of staying on the area-centroid fallback in
// lib/geo.ts forever. Nominatim's usage policy caps this at ~1 request/sec
// and asks for a real User-Agent — fine for this app's write volume (a few
// property saves a day), not meant for bulk geocoding.
export async function geocodeAddress(address: string, area?: string | null): Promise<{ lat: number; lng: number } | null> {
  const q = [address, area, 'Αθήνα', 'Ελλάδα'].filter(Boolean).join(', ')
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`, {
      headers: { 'User-Agent': 'kwac-performance-real-estate-app/1.0' },
    })
    if (!res.ok) return null
    const rows = await res.json()
    if (!Array.isArray(rows) || rows.length === 0) return null
    const lat = parseFloat(rows[0].lat)
    const lng = parseFloat(rows[0].lon)
    if (!isFinite(lat) || !isFinite(lng)) return null
    return { lat, lng }
  } catch {
    return null
  }
}
