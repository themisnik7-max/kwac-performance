// app/api/intelligence-agent/route.ts
// Personal intelligence for agents: weekly_submissions + sprint_entries vs GPS targets
// CEO endpoint is unchanged — uses /api/intelligence

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthedAgent } from '@/lib/auth'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const agent = await getAuthedAgent(req)
  if (!agent) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const agentId   = agent.id
  const agencyId  = agent.agency_id
  const now       = new Date()
  const thisYear  = now.getFullYear()
  // ISO week number
  const startOfYear = new Date(thisYear, 0, 1)
  const dayOfYear   = Math.floor((now.getTime() - startOfYear.getTime()) / 86400000)
  const thisWeek    = Math.ceil((dayOfYear + startOfYear.getDay() + 1) / 7)

  // These 5 queries are independent of each other — fire them together
  // instead of awaiting one at a time.
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const [
    { data: gps },
    { data: submissions },
    { data: sprintEntries },
    { count: dealsThisMonth },
    { count: activeListings },
  ] = await Promise.all([
    // 1. GPS Goal
    sb.from('gps_goals').select('*').eq('agent_id', agentId)
      .order('created_at', { ascending: false }).limit(1).maybeSingle(),
    // 2. Last 8 weekly submissions
    sb.from('weekly_submissions').select('*').eq('agent_id', agentId)
      .order('year', { ascending: false }).order('week_number', { ascending: false }).limit(8),
    // 3. Sprint entries (last 6 sprints)
    sb.from('sprint_entries').select('*, sprint_sessions(label, date)').eq('agent_id', agentId)
      .order('updated_at', { ascending: false }).limit(6),
    // 4. This agent's closed deals this month
    sb.from('properties').select('*', { count: 'exact', head: true })
      .eq('agent_id', agentId).eq('status', 'sold').gte('sold_at', monthStart),
    // 5. Active listings count
    sb.from('properties').select('*', { count: 'exact', head: true })
      .eq('agent_id', agentId).neq('status', 'sold'),
  ])

  // ── Compute weekly averages from submissions ──────────────────────────────
  const subs = submissions || []
  const avg = (field: string) =>
    subs.length > 0
      ? Math.round(subs.reduce((s, r) => s + (r[field] || 0), 0) / subs.length)
      : 0

  const avgCalls      = avg('calls')
  const avgLeads      = avg('leads')
  const avgAppt1      = avg('appt1')
  const avgAppt2      = avg('appt2')
  const avgContracts  = avg('contracts')
  const avgExclusives = avg('exclusives')

  // ── Compare to GPS targets ────────────────────────────────────────────────
  const gpsData = gps ? {
    targetIncome:    gps.target_income,
    avgPrice:        gps.avg_property_price,
    commRate:        gps.commission_rate,
    split:           gps.agent_split,
    workWeeks:       gps.work_weeks,
    crCallAppt1:     gps.cr_call_appt1,
    crAppt1Appt2:    gps.cr_appt1_appt2,
    crAppt2Listing:  gps.cr_appt2_listing,
    crListingDeal:   gps.cr_listing_deal,
  } : null

  // Weekly targets derived from GPS
  let weeklyTargets: Record<string, number> | null = null
  if (gpsData) {
    const perDeal        = gpsData.avgPrice * (gpsData.commRate / 100) * (gpsData.split / 100)
    const dealsNeeded    = Math.ceil(gpsData.targetIncome / perDeal)
    const listingsNeeded = Math.ceil(dealsNeeded / (gpsData.crListingDeal / 100))
    const appt2Needed    = Math.ceil(listingsNeeded / (gpsData.crAppt2Listing / 100))
    const appt1Needed    = Math.ceil(appt2Needed / (gpsData.crAppt1Appt2 / 100))
    const callsNeeded    = Math.ceil(appt1Needed / (gpsData.crCallAppt1 / 100))
    const wks            = gpsData.workWeeks || 48

    weeklyTargets = {
      calls:    Math.ceil(callsNeeded / wks),
      appt1:    Math.ceil(appt1Needed / wks),
      appt2:    Math.ceil(appt2Needed / wks),
      listings: Math.ceil(listingsNeeded / wks),
      deals:    Math.ceil(dealsNeeded / wks),
    }
  }

  // ── Generate coaching insights ────────────────────────────────────────────
  const insights: string[] = []

  if (!gps) {
    insights.push('🎯 Δεν έχεις ορίσει GPS στόχο ακόμα. Πήγαινε στο GPS και βάλε τον ετήσιο σου στόχο να ξεκινήσουμε τη μέτρηση.')
  }

  if (subs.length === 0) {
    insights.push('📋 Δεν υπάρχουν εβδομαδιαίες καταχωρήσεις ακόμα. Κάνε submit τη Μετρησιμότητά σου κάθε Παρασκευή.')
  } else {
    const thisWeekSub = subs.find(s => s.week_number === thisWeek && s.year === thisYear)
    if (!thisWeekSub) {
      insights.push('⚠️ Δεν έχεις υποβάλει τη Μετρησιμότητα αυτής της εβδομάδας ακόμα. Κάνε το πριν το τέλος της Παρασκευής.')
    } else {
      insights.push(`✅ Μετρησιμότητα εβδομάδας ${thisWeek} υποβλήθηκε. Calls: ${thisWeekSub.calls || 0}, Leads: ${thisWeekSub.leads || 0}, Ραντεβού: ${(thisWeekSub.appt1 || 0) + (thisWeekSub.appt2 || 0)}`)
    }

    if (weeklyTargets) {
      const callGap = weeklyTargets.calls - avgCalls
      if (callGap > 5)  insights.push(`📞 Calls: κάνεις κατά μέσο όρο ${avgCalls}/εβδ ενώ ο στόχος σου είναι ${weeklyTargets.calls}. Χρειάζεσαι +${callGap} calls/εβδομάδα για να χτυπήσεις τον στόχο.`)
      if (callGap <= 0) insights.push(`🔥 Calls: πάνω από τον εβδομαδιαίο στόχο! (${avgCalls} vs ${weeklyTargets.calls} target). Συνέχισε.`)

      const apptGap = weeklyTargets.appt1 - avgAppt1
      if (apptGap > 2) insights.push(`🗓️ 1α Ραντεβού: ${avgAppt1}/εβδ vs στόχο ${weeklyTargets.appt1}. Δούλεψε το conversion rate απ' τα calls.`)
    }

    // Conversion rate analysis
    if (avgCalls > 0 && avgAppt1 > 0) {
      const actualCR = Math.round((avgAppt1 / avgCalls) * 100)
      const targetCR = gpsData?.crCallAppt1 || 10
      if (actualCR < targetCR - 3) {
        insights.push(`📉 CR Call→Ραντεβού: ${actualCR}% (στόχος ${targetCR}%). Δούλεψε το script σου — κάθε extra call που μετατρέπεται σου φέρνει €${Math.round((gpsData?.avgPrice || 200000) * (gpsData?.commRate || 4) / 100 * (gpsData?.split || 70) / 100 / (gpsData?.crListingDeal || 50) * 100).toLocaleString('el-GR')}.`)
      } else if (actualCR > targetCR) {
        insights.push(`💪 CR Call→Ραντεβού: ${actualCR}% — πάνω από τον στόχο σου (${targetCR}%). Εξαιρετικό.`)
      }
    }

    if (subs.length >= 4) {
      // Trend: is performance improving?
      const recent2 = subs.slice(0, 2).reduce((s, r) => s + (r.calls || 0), 0) / 2
      const older2  = subs.slice(2, 4).reduce((s, r) => s + (r.calls || 0), 0) / 2
      if (recent2 > older2 * 1.15) insights.push('📈 Trend: τα calls σου ανεβαίνουν τις τελευταίες εβδομάδες. Keep it up!')
      if (recent2 < older2 * 0.85) insights.push('📉 Trend: τα calls σου έπεσαν τις τελευταίες 2 εβδομάδες vs πριν. Τι άλλαξε;')
    }
  }

  // Sprint insights
  if (sprintEntries && sprintEntries.length > 0) {
    const lastSprint = sprintEntries[0]
    const total = (lastSprint.calls || 0) + (lastSprint.leads || 0) + (lastSprint.appointments || 0)
    insights.push(`🏃 Τελευταίο Sprint "${(lastSprint as any).sprint_sessions?.label || ''}": ${total} actions (${lastSprint.calls || 0} calls, ${lastSprint.leads || 0} leads, ${lastSprint.appointments || 0} ραντ.)`)
  } else {
    insights.push('🏃 Δεν έχεις συμμετάσχει σε Sprint ακόμα. Κοίτα την ενότητα Sprint για live leaderboard.')
  }

  // Deal closing insight
  if (weeklyTargets && gpsData) {
    const monthlyTarget = Math.ceil(gpsData.targetIncome / 12)
    const revenueThisMonth = (dealsThisMonth || 0) * gpsData.avgPrice * (gpsData.commRate / 100) * (gpsData.split / 100)
    insights.push(`💰 Αυτόν τον μήνα: ${dealsThisMonth || 0} deals (≈€${Math.round(revenueThisMonth).toLocaleString('el-GR')} έσοδα) έναντι μηνιαίου στόχου €${Math.round(monthlyTarget).toLocaleString('el-GR')}.`)
  }

  return NextResponse.json({
    agent: { id: agentId, name: agent.full_name, role: agent.role },
    gps: gpsData,
    weeklyTargets,
    actuals: {
      avgCalls, avgLeads, avgAppt1, avgAppt2, avgContracts, avgExclusives,
      submissionsCount: subs.length,
      activeListings:   activeListings || 0,
      dealsThisMonth:   dealsThisMonth || 0,
    },
    submissions: subs,
    sprintEntries: sprintEntries || [],
    insights,
  })
}
