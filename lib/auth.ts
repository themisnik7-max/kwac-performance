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
}

// Returns the calling agent, or null if there's no valid session. Reads the
// access token from the Authorization header — the client must attach it
// (see lib/authedFetch.ts), since this app stores the Supabase session in
// the browser, not in an httpOnly cookie that would reach this route for free.
export async function getAuthedAgent(req: NextRequest): Promise<AuthedAgent | null> {
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  if (!token) return null

  const { data: userData, error } = await sb.auth.getUser(token)
  if (error || !userData?.user?.email) return null

  const { data: agent } = await sb.from('agents').select('id,email,role,agency_id').eq('email', userData.user.email).single()
  if (!agent) return null

  return agent as AuthedAgent
}

export function isCeoOrAdmin(agent: AuthedAgent) {
  return agent.role === 'ceo' || agent.role === 'admin'
}

// Convenience: throws-free check for "can this agent act as agent_id?"
export function canActAs(agent: AuthedAgent, agent_id: string) {
  return agent.id === agent_id || isCeoOrAdmin(agent)
}
