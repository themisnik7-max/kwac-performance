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

  // Row-locked, single-transaction RPC — see migration
  // 20260711120500_atomic_sprint_entry_fold.sql. Replaces a JS
  // read-modify-write that lost updates under concurrent requests (double
  // tap, two devices, two fields updated close together).
  const { week, year } = getWeekInfo(new Date())
  const { error } = await sb.rpc('upsert_sprint_entry_and_fold', {
    p_sprint_id: sprint_id, p_agent_id: caller.id, p_agency_id: caller.agency_id,
    p_field: field, p_value: value,
    p_week_column: mapping.column, p_xp_weight: mapping.xpWeight,
    p_week_number: week, p_year: year,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
