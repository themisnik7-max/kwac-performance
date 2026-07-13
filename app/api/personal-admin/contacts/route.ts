import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthedAgent, isCeoOrAdmin } from '@/lib/auth'
import { splitName } from '@/lib/contacts'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// contacts_select RLS (own row, agent_id IS NULL "general pool", or
// admin/ceo) already fully hides rows a caller shouldn't see at all — unlike
// meeting_properties/demand_profiles, there's no "agency-visible but PII-
// redacted" middle state here (Turn 4 made contacts strictly owner-scoped
// after it was flagged as a serious permission issue), so anything this
// query returns is safe to show in full. Still goes through the service
// role + hand-replicated filter, not a client-side RLS-backed query, to stay
// consistent with the sibling properties/demand routes and to attach the
// has-property/has-demand counts in one round trip.
function countOf(v: unknown): number {
  if (Array.isArray(v)) return v[0]?.count ?? 0
  return (v as { count?: number } | null)?.count ?? 0
}

export async function GET(req: NextRequest) {
  const caller = await getAuthedAgent(req)
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const privileged = isCeoOrAdmin(caller)
  let query = sb.from('contacts')
    .select('id,full_name,first_name,last_name,phone,phone2,email,type,sources,kwac_tag,notes,agent_id,created_at,google_resource_name,agents!agent_id(full_name),meeting_properties!owner_contact_id(count),demand_profiles!contact_id(count)')
    .eq('agency_id', caller.agency_id)
    .order('created_at', { ascending: false })
    .limit(500)
  if (!privileged) query = query.or(`agent_id.is.null,agent_id.eq.${caller.id}`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const contacts = (data || []).map((row: any) => ({
    ...row,
    property_count: countOf(row.meeting_properties),
    demand_count: countOf(row.demand_profiles),
    meeting_properties: undefined,
    demand_profiles: undefined,
  }))

  return NextResponse.json({ contacts })
}

// Manual "+ Νέος Πελάτης" — a contact card doesn't require a property or
// demand to exist (that's the whole point of this tab). Always owned by the
// creating agent (never trust a client-supplied agent_id — contacts_insert's
// RLS check only constrains agency_id, not agent_id, see migration
// 20260712110000's comment).
export async function POST(req: NextRequest) {
  const caller = await getAuthedAgent(req)
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const fullName = (body.full_name as string | undefined)?.trim() || null
  const phone = (body.phone as string | undefined)?.trim() || null
  const phone2 = (body.phone2 as string | undefined)?.trim() || null
  const email = (body.email as string | undefined)?.trim() || null
  const notes = (body.notes as string | undefined)?.trim() || null

  if (!fullName && !phone && !email) {
    return NextResponse.json({ error: 'Χρειάζεται τουλάχιστον όνομα, τηλέφωνο ή email.' }, { status: 400 })
  }
  const { first_name, last_name } = splitName(fullName || '')

  const { data: created, error } = await sb.from('contacts').insert({
    agency_id: caller.agency_id, agent_id: caller.id,
    full_name: fullName, first_name: first_name || null, last_name: last_name || null,
    phone, phone2, email, notes, type: 'contact', sources: ['manual'],
  }).select('id').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // A property or demand logged earlier under the same phone, before this
  // contact card existed, would otherwise stay orphaned forever — link it
  // now the same way voice-ingest links a newly-registered owner going
  // forward, so the card shows a complete picture immediately.
  if (phone) {
    await sb.from('meeting_properties')
      .update({ owner_contact_id: created!.id })
      .eq('agent_id', caller.id).eq('owner_phone', phone).is('owner_contact_id', null)
    await sb.from('demand_profiles')
      .update({ contact_id: created!.id })
      .eq('agent_id', caller.id).eq('client_phone', phone).is('contact_id', null)
  }

  return NextResponse.json({ ok: true, id: created!.id })
}
