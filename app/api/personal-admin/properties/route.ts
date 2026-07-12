import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthedAgent, isCeoOrAdmin } from '@/lib/auth'
import { redactPropertyIfNotOwner } from '@/lib/properties'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// GET — agency-wide property list for Personal Admin. Uses the service role
// and replicates meeting_properties_select's RLS rule by hand (own rows,
// any non-pending row, or admin/ceo) because it also needs to redact
// owner PII for rows the caller doesn't own — RLS can hide rows but not
// individual columns within a row it already allows, so the raw table
// query can't do this on its own. See lib/properties.ts.
export async function GET(req: NextRequest) {
  const caller = await getAuthedAgent(req)
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const privileged = isCeoOrAdmin(caller)
  let query = sb.from('meeting_properties')
    .select('id,ilist_id,title,owner_name,owner_phone,owner_email,owner_contact_id,contacts(id,full_name,first_name,last_name,phone,email),transaction_type,address,area,floor,sqm,rooms,condition,year_built,year_renovated,balcony,parking,security_door,asking_price,seller_motivation,ai_summary,status,voice_note_ids,created_at,updated_at,agent_id,agents!agent_id(full_name)')
    .eq('agency_id', caller.agency_id)
    .order('created_at', { ascending: false })
    .limit(200)
  if (!privileged) query = query.or(`agent_id.eq.${caller.id},status.neq.pending`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const properties = (data || []).map(row => redactPropertyIfNotOwner(row as any, caller.id, privileged))
  return NextResponse.json({ properties })
}
