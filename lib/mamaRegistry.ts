// Ministry of Finance "Μητρώο Αξιών Μεταβιβάσεων Ακινήτων" (property
// transfer values registry) — real, anonymized transaction data published
// yearly at gsis.gr. Used to supplement the agency's own (currently very
// thin) comp pool with actual market prices instead of just asking prices.
//
// The registry publishes at Δήμος/Δημοτικό-Διαμέρισμα granularity using
// formal (often genitive-case) names; this app's properties.area uses
// informal neighborhood names as agents actually write them. There's no
// reliable grammatical rule to convert one to the other, so this is a
// curated lookup covering the areas already in use — anything not listed
// stays unmapped (area: null) rather than guessed.

export const ATTICA_PREFECTURES = [
  'ΑΘΗΝΩΝ (ΝΟΜΑΡΧΙΑ)', 'ΑΝΑΤ. ΑΤΤΙΚΗΣ (ΝΟΜΑΡΧΙΑ)', 'ΔΥΤ. ΑΤΤΙΚΗΣ (ΝΟΜΑΡΧΙΑ)', 'ΠΕΙΡΑΙΩΣ (ΝΟΜΑΡΧΙΑ)',
]

// Residential-only — comps for a home valuation shouldn't include land plots,
// parking spaces, warehouses, etc.
export const RESIDENTIAL_CATEGORIES = ['Κατοικία ή διαμέρισμα πλήν μονοκατοικίας', 'Μονοκατοικία']

// district_raw ("ΔΗΜΟΣ - ΔΙΑΜΕΡΙΣΜΑ") → app's area name, finer granularity first.
export const DISTRICT_TO_AREA: Record<string, string> = {
  'ΑΘΗΝΑΙΩΝ - ΝΕΟΥ ΚΟΣΜΟΥ': 'Νέος Κόσμος',
  'ΑΘΗΝΑΙΩΝ - ΚΟΛΩΝΑΚΙΟΥ': 'Κολωνάκι',
  'ΑΘΗΝΑΙΩΝ - ΚΥΨΕΛΗΣ': 'Κυψέλη',
  'ΑΘΗΝΑΙΩΝ - ΕΞΑΡΧΕΙΩΝ': 'Εξάρχεια - Νεάπολη',
  'ΑΘΗΝΑΙΩΝ - ΝΕΑΠΟΛΗΣ': 'Εξάρχεια - Νεάπολη',
  'ΑΘΗΝΑΙΩΝ - ΠΑΓΚΡΑΤΙΟΥ': 'Παγκράτι',
  'ΑΘΗΝΑΙΩΝ - ΚΟΥΚΑΚΙΟΥ': 'Κουκάκι - Μακρυγιάννη',
  'ΑΘΗΝΑΙΩΝ - ΜΑΚΡΥΓΙΑΝΝΗ': 'Κουκάκι - Μακρυγιάννη',
  'ΑΘΗΝΑΙΩΝ - ΑΜΠΕΛΟΚΗΠΩΝ': 'Αμπελόκηποι - Πεντάγωνο',
}

// Δήμος (municipality, no sub-district) → app's area name, used when
// district_raw has no finer match above.
export const MUNICIPALITY_TO_AREA: Record<string, string> = {
  'ΓΛΥΦΑΔΑΣ': 'Γλυφάδα',
  'ΧΑΛΑΝΔΡΙΟΥ': 'Χαλάνδρι',
  'ΚΑΛΛΙΘΕΑΣ': 'Καλλιθέα',
  'ΝΕΑΣ ΣΜΥΡΝΗΣ': 'Νέα Σμύρνη',
  'ΝΕΑΣ ΙΩΝΙΑΣ': 'Νέα Ιωνία',
  'ΥΜΗΤΤΟΥ': 'Υμηττός',
}

export function mapAreaName(municipality: string, districtRaw: string | null | undefined): string | null {
  // district_raw as published already includes the municipality prefix when
  // there's a sub-district (e.g. "ΑΘΗΝΑΙΩΝ - ΝΕΟΥ ΚΟΣΜΟΥ"), or just repeats
  // the municipality name alone when there isn't — never prepend it again.
  const key = districtRaw || municipality
  return DISTRICT_TO_AREA[key] ?? MUNICIPALITY_TO_AREA[municipality] ?? null
}

// Registry dates are Excel serial numbers (days since 1899-12-30).
export function excelSerialToISODate(serial: number): string {
  const ms = Math.round((serial - 25569) * 86400 * 1000)
  return new Date(ms).toISOString().split('T')[0]
}

export type RawRegistryRow = [
  string, string, string, string, string, number | null, number | null,
  number | null, number | null, number | null, string, number | null,
  string | null, string | number | null, number | null, string | null,
  number | null, number | null, number, number,
]

export type ParsedTransaction = {
  prefecture: string; municipality: string; district_raw: string | null; area: string | null
  category: string; sqm_main: number | null; sqm_aux: number | null; year_built: number | null
  floor: string | null; contract_date: string; price: number; source_year: number
}

export function parseRegistryRows(rows: RawRegistryRow[], sourceYear: number): ParsedTransaction[] {
  const out: ParsedTransaction[] = []
  for (const r of rows) {
    const [prefecture, municipality, district, , category, , , sqmMain, sqmAux, yearBuilt, , , , floor, , , , , contractSerial, price] = r
    if (!ATTICA_PREFECTURES.includes(prefecture)) continue
    if (!RESIDENTIAL_CATEGORIES.includes(category)) continue
    if (!price || price <= 0 || !sqmMain || sqmMain <= 0) continue
    if (!contractSerial) continue

    out.push({
      prefecture, municipality, district_raw: district || null,
      area: mapAreaName(municipality, district),
      category, sqm_main: sqmMain, sqm_aux: sqmAux || null,
      year_built: yearBuilt || null, floor: floor != null ? String(floor) : null,
      contract_date: excelSerialToISODate(contractSerial), price, source_year: sourceYear,
    })
  }
  return out
}
