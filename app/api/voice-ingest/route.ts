import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@supabase/supabase-js'

const SUPABASE_URL     = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON    = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function resolveUser(token: string) {
  const c = createClient(SUPABASE_URL, SUPABASE_ANON, { auth: { persistSession: false } })
  const { data: { user }, error } = await c.auth.getUser(token)
  if (error || !user) return null
  return user
}

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { db: { schema: 'public' } })

// Body: { transcript, intent, fields, lead_id?, property_id?, meeting_id? }
// Fields are already reviewed & corrected by the agent — no LLM call here.
export async function POST(req: NextRequest) {

  // 1. Auth
  const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? ''
  const user  = await resolveUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 2. Resolve agency_id
  let agencyId: string | null = null
  const { data: agentRow } = await db.from('agents').select('agency_id').eq('id', user.id).single()
  if (agentRow?.agency_id) {
    agencyId = agentRow.agency_id
  } else {
    const { data: agency } = await db.from('agencies').select('id').order('created_at').limit(1).single()
    agencyId = agency?.id ?? null
  }
  if (!agencyId) return NextResponse.json({ error: 'No agency configured' }, { status: 403 })

  // 3. Parse body
  const body       = await req.json()
  const transcript = (body.transcript as string | undefined)?.trim()
  const intent     = body.intent     as string | undefined
  const fields     = (body.fields    as Record<string, unknown>) ?? {}
  const leadId     = body.lead_id    as string | null | undefined
  const propertyId = body.property_id as string | null | undefined
  const meetingId  = body.meeting_id  as string | null | undefined

  if (!transcript) return NextResponse.json({ error: 'No transcript' }, { status: 400 })

  // 4. Audit log
  const { data: note, error: noteErr } = await db
    .from('voice_notes')
    .insert({
      agency_id:   agencyId,
      agent_id:    user.id,
      lead_id:     leadId     ?? null,
      property_id: propertyId ?? null,
      meeting_id:  meetingId  ?? null,
      transcript,
      extracted:   { intent, ...fields },
    })
    .select('id')
    .single()

  if (noteErr) {
    console.error('[voice-ingest] voice_notes insert', noteErr)
    return NextResponse.json({ error: `DB error: ${noteErr.message}` }, { status: 500 })
  }

  // 5. Upsert profile
  if (intent === 'property_scouted') {
    const phone = fields.owner_phone as string | null

    const { error: upsertErr } = await db.from('property_scouted').upsert(
      {
        agency_id:         agencyId,
        agent_id:          user.id,
        raw_transcript:    transcript,
        owner_phone:       phone,
        owner_email:       fields.owner_email       ?? null,
        owner_name:        fields.owner_name        ?? null,
        transaction_type:  fields.transaction_type  ?? null,
        address:           fields.address           ?? null,
        area:              fields.area              ?? null,
        floor:             fields.floor             ?? null,
        size_sqm:          fields.size_sqm          ?? null,
        condition:         fields.condition         ?? null,
        year_built:        fields.year_built        ?? null,
        year_renovated:    fields.year_renovated    ?? null,
        rooms:             fields.rooms             ?? null,
        balcony:           fields.balcony           ?? null,
        parking:           fields.parking           ?? null,
        security_door:     fields.security_door     ?? null,
        asking_price:      fields.asking_price      ?? null,
        seller_motivation: fields.seller_motivation ?? null,
        seller_reason:     fields.seller_reason     ?? null,
        ai_summary:        fields.ai_summary        ?? null,
        features:          {},
      },
      { onConflict: 'agent_id,owner_phone', ignoreDuplicates: false }
    )

    if (upsertErr) console.error('[voice-ingest] property_scouted upsert', upsertErr)

    if (phone) {
      await db.rpc('append_voice_note_to_scouted', {
        p_agent_id: user.id, p_phone: phone, p_note_id: note.id,
      })
    }
  }

  if (intent === 'demand_profile') {
    const phone = fields.client_phone as string | null

    const { error: upsertErr } = await db.from('demand_profiles').upsert(
      {
        agency_id:        agencyId,
        agent_id:         user.id,
        lead_id:          leadId ?? null,
        raw_transcript:   transcript,
        client_name:      fields.client_name      ?? null,
        client_phone:     phone,
        client_email:     fields.client_email     ?? null,
        transaction_type: fields.transaction_type ?? null,
        property_type:    fields.property_type    ?? null,
        floor_min:        fields.floor_min        ?? null,
        floor_max:        fields.floor_max        ?? null,
        size_min:         fields.size_min         ?? null,
        size_max:         fields.size_max         ?? null,
        budget_eur:       fields.budget_eur       ?? null,
        condition_req:    fields.condition_req    ?? null,
        must_have:        fields.must_have        ?? [],
        nice_to_have:     fields.nice_to_have     ?? [],
        areas_preferred:  fields.areas_preferred  ?? [],
        ai_summary:       fields.ai_summary       ?? null,
      },
      { onConflict: 'agent_id,client_phone', ignoreDuplicates: false }
    )

    if (upsertErr) console.error('[voice-ingest] demand_profiles upsert', upsertErr)

    if (phone) {
      await db.rpc('append_voice_note_to_demand', {
        p_agent_id: user.id, p_phone: phone, p_note_id: note.id,
      })
    }
  }

  return NextResponse.json({
    ok:      true,
    intent,
    note_id: note.id,
    summary: (fields.ai_summary as string) ?? transcript.slice(0, 120),
  })
}
