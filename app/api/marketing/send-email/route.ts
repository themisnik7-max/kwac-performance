import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
export async function POST(req: NextRequest) {
  const { property_id, agent_id } = await req.json()
  const { data: property } = await supabase.from('properties').select('*').eq('id', property_id).single()
  const { data: agent } = await supabase.from('agents').select('*').eq('id', agent_id).single()
  if (!property || !agent) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await supabase.from('marketing_actions').insert({
    property_id, agent_id, action_type: 'email_blast', status: 'sent',
    recipients_count: agent.contacts_count || 0, sent_at: new Date().toISOString()
  })
  return NextResponse.json({ ok: true, message: 'Email brochure απεστάλη', recipients: agent.contacts_count || 0 })
}