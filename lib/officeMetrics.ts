import { SupabaseClient } from '@supabase/supabase-js'

// Cross-agent activity aggregation — the single implementation used by both
// Monitor's "Παραγωγή" tab (admin-only, per-agent detail) and Intelligence
// OP (office-wide totals), so the two views can never silently disagree on
// what a number means.
//
// Reality check on data sources (2026-07): weekly_submissions is the only
// one of these actually fed by a real data-entry UI (app/submit/page.jsx) —
// showings/offers/property_closing/property_mandate exist as real, well-
// formed tables but have zero write path anywhere in the app today, so
// their counts are honestly 0 until that's built. Not hidden or faked here.
export type AgentActivityTotals = {
  agent_id: string
  full_name: string
  email: string
  team: string | null
  role: string
  calls: number             // καταγραφές — weekly_submissions.cold_calls
  second_appointments: number // 2α ραντεβού — weekly_submissions.meet2_seller
  mandates: number           // αναθέσεις — weekly_submissions excl/simple listing+rental fields
  demand: number             // ζητήσεις — demand_profiles rows
  showings: number           // υποδείξεις — showings table rows (no write UI yet, see note above)
  offers: number             // προσφορές — weekly_submissions.offer_buyer + offer_tenant
  deposits: number           // προκαταβολές — weekly_submissions.deposit_office + deposit_client
  closings: number           // κλεισίματα — weekly_submissions.contract_seller + contract_buyer
  weeks_submitted: number    // μετρησιμότητα — count of weekly_submissions rows on file
  xp_total: number
}

export type OfficeActivityResult = {
  agents: AgentActivityTotals[]
  teams: { team: string; agents: AgentActivityTotals[]; totals: Omit<AgentActivityTotals, 'agent_id' | 'full_name' | 'email' | 'team' | 'role'> }[]
  solo: AgentActivityTotals[]
  officeTotals: Omit<AgentActivityTotals, 'agent_id' | 'full_name' | 'email' | 'team' | 'role'>
}

function emptyTotals() {
  return { calls: 0, second_appointments: 0, mandates: 0, demand: 0, showings: 0, offers: 0, deposits: 0, closings: 0, weeks_submitted: 0, xp_total: 0 }
}

export async function getOfficeActivityMetrics(sb: SupabaseClient, agencyId: string): Promise<OfficeActivityResult> {
  const { data: agentRows } = await sb
    .from('agents').select('id, full_name, email, team, role')
    .eq('agency_id', agencyId).eq('is_active', true).order('full_name', { ascending: true })

  const byAgent = new Map<string, AgentActivityTotals>()
  for (const a of agentRows || []) {
    byAgent.set(a.id, { agent_id: a.id, full_name: a.full_name, email: a.email, team: a.team, role: a.role, ...emptyTotals() })
  }

  const { data: submissions } = await sb
    .from('weekly_submissions')
    .select('agent_id, cold_calls, meet2_seller, excl_listing_sale, simple_listing_sale, excl_rental_high, excl_rental_low, simple_rental, offer_buyer, offer_tenant, deposit_office, deposit_client, contract_seller, contract_buyer, xp_earned')
    .eq('agency_id', agencyId)
  for (const s of submissions || []) {
    const row = byAgent.get(s.agent_id)
    if (!row) continue
    row.calls += s.cold_calls || 0
    row.second_appointments += s.meet2_seller || 0
    row.mandates += (s.excl_listing_sale || 0) + (s.simple_listing_sale || 0) + (s.excl_rental_high || 0) + (s.excl_rental_low || 0) + (s.simple_rental || 0)
    row.offers += (s.offer_buyer || 0) + (s.offer_tenant || 0)
    row.deposits += (s.deposit_office || 0) + (s.deposit_client || 0)
    row.closings += (s.contract_seller || 0) + (s.contract_buyer || 0)
    row.xp_total += s.xp_earned || 0
    row.weeks_submitted += 1
  }

  const { data: demandRows } = await sb.from('demand_profiles').select('agent_id').eq('agency_id', agencyId)
  for (const d of demandRows || []) { const row = byAgent.get(d.agent_id); if (row) row.demand += 1 }

  // showings has no agency_id column of its own — filter by this agency's
  // agent ids directly rather than assuming a resolvable FK through property_id.
  const agentIds = Array.from(byAgent.keys())
  if (agentIds.length) {
    const { data: showingRows } = await sb.from('showings').select('agent_id').in('agent_id', agentIds)
    for (const s of showingRows || []) { const row = byAgent.get(s.agent_id); if (row) row.showings += 1 }
  }

  const agents = Array.from(byAgent.values())
  const teamNames = Array.from(new Set(agents.map(a => a.team).filter(Boolean))) as string[]
  const teams = teamNames.map(team => {
    const members = agents.filter(a => a.team === team)
    const totals = members.reduce((acc, m) => {
      acc.calls += m.calls; acc.second_appointments += m.second_appointments; acc.mandates += m.mandates
      acc.demand += m.demand; acc.showings += m.showings; acc.offers += m.offers; acc.deposits += m.deposits
      acc.closings += m.closings; acc.weeks_submitted += m.weeks_submitted; acc.xp_total += m.xp_total
      return acc
    }, emptyTotals())
    return { team, agents: members, totals }
  })
  const solo = agents.filter(a => !a.team && a.role === 'agent')

  const officeTotals = agents.reduce((acc, m) => {
    acc.calls += m.calls; acc.second_appointments += m.second_appointments; acc.mandates += m.mandates
    acc.demand += m.demand; acc.showings += m.showings; acc.offers += m.offers; acc.deposits += m.deposits
    acc.closings += m.closings; acc.weeks_submitted += m.weeks_submitted; acc.xp_total += m.xp_total
    return acc
  }, emptyTotals())

  return { agents, teams, solo, officeTotals }
}
