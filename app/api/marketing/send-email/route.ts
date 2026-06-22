import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthedAgent, canActAs } from '@/lib/auth'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// NOTE: still a stub — logs the action but doesn't actually call Brevo, check
// lead consent, or generate content yet. That's task #9 (listing-marketing-kit).
// This pass only adds the auth check that was missing entirely before.
export async function POST(req: NextRequest) {
  const caller = await getAuthedAgent(req)
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { property_id, agent_id } = await req.json()
  if (!canActAs(caller, agent_id)) {
    return NextResponse.json({ error: 'Δεν μπορείς να στείλεις marketing για άλλον μεσίτη' }, { status: 403 })
  }

  const { data: property } = await supabase.from('properties').select('*').eq('id', property_id).eq('agency_id', caller.agency_id).single()
  const { data: agent } = await supabase.from('agents').select('*').eq('id', agent_id).eq('agency_id', caller.agency_id).single()
  if (!property || !agent) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await supabase.from('marketing_actions').insert({
    property_id, agent_id, agency_id: caller.agency_id, action_type: 'email_blast', status: 'sent',
    recipients_count: agent.contacts_count || 0, sent_at: new Date().toISOString()
  })
  return NextResponse.json({ ok: true, message: 'Email brochure απεστάλη (demo — δεν στέλνεται ακόμα πραγματικό email)', recipients: agent.contacts_count || 0 })
}
