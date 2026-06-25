import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthedAgent, isCeoOrAdmin } from '@/lib/auth'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

function isoWeekNumber(date: Date): number {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const jan4 = new Date(d.getFullYear(), 0, 4)
  return 1 + Math.round(((d.getTime() - jan4.getTime()) / 86400000 - 3 + ((jan4.getDay() + 6) % 7)) / 7)
}

export async function POST(req: NextRequest) {
  const caller = await getAuthedAgent(req)
  if (!caller)               return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isCeoOrAdmin(caller)) return NextResponse.json({ error: 'Forbidden' },    { status: 403 })

  const now = new Date()
  const week = isoWeekNumber(now)
  const year = now.getFullYear()

  const { data: nonCompliant } = await sb
    .from('agent_compliance')
    .select('full_name, email')
    .eq('agency_id', caller.agency_id)
    .eq('submitted_this_week', false)

  const names = (nonCompliant || []).map(a => a.full_name || a.email).filter(Boolean) as string[]
  const allSubmitted = names.length === 0

  const title = `⏰ Υπενθύμιση Μετρησιμότητας — W${week}/${String(year).slice(2)}`
  const content = allSubmitted
    ? `✅ Όλοι έχουν υποβάλλει για W${week}. Εξαιρετική εβδομάδα!`
    : `Εκκρεμεί υποβολή για: ${names.join(', ')}. Deadline: Κυριακή 23:59.`

  const { error } = await sb.from('announcements').insert({
    agency_id: caller.agency_id, agent_id: caller.id, title, content, is_system: true
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, pendingAgents: names, week, year, allSubmitted })
}