import { NextRequest, NextResponse } from 'next/server'

// NOTE: this check is global (`.limit(1)`, not scoped to the visitor's own
// agency_id) — a "first agency in the system" single-tenant shortcut, same
// bug class fixed elsewhere this session. Low priority to fix here
// specifically because (a) middleware has no session/agency awareness
// without decoding the token itself — a bigger change than this file's
// current job, and (b) the real enforcement now lives in
// lib/auth.ts's getAuthedAgent (properly per-agency, covers every API
// route) — this middleware redirect is UX-only (page navigation), not the
// actual access-control boundary anymore.
const TTL_MS = 5 * 60 * 1000
let ksCache: { active: boolean; expiresAt: number } | null = null

async function isSystemActive(): Promise<boolean> {
  const now = Date.now()
  if (ksCache && ksCache.expiresAt > now) return ksCache.active
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/agencies?select=system_active&limit=1`,
      { headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}` }, cache: 'no-store' }
    )
    if (!res.ok) return true
    const rows = await res.json() as Array<{ system_active?: boolean }>
    const active = rows?.[0]?.system_active !== false
    ksCache = { active, expiresAt: now + TTL_MS }
    return active
  } catch { return true }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (pathname.startsWith('/locked')) return NextResponse.next()
  const active = await isSystemActive()
  if (!active) return NextResponse.redirect(new URL('/locked', req.url))
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\.ico|api/|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|otf|map)$).*)'],
}