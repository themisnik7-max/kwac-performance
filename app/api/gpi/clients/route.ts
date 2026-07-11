import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthedAgent, isCeoOrAdmin } from '@/lib/auth'
import { redactGpiClient, encryptGpiCredentials, hasGpiFeatureAccess, type GpiClientRow } from '@/lib/gpi'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// GET — list clients: agents see only their own, CEO/Admin see the whole agency.
export async function GET(req: NextRequest) {
  const caller = await getAuthedAgent(req)
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasGpiFeatureAccess(caller)) return NextResponse.json({ error: 'GPI δεν είναι διαθέσιμο για τον λογαριασμό σου' }, { status: 403 })

  let query = db.from('gpi_clients').select('*').eq('agency_id', caller.agency_id).order('created_at', { ascending: false }).limit(1000)
  if (!isCeoOrAdmin(caller)) query = query.eq('agent_id', caller.id)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const clients = (data as GpiClientRow[] || []).map(row => {
    const { id_passport_photo_path, ...redacted } = redactGpiClient(row)
    return { ...redacted, has_id_photo: !!id_passport_photo_path }
  })
  return NextResponse.json({ clients })
}

// POST — create a client, assigned to the caller unless CEO/Admin assigns someone else.
export async function POST(req: NextRequest) {
  const caller = await getAuthedAgent(req)
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasGpiFeatureAccess(caller)) return NextResponse.json({ error: 'GPI δεν είναι διαθέσιμο για τον λογαριασμό σου' }, { status: 403 })

  const body = await req.json()
  if (!body.full_name) return NextResponse.json({ error: 'full_name required' }, { status: 400 })

  let assignedAgentId = caller.id
  if (body.agent_id && body.agent_id !== caller.id) {
    if (!isCeoOrAdmin(caller)) return NextResponse.json({ error: 'Μόνο CEO/Admin μπορεί να αναθέσει πελάτη σε άλλον agent' }, { status: 403 })
    const { data: target } = await db.from('agents').select('agency_id').eq('id', body.agent_id).single()
    if (!target || target.agency_id !== caller.agency_id) return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    assignedAgentId = body.agent_id
  }

  const { data, error } = await db.from('gpi_clients').insert({
    agency_id: caller.agency_id,
    agent_id: assignedAgentId,
    full_name: body.full_name,
    father_name: body.father_name || null,
    tin_number: body.tin_number || null,
    id_passport_number: body.id_passport_number || null,
    address: body.address || null,
    bank_account: body.bank_account || null,
    ...encryptGpiCredentials(body),
  }).select('*').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ client: redactGpiClient(data as GpiClientRow) })
}
