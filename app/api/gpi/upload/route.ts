import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthedAgent } from '@/lib/auth'
import { canAccessGpiClient, type GpiClientRow } from '@/lib/gpi'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const BUCKET = 'gpi-documents'
const MAX_FILE_MB = 15

// POST multipart: field "client_id" + "file" (the ID/passport photo).
export async function POST(req: NextRequest) {
  const caller = await getAuthedAgent(req)
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const form = await req.formData()
  const clientId = form.get('client_id') as string | null
  const file = form.get('file') as File | null
  if (!clientId || !file) return NextResponse.json({ error: 'client_id and file required' }, { status: 400 })

  const { data: client } = await db.from('gpi_clients').select('*').eq('id', clientId).single()
  if (!client || !canAccessGpiClient(caller, client as GpiClientRow)) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  if (file.size > MAX_FILE_MB * 1024 * 1024) return NextResponse.json({ error: `Exceeds ${MAX_FILE_MB}MB` }, { status: 400 })

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const path = `${client.agency_id}/${clientId}/id-${Date.now()}.${ext}`

  const { error: upErr } = await db.storage.from(BUCKET).upload(path, await file.arrayBuffer(), {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  })
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  // Replace the previous photo, if any, so we don't accumulate orphaned files.
  if (client.id_passport_photo_path) await db.storage.from(BUCKET).remove([client.id_passport_photo_path])

  await db.from('gpi_clients').update({ id_passport_photo_path: path, updated_at: new Date().toISOString() }).eq('id', clientId)

  const { data: signed } = await db.storage.from(BUCKET).createSignedUrl(path, 3600)
  return NextResponse.json({ path, url: signed?.signedUrl || null })
}
