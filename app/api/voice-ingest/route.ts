import { NextRequest, NextResponse }                                    from 'next/server'
import { createClient }                                                  from '@supabase/supabase-js'
import { whisperTranscribe }                                             from '@/lib/voice/cloudflare-ai'
import { detectIntent, extractPropertyScouted, extractDemandProfile }   from '@/lib/voice/extractors'

const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE_ROLE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!

const MAX_AUDIO_MB = 24

async function resolveUser(token: string) {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  })
  const { data: { user }, error } = await client.auth.getUser(token)
  if (error || !user) return null
  return user
}

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  db: { schema: 'public' },
})

export async function POST(req: NextRequest) {

  // 1. Auth
  const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? ''
  const user  = await resolveUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Resolve agency_id from the agents table
  const { data: agentRow } = await db
    .from('agents')
    .select('agency_id')
    .eq('id', user.id)
    .single()

  if (!agentRow?.agency_id)
    return NextResponse.json({ error: 'Agent not found' }, { status: 403 })

  const agencyId = agentRow.agency_id

  // 2. Parse form
  const form       = await req.formData()
  const audioBlob  = form.get('audio')       as Blob | null
  const leadId     = form.get('lead_id')     as string | null
  const propertyId = form.get('property_id') as string | null
  const meetingId  = form.get('meeting_id')  as string | null

  if (!audioBlob)
    return NextResponse.json({ error: 'No audio' }, { status: 400 })
  if (audioBlob.size > MAX_AUDIO_MB * 1024 * 1024)
    return NextResponse.json({ error: `Audio exceeds ${MAX_AUDIO_MB}MB` }, { status: 413 })

  // 3. Transcription
  let transcript: string
  try {
    transcript = await whisperTranscribe(audioBlob)
  } catch (err) {
    console.error('[voice-ingest] whisper failed', err)
    return NextResponse.json({ error: 'Transcription service unavailable' }, { status: 503 })
  }

  if (!transcript)
    return NextResponse.json({ error: 'Empty transcript' }, { status: 422 })

  // 4. Intent
  const intent = detectIntent(transcript)

  // 5. Extraction
  let extracted: Record<string, unknown> = {}
  try {
    if      (intent === 'property_scouted') extracted = await extractPropertyScouted(transcript)
    else if (intent === 'demand_profile')   extracted = await extractDemandProfile(transcript)
  } catch (err) {
    console.error('[voice-ingest] extraction failed', err)
    // Non-fatal: store transcript anyway
  }

  // 6. Append to voice_notes (audit log)
  const { data: note, error: noteErr } = await db
    .from('voice_notes')
    .insert({
      agency_id:   agencyId,
      agent_id:    user.id,
      lead_id:     leadId     ?? null,
      property_id: propertyId ?? null,
      meeting_id:  meetingId  ?? null,
      transcript,
      extracted:   { intent, ...extracted },
      audio_sec:   Math.round(audioBlob.size / 16000),
    })
    .select('id')
    .single()

  if (noteErr) {
    console.error('[voice-ingest] voice_notes insert', noteErr)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  // 7. Upsert profile (dedup on phone)
  if (intent === 'property_scouted') {
    const phone = extracted.owner_phone as string | null

    await db.from('property_scouted').upsert(
      {
        agency_id:         agencyId,
        agent_id:          user.id,
        owner_phone:       phone,
        owner_email:       extracted.owner_email,
        owner_name:        extracted.owner_name,
        transaction_type:  extracted.transaction_type,
        address:           extracted.address,
        area:              extracted.area,
        floor:             extracted.floor,
        size_sqm:          extracted.size_sqm,
        condition:         extracted.condition,
        features:          extracted.features,
        asking_price:      extracted.asking_price,
        offers_received:   extracted.offers_received,
        seller_motivation: extracted.seller_motivation,
        seller_reason:     extracted.seller_reason,
        ai_summary:        extracted.ai_summary,
        raw_transcript:    transcript,
      },
      { onConflict: 'agent_id,owner_phone', ignoreDuplicates: false }
    )

    await db.rpc('append_voice_note_to_scouted', {
      p_agent_id: user.id,
      p_phone:    phone,
      p_note_id:  note.id,
    })
  }

  if (intent === 'demand_profile') {
    const phone = extracted.client_phone as string | null

    await db.from('demand_profiles').upsert(
      {
        agency_id:        agencyId,
        agent_id:         user.id,
        lead_id:          leadId ?? null,
        client_name:      extracted.client_name,
        client_phone:     phone,
        client_email:     extracted.client_email,
        transaction_type: extracted.transaction_type,
        property_type:    extracted.property_type,
        floor_min:        extracted.floor_min,
        floor_max:        extracted.floor_max,
        size_min:         extracted.size_min,
        size_max:         extracted.size_max,
        budget_eur:       extracted.budget_eur,
        condition_req:    extracted.condition_req,
        must_have:        extracted.must_have,
        nice_to_have:     extracted.nice_to_have,
        areas_preferred:  extracted.areas_preferred,
        ai_summary:       extracted.ai_summary,
        raw_transcript:   transcript,
      },
      { onConflict: 'agent_id,client_phone', ignoreDuplicates: false }
    )

    await db.rpc('append_voice_note_to_demand', {
      p_agent_id: user.id,
      p_phone:    phone,
      p_note_id:  note.id,
    })

    if (phone && extracted.budget_eur) {
      await db.from('leads')
        .update({ budget_eur: extracted.budget_eur, last_note_id: note.id })
        .eq('agency_id', agencyId)
        .eq('phone_number', phone)
    }
  }

  return NextResponse.json({
    ok:       true,
    intent,
    note_id:  note.id,
    summary:  extracted.ai_summary ?? transcript.slice(0, 120),
    extracted,
  })
}
