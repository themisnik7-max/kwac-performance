import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthedAgent, isCeoOrAdmin } from '@/lib/auth'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// POST — grant/revoke a locked-feature flag for an agent in the caller's own
// agency. Only gpi_access exists today; shaped to add more flags later
// without a new route per flag.
export async function POST(req: NextRequest) {
  const caller = await getAuthedAgent(req)
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isCeoOrAdmin(caller)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const agentId = body.agent_id
  const gpiAccess = body.gpi_access
  if (!agentId || typeof gpiAccess !== 'boolean') {
    return NextResponse.json({ error: 'agent_id and a boolean gpi_access are required' }, { status: 400 })
  }

  // Scope to the caller's own agency — a service-role client has no RLS
  // backstop, so this is the only thing stopping a CEO in Agency A from
  // changing permissions on an agent row in Agency B.
  const { data: target } = await sb.from('agents').select('id, agency_id').eq('id', agentId).single()
  if (!target || target.agency_id !== caller.agency_id) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
  }

  const { error } = await sb.from('agents').update({ gpi_access: gpiAccess }).eq('id', agentId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
