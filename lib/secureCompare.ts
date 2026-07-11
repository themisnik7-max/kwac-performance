import crypto from 'crypto'

// Constant-time string comparison for shared-secret checks (CRON_SECRET,
// INTERNAL_API_SECRET) — a plain `===` short-circuits on the first
// mismatched byte, which theoretically leaks how many leading characters
// were correct via response timing. crypto.timingSafeEqual throws on a
// buffer-length mismatch (itself a variable-time branch on secret length),
// so both sides are hashed to a fixed-length digest first.
export function secureCompare(a: string, b: string): boolean {
  const ha = crypto.createHash('sha256').update(a).digest()
  const hb = crypto.createHash('sha256').update(b).digest()
  return crypto.timingSafeEqual(ha, hb)
}
