import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthedAgent, canActAs } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rateLimit'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Vercel Hobby max — sends sequentially, one Brevo call per consented
// contact; a large contact list could plausibly exceed the platform's
// unconfigured default duration.
export const maxDuration = 60

const BREVO_TIMEOUT_MS = 15_000

function formatPrice(v: unknown): string {
  const n = Number(v)
  return n ? `€${n.toLocaleString('el-GR')}` : 'Κατόπιν επικοινωνίας'
}

function buildPropertyCard(prop: Record<string, any>, trackedUrl: string): string {
  const price = formatPrice(prop.price_asking)
  return `
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
    style="margin-bottom:16px;border:1px solid #EEEEEE;border-radius:4px;overflow:hidden;">
    <tr><td style="padding:20px 24px;background:#FFFFFF;">
      <div style="font-size:17px;font-weight:700;color:#1A1A1A;margin-bottom:4px;">${prop.area ?? prop.address ?? ''}</div>
      <div style="font-size:13px;color:#888;margin-bottom:14px;">${prop.address ?? ''}</div>
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom:16px;">
        <tr>
          ${prop.sqm ? `<td style="padding-right:16px;"><div style="font-size:20px;font-weight:700;color:#1A1A1A;">${prop.sqm}</div><div style="font-size:10px;color:#AAAAAA;">τ.μ.</div></td>` : ''}
          <td><div style="font-size:20px;font-weight:700;color:#CC2229;">${price}</div><div style="font-size:10px;color:#AAAAAA;">Τιμή</div></td>
        </tr>
      </table>
      <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td style="background:#CC2229;border-radius:2px;">
        <a href="${trackedUrl}" style="display:inline-block;padding:11px 24px;font-size:13px;font-weight:700;color:#FFFFFF;text-decoration:none;">Δείτε το Ακίνητο →</a>
      </td></tr></table>
    </td></tr>
  </table>`
}

function buildNewsletterHTML(cards: string, subject: string, agentName: string, agentPhone: string, agentEmail: string): string {
  const year = new Date().getFullYear()
  return `<!DOCTYPE html>
<html lang="el"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${subject}</title></head>
<body style="margin:0;padding:0;background:#F2F2F2;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" style="background:#F2F2F2;"><tr><td style="padding:20px 0;">
<table role="presentation" width="600" align="center" style="margin:0 auto;background:#FFFFFF;">
  <tr><td style="background:#1A1A1A;padding:20px 40px;text-align:center;">
    <div style="color:#fff;font-size:18px;font-weight:700;">KW Athens Center</div>
  </td></tr>
  <tr><td style="background:#CC2229;height:4px;font-size:0;">&nbsp;</td></tr>
  <tr><td style="padding:28px 44px;">${cards}</td></tr>
  <tr><td style="padding:0 44px;"><div style="height:1px;background:#EEEEEE;"></div></td></tr>
  <tr><td style="padding:28px 44px 32px;">
    <div style="font-size:16px;font-weight:700;color:#1A1A1A;">${agentName}</div>
    <div style="font-size:13px;color:#555;line-height:2;">📞 ${agentPhone}<br>✉️ ${agentEmail}</div>
  </td></tr>
  <tr><td style="background:#1A1A1A;padding:24px 40px;text-align:center;">
    <p style="margin:0;font-size:10px;color:#444;">&copy; ${year} KW Athens Center. <a href="{{unsubscribe}}" style="color:#CC2229;">Διαγραφή</a></p>
  </td></tr>
</table></td></tr></table></body></html>`
}

