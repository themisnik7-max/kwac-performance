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

export type OfficeConversionRates = {
  cr_call_appt1: number | null; cr_appt1_appt2: number | null
  cr_appt2_listing: number | null; cr_listing_deal: number | null
  weeks_of_data: number
}

// Office-wide analog of app/api/gps/route.ts's per-agent "realRates" —
// same field mapping, summed across every agent in the agency instead of
// one. Backs the "GPS Γραφείου" tab in Intelligence OP: the individual GPS
// funnel reverse-engineers one agent's target into weekly actions from
// their own real conversion rates; this does the same at office scale.
export async function getOfficeConversionRates(sb: SupabaseClient, agencyId: string): Promise<OfficeConversionRates> {
  const { data: submissions } = await sb
    .from('weekly_submissions')
    .select('cold_calls, follow_up, meet1_seller_live, meet1_seller_phone, meet1_buyer_live, meet1_buyer_phone, meet1_tenant_live, meet1_tenant_phone, meet2_seller, excl_listing_sale, simple_listing_sale, excl_rental_high, excl_rental_low, simple_rental, contract_seller, contract_buyer')
    .eq('agency_id', agencyId)

  const rows = submissions || []
  if (rows.length === 0) return { cr_call_appt1: null, cr_appt1_appt2: null, cr_appt2_listing: null, cr_listing_deal: null, weeks_of_data: 0 }

  const totCalls = rows.reduce((s, r) => s + (r.cold_calls || 0) + (r.follow_up || 0), 0)
  const totAppt1 = rows.reduce((s, r) => s + (r.meet1_seller_live || 0) + (r.meet1_seller_phone || 0) + (r.meet1_buyer_live || 0) + (r.meet1_buyer_phone || 0) + (r.meet1_tenant_live || 0) + (r.meet1_tenant_phone || 0), 0)
  const totAppt2 = rows.reduce((s, r) => s + (r.meet2_seller || 0), 0)
  const totList  = rows.reduce((s, r) => s + (r.excl_listing_sale || 0) + (r.simple_listing_sale || 0) + (r.excl_rental_high || 0) + (r.excl_rental_low || 0) + (r.simple_rental || 0), 0)
  const totDeals = rows.reduce((s, r) => s + (r.contract_seller || 0) + (r.contract_buyer || 0), 0)

  // Clamped to [1,95] — a real funnel stage can't convert above ~100%, but
  // aggregating many agents' independently-timed weekly counters can produce
  // a ratio over 100 in practice (e.g. a mandate logged in a week with no
  // matching 2nd-appointment counted that same week). Uncapped, that would
  // both misread as a bug and break the office GPS slider (max 90).
  const rate = (num: number, den: number) => den > 0 ? Math.max(1, Math.min(95, Math.round((num / den) * 100))) : null

  return {
    cr_call_appt1: rate(totAppt1, totCalls),
    cr_appt1_appt2: rate(totAppt2, totAppt1),
    cr_appt2_listing: rate(totList, totAppt2),
    cr_listing_deal: rate(totDeals, totList),
    weeks_of_data: rows.length,
  }
}
