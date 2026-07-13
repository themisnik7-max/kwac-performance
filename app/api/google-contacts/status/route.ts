import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthedAgent } from '@/lib/auth'
import { googleOAuthConfigured } from '@/lib/googleContacts'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(req: NextRequest) {
  const caller = await getAuthedAgent(req)
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const configured = googleOAuthConfigured()
  if (!configured) return NextResponse.json({ configured, connected: false })

  const { data } = await sb.from('google_contacts_connections')
    .select('google_email,connected_at,last_synced_at,last_sync_count,last_sync_error')
    .eq('agent_id', caller.id).maybeSingle()

  return NextResponse.json({ configured, connected: !!data, ...(data || {}) })
}
