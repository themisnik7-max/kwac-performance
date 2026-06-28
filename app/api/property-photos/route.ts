import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@supabase/supabase-js'

const SUPABASE_URL     = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON    = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const BUCKET           = 'property-images'
const MAX_FILE_MB      = 15

async function resolveUser(token: string) {
  const c = createClient(SUPABASE_URL, SUPABASE_ANON, { auth: { persistSession: false } })
  const { data: { user }, error } = await c.auth.getUser(token)
  if (error || !user) return null
  return user
}

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

// POST multipart: field "property_id" + multiple "photos" files
export async function POST(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? ''
  const user  = await resolveUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Resolve agency
  let agencyId: string | null = null
  const { data: agentRow } = await db.from('agents').select('agency_id').eq('id', user.id).single()
  if (agentRow?.agency_id) {
    agencyId = agentRow.agency_id
  } else {
    const { data: agency } = await db.from('agencies').select('id').order('created_at').limit(1).single()
    agencyId = agency?.id ?? null
  }
  if (!agencyId) return NextResponse.json({ error: 'No agency' }, { status: 403 })

  const form       = await req.formData()
  const propertyId = form.get('property_id') as string | null
  if (!propertyId) return NextResponse.json({ error: 'property_id required' }, { status: 400 })

  // Verify property belongs to this agent or admin
  const { data: prop } = await db
    .from('meeting_properties')
    .select('id, agent_id, agency_id')
    .eq('id', propertyId)
    .single()
  if (!prop) return NextResponse.json({ error: 'Property not found' }, { status: 404 })

  const photos = form.getAll('photos') as File[]
  if (!photos.length) return NextResponse.json({ error: 'No photos' }, { status: 400 })

  const results: { url: string; path: string; name: string }[] = []
  const errors:  string[] = []

  for (const file of photos) {
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      errors.push(`${file.name}: exceeds ${MAX_FILE_MB}MB`)
      continue
    }

    const ext  = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
    const path = `${agencyId}/${propertyId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    const { error: upErr } = await db.storage
      .from(BUCKET)
      .upload(path, await file.arrayBuffer(), {
        contentType: file.type || 'image/jpeg',
        upsert:      false,
      })

    if (upErr) { errors.push(`${file.name}: ${upErr.message}`); continue }

    const { data: pub } = db.storage.from(BUCKET).getPublicUrl(path)
    const url = pub.publicUrl

    const { error: dbErr } = await db.from('property_photos').insert({
      agency_id:     agencyId,
      property_id:   propertyId,
      uploaded_by:   user.id,
      storage_path:  path,
      url,
      original_name: file.name,
      size_bytes:    file.size,
    })

    if (dbErr) { errors.push(`${file.name}: DB error ${dbErr.message}`); continue }

    results.push({ url, path, name: file.name })
  }

  return NextResponse.json({ uploaded: results, errors })
}

// GET ?property_id=xxx — list photos for a property
export async function GET(req: NextRequest) {
  const token      = req.headers.get('Authorization')?.replace('Bearer ', '') ?? ''
  const user       = await resolveUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const propertyId = req.nextUrl.searchParams.get('property_id')
  if (!propertyId) return NextResponse.json({ error: 'property_id required' }, { status: 400 })

  const { data, error } = await db
    .from('property_photos')
    .select('id, url, original_name, size_bytes, created_at')
    .eq('property_id', propertyId)
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ photos: data ?? [] })
}

// DELETE ?id=photo_uuid — remove a photo
export async function DELETE(req: NextRequest) {
  const token   = req.headers.get('Authorization')?.replace('Bearer ', '') ?? ''
  const user    = await resolveUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const photoId = req.nextUrl.searchParams.get('id')
  if (!photoId) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { data: photo } = await db
    .from('property_photos')
    .select('storage_path, uploaded_by')
    .eq('id', photoId)
    .single()

  if (!photo) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (photo.uploaded_by !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await db.storage.from(BUCKET).remove([photo.storage_path])
  await db.from('property_photos').delete().eq('id', photoId)

  return NextResponse.json({ ok: true })
}
