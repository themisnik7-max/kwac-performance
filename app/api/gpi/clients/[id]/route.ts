import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthedAgent, isCeoOrAdmin } from '@/lib/auth'
import { redactGpiClient, encryptGpiCredentials, canAccessGpiClient, hasGpiFeatureAccess, type GpiClientRow } from '@/lib/gpi'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const BUCKET = 'gpi-documents'

async function loadClient(id: string): Promise<GpiClientRow | null> {
  const { data } = await db.from('gpi_clients').select('*').eq('id', id).single()
  return data as GpiClientRow | null
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const caller = await getAuthedAgent(req)
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasGpiFeatureAccess(caller)) return NextResponse.json({ error: 'GPI δεν είναι διαθέσιμο για τον λογαριασμό σου' }, { status: 403 })

  const client = await loadClient(params.id)
  if (!client || !canAccessGpiClient(caller, client)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: units } = await db.from('gpi_units').select('*').eq('client_id', params.id).order('created_at')

  let id_photo_url: string | null = null
  if (client.id_passport_photo_path) {
    const { data: signed } = await db.storage.from(BUCKET).createSignedUrl(client.id_passport_photo_path, 3600)
    id_photo_url = signed?.signedUrl || null
  }

  return NextResponse.json({ client: { ...redactGpiClient(client), id_photo_url }, units: units || [] })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const caller = await getAuthedAgent(req)
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasGpiFeatureAccess(caller)) return NextResponse.json({ error: 'GPI δεν είναι διαθέσιμο για τον λογαριασμό σου' }, { status: 403 })

  const client = await loadClient(params.id)
  if (!client || !canAccessGpiClient(caller, client)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()

  if (body.agent_id && body.agent_id !== client.agent_id && !isCeoOrAdmin(caller))
    return NextResponse.json({ error: 'Μόνο CEO/Admin μπορεί να αλλάξει τον υπεύθυνο agent' }, { status: 403 })

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const f of ['full_name', 'father_name', 'tin_number', 'id_passport_number', 'address', 'bank_account', 'agent_id'] as const) {
    if (body[f] !== undefined) patch[f] = body[f]
  }
  Object.assign(patch, encryptGpiCredentials(body))

  const { data, error } = await db.from('gpi_clients').update(patch).eq('id', params.id).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ client: redactGpiClient(data as GpiClientRow) })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const caller = await getAuthedAgent(req)
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasGpiFeatureAccess(caller)) return NextResponse.json({ error: 'GPI δεν είναι διαθέσιμο για τον λογαριασμό σου' }, { status: 403 })

  const client = await loadClient(params.id)
  if (!client || !canAccessGpiClient(caller, client)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (client.agent_id !== caller.id && !isCeoOrAdmin(caller))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (client.id_passport_photo_path) await db.storage.from(BUCKET).remove([client.id_passport_photo_path])
  await db.from('gpi_clients').delete().eq('id', params.id)
  return NextResponse.json({ ok: true })
}
