// ─────────────────────────────────────────────────────────
// app/api/marketing/send-email/route.ts  (REPLACE existing stub)
//
// Creates a Brevo email campaign DRAFT for the property.
// The agent reviews & sends from the Brevo dashboard.
//
// Required env vars (add to .env.local + Vercel):
//   BREVO_API_KEY          — API key from app.brevo.com/settings/keys/api
//   BREVO_SENDER_EMAIL     — verified sender email in Brevo
//   BREVO_SENDER_NAME      — display name (e.g. "KW Athens Center")
//   BREVO_LIST_ID          — numeric ID of the contact list to send to
//                            (find it at app.brevo.com/contacts/lists)
//   SUPABASE_SERVICE_ROLE_KEY — already in your env
// ─────────────────────────────────────────────────────────
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthedAgent, canActAs } from '@/lib/auth'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ── Price formatter ───────────────────────────────────────
function formatPrice(v: unknown): string {
  const n = Number(v)
  return n ? `€${n.toLocaleString('el-GR')}` : 'Κατόπιν επικοινωνίας'
}

// ── Newsletter HTML builder ───────────────────────────────
function buildNewsletterHTML(prop: Record<string, unknown>, agent: Record<string, unknown>): string {
  const title = `${prop.property_type || 'Ακίνητο'} στο ${prop.area || ''}`
  const address = `${prop.address || ''}, ${prop.city || 'Αθήνα'}`
  const price = formatPrice(prop.price_asking)
  const ctaUrl = prop.ilist_code
    ? `https://kwac.gr/results?q=${prop.ilist_code}`
    : 'https://kwac.gr/results'
  const agentName = agent.full_name || agent.email || 'Σύμβουλος'
  const agentPhone = agent.phone || '(+30) 211 0131911'
  const agentEmail = agent.email || 'kwathenscenter@kwgreece.gr'
  const year = new Date().getFullYear()

  return `<!DOCTYPE html>
<html lang="el">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title></head>
<body style="margin:0;padding:0;background:#F2F2F2;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#F2F2F2;">
<tr><td style="padding:20px 0;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" align="center"
  style="margin:0 auto;background:#FFFFFF;box-shadow:0 4px 24px rgba(0,0,0,.10);">

  <!-- HEADER -->
  <tr><td style="background:#1A1A1A;padding:20px 40px;text-align:center;">
    <img src="https://www.kwac.gr/images/logow.png" alt="KW Athens Center" width="140"
      style="display:block;margin:0 auto;max-width:140px;">
  </td></tr>
  <tr><td style="background:#CC2229;height:4px;font-size:0;line-height:0;">&nbsp;</td></tr>

  <!-- HERO TITLE BLOCK (no external image dependency) -->
  <tr><td style="background:#1A1A1A;padding:40px 40px 32px;">
    <div style="font-size:11px;color:#CC2229;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;margin-bottom:10px;">
      Νέα Αποκλειστική Καταχώρηση
    </div>
    <div style="font-size:26px;font-weight:700;color:#FFFFFF;line-height:1.25;margin-bottom:8px;">${title}</div>
    <div style="font-size:13px;color:rgba(255,255,255,.55);">📍 ${address}</div>
  </td></tr>

  <!-- STATS BAR -->
  <tr><td style="background:#111111;padding:0;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tr>
      <td width="25%" style="padding:18px 0;text-align:center;border-right:1px solid #2A2A2A;">
        <div style="font-size:22px;font-weight:700;color:#FFFFFF;">${prop.sqm || '—'}</div>
        <div style="font-size:10px;color:#666;letter-spacing:1px;text-transform:uppercase;margin-top:4px;">τ.μ.</div>
      </td>
      <td width="25%" style="padding:18px 0;text-align:center;border-right:1px solid #2A2A2A;">
        <div style="font-size:22px;font-weight:700;color:#FFFFFF;">${prop.bedrooms || '—'}</div>
        <div style="font-size:10px;color:#666;letter-spacing:1px;text-transform:uppercase;margin-top:4px;">Υπνοδωμ.</div>
      </td>
      <td width="25%" style="padding:18px 0;text-align:center;border-right:1px solid #2A2A2A;">
        <div style="font-size:22px;font-weight:700;color:#FFFFFF;">${prop.bathrooms || '—'}</div>
        <div style="font-size:10px;color:#666;letter-spacing:1px;text-transform:uppercase;margin-top:4px;">Μπάνια</div>
      </td>
      <td width="25%" style="padding:18px 0;text-align:center;">
        <div style="font-size:18px;font-weight:700;color:#CC2229;">${price}</div>
        <div style="font-size:10px;color:#666;letter-spacing:1px;text-transform:uppercase;margin-top:4px;">Τιμή</div>
      </td>
    </tr></table>
  </td></tr>

  <!-- BODY -->
  <tr><td style="padding:36px 44px;">
    ${prop.description ? `<p style="font-size:15px;color:#444;line-height:1.8;margin:0 0 28px;">${prop.description}</p>` : ''}

    <!-- EXTRA DETAILS -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom:32px;">
      <tr>
        ${prop.floor ? `<td width="50%" style="padding:0 8px 0 0;vertical-align:top;">
          <div style="background:#F8F8F8;border-left:3px solid #CC2229;padding:12px 14px;">
            <div style="font-size:10px;color:#888;letter-spacing:1px;text-transform:uppercase;margin-bottom:3px;">Όροφος</div>
            <div style="font-size:15px;color:#1A1A1A;font-weight:700;">${prop.floor}ος</div>
          </div>
        </td>` : '<td width="50%"></td>'}
        ${prop.year_built ? `<td width="50%" style="padding:0 0 0 8px;vertical-align:top;">
          <div style="background:#F8F8F8;border-left:3px solid #CC2229;padding:12px 14px;">
            <div style="font-size:10px;color:#888;letter-spacing:1px;text-transform:uppercase;margin-bottom:3px;">Έτος Κατ/ής</div>
            <div style="font-size:15px;color:#1A1A1A;font-weight:700;">${prop.year_built}</div>
          </div>
        </td>` : '<td width="50%"></td>'}
      </tr>
    </table>

    <!-- CTA -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
      <tr><td style="border-radius:2px;background:#CC2229;">
        <a href="${ctaUrl}" target="_blank"
          style="display:inline-block;padding:15px 36px;font-size:14px;font-weight:700;color:#FFFFFF;text-decoration:none;letter-spacing:1px;text-transform:uppercase;">
          Δείτε το Ακίνητο &rarr;
        </a>
      </td></tr>
    </table>
    ${prop.ilist_code ? `<p style="margin:12px 0 0;font-size:11px;color:#AAAAAA;">Κωδικός: <strong style="color:#1A1A1A;">${prop.ilist_code}</strong></p>` : ''}
  </td></tr>

  <!-- DIVIDER -->
  <tr><td style="padding:0 44px;"><div style="height:1px;background:#EEEEEE;"></div></td></tr>

  <!-- AGENT -->
  <tr><td style="padding:28px 44px 32px;">
    <div style="font-size:16px;font-weight:700;color:#1A1A1A;margin-bottom:2px;">${agentName}</div>
    <div style="font-size:11px;color:#CC2229;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:12px;">Real Estate Consultant · KW Athens Center</div>
    <div style="font-size:13px;color:#555;line-height:2;">
      📞 <a href="tel:${agentPhone}" style="color:#555;text-decoration:none;">${agentPhone}</a><br>
      ✉️ <a href="mailto:${agentEmail}" style="color:#CC2229;text-decoration:none;">${agentEmail}</a>
    </div>
  </td></tr>

  <!-- FOOTER -->
  <tr><td style="background:#1A1A1A;padding:24px 40px;text-align:center;">
    <p style="margin:0 0 8px;font-size:11px;color:#555;line-height:1.7;">
      KW Athens Center &mdash; Λεωφ. Βασιλίσσης Σοφίας 10, Αθήνα 106 74<br>
      (+30) 211 0131911 &middot; kwathenscenter@kwgreece.gr
    </p>
    <p style="margin:0;font-size:10px;color:#444;">
      &copy; ${year} KW Athens Center.
      <a href="{{unsubscribe}}" style="color:#CC2229;text-decoration:none;">Διαγραφή</a>
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`
}

