import { gptExtract } from '@/lib/voice/openai-stt'

// ── Intent detection — regex only, 0 tokens ──────────────────────

export type VoiceIntent = 'property_scouted' | 'demand_profile' | 'voice_note'

const PROPERTY_RE = /πώλη|πωλ[ηε]|μίσθω|ιδιοκτήτης|ζητάει|τ\.?μ|τετραγ|όροφ|κατάστ|ανακαίν|κουφώμ|πόρτα ασφ|ισόγει|υπόγει/i
const DEMAND_RE   = /ψάχνει|θέλει|budget|αγοράσ|νοικιάσ|αγορά|ζήτηση|πελάτης|χρειάζεται|ενδιαφέρεται/i

export function detectIntent(transcript: string): VoiceIntent {
  const p = PROPERTY_RE.test(transcript)
  const d = DEMAND_RE.test(transcript)
  if (p && !d) return 'property_scouted'
  if (d && !p) return 'demand_profile'
  const pScore = (transcript.match(new RegExp(PROPERTY_RE.source, 'gi')) ?? []).length
  const dScore = (transcript.match(new RegExp(DEMAND_RE.source,   'gi')) ?? []).length
  if (pScore > dScore) return 'property_scouted'
  if (dScore > pScore) return 'demand_profile'
  return 'voice_note'
}

// ── Regex extractors — 0 tokens ──────────────────────────────────

export function extractPhone(text: string): string | null {
  const m = text.replace(/\s/g, '').match(/(?<!\d)(6\d{9})(?!\d)/)
  return m?.[1] ?? null
}

export function extractEmail(text: string): string | null {
  const m = text.match(/\b[\w.+-]+@[\w-]+\.[a-z]{2,}\b/i)
  return m?.[0]?.toLowerCase() ?? null
}

export function extractPrice(text: string): number | null {
  const th = text.match(/(\d{1,3})[.,](\d{3})\b(?!\d)/)
  if (th) return parseInt(th[1]) * 1000 + parseInt(th[2])
  const k   = text.match(/(\d+)\s*k\b/i)
  const xil = text.match(/(\d+)\s*χιλ/i)
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
    '3ου': 3,   '3ο': 3,  '4ου': 4, '5ου': 5, '6ου': 6,
    'πρώτ': 1, 'δεύτερ': 2, 'τρίτ': 3, 'τέταρτ': 4,
  }
  for (const [key, val] of Object.entries(map)) {
    if (text.toLowerCase().includes(key)) return val
  }
  return null
}

// ── Property Scouted extraction ───────────────────────────────────

const PROPERTY_SYSTEM = `Εξάγεις δομημένα δεδομένα από ελληνική φωνητική σημείωση μεσίτη για ακίνητο.
Επέστρεψε ΜΟΝΟ έγκυρο JSON (χωρίς κείμενο πριν ή μετά) με τα παρακάτω πεδία:
{
  "owner_name": string|null,
  "address": string|null,
  "area": string|null,
  "condition": string|null,
  "year_built": number|null,
  "year_renovated": number|null,
  "rooms": number|null,
  "balcony": boolean|null,
  "parking": boolean|null,
  "security_door": boolean|null,
  "seller_motivation": string|null,
  "seller_reason": string|null,
  "ai_summary": string (1 πρόταση στα ελληνικά)
}`

export async function extractPropertyScouted(transcript: string) {
  const [phone, email, price, size, floor, llm] = await Promise.all([
    extractPhone(transcript),
    extractEmail(transcript),
    extractPrice(transcript),
    extractSizeSqm(transcript),
    extractFloor(transcript),
    gptExtract(PROPERTY_SYSTEM, transcript),
  ])

  return {
    owner_phone:      phone,
    owner_email:      email,
    asking_price:     price,
    size_sqm:         size,
    floor:            floor ?? (llm.floor as number ?? null),
    transaction_type: /πώλη|πωλεί/i.test(transcript) ? 'sale' : /μίσθω|ενοίκ|νοίκ/i.test(transcript) ? 'rent' : null,
    owner_name:       (llm.owner_name       as string)  ?? null,
    address:          (llm.address          as string)  ?? null,
    area:             (llm.area             as string)  ?? null,
    condition:        (llm.condition        as string)  ?? null,
    year_built:       (llm.year_built       as number)  ?? null,
    year_renovated:   (llm.year_renovated   as number)  ?? null,
    rooms:            (llm.rooms            as number)  ?? null,
    balcony:          (llm.balcony          as boolean) ?? null,
    parking:          (llm.parking          as boolean) ?? null,
    security_door:    (llm.security_door    as boolean) ?? null,
    seller_motivation:(llm.seller_motivation as string) ?? null,
    seller_reason:    (llm.seller_reason     as string) ?? null,
    ai_summary:       (llm.ai_summary       as string)  ?? null,
  }
}

// ── Demand Profile extraction ─────────────────────────────────────

const DEMAND_SYSTEM = `Εξάγεις δομημένα δεδομένα από ελληνική φωνητική σημείωση μεσίτη για αίτημα πελάτη.
Επέστρεψε ΜΟΝΟ έγκυρο JSON (χωρίς κείμενο πριν ή μετά) με τα παρακάτω πεδία:
{
  "client_name": string|null,
  "property_type": string|null,
  "condition_req": string|null,
  "must_have": string[],
  "nice_to_have": string[],
  "areas_preferred": string[],
  "floor_min": number|null,
  "floor_max": number|null,
  "size_min": number|null,
  "size_max": number|null,
  "ai_summary": string (1 πρόταση στα ελληνικά)
}`

export async function extractDemandProfile(transcript: string) {
  const sizeRange = transcript.match(/(\d+)\s*[-–ως]\s*(\d+)\s*τ\.?μ/i)

  const [phone, email, budget, llm] = await Promise.all([
    extractPhone(transcript),
    extractEmail(transcript),
    extractPrice(transcript),
    gptExtract(DEMAND_SYSTEM, transcript),
  ])

  return {
    client_phone:     phone,
    client_email:     email,
    budget_eur:       budget,
    transaction_type: /αγοράσ|αγορά|buy/i.test(transcript) ? 'buy' : /νοικιάσ|rent/i.test(transcript) ? 'rent' : null,
    client_name:      (llm.client_name     as string)   ?? null,
    property_type:    (llm.property_type   as string)   ?? null,
    condition_req:    (llm.condition_req   as string)   ?? null,
    must_have:        (llm.must_have       as string[]) ?? [],
    nice_to_have:     (llm.nice_to_have    as string[]) ?? [],
    areas_preferred:  (llm.areas_preferred as string[]) ?? [],
    floor_min:        (llm.floor_min as number) ?? null,
    floor_max:        (llm.floor_max as number) ?? null,
    size_min:         sizeRange ? parseInt(sizeRange[1]) : ((llm.size_min as number) ?? null),
    size_max:         sizeRange ? parseInt(sizeRange[2]) : ((llm.size_max as number) ?? null),
    ai_summary:       (llm.ai_summary      as string)   ?? null,
  }
}
