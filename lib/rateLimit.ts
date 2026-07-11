import { SupabaseClient } from '@supabase/supabase-js'

// Fixed-window rate limit, backed by the check_rate_limit RPC (migration
// 20260711130000). Atomically increments and checks in one DB round trip —
// call this BEFORE doing the expensive/costly work, same principle as
// lib/aiAdmin.ts's daily cap (a request that will be rejected should cost
// nothing). Fails open on infra errors: a rate-limit check that can't run
// should never be the reason a legitimate request gets blocked.
export async function checkRateLimit(
  sb: SupabaseClient,
  key: string,
  windowSeconds: number,
  limit: number
): Promise<boolean> {
  const { data, error } = await sb.rpc('check_rate_limit', {
    p_key: key, p_window_seconds: windowSeconds, p_limit: limit,
  })
  if (error) {
    console.error('[rateLimit] check_rate_limit failed, failing open', error)
    return true
  }
  return data === true
}
