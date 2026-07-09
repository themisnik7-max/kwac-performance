import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthedAgent, isCeoOrAdmin } from '@/lib/auth'
import { getOfficeConversionRates } from '@/lib/officeMetrics'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// Office-wide analog of /api/gps — admin/CEO only, since this sets the
// office-level target the "GPS Γραφείου" tab in Intelligence OP reverse-
// engineers into required weekly activity across the whole team.
export async function GET(req: NextRequest) {
  const caller = await getAuthedAgent(req)
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (!isCeoOrAdmin(caller)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: goal } = await sb.from('office_gps_goals').select('*').eq('agency_id', caller.agency_id).maybeSingle()
  const realRates = await getOfficeConversionRates(sb, caller.agency_id)

  return NextResponse.json({ goal, realRates })
}

export async function POST(req: NextRequest) {
  const caller = await getAuthedAgent(req)
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (!isCeoOrAdmin(caller)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { data, error } = await sb.from('office_gps_goals').upsert(
    { agency_id: caller.agency_id, ...body, updated_at: new Date().toISOString() },
    { onConflict: 'agency_id' }
  ).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
