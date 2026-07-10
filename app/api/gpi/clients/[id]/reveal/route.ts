import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthedAgent } from '@/lib/auth'
import { decryptGpiCredentials, canAccessGpiClient, type GpiClientRow } from '@/lib/gpi'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// Separate from GET /clients/[id] on purpose: taxisnet credentials should
// never come back with a routine page load, only on an explicit "show"
// action in the UI — and every reveal is logged (gpi_credential_access_log).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const caller = await getAuthedAgent(req)
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: client } = await db.from('gpi_clients').select('*').eq('id', params.id).single()
  if (!client || !canAccessGpiClient(caller, client as GpiClientRow)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db.from('gpi_credential_access_log').insert({
    agency_id: caller.agency_id, client_id: params.id, accessed_by: caller.id,
  })

  return NextResponse.json(decryptGpiCredentials(client as GpiClientRow))
}
