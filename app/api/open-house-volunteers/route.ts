import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthedAgent, canActAs } from '@/lib/auth'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const caller = await getAuthedAgent(req)
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { open_house_id, agent_id } = await req.json()
  if (!canActAs(caller, agent_id)) {
    return NextResponse.json({ error: 'Δεν μπορείς να δηλώσεις συμμετοχή για άλλον μεσίτη' }, { status: 403 })
  }

  // Check current volunteer count
  const { data: existing, error: countErr } = await supabase
    .from('open_house_volunteers')
    .select('id, agent_id, agents(full_name)')
    .eq('open_house_id', open_house_id)

  if (countErr) return NextResponse.json({ error: countErr.message }, { status: 500 })
  if (existing && existing.length >= 2) {
    return NextResponse.json({ error: 'Οι 2 θέσεις εθελοντών έχουν συμπληρωθεί', full: true }, { status: 400 })
  }

  const alreadyIn = existing?.find(v => v.agent_id === agent_id)
  if (alreadyIn) {
    return NextResponse.json({ error: 'Έχεις ήδη δηλώσει συμμετοχή', already: true }, { status: 400 })
  }

  const { error } = await supabase.from('open_house_volunteers').insert({ open_house_id, agent_id, agency_id: caller.agency_id })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const caller = await getAuthedAgent(req)
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { open_house_id, agent_id } = await req.json()
  // Previously anyone could remove anyone else's signup just by knowing the
  // ids — now only the volunteer themselves or CEO/Admin can withdraw it.
  if (!canActAs(caller, agent_id)) {
    return NextResponse.json({ error: 'Δεν μπορείς να αποσύρεις τη συμμετοχή άλλου μεσίτη' }, { status: 403 })
  }

  const { error } = await supabase.from('open_house_volunteers')
    .delete().eq('open_house_id', open_house_id).eq('agent_id', agent_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function GET(req: NextRequest) {
  const caller = await getAuthedAgent(req)
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const open_house_id = req.nextUrl.searchParams.get('open_house_id')
  const { data, error } = await supabase
    .from('open_house_volunteers')
    .select('*, agents(full_name, email)')
    .eq('open_house_id', open_house_id)
    .eq('agency_id', caller.agency_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
