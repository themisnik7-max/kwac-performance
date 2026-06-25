import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthedAgent } from '@/lib/auth'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const caller = await getAuthedAgent(req)
  if (!caller) return NextResponse.json({ ok: false }, { status: 401 })

  const { phone, contact_id } = await req.json()
  if (!phone) return NextResponse.json({ ok: false }, { status: 400 })

  const now = new Date()

  await sb.from('call_events').insert({
    agent_id:   caller.id,
    agency_id:  caller.agency_id,
    contact_id: contact_id ?? null,
    phone,
    called_at:  now.toISOString(),
  })

  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  weekStart.setHours(0, 0, 0, 0)

  await sb.rpc('increment_weekly_call_count', {
    p_agent_id:   caller.id,
    p_agency_id:  caller.agency_id,
    p_week_start: weekStart.toISOString().split('T')[0],
  })

  return NextResponse.json({ ok: true })
}

export async function GET(req: NextRequest) {
  const caller = await getAuthedAgent(req)
  if (!caller) return NextResponse.json({ count: 0 }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const weekStart = searchParams.get('week_start')
  if (!weekStart) return NextResponse.json({ count: 0 })

  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 7)

  const { count } = await sb
    .from('call_events')
    .select('*', { count: 'exact', head: true })
    .eq('agent_id', caller.id)
    .gte('called_at', weekStart)
    .lt('called_at', weekEnd.toISOString())

  return NextResponse.json({ count: count ?? 0 })
}