// ── Route handler ─────────────────────────────────────────
export async function POST(req: NextRequest) {
  // 1. Auth
  const caller = await getAuthedAgent(req)
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  // 2. Parse body — accepts prop data + agent_id
  const body = await req.json()
  const { prop, agent_id } = body as { prop: Record<string, unknown>; agent_id: string }

  if (!canActAs(caller, agent_id)) {
    return NextResponse.json({ error: 'Δεν μπορείς να στείλεις marketing για άλλον μεσίτη' }, { status: 403 })
  }

  // 3. Fetch agent details for personalisation
  const { data: agent } = await supabase
    .from('agents')
    .select('id,email,full_name,phone,agency_id')
    .eq('id', agent_id)
    .eq('agency_id', caller.agency_id)
    .single()

  if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 })

  // 4. Build HTML
  const htmlContent = buildNewsletterHTML(prop, agent)

  // 5. Brevo env check
  const BREVO_API_KEY = process.env.BREVO_API_KEY
  const BREVO_LIST_ID = Number(process.env.BREVO_LIST_ID)
  const BREVO_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || 'kwathenscenter@kwgreece.gr'
  const BREVO_SENDER_NAME = process.env.BREVO_SENDER_NAME || 'KW Athens Center'

  if (!BREVO_API_KEY) {
    // Graceful fallback: log action, return without Brevo
    await supabase.from('marketing_actions').insert({
      agent_id, agency_id: caller.agency_id,
      action_type: 'email_draft', status: 'no_brevo_key',
      sent_at: new Date().toISOString(),
      meta: { address: prop.address, area: prop.area },
    })
    return NextResponse.json({
      ok: true,
      warning: 'BREVO_API_KEY not configured — action logged only',
      campaign_url: null,
    })
  }

  // 6. Create Brevo campaign draft
  const campaignName = `${prop.address || 'Ακίνητο'} — ${new Date().toLocaleDateString('el-GR')}`
  const subject = `Νέο ακίνητο: ${prop.property_type || 'Ακίνητο'} στο ${prop.area || ''} | KW Athens Center`

  const brevoPayload = {
    name: campaignName,
    subject,
    sender: { name: BREVO_SENDER_NAME, email: BREVO_SENDER_EMAIL },
    type: 'classic',
    htmlContent,
    recipients: { listIds: [BREVO_LIST_ID] },
    // No scheduledAt → stays as draft for agent to review
  }

  const brevoRes = await fetch('https://api.brevo.com/v3/emailCampaigns', {
    method: 'POST',
    headers: {
      'api-key': BREVO_API_KEY,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(brevoPayload),
  })

  if (!brevoRes.ok) {
    const err = await brevoRes.json()
    console.error('[marketing/send-email] Brevo error:', err)
    return NextResponse.json({ error: err.message || 'Brevo API error' }, { status: 502 })
  }

  const { id: campaignId } = await brevoRes.json() as { id: number }

  // 7. Log to marketing_actions
  await supabase.from('marketing_actions').insert({
    agent_id, agency_id: caller.agency_id,
    action_type: 'email_draft', status: 'draft_created',
    brevo_campaign_id: campaignId,
    sent_at: new Date().toISOString(),
    meta: { address: prop.address, area: prop.area, ilist_code: prop.ilist_code },
  })

  // 8. Return campaign URL for the agent to open in Brevo
  const campaign_url = `https://app.brevo.com/campaign/stats/list/emails`

  return NextResponse.json({
    ok: true,
    campaign_id: campaignId,
    campaign_url,
    message: `Campaign draft "${campaignName}" δημιουργήθηκε στο Brevo.`,
  })
}
