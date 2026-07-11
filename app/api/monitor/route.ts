import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthedAgent, isCeoOrAdmin } from '@/lib/auth'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(req: NextRequest) {
  const caller = await getAuthedAgent(req)
  if (!caller)               return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isCeoOrAdmin(caller)) return NextResponse.json({ error: 'Forbidden' },    { status: 403 })

  const agencyId = caller.agency_id
  let agents: any[] = []

  const { data: complianceData, error: complianceErr } = await sb
    .from('agent_compliance').select('*').eq('agency_id', agencyId).order('full_name', { ascending: true })

  if (complianceErr) {
    const { data: raw } = await sb.from('agents')
      .select('id, full_name, email, role, joined_at, agency_id')
      .eq('agency_id', agencyId).eq('is_active', true).order('full_name', { ascending: true })
    agents = (raw || []).map(a => ({ ...a, has_gps_goal: false, submitted_this_week: false, total_submissions: 0, meeting_props_count: 0, last_sprint_at: null, last_submission_at: null }))
  } else {
    agents = complianceData || []
  }

  // agent_compliance (and the raw fallback) predate gpi_access — merged in
  // separately rather than touching the view for one extra column.
  const { data: gpiFlags } = await sb.from('agents').select('id, gpi_access').eq('agency_id', agencyId)
  const gpiMap: Record<string, boolean> = {}
  ;(gpiFlags || []).forEach(a => { gpiMap[a.id] = a.gpi_access === true })
  agents = agents.map(a => ({ ...a, gpi_access: gpiMap[a.id] === true }))

  let featureUsage: any[] = []
  const { data: usageRaw } = await sb.from('agent_feature_usage')
    .select('agent_id, route, visit_count, last_visit, visits_7d, visits_30d').eq('agency_id', agencyId)
  if (usageRaw?.length) featureUsage = usageRaw

  const lastSeenMap: Record<string, string> = {}
  featureUsage.forEach(row => {
    if (!lastSeenMap[row.agent_id] || row.last_visit > lastSeenMap[row.agent_id]) lastSeenMap[row.agent_id] = row.last_visit
  })

  const agentsWithActivity = agents.map(a => ({
    ...a,
    last_seen: lastSeenMap[a.id] || null,
    page_views_7d: featureUsage.filter(r => r.agent_id === a.id).reduce((s, r) => s + (r.visits_7d || 0), 0),
  }))

  const routeTotals: Record<string, number> = {}
  featureUsage.forEach(row => { routeTotals[row.route] = (routeTotals[row.route] || 0) + (row.visit_count || 0) })
  const topRoutes = Object.entries(routeTotals).sort((a, b) => b[1] - a[1]).map(([route, count]) => ({ route, count }))

  const total = agents.length || 1
  const submitted = agents.filter(a => a.submitted_this_week).length
  const hasGPS = agents.filter(a => a.has_gps_goal).length
  const activeThisWeek = new Set(featureUsage.filter(r => r.visits_7d > 0).map(r => r.agent_id)).size

  const systemKPIs = {
    complianceRate: Math.round((submitted / total) * 100),
    gpsAdoptionRate: Math.round((hasGPS / total) * 100),
    weeklyActiveUsers: activeThisWeek,
    engagementRate: Math.round((activeThisWeek / total) * 100),
    topFeature: topRoutes[0]?.route?.replace('/', '') || '—',
    totalPageViews30d: Object.values(routeTotals).reduce((s, v) => s + v, 0),
  }

  return NextResponse.json({ agents: agentsWithActivity, topRoutes, systemKPIs })
}