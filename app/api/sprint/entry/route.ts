import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthedAgent } from '@/lib/auth'
import { getWeekInfo } from '@/lib/weekInfo'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// Sprint's 3 generic counters map onto specific weekly_submissions columns —
// a sprint is a timed cold-calling session, so its calls/leads/appointments
// are cold_calls/leads_cold/a phone-set 1st appointment specifically, not a
// fourth parallel counter system. Weights match app/api/submit/route.js's
// XP_MAP for these same fields, so sprint activity earns the same XP a
// manually-entered weekly submission would.
const FIELD_MAP: Record<string, { column: string; xpWeight: number }> = {
  calls:        { column: 'cold_calls',          xpWeight: 1 },
  leads:        { column: 'leads_cold',          xpWeight: 3 },
  appointments: { column: 'meet1_seller_phone',  xpWeight: 10 },
}

// POST { sprint_id, field, value } — value is the new absolute count (same
// contract app/sprint/page.tsx already used for its direct upsert); this
// route additionally folds the delta into the agent's current week's
// weekly_submissions row so sprint activity isn't siloed from Μετρησιμότητα.
export async function POST(req: NextRequest) {
  const caller = await getAuthedAgent(req)
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { sprint_id, field, value } = await req.json() as { sprint_id: string; field: string; value: number }
  const mapping = FIELD_MAP[field]
  if (!sprint_id || !mapping || typeof value !== 'number' || value < 0) {
    return NextResponse.json({ error: 'Invalid sprint_id/field/value' }, { status: 400 })
  }

  const { data: sprint } = await sb.from('sprint_sessions').select('id, agency_id').eq('id', sprint_id).single()
  if (!sprint || (sprint.agency_id && sprint.agency_id !== caller.agency_id)) {
    return NextResponse.json({ error: 'Sprint not found' }, { status: 404 })
  }

  const { data: existingEntry } = await sb.from('sprint_entries').select('*')
    .eq('sprint_id', sprint_id).eq('agent_id', caller.id).maybeSingle()

  const delta = value - (existingEntry?.[field] || 0)

  const { error: entryErr } = await sb.from('sprint_entries').upsert({
    sprint_id, agent_id: caller.id, agency_id: caller.agency_id,
    calls: existingEntry?.calls || 0, leads: existingEntry?.leads || 0, appointments: existingEntry?.appointments || 0,
    [field]: value, updated_at: new Date().toISOString(),
  }, { onConflict: 'sprint_id,agent_id' })
  if (entryErr) return NextResponse.json({ error: entryErr.message }, { status: 500 })

  if (delta !== 0) {
    const { week, year } = getWeekInfo(new Date())
    const { data: existingWeek } = await sb.from('weekly_submissions').select('*')
      .eq('agent_id', caller.id).eq('week_number', week).eq('year', year).maybeSingle()

    const newFieldValue = (existingWeek?.[mapping.column] || 0) + delta
    const newXp = (existingWeek?.xp_earned || 0) + delta * mapping.xpWeight

    const { error: weekErr } = await sb.from('weekly_submissions').upsert({
      agent_id: caller.id, agency_id: caller.agency_id, week_number: week, year,
      ...(existingWeek || {}), id: existingWeek?.id, // preserve other fields already entered this week
      [mapping.column]: newFieldValue, xp_earned: newXp,
      is_editable: existingWeek?.is_editable ?? true, updated_at: new Date().toISOString(),
    }, { onConflict: 'agent_id,week_number,year' })
    if (weekErr) return NextResponse.json({ error: weekErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
