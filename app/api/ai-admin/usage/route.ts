import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthedAgent, isCeoOrAdmin } from '@/lib/auth'
import { DAILY_ACTION_CAP } from '@/lib/aiAdmin'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET — admin/CEO-only oversight: today's per-agent usage against the cap,
// plus the recent action log (what was asked, what tool ran, what happened).
export async function GET(req: NextRequest) {
  const caller = await getAuthedAgent(req)
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (!isCeoOrAdmin(caller)) return NextResponse.json({ error: 'Admin/CEO only' }, { status: 403 })

  const today = new Date().toISOString().split('T')[0]

  const [{ data: usageToday }, { data: recentLog }] = await Promise.all([
    sb.from('ai_admin_usage_daily').select('agent_id, action_count, agents(full_name)')
      .eq('agency_id', caller.agency_id).eq('usage_date', today).order('action_count', { ascending: false }),
    sb.from('ai_admin_actions_log').select('id, agent_id, input_text, tool_name, status, result_summary, created_at, agents(full_name)')
      .eq('agency_id', caller.agency_id).order('created_at', { ascending: false }).limit(100),
  ])

  return NextResponse.json({
    daily_cap: DAILY_ACTION_CAP,
    usage_today: (usageToday || []).map((u: any) => ({ agent_name: u.agents?.full_name, action_count: u.action_count, over_cap: u.action_count > DAILY_ACTION_CAP })),
    recent_log: (recentLog || []).map((l: any) => ({ ...l, agent_name: l.agents?.full_name })),
  })
}
