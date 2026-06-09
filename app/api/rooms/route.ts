import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get('date')
  const { data, error } = await supabase.from('room_bookings').select('*, agents(full_name)').eq('date', date)
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json(data)
}
export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  const { error } = await supabase.from('room_bookings').delete().eq('id', id)
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json({ ok: true })
}