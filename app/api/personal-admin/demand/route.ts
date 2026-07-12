import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthedAgent, isCeoOrAdmin } from '@/lib/auth'
import { redactDemandIfNotOwner } from '@/lib/properties'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// GET — agency-wide demand-profile list for Personal Admin, PII-redacted
// for rows the caller doesn't own. See app/api/personal-admin/properties
// for why this can't just be a client-side RLS-protected query.
export async function GET(req: NextRequest) {
  const caller = await getAuthedAgent(req)
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await sb.from('demand_profiles')
    .select('id,client_name,client_phone,client_email,transaction_type,property_type,budget_eur,size_min,size_max,floor_min,floor_max,areas_preferred,must_have,nice_to_have,condition_req,ai_summary,status,updated_at,voice_note_ids,agent_id,agents!agent_id(full_name)')
    .eq('agency_id', caller.agency_id)
    .order('updated_at', { ascending: false })
    .limit(200)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const privileged = isCeoOrAdmin(caller)
  const demand = (data || []).map(row => redactDemandIfNotOwner(row as any, caller.id, privileged))
  return NextResponse.json({ demand })
}
