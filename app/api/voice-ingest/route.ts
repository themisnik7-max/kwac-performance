import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@supabase/supabase-js'
import { getAuthedAgent }            from '@/lib/auth'
import { splitName }                 from '@/lib/contacts'

const SUPABASE_URL     = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

// Body: { transcript, intent, fields, lead_id?, property_id?, meeting_id? }
// All path now writes to meeting_properties — the single unified property table.
export async function POST(req: NextRequest) {

  // 1. Auth — same pattern as every other route. No agency fallback: a
  // caller who doesn't resolve to a real agent gets 401, not "the first
  // agency in the system" (that fallback used to silently misfile real
  // agents' scouted properties into whichever agency happened to be
  // created first, the moment agents.id stopped matching auth.users.id).
  const caller = await getAuthedAgent(req)
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const agencyId = caller.agency_id

  // 2. Parse body
  const body       = await req.json()
  const transcript = (body.transcript as string | undefined)?.trim()
  const intent     = body.intent     as string | undefined
  const fields     = (body.fields    as Record<string, unknown>) ?? {}
  const leadId     = body.lead_id    as string | null | undefined
  const propertyId = body.property_id as string | null | undefined
  const meetingId  = body.meeting_id  as string | null | undefined

  if (!transcript) return NextResponse.json({ error: 'No transcript or intent provided' }, { status: 400 })

  // 4. Audit log in voice_notes (skip for manual entries — non-fatal)
  const isManual = transcript === '(manual entry)'
  let note: { id: string } | null = null
  if (!isManual) {
    const { data: n, error: noteErr } = await db
      .from('voice_notes')
      .insert({
        agency_id:   agencyId,
        agent_id:    caller.id,
        lead_id:     leadId     ?? null,
        property_id: propertyId ?? null,
        meeting_id:  meetingId  ?? null,
        transcript,
        extracted:   { intent, ...fields },
      })
      .select('id')
      .single()
    if (noteErr) console.error('[voice-ingest] voice_notes insert (non-fatal)', noteErr)
    note = n
  }

  // 5. Write to unified meeting_properties
  let upsertedId: string | null = null

  if (intent === 'property_scouted') {
    const phone = fields.owner_phone as string | null

    // Try to find existing record by agent + phone to avoid duplicates
    let existingId: string | null = null
    if (phone) {
      const { data: ex } = await db
        .from('meeting_properties')
        .select('id')
        .eq('agent_id', caller.id)
        .eq('owner_phone', phone)
        .single()
      existingId = ex?.id ?? null
    }

    // Link owner to contacts table if phone matches; auto-create one if none
    // does. Previously this only ever linked to an EXISTING contact — an
    // owner given by name+phone with no prior contact record stayed
    // unlinked forever, so Personal Admin / the property detail page had
    // nothing to make clickable ("δεν έχει συνδεθεί ακόμα με καρτέλα
    // επαφής"). A manually-entered owner should always end up with a real
    // contact card, same as add_contact does for AI Admin.
    let ownerContactId: string | null = null
    if (phone && agencyId) {
      const { data: contact } = await db
        .from('contacts')
        .select('id')
        .eq('agency_id', agencyId)
        .or(`phone.eq.${phone},phone2.eq.${phone}`)
        .limit(1)
        .single()
      if (contact) {
        ownerContactId = contact.id
      } else {
        const ownerName = (fields.owner_name as string) || null
        const { first_name, last_name } = splitName(ownerName || '')
        const { data: created, error: contactErr } = await db.from('contacts').insert({
          agency_id: agencyId, full_name: ownerName,
          first_name: first_name || null, last_name: last_name || null,
          phone, email: (fields.owner_email as string) ?? null, type: 'contact',
        }).select('id').single()
        if (contactErr) console.error('[voice-ingest] owner contact auto-create (non-fatal)', contactErr)
        ownerContactId = created?.id ?? null
      }
    }

    const payload = {
      agency_id:         agencyId,
      agent_id:          caller.id,
      raw_transcript:    transcript,
      owner_phone:       phone,
      owner_email:       (fields.owner_email       as string) ?? null,
      owner_name:        (fields.owner_name        as string) ?? null,
      owner_contact_id:  ownerContactId,
      transaction_type:  (fields.transaction_type  as string) ?? null,
      address:           (fields.address           as string) ?? null,
      area:              (fields.area              as string) ?? null,
      floor:             (fields.floor             as number) ?? null,
      sqm:               (fields.sqm ?? fields.size_sqm as number) ?? null,
      condition:         (fields.condition         as string) ?? null,
      year_built:        (fields.year_built        as number) ?? null,
      year_renovated:    (fields.year_renovated    as number) ?? null,
      rooms:             (fields.rooms             as number) ?? null,
      balcony:           (fields.balcony           as boolean) ?? null,
      parking:           (fields.parking           as boolean) ?? null,
      security_door:     (fields.security_door     as boolean) ?? null,
      asking_price:      (fields.asking_price      as number) ?? null,
      seller_motivation: (fields.seller_motivation as string) ?? null,
      seller_reason:     (fields.seller_reason     as string) ?? null,
      ai_summary:        (fields.ai_summary        as string) ?? null,
      title:             (fields.address as string) || (fields.area as string) || 'Νέο Ακίνητο',
      status:            'pending',
      meeting_date:      new Date().toISOString().split('T')[0],
      first_registered_by: caller.id,
    }

    if (existingId) {
      // Update existing — don't overwrite agent_id or first_registered_by
      const { error: updErr } = await db
        .from('meeting_properties')
        .update({ ...payload, first_registered_by: undefined })
        .eq('id', existingId)
      if (updErr) console.error('[voice-ingest] mp update', updErr)
      upsertedId = existingId

      // Append voice note
      if (note) await db.rpc('append_voice_note_to_property', { p_property_id: existingId, p_note_id: note.id })
    } else {
      const { data: mp, error: insErr } = await db
        .from('meeting_properties')
        .insert({ ...payload, ilist_id: 'VOC-' + Date.now() })
        .select('id')
        .single()
      if (insErr) {
        console.error('[voice-ingest] mp insert', insErr)
        return NextResponse.json({ error: `DB insert failed: ${insErr.message}` }, { status: 500 })
      }
      upsertedId = mp?.id ?? null

      if (upsertedId && note) {
        await db.rpc('append_voice_note_to_property', { p_property_id: upsertedId, p_note_id: note.id })
      }
    }
  }

  if (intent === 'demand_profile') {
    const phone = fields.client_phone as string | null

    // Check for existing demand by agent + phone
    let existingId: string | null = null
    if (phone) {
      const { data: ex } = await db
        .from('demand_profiles')
        .select('id')
        .eq('agent_id', caller.id)
        .eq('client_phone', phone)
        .single()
      existingId = ex?.id ?? null
    }

    const payload = {
      agency_id:        agencyId,
      agent_id:         caller.id,
      lead_id:          leadId ?? null,
      raw_transcript:   transcript,
      client_name:      (fields.client_name      as string)   ?? null,
      client_phone:     phone,
      client_email:     (fields.client_email     as string)   ?? null,
      transaction_type: (fields.transaction_type as string)   ?? null,
      property_type:    (fields.property_type    as string)   ?? null,
      floor_min:        (fields.floor_min        as number)   ?? null,
      floor_max:        (fields.floor_max        as number)   ?? null,
      size_min:         (fields.size_min         as number)   ?? null,
      size_max:         (fields.size_max         as number)   ?? null,
      budget_eur:       (fields.budget_eur       as number)   ?? null,
      condition_req:    (fields.condition_req    as string)   ?? null,
      must_have:        (Array.isArray(fields.must_have)       ? fields.must_have       : []) as string[],
      nice_to_have:     (Array.isArray(fields.nice_to_have)    ? fields.nice_to_have    : []) as string[],
      areas_preferred:  (Array.isArray(fields.areas_preferred) ? fields.areas_preferred : []) as string[],
      ai_summary:       (fields.ai_summary       as string)   ?? null,
    }

    let demandId: string | null = existingId
    if (existingId) {
      await db.from('demand_profiles').update(payload).eq('id', existingId)
      if (note) await db.rpc('append_voice_note_to_demand', { p_agent_id: caller.id, p_phone: phone, p_note_id: note.id })
    } else {
      const { data: dp } = await db.from('demand_profiles')
        .insert({ ...payload, status: 'active' })
        .select('id').single()
      demandId = dp?.id ?? null
      if (dp?.id && phone) {
        if (note) await db.rpc('append_voice_note_to_demand', { p_agent_id: caller.id, p_phone: phone, p_note_id: note.id })
      }
    }

    // Auto-match: call demand-match handler directly (no HTTP round-trip needed)
    if (demandId) {
      const matchReq = new Request('http://internal/api/demand-match', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.INTERNAL_API_SECRET ? { 'x-internal-secret': process.env.INTERNAL_API_SECRET } : {}),
        },
        body: JSON.stringify({ demand_id: demandId }),
      })
      import('@/app/api/demand-match/route').then(m => m.POST(matchReq as never))
        .catch(err => console.error('[voice-ingest] auto-match', err))
    }
  }

  return NextResponse.json({
    ok:          true,
    intent,
    note_id:     note?.id ?? null,
    property_id: upsertedId,
    summary:     (fields.ai_summary as string) ?? transcript.slice(0, 120),
  })
}
