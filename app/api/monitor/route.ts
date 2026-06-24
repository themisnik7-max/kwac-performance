// app/api/monitor/route.ts
// Returns agent compliance data — CEO/Admin only

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthedAgent, isCeoOrAdmin } from '@/lib/auth'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const agent = await getAuthedAgent(req)
  if (!agent)             return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isCeoOrAdmin(agent)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Pull from the agent_compliance view (created in 005_registration_monitor.sql)
  const { data, error } = await sb
    .from('agent_compliance')
    .select('*')
    .eq('agency_id', agent.agency_id)
    .order('full_name', { ascending: true })

  if (error) {
    // Fallback if view doesn't exist yet: raw query
    const { data: raw } = await sb
      .from('agents')
      .select('id, full_name, email, role, joined_at, agency_id')
      .eq('agency_id', agent.agency_id)
      .eq('is_active', true)
      .order('full_name', { ascending: true })

    return NextResponse.json({
      agents: (raw || []).map(a => ({
        ...a,
        has_gps_goal:        false,
        submitted_this_week: false,
        total_submissions:   0,
        meeting_props_count: 0,
        last_sprint_at:      null,
        last_submission_at:  null,
      })),
      note: 'Run 005_registration_monitor.sql to enable full compliance data.',
    })
  }

  return NextResponse.json({ agents: data || [] })
}
