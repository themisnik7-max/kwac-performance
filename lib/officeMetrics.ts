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

  // Aggregated server-side (migration 20260711150000) instead of fetching
  // every weekly_submissions/demand_profiles/showings row this agency has
  // ever produced and reducing it here — this used to be O(all rows ever),
  // on every page load, with no cache.
  const { data: totals } = await sb.rpc('get_agent_activity_totals', { p_agency_id: agencyId })
  for (const t of totals || []) {
    const row = byAgent.get(t.agent_id)
    if (!row) continue
    row.calls = Number(t.calls)
    row.second_appointments = Number(t.second_appointments)
    row.mandates = Number(t.mandates)
    row.offers = Number(t.offers)
    row.deposits = Number(t.deposits)
    row.closings = Number(t.closings)
    row.weeks_submitted = Number(t.weeks_submitted)
    row.xp_total = Number(t.xp_total)
    row.demand = Number(t.demand)
    row.showings = Number(t.showings)
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
  // Same SQL-side SUM as getOfficeActivityMetrics above (migration
  // 20260711150000) instead of fetching every weekly_submissions row and
  // reducing five separate times in JS.
  const { data } = await sb.rpc('get_office_conversion_totals', { p_agency_id: agencyId }).maybeSingle() as
    { data: { tot_calls: number; tot_appt1: number; tot_appt2: number; tot_list: number; tot_deals: number; weeks_of_data: number } | null }
  const weeksOfData = Number(data?.weeks_of_data ?? 0)
  if (weeksOfData === 0) return { cr_call_appt1: null, cr_appt1_appt2: null, cr_appt2_listing: null, cr_listing_deal: null, weeks_of_data: 0 }

  const totCalls = Number(data!.tot_calls)
  const totAppt1 = Number(data!.tot_appt1)
  const totAppt2 = Number(data!.tot_appt2)
  const totList  = Number(data!.tot_list)
  const totDeals = Number(data!.tot_deals)

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
    weeks_of_data: weeksOfData,
  }
}
