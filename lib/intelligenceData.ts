// Shared aggregation for the Intelligence dashboard + AI chat context.
// Computes everything from the real `properties` table, scoped to one
// agency — nothing here is hardcoded. Previously both the dashboard page and
// the chat route had a real agency's actual numbers (agent names, revenue,
// concentration risk) frozen into source code with no access control and no
// way to update — replaced with this, so it's live, agency-scoped, and only
// reachable by an authenticated agent of that agency.
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export type Insight = { type: 'warning' | 'opportunity' | 'insight'; icon: string; title: string; text: string }

export async function getIntelligenceData(agency_id: string) {
  // No .limit() here on purpose — this computes real aggregate stats
  // (totals, averages, concentration risk) across the whole agency, so
  // truncating the row set would silently make the dashboard's numbers
  // wrong, not just slow. Fine at today's row counts; if this ever becomes
  // a real bottleneck, the fix is pushing the aggregation into SQL (same
  // pattern as lib/officeMetrics.ts's get_agent_activity_totals RPC), not
  // a naive row cap.
  const { data: rows } = await supabase
    .from('properties')
    .select('agent_name,area,price_asking,price_final,price_sqm_final,sqm,property_type,deal_type')
    .eq('agency_id', agency_id)

  // price_final (actual closed price) when the deal is done, else price_asking
  // for still-active listings — properties.price/.price_per_sqm/.transaction_type
  // don't exist on the live schema (real columns above); this function was
  // silently returning all-zero data on every call until this fix, since a
  // select referencing a nonexistent column fails the whole query.
  const props = (rows || []).map(p => ({
    ...p,
    price: p.price_final ?? p.price_asking ?? 0,
    pricePerSqm: p.price_sqm_final ?? (p.sqm && p.price_asking ? Math.round(p.price_asking / p.sqm) : null),
  }))
  const sales = props.filter(p => p.deal_type === 'sale')
  const rentals = props.filter(p => p.deal_type === 'rental')
  const portfolioValue = sales.reduce((s, p) => s + p.price, 0)
  const avgSale = sales.length ? Math.round(sales.reduce((s, p) => s + p.price, 0) / sales.length) : 0
  const avgRental = rentals.length ? Math.round(rentals.reduce((s, p) => s + p.price, 0) / rentals.length) : 0
  const totalCount = props.length || 1

  const byAgent: Record<string, { name: string; total: number; sales: number; rentals: number; portfolio: number }> = {}
  props.forEach(p => {
    const name = p.agent_name || 'Άγνωστος'
    if (!byAgent[name]) byAgent[name] = { name, total: 0, sales: 0, rentals: 0, portfolio: 0 }
    byAgent[name].total++
    if (p.deal_type === 'sale') { byAgent[name].sales++; byAgent[name].portfolio += p.price }
    else byAgent[name].rentals++
  })
  const agents = Object.values(byAgent)
    .map(a => ({ ...a, pct: Math.round((a.total / totalCount) * 1000) / 10 }))
    .sort((a, b) => b.total - a.total)

  const byArea: Record<string, { area: string; count: number; sumPsqm: number; n: number }> = {}
  props.forEach(p => {
    const area = p.area || 'Άγνωστη'
    if (!byArea[area]) byArea[area] = { area, count: 0, sumPsqm: 0, n: 0 }
    byArea[area].count++
    if (p.pricePerSqm) { byArea[area].sumPsqm += p.pricePerSqm; byArea[area].n++ }
  })
  const areas = Object.values(byArea).sort((a, b) => b.count - a.count).slice(0, 8).map(a => ({ area: a.area, count: a.count }))
  const psqm = Object.values(byArea).filter(a => a.n > 0)
    .map(a => ({ area: a.area, price_sqm: Math.round(a.sumPsqm / a.n), n: a.n }))
    .sort((a, b) => b.price_sqm - a.price_sqm).slice(0, 6)

  const byType: Record<string, number> = {}
  props.forEach(p => { const t = p.property_type || 'Άλλο'; byType[t] = (byType[t] || 0) + 1 })
  const types = Object.entries(byType)
    .map(([type, count]) => ({ type, count, pct: Math.round((count / totalCount) * 1000) / 10 }))
    .sort((a, b) => b.count - a.count)

  // Rules-based insights — not hardcoded, derived from the numbers above.
  const insights: Insight[] = []
  const top = agents[0]
  if (top && top.pct > 50) {
    insights.push({ type: 'warning', icon: '⚠️', title: 'Συγκέντρωση ρίσκου', text: `${top.name} κατέχει το ${top.pct}% του χαρτοφυλακίου (${top.total}/${props.length}). Τυχόν αποχώρηση θα επηρεάσει κρίσιμα τον τζίρο.` })
  }
  if (psqm[0]) {
    insights.push({ type: 'opportunity', icon: '📈', title: 'Premium περιοχή', text: `${psqm[0].area} €${psqm[0].price_sqm.toLocaleString('el-GR')}/τμ — το ακριβότερο segment στο χαρτοφυλάκιο (n=${psqm[0].n}).` })
  }
  const rentalSharePct = props.length ? Math.round((rentals.length / props.length) * 100) : 0
  insights.push({ type: 'insight', icon: '📊', title: 'Sales/Rentals mix', text: `${100 - rentalSharePct}% πωλήσεις vs ${rentalSharePct}% ενοικιάσεις, σε σύνολο ${props.length} ακινήτων.` })
  if (types[0]) {
    insights.push({ type: 'insight', icon: '💡', title: 'Mix ακινήτων', text: `${types[0].type} είναι ο κυρίαρχος τύπος (${types[0].pct}%).` })
  }

  return {
    totals: { portfolioValue, avgSale, avgRental, salesCount: sales.length, rentalCount: rentals.length, totalCount: props.length },
    insights, agents, areas, psqm, types
  }
}
