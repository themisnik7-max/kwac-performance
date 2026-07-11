// Server-side helper for API routes: verify who's calling and what they're
// allowed to touch. Use this in every route instead of trusting agent_id /
// agency_id from the request body or query string directly.
import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export type AuthedAgent = {
  id: string
  email: string
  role: string
  agency_id: string
  full_name: string | null
  gpi_access: boolean
}

// middleware.ts's system_active kill-switch only covers page navigation
// (its own matcher explicitly excludes api/) — a locked-out agency's API
// access kept working fully even while their UI redirected to /locked.
// Checked here instead so every service-role route gets it for free via
// getAuthedAgent, with no per-route wiring needed. Also fixes a real bug
// found while adding this: middleware.ts's own check is
// `agencies.select('system_active').limit(1)` — GLOBAL, not scoped to the
// visitor's own agency (the same "first agency in the system" single-
// tenant shortcut CLAUDE.md flags as a bug class, already found and fixed
// twice elsewhere this session). This version is scoped to the caller's
// actual agency_id from the start.
const SYSTEM_ACTIVE_TTL_MS = 5 * 60 * 1000
const systemActiveCache = new Map<string, { active: boolean; expiresAt: number }>()

async function isAgencyActive(agencyId: string): Promise<boolean> {
  const now = Date.now()
  const cached = systemActiveCache.get(agencyId)
  if (cached && cached.expiresAt > now) return cached.active
  const { data, error } = await sb.from('agencies').select('system_active').eq('id', agencyId).single()
  // Fails open on an infra error (can't distinguish "column doesn't exist
  // yet" from "DB unreachable" here), same as middleware.ts's own fallback —
  // a lock-check outage should never be the reason every agency loses
  // access. system_active itself defaults active unless explicitly false.
  const active = error ? true : data?.system_active !== false
  systemActiveCache.set(agencyId, { active, expiresAt: now + SYSTEM_ACTIVE_TTL_MS })
  return active
}

// Returns the calling agent, or null if there's no valid session or their
// agency has been deactivated. Reads the access token from the
// Authorization header — the client must attach it (see
// lib/authedFetch.ts), since this app stores the Supabase session in the
// browser, not in an httpOnly cookie that would reach this route for free.
export async function getAuthedAgent(req: NextRequest): Promise<AuthedAgent | null> {
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  if (!token) return null

  const { data: userData, error } = await sb.auth.getUser(token)
  if (error || !userData?.user?.email) return null

  const { data: agent } = await sb.from('agents').select('id,email,role,agency_id,full_name,is_active,gpi_access').eq('email', userData.user.email).single()
  if (!agent) return null

  // Agents created pending admin approval (agencies.require_approval) or
  // later deactivated are is_active=false. The Supabase auth session is
  // still valid either way — this is the actual gate, checked on every
  // service-role route via getAuthedAgent. Fail closed.
  if (agent.is_active === false) return null

  if (!(await isAgencyActive(agent.agency_id))) return null

  return agent as AuthedAgent
}

export function isCeoOrAdmin(agent: AuthedAgent) {
  return agent.role === 'ceo' || agent.role === 'admin'
}

// "Can this agent act as agent_id?" Self always passes. CEO/Admin may act as
// any agent, but ONLY within their own agency — a service-role client has no
// RLS backstop, so this check is the only thing stopping a CEO in Agency A
// from reading/overwriting an agent's data in Agency B. Must be awaited.
export async function canActAs(agent: AuthedAgent, agent_id: string): Promise<boolean> {
  if (!agent_id) return false
  if (agent.id === agent_id) return true
  if (!isCeoOrAdmin(agent)) return false
  const { data: target } = await sb.from('agents').select('agency_id').eq('id', agent_id).single()
  return target?.agency_id === agent.agency_id
}
