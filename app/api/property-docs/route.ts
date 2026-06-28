import { NextRequest, NextResponse } from 'next/server'
import { getAuthedAgent }            from '@/lib/auth'
import { createClient }              from '@supabase/supabase-js'

const db     = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const BUCKET = 'property-docs'
const MAX_MB = 50

const CATEGORY_LABELS: Record<string, string> = {
  title_deed:   'Τίτλος Ιδιοκτησίας',
  floor_plan:   'Κατόψεις',
  constitution: 'Σύσταση',
  regulations:  'Κανονισμός Πολυκατοικίας',
  topographic:  'Τοπογραφικό',
  assignment:   'Εντολή Ανάθεσης',
  viewing:      'Έντυπο Υπόδειξης',
  offer:        'Έντυπο Προσφοράς',
  deposit:      'Προκαταβολή',
  contract:     'Συμβόλαιο',
  other:        'Άλλο',
}

// POST multipart: field "property_id" + "category" + multiple "docs" files
export async function POST(req: NextRequest) {
  const caller = await getAuthedAgent(req)
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const form       = await req.formData()
  const propertyId = form.get('property_id') as string | null
  const category   = form.get('category')   as string | null
  const notes      = form.get('notes')      as string | null

  if (!propertyId) return NextResponse.json({ error: 'property_id required' }, { status: 400 })
  if (!category || !CATEGORY_LABELS[category])
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 })

  // Verify property belongs to same agency
  const { data: prop } = await db
    .from('meeting_properties')
    .select('id, agent_id, agency_id')
    .eq('id', propertyId)
    .single()
  if (!prop || prop.agency_id !== caller.agency_id)
    return NextResponse.json({ error: 'Property not found' }, { status: 404 })

  const docs   = form.getAll('docs') as File[]
  if (!docs.length) return NextResponse.json({ error: 'No files' }, { status: 400 })

  const results: { url: string; path: string; name: string; id: string }[] = []
  const errors:  string[] = []

  for (const file of docs) {
    if (file.size > MAX_MB * 1024 * 1024) {
      errors.push(`${file.name}: υπερβαίνει ${MAX_MB}MB`); continue
    }
    const ext  = file.name.split('.').pop()?.toLowerCase() ?? 'pdf'
    const path = `${caller.agency_id}/${propertyId}/${category}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    const { error: upErr } = await db.storage
      .from(BUCKET)
      .upload(path, await file.arrayBuffer(), { contentType: file.type || 'application/pdf', upsert: false })

    if (upErr) { errors.push(`${file.name}: ${upErr.message}`); continue }

    // Signed URL (1 year) — private bucket
    const { data: signed } = await db.storage.from(BUCKET).createSignedUrl(path, 31536000)
    const url = signed?.signedUrl ?? ''

    const { data: row, error: dbErr } = await db.from('property_documents').insert({
      agency_id:     caller.agency_id,
      property_id:   propertyId,
      uploaded_by:   caller.id,
      category,
      storage_path:  path,
      url,
      original_name: file.name,
      size_bytes:    file.size,
      notes:         notes ?? null,
    }).select('id').single()

    if (dbErr) { errors.push(`${file.name}: DB ${dbErr.message}`); continue }
    results.push({ id: row!.id, url, path, name: file.name })
  }

  return NextResponse.json({ uploaded: results, errors })
}

// GET ?property_id=xxx — list all docs for a property, grouped by category
export async function GET(req: NextRequest) {
  const caller     = await getAuthedAgent(req)
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const propertyId = req.nextUrl.searchParams.get('property_id')
  if (!propertyId) return NextResponse.json({ error: 'property_id required' }, { status: 400 })

  let query = db
    .from('property_documents')
    .select('id, category, original_name, size_bytes, notes, created_at, url, storage_path')
    .eq('property_id', propertyId)
    .order('category')
    .order('created_at')

  // Non-admin agents see only their own docs
  if (caller.role !== 'admin' && caller.role !== 'ceo')
    query = query.eq('uploaded_by', caller.id)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Refresh signed URLs (they expire — regenerate on fetch)
  const docs = await Promise.all((data ?? []).map(async d => {
    const { data: signed } = await db.storage.from(BUCKET).createSignedUrl(d.storage_path, 3600)
    return { ...d, url: signed?.signedUrl ?? d.url, label: CATEGORY_LABELS[d.category] ?? d.category }
  }))

  return NextResponse.json({ docs })
}

// DELETE ?id=doc_uuid
export async function DELETE(req: NextRequest) {
  const caller  = await getAuthedAgent(req)
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const docId = req.nextUrl.searchParams.get('id')
  if (!docId) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { data: doc } = await db
    .from('property_documents')
    .select('storage_path, uploaded_by, agency_id')
    .eq('id', docId)
    .single()

  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (doc.agency_id !== caller.agency_id)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  // Only uploader or admin/ceo can delete
  if (doc.uploaded_by !== caller.id && caller.role !== 'admin' && caller.role !== 'ceo')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await db.storage.from(BUCKET).remove([doc.storage_path])
  await db.from('property_documents').delete().eq('id', docId)

  return NextResponse.json({ ok: true })
}
