import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthedAgent, isCeoOrAdmin } from '@/lib/auth'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(req: NextRequest) {
  const caller = await getAuthedAgent(req)
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const date = req.nextUrl.searchParams.get('date')
  const { data, error } = await supabase.from('room_bookings').select('*, agents(full_name)').eq('date', date).eq('agency_id', caller.agency_id)
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const caller = await getAuthedAgent(req)
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { id } = await req.json()
  // Only the agent who made the booking, or CEO/Admin, can cancel it.
  const { data: booking } = await supabase.from('room_bookings').select('agent_id,agency_id').eq('id', id).single()
  if (!booking || booking.agency_id !== caller.agency_id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (booking.agent_id !== caller.id && !isCeoOrAdmin(caller)) {
    return NextResponse.json({ error: 'Δεν μπορείς να ακυρώσεις κράτηση άλλου μεσίτη' }, { status: 403 })
  }

  const { error } = await supabase.from('room_bookings').delete().eq('id', id)
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json({ ok: true })
}
