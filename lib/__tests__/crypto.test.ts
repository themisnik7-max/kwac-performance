import { encryptSecret, decryptSecret } from '../crypto'

// AES-256-GCM wrapper for taxisnet credentials (lib/gpi.ts) — the audit
// that led to this test suite verified this by hand (unique IV per call,
// auth tag checked on decrypt, throws rather than falling back to
// plaintext on a missing/malformed key). Pinning it down here so a future
// refactor can't silently reintroduce IV reuse or skip tag verification.
// Self-contained: sets its own fake key rather than depending on a real
// GPI_ENCRYPTION_KEY being present in the environment (crypto.ts reads the
// key lazily per-call, not at module load, so this is safe to do here).

const FAKE_KEY = Buffer.alloc(32, 7).toString('base64') // 32 bytes, deterministic, not a real secret

beforeEach(() => { process.env.GPI_ENCRYPTION_KEY = FAKE_KEY })
afterEach(() => { delete process.env.GPI_ENCRYPTION_KEY })

describe('encryptSecret / decryptSecret', () => {
  test('round-trips plaintext correctly', () => {
    const plaintext = 'my-taxisnet-password-123'
    expect(decryptSecret(encryptSecret(plaintext))).toBe(plaintext)
  })

  test('empty string in, empty string out (no key touched)', () => {
    expect(encryptSecret('')).toBe('')
    expect(decryptSecret('')).toBe('')
  })

  test('encrypting the same plaintext twice never produces the same ciphertext (fresh IV per call)', () => {
    const a = encryptSecret('same-value')
    const b = encryptSecret('same-value')
    expect(a).not.toBe(b)
    expect(decryptSecret(a)).toBe('same-value')
    expect(decryptSecret(b)).toBe('same-value')
  })

  test('tampered ciphertext fails auth-tag verification instead of silently returning garbage', () => {
    const encrypted = encryptSecret('sensitive-value')
    const [iv, tag, ct] = encrypted.split('.')
    const tampered = [iv, tag, Buffer.from(ct, 'base64').fill(0).toString('base64')].join('.')
    expect(() => decryptSecret(tampered)).toThrow()
  })

  test('malformed payload (missing a segment) throws rather than decrypting partial data', () => {
    expect(() => decryptSecret('only-one-segment')).toThrow('Malformed encrypted payload')
  })

  test('missing GPI_ENCRYPTION_KEY throws rather than falling back to plaintext', () => {
    delete process.env.GPI_ENCRYPTION_KEY
    expect(() => encryptSecret('anything')).toThrow('GPI_ENCRYPTION_KEY is not set')
  })

  test('wrong-length key is rejected rather than silently truncated/padded', () => {
    process.env.GPI_ENCRYPTION_KEY = Buffer.alloc(16, 1).toString('base64') // 16 bytes, not 32
    expect(() => encryptSecret('anything')).toThrow('32-byte')
  })
})
