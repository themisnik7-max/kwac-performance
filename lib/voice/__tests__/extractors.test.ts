import { detectIntent, extractPhone, extractEmail, extractPrice, extractSizeSqm, extractFloor } from '../extractors'

// ── detectIntent ─────────────────────────────────────────────────

describe('detectIntent', () => {
  test('property_scouted — owns and sells', () => {
    expect(detectIntent('ο ιδιοκτήτης θέλει να πωλήσει το διαμέρισμα 80 τμ')).toBe('property_scouted')
  })
  test('demand_profile — client searching', () => {
    expect(detectIntent('ο πελάτης ψάχνει για αγορά κατοικίας στη Γλυφάδα')).toBe('demand_profile')
  })
  test('voice_note — no strong signal', () => {
    expect(detectIntent('να θυμηθώ να καλέσω τον Γιώργη αύριο')).toBe('voice_note')
  })
  test('property wins when both present but more property keywords', () => {
    const t = 'ο ιδιοκτήτης πωλεί τριάρι 3ου ορόφου με μπαλκόνι και πάρκινγκ'
    expect(detectIntent(t)).toBe('property_scouted')
  })
})

// ── extractPhone ─────────────────────────────────────────────────

describe('extractPhone', () => {
  test('standard 10-digit Greek mobile', () => {
    expect(extractPhone('tel 6941234567')).toBe('6941234567')
  })
  test('phone with spaces', () => {
    expect(extractPhone('694 123 4567')).toBe('6941234567')
  })
  test('no phone', () => {
    expect(extractPhone('καμία πληροφορία')).toBeNull()
  })
  test('landline not matched (not 6xx)', () => {
    expect(extractPhone('2101234567')).toBeNull()
  })
})

// ── extractEmail ─────────────────────────────────────────────────

describe('extractEmail', () => {
  test('basic email', () => {
    expect(extractEmail('email: test@example.com αυτό')).toBe('test@example.com')
  })
  test('no email', () => {
    expect(extractEmail('χωρίς email')).toBeNull()
  })
  test('lowercased', () => {
    expect(extractEmail('JOHN@EXAMPLE.COM')).toBe('john@example.com')
  })
})

// ── extractPrice ─────────────────────────────────────────────────

describe('extractPrice', () => {
  test('comma separator 200,000', () => {
    expect(extractPrice('τιμή 200,000 ευρώ')).toBe(200000)
  })
  test('dot separator 200.000', () => {
    expect(extractPrice('τιμή 200.000 ευρώ')).toBe(200000)
  })
  test('k suffix', () => {
    expect(extractPrice('ζητά 150k')).toBe(150000)
  })
  test('χιλ suffix', () => {
    expect(extractPrice('budget 80 χιλ')).toBe(80000)
  })
  test('no price', () => {
    expect(extractPrice('δεν ανέφερε τιμή')).toBeNull()
  })
})

// ── extractSizeSqm ───────────────────────────────────────────────

describe('extractSizeSqm', () => {
  test('80 τμ', () => { expect(extractSizeSqm('διαμέρισμα 80 τμ')).toBe(80) })
  test('τ.μ. with dots', () => { expect(extractSizeSqm('120 τ.μ.')).toBe(120) })
  test('no size', () => { expect(extractSizeSqm('χωρίς μέγεθος')).toBeNull() })
})

// ── extractFloor ─────────────────────────────────────────────────

describe('extractFloor', () => {
  test('ισόγειο = 0', () => { expect(extractFloor('ισόγειο κατάστημα')).toBe(0) })
  test('3ου = 3',     () => { expect(extractFloor('διαμέρισμα 3ου ορόφου')).toBe(3) })
  test('δεύτερ = 2',  () => { expect(extractFloor('στον δεύτερο όροφο')).toBe(2) })
  test('no floor',    () => { expect(extractFloor('καμία πληροφορία ορόφου')).toBeNull() })
})
