// Client-side helper: attach the logged-in user's access token to a fetch
// call so API routes can verify identity via lib/auth.ts's getAuthedAgent().
// Use this instead of bare fetch() for any call to our own /api/* routes
// that touch agent-specific or agency-specific data.
'use client'
import { createClient } from '@/lib/supabase'

export async function authedFetch(url: string, options: RequestInit = {}) {
  const supabase = createClient()
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token

  const headers = new Headers(options.headers || {})
  if (token) headers.set('Authorization', `Bearer ${token}`)

  return fetch(url, { ...options, headers })
}