// POST { property_ids: string[], agent_id, subject?, confirm?: boolean }
// Multi-property campaign newsletter. Sends one transactional email per
// consented contact (not one shared Brevo "classic" campaign) so every
// recipient gets their own tracked link — a bulk campaign would serve the
// identical HTML to everyone, making click attribution meaningless.
// Without confirm:true this only previews (recipient count, subject, sample
// HTML) — nothing is sent and no rows are written. See
// skills/listing-marketing-kit/SKILL.md step 6: draft/preview, never auto-send.
export async function POST(req: NextRequest) {
  const caller = await getAuthedAgent(req)
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { property_ids, agent_id, subject, confirm } = await req.json() as
    { property_ids: string[]; agent_id: string; subject?: string; confirm?: boolean }
  if (!Array.isArray(property_ids) || property_ids.length === 0)
    return NextResponse.json({ error: 'property_ids required' }, { status: 400 })
  if (!(await canActAs(caller, agent_id)))
    return NextResponse.json({ error: 'Δεν μπορείς να στείλεις marketing για άλλον μεσίτη' }, { status: 403 })

  const { data: agent } = await sb.from('agents').select('id,email,full_name,phone,agency_id')
    .eq('id', agent_id).eq('agency_id', caller.agency_id).single()
  if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 })

  const { data: props } = await sb.from('properties')
    .select('id, address, area, sqm, price_asking, ilist_id')
    .in('id', property_ids).eq('agency_id', caller.agency_id)
  if (!props?.length) return NextResponse.json({ error: 'No matching properties found in your agency' }, { status: 404 })

  const { data: recipients } = await sb.from('contacts')
    .select('id, email').eq('agency_id', caller.agency_id).eq('email_consent', true).not('email', 'is', null)
  if (!recipients?.length)
    return NextResponse.json({ ok: true, warning: 'No email-consented contacts to send to', recipients: 0 })

  const campaignSubject = subject || `${props.length} νέα ακίνητα | KW Athens Center`
  const agentName = agent.full_name || agent.email
  const destinationUrl = props[0].ilist_id ? `https://kwac.gr/results?q=${props[0].ilist_id}` : 'https://kwac.gr/results'

  if (!confirm) {
    const previewHtml = buildNewsletterHTML(
      props.map(p => buildPropertyCard(p, '#')).join(''), campaignSubject, agentName, agent.phone || '', agent.email,
    )
    return NextResponse.json({
      ok: true, preview: true, recipients: recipients.length, properties: props.length,
      subject: campaignSubject, preview_html: previewHtml,
      message: 'Preview only — resend with confirm:true to actually send.',
    })
  }

  // Guards against a double-click or a client retry after an apparent
  // timeout re-sending this exact blast to every consented contact again —
  // no idempotency key existed here before (confirmed during the 2026-07-11
  // audit: Brevo calls throughout this app had no timeout and no dedup on
  // retry). A short per-agent cooldown on the *confirmed send* step is a
  // pragmatic fix reusing the rate-limit primitive rather than a full
  // client-supplied idempotency key.
  const withinRate = await checkRateLimit(sb, `newsletter-send:${agent_id}`, 30, 1)
  if (!withinRate) return NextResponse.json({ error: 'Ήδη στάλθηκε — περίμενε λίγο πριν ξαναστείλεις.' }, { status: 429 })

  // status starts 'sending', not 'sent' — only flipped to a final status
  // once the loop below actually finishes (see migration
  // 20260711170000). A mid-loop timeout now leaves this honestly stuck at
  // 'sending' instead of falsely claiming success.
  const { data: campaign } = await sb.from('marketing_campaigns').insert({
    agency_id: caller.agency_id, agent_id, channel: 'email',
    property_ids: props.map(p => p.id), subject: campaignSubject,
    content: campaignSubject, status: 'sending',
  }).select('id').single()
  if (!campaign) return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 })

  const BREVO_API_KEY = process.env.BREVO_API_KEY
  const BREVO_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || 'kwathenscenter@kwgreece.gr'
  const BREVO_SENDER_NAME = process.env.BREVO_SENDER_NAME || 'KW Athens Center'
  const origin = req.nextUrl.origin

  let sent = 0
  const errors: string[] = []

  for (const r of recipients) {
    const { data: recipientRow } = await sb.from('marketing_campaign_recipients').insert({
      campaign_id: campaign.id, contact_id: r.id, destination_url: destinationUrl,
    }).select('id').single()
    if (!recipientRow) continue

    const trackedUrl = `${origin}/api/marketing/track?r=${recipientRow.id}`
    const htmlContent = buildNewsletterHTML(
      props.map(p => buildPropertyCard(p, trackedUrl)).join(''), campaignSubject, agentName, agent.phone || '', agent.email,
    )

    if (!BREVO_API_KEY) { errors.push(`${r.email}: BREVO_API_KEY not configured`); continue }

    let res: Response
    try {
      res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: { name: BREVO_SENDER_NAME, email: BREVO_SENDER_EMAIL },
          to: [{ email: r.email }], subject: campaignSubject, htmlContent, tags: ['newsletter-campaign'],
        }),
        signal: AbortSignal.timeout(BREVO_TIMEOUT_MS),
      })
    } catch (e: any) {
      errors.push(`${r.email}: ${e.name === 'TimeoutError' ? 'Brevo timeout' : e.message}`)
      continue
    }

    if (res.ok) {
      await sb.from('marketing_campaign_recipients').update({ sent_at: new Date().toISOString() }).eq('id', recipientRow.id)
      sent++
    } else {
      errors.push(`${r.email}: ${res.status}`)
    }
  }

  // Only now — after every recipient has actually been attempted — does the
  // campaign get its final status. 'partial' is distinguishable from a full
  // 'sent' instead of both looking identical in the DB.
  const finalStatus = sent === recipients.length ? 'sent' : sent > 0 ? 'partial' : 'failed'
  await sb.from('marketing_campaigns').update({ status: finalStatus, sent_at: new Date().toISOString() }).eq('id', campaign.id)

  return NextResponse.json({ ok: true, campaign_id: campaign.id, status: finalStatus, sent, total: recipients.length, errors })
}
