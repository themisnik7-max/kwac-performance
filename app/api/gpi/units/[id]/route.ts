import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthedAgent, isCeoOrAdmin } from '@/lib/auth'
import { canAccessGpiClient, GPI_UNIT_FIELDS, type GpiClientRow } from '@/lib/gpi'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function loadUnitWithClient(id: string) {
  const { data: unit } = await db.from('gpi_units').select('*').eq('id', id).single()
  if (!unit) return null
  const { data: client } = await db.from('gpi_clients').select('*').eq('id', unit.client_id).single()
  return client ? { unit, client: client as GpiClientRow } : null
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const caller = await getAuthedAgent(req)
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const found = await loadUnitWithClient(params.id)
  if (!found || !canAccessGpiClient(caller, found.client)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const f of GPI_UNIT_FIELDS) if (body[f] !== undefined) patch[f] = body[f]

  const { data, error } = await db.from('gpi_units').update(patch).eq('id', params.id).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ unit: data })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const caller = await getAuthedAgent(req)
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const found = await loadUnitWithClient(params.id)
  if (!found || !canAccessGpiClient(caller, found.client)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (found.client.agent_id !== caller.id && !isCeoOrAdmin(caller))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await db.from('gpi_units').delete().eq('id', params.id)
  return NextResponse.json({ ok: true })
}
