import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthedAgent, isCeoOrAdmin } from '@/lib/auth'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// GET — list agents in the caller's agency awaiting approval (is_active=false).
export async function GET(req: NextRequest) {
  const caller = await getAuthedAgent(req)
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isCeoOrAdmin(caller)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await sb.from('agents')
    .select('id, full_name, email, phone, joined_at')
    .eq('agency_id', caller.agency_id)
    .eq('is_active', false)
    .order('joined_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ pending: data || [] })
}

// POST — approve or reject a pending agent. Body: { agent_id, action: 'approve' | 'reject' }
export async function POST(req: NextRequest) {
  const caller = await getAuthedAgent(req)
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isCeoOrAdmin(caller)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const agentId = body.agent_id
  const action = body.action
  if (!agentId || (action !== 'approve' && action !== 'reject')) {
    return NextResponse.json({ error: 'agent_id and a valid action are required' }, { status: 400 })
  }

  // Scope to the caller's own agency — a service-role client has no RLS
  // backstop, so this is the only thing stopping a CEO in Agency A from
  // approving/deleting an agent row in Agency B.
  const { data: target } = await sb.from('agents').select('id, agency_id, is_active').eq('id', agentId).single()
  if (!target || target.agency_id !== caller.agency_id) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
  }
  if (target.is_active) {
    return NextResponse.json({ error: 'Ο λογαριασμός είναι ήδη ενεργός' }, { status: 409 })
  }

  if (action === 'approve') {
    const { error } = await sb.from('agents').update({ is_active: true }).eq('id', agentId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  // reject — remove the agent record and the auth user so the email is free
  // to register again later, mirroring register/route.ts's own rollback.
  const { error: deleteAgentError } = await sb.from('agents').delete().eq('id', agentId)
  if (deleteAgentError) return NextResponse.json({ error: deleteAgentError.message }, { status: 500 })
  await sb.auth.admin.deleteUser(agentId)
  return NextResponse.json({ ok: true })
}
