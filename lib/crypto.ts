// Application-level encryption for secrets that must never sit in plaintext
// in Postgres (taxisnet credentials — see lib/gpi.ts). AES-256-GCM via
// Node's built-in crypto module — no external dependency, no black box.
// Key is read lazily (inside the functions, not at module scope) so a
// missing GPI_ENCRYPTION_KEY doesn't break `next build`, only an actual
// encrypt/decrypt call at runtime.
import crypto from 'crypto'

const ALGO = 'aes-256-gcm'

function getKey(): Buffer {
  const raw = process.env.GPI_ENCRYPTION_KEY
  if (!raw) throw new Error('GPI_ENCRYPTION_KEY is not set')
  const key = Buffer.from(raw, 'base64')
  if (key.length !== 32) throw new Error('GPI_ENCRYPTION_KEY must be a base64-encoded 32-byte (AES-256) key')
  return key
}

// Returns "iv.tag.ciphertext" (each base64) — a fresh random IV every call,
// so encrypting the same plaintext twice never produces the same output.
export function encryptSecret(plaintext: string): string {
  if (!plaintext) return ''
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [iv, tag, ciphertext].map(b => b.toString('base64')).join('.')
}

export function decryptSecret(payload: string): string {
  if (!payload) return ''
  const [ivB64, tagB64, ctB64] = payload.split('.')
  if (!ivB64 || !tagB64 || !ctB64) throw new Error('Malformed encrypted payload')
  const iv = Buffer.from(ivB64, 'base64')
  const tag = Buffer.from(tagB64, 'base64')
  const ciphertext = Buffer.from(ctB64, 'base64')
  const decipher = crypto.createDecipheriv(ALGO, getKey(), iv)
  decipher.setAuthTag(tag)
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return plaintext.toString('utf8')
}
