import { llamaExtract } from '@/lib/voice/cloudflare-ai'

// ── Intent detection — keyword-based, 0 tokens ───────────────────

export type VoiceIntent = 'property_scouted' | 'demand_profile' | 'voice_note'

const PROPERTY_KEYWORDS = /πώλη|μίσθω|ιδιοκτήτης|ζητάει|τ\.?μ|τετραγ|όροφ|κατάστ|ανακαίν|κουφώμ|πόρτα ασφ/i
const DEMAND_KEYWORDS   = /ψάχνει|θέλει|budget|αγοράσ|νοικιάσ|αγορά|ζήτηση|πελάτης.*θέλ|χρειάζεται/i

export function detectIntent(transcript: string): VoiceIntent {
  const p = PROPERTY_KEYWORDS.test(transcript)
  const d = DEMAND_KEYWORDS.test(transcript)
  if (p && !d) return 'property_scouted'
  if (d && !p) return 'demand_profile'
  const pScore = (transcript.match(PROPERTY_KEYWORDS) ?? []).length
  const dScore = (transcript.match(DEMAND_KEYWORDS)   ?? []).length
  if (pScore > dScore) return 'property_scouted'
  if (dScore > pScore) return 'demand_profile'
  return 'voice_note'
}

// ── Shared regex extractors — 0 tokens ──────────────────────────

/** Greek mobile: 69XXXXXXXX — also handles space-separated "69 3456 7890" */
export function extractPhone(text: string): string | null {
  const digits = text.replace(/\s/g, '')
  const m = digits.match(/\b(6\d{9})\b/)
  return m?.[1] ?? null
}

export function extractEmail(text: string): string | null {
  const m = text.match(/\b[\w.+-]+@[\w-]+\.[a-z]{2,}\b/i)
  return m?.[0]?.toLowerCase() ?? null
}

export function extractPrice(text: string): number | null {
  // "200.000", "200,000", "200k", "200 χιλιάδες" — guard: only thousands separator, not decimal
  const thousands = text.match(/(\d{1,3})[.,](\d{3})\b(?!\d)/)
  if (thousands && parseInt(thousands[2]) % 100 === 0) {
    return parseInt(thousands[1]) * 1000 + parseInt(thousands[2])
  }
  const k    = text.match(/(\d+)\s*k\b/i)
  const xil  = text.match(/(\d+)\s*χιλ/i)
  if (k)   return parseInt(k[1])   * 1000
  if (xil) return parseInt(xil[1]) * 1000
  return null
}

export function extractSizeSqm(text: string): number | null {
  const m = text.match(/(\d+)\s*τ\.?μ\.?/i)
  return m ? parseInt(m[1]) : null
}

export function extractFloor(text: string): number | null {
  const map: Record<string, number> = {
    'ισόγει': 0, '1ου': 1, '1ο': 1, '2ου': 2, '2ο': 2,
    '3ου': 3, '3ο': 3, '4ου': 4, '5ου': 5, '6ου': 6,
    'πρώτ': 1, 'δεύτερ': 2, 'τρίτ': 3, 'τέταρτ': 4,
  }
  for (const [key, val] of Object.entries(map)) {
    if (text.toLowerCase().includes(key)) return val
  }
  return null
}

export function extractTransactionType(text: string, mode: 'property' | 'demand'): string | null {
  if (mode === 'property') {
    if (/πώλη|πωλεί|πωλητήρ/i.test(text)) return 'sale'
    if (/μίσθω|ενοίκιο|νοίκι/i.test(text)) return 'rent'
  } else {
    if (/αγοράσ|αγορά|buy/i.test(text)) return 'buy'
    if (/νοικιάσ|μισθώσ|rent/i.test(text)) return 'rent'
  }
  return null
}

// ── Property Scouted — Llama only for unstructured fields ────────

const PROPERTY_SYSTEM = `You extract structured data from a Greek real-estate agent's voice note about a property they visited.
Output ONLY valid JSON with NO additional text before or after. Keys:
- owner_name: string|null
- address: string|null (street + number)
- area: string|null (neighborhood)
- condition: string|null (short description)
- seller_motivation: string|null
- seller_reason: string|null
- features: { renovations:[{item:string,year:number|null}], security_door:bool, parking:bool, balcony:bool }
- offers_received: [{amount:number}]
- ai_summary: string (1 sentence in Greek)`

export async function extractPropertyScouted(transcript: string) {
  const [phone, email, price, size, floor, txType, llmData] = await Promise.all([
    extractPhone(transcript),
    extractEmail(transcript),
    extractPrice(transcript),
    extractSizeSqm(transcript),
    extractFloor(transcript),
    extractTransactionType(transcript, 'property'),
    llamaExtract(PROPERTY_SYSTEM, transcript, 400),
  ])

  return {
    owner_phone:       phone,
    owner_email:       email,
    asking_price:      price,
    size_sqm:          size,
    floor,
    transaction_type:  txType,
    owner_name:        (llmData.owner_name        as string)   ?? null,
    address:           (llmData.address           as string)   ?? null,
    area:              (llmData.area              as string)   ?? null,
    condition:         (llmData.condition         as string)   ?? null,
    seller_motivation: (llmData.seller_motivation as string)   ?? null,
    seller_reason:     (llmData.seller_reason     as string)   ?? null,
    features:          (llmData.features          as object)   ?? {},
    offers_received:   (llmData.offers_received   as unknown[]) ?? [],
    ai_summary:        (llmData.ai_summary        as string)   ?? null,
  }
}

// ── Demand Profile — Llama only for unstructured fields ──────────

const DEMAND_SYSTEM = `You extract structured data from a Greek real-estate agent's voice note about a client's property request.
Output ONLY valid JSON with NO additional text before or after. Keys:
- client_name: string|null
- property_type: string|null (διαμέρισμα/μεζονέτα/etc)
- condition_req: string|null
- must_have: string[] (e.g. ["parking","elevator"])
- nice_to_have: string[] (e.g. ["balcony"])
- areas_preferred: string[] (neighborhoods)
- floor_min: number|null
- floor_max: number|null
- size_min: number|null
- size_max: number|null
- ai_summary: string (1 sentence in Greek)`

export async function extractDemandProfile(transcript: string) {
  const sizeRange = transcript.match(/(\d+)\s*[-–ως]\s*(\d+)\s*τ\.?μ/i)

  const [phone, email, budget, txType, llmData] = await Promise.all([
    extractPhone(transcript),
    extractEmail(transcript),
    extractPrice(transcript),
    extractTransactionType(transcript, 'demand'),
    llamaExtract(DEMAND_SYSTEM, transcript, 400),
  ])

  return {
    client_phone:     phone,
    client_email:     email,
    budget_eur:       budget,
    transaction_type: txType,
    client_name:      (llmData.client_name     as string)   ?? null,
    property_type:    (llmData.property_type   as string)   ?? null,
    condition_req:    (llmData.condition_req   as string)   ?? null,
    must_have:        (llmData.must_have       as string[]) ?? [],
    nice_to_have:     (llmData.nice_to_have    as string[]) ?? [],
    areas_preferred:  (llmData.areas_preferred as string[]) ?? [],
    floor_min:        (llmData.floor_min as number) ?? null,
    floor_max:        (llmData.floor_max as number) ?? null,
    size_min:         sizeRange ? parseInt(sizeRange[1]) : ((llmData.size_min as number) ?? null),
    size_max:         sizeRange ? parseInt(sizeRange[2]) : ((llmData.size_max as number) ?? null),
    ai_summary:       (llmData.ai_summary      as string)   ?? null,
  }
}
