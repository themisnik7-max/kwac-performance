import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthedAgent, canActAs } from '@/lib/auth'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Greek mobile numbers are stored as bare 10-digit (69XXXXXXXX); Brevo needs
// the country code. Leave anything that already has a + alone.
function toE164Greek(phone: string): string {
  const trimmed = phone.replace(/\s/g, '')
  return trimmed.startsWith('+') ? trimmed : `+30${trimmed}`
}

// POST { property_id, agent_id, message?, confirm?: boolean }
// Single-property SMS campaign via Brevo's transactional SMS endpoint
// (type:'marketing') — Brevo has no bulk "SMS campaign" abstraction, so this
// sends one at a time to each sms_consent contact, same as the newsletter
// route does for email. Without confirm:true, previews only. See
// skills/listing-marketing-kit/SKILL.md — SMS confirm is never optional.
export async function POST(req: NextRequest) {
  const caller = await getAuthedAgent(req)
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { property_id, agent_id, message, confirm } = await req.json() as
    { property_id: string; agent_id: string; message?: string; confirm?: boolean }
  if (!property_id) return NextResponse.json({ error: 'property_id required' }, { status: 400 })
  if (!(await canActAs(caller, agent_id)))
    return NextResponse.json({ error: 'Δεν μπορείς να στείλεις marketing για άλλον μεσίτη' }, { status: 403 })

  const { data: agent } = await sb.from('agents').select('id,email,full_name,phone,agency_id')
    .eq('id', agent_id).eq('agency_id', caller.agency_id).single()
  if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 })

  const { data: prop } = await sb.from('properties')
    .select('id, address, area, sqm, price_asking, ilist_id').eq('id', property_id).eq('agency_id', caller.agency_id).single()
  if (!prop) return NextResponse.json({ error: 'Property not found' }, { status: 404 })

  const { data: recipients } = await sb.from('contacts')
    .select('id, phone').eq('agency_id', caller.agency_id).eq('sms_consent', true).not('phone', 'is', null)
  if (!recipients?.length)
    return NextResponse.json({ ok: true, warning: 'No sms-consented contacts to send to', recipients: 0 })

  const price = prop.price_asking ? `€${Number(prop.price_asking).toLocaleString('el-GR')}` : ''
  const destinationUrl = prop.ilist_id ? `https://kwac.gr/results?q=${prop.ilist_id}` : 'https://kwac.gr/results'
  const template = message || `Νέο ακίνητο στην περιοχή ${prop.area || ''} ${price}. Δες το εδώ:`
  const agentSender = (agent.full_name || 'KWAthens').replace(/[^a-zA-Z0-9]/g, '').slice(0, 11) || 'KWAthens'

  if (!confirm) {
    return NextResponse.json({
      ok: true, preview: true, recipients: recipients.length,
      sample_message: `${template} https://kwac.gr/...  (tracked link generated per recipient on send)`,
      message: 'Preview only — resend with confirm:true to actually send.',
    })
  }

  const { data: campaign } = await sb.from('marketing_campaigns').insert({
    agency_id: caller.agency_id, agent_id, channel: 'sms', property_ids: [prop.id],
    content: template, status: 'sent', sent_at: new Date().toISOString(),
  }).select('id').single()
  if (!campaign) return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 })

  const BREVO_API_KEY = process.env.BREVO_API_KEY
  const origin = req.nextUrl.origin

  let sent = 0
  const errors: string[] = []

  for (const r of recipients) {
    const { data: recipientRow } = await sb.from('marketing_campaign_recipients').insert({
      campaign_id: campaign.id, contact_id: r.id, destination_url: destinationUrl,
    }).select('id').single()
    if (!recipientRow) continue

    const trackedUrl = `${origin}/api/marketing/track?r=${recipientRow.id}`
    const content = `${template} ${trackedUrl}`.slice(0, 300) // Brevo auto-splits over 160 chars, cap to avoid runaway multi-part SMS

    if (!BREVO_API_KEY) { errors.push(`${r.phone}: BREVO_API_KEY not configured`); continue }

    const res = await fetch('https://api.brevo.com/v3/transactionalSMS/send', {
      method: 'POST',
      headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sender: agentSender, recipient: toE164Greek(r.phone), content, type: 'marketing', tag: 'sms-campaign' }),
    })

    if (res.ok) {
      const { messageId } = await res.json() as { messageId: number }
      await sb.from('marketing_campaign_recipients').update({
        sent_at: new Date().toISOString(), brevo_message_id: String(messageId),
      }).eq('id', recipientRow.id)
      sent++
    } else {
      errors.push(`${r.phone}: ${res.status}`)
    }
  }

  return NextResponse.json({ ok: true, campaign_id: campaign.id, sent, total: recipients.length, errors })
}
