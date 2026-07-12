import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthedAgent, isCeoOrAdmin } from '@/lib/auth'
import { redactPropertyIfNotOwner } from '@/lib/properties'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// GET — single property for the property-file page, PII-redacted for
// viewers who aren't the uploading agent or admin/ceo. Writes still go
// straight from the browser to meeting_properties (RLS's
// meeting_properties_update already enforces owner-or-admin correctly);
// this route only covers the read side, which RLS can't redact by column.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const caller = await getAuthedAgent(req)
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: row, error } = await sb.from('meeting_properties').select('*').eq('id', params.id).single()
  if (error || !row) return NextResponse.json({ error: 'Δεν βρέθηκε το ακίνητο.' }, { status: 404 })

  const privileged = isCeoOrAdmin(caller)
  const visible = row.agency_id === caller.agency_id
    && (row.agent_id === caller.id || row.status !== 'pending' || privileged)
  if (!visible) return NextResponse.json({ error: 'Δεν βρέθηκε το ακίνητο.' }, { status: 404 })

  return NextResponse.json({ property: redactPropertyIfNotOwner(row as any, caller.id, privileged) })
}
