import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthedAgent } from '@/lib/auth'
import { canAccessGpiClient, generateShareToken, type GpiClientRow, type GpiUnitRow } from '@/lib/gpi'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

function buildEmailHtml(agentName: string, agentEmail: string, agentPhone: string, propertyLabel: string, viewUrl: string) {
  const year = new Date().getFullYear()
  return `<!DOCTYPE html>
<html lang="el"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Exclusive Leasing Agreement</title></head>
<body style="margin:0;padding:0;background:#F2F2F2;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" style="background:#F2F2F2;"><tr><td style="padding:20px 0;">
<table role="presentation" width="560" align="center" style="margin:0 auto;background:#FFFFFF;">
  <tr><td style="background:#1A1A1A;padding:20px 40px;text-align:center;"><div style="color:#fff;font-size:18px;font-weight:700;">KW Athens Center</div></td></tr>
  <tr><td style="background:#CC2229;height:4px;font-size:0;">&nbsp;</td></tr>
  <tr><td style="padding:36px 44px;">
    <p style="font-size:14px;color:#333;line-height:1.7;">Καλησπέρα,</p>
    <p style="font-size:14px;color:#333;line-height:1.7;">Επισυνάπτεται προς έλεγχο και υπογραφή το Αποκλειστικό Συμφωνητικό Εκμίσθωσης για το ακίνητο${propertyLabel ? ` — <b>${propertyLabel}</b>` : ''}. Πατήστε το παρακάτω κουμπί για να το δείτε, να το εκτυπώσετε και να το υπογράψετε.</p>
    <table role="presentation" style="margin:24px 0;"><tr><td style="background:#CC2229;border-radius:2px;">
      <a href="${viewUrl}" style="display:inline-block;padding:13px 28px;font-size:13px;font-weight:700;color:#FFFFFF;text-decoration:none;">Προβολή Συμφωνητικού →</a>
    </td></tr></table>
    <p style="font-size:12px;color:#888;">Για οποιαδήποτε ερώτηση, επικοινωνήστε με τον σύμβουλό σας.</p>
    <div style="height:1px;background:#EEEEEE;margin:24px 0;"></div>
    <div style="font-size:15px;font-weight:700;color:#1A1A1A;">${agentName}</div>
    <div style="font-size:13px;color:#555;line-height:2;">📞 ${agentPhone}<br>✉️ ${agentEmail}</div>
  </td></tr>
  <tr><td style="background:#1A1A1A;padding:20px 40px;text-align:center;"><p style="margin:0;font-size:10px;color:#444;">&copy; ${year} KW Athens Center</p></td></tr>
</table></td></tr></table></body></html>`
}

// POST { email: string, confirm?: boolean }
// Preview-then-confirm, same rule as skills/listing-marketing-kit: a send to
// an external party is never automatic. Without confirm:true this only
// returns what would be sent — no share token created, no email sent.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const caller = await getAuthedAgent(req)
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { email, confirm } = await req.json() as { email?: string; confirm?: boolean }
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 })

  const { data: unit } = await db.from('gpi_units').select('*').eq('id', params.id).single()
  if (!unit) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { data: client } = await db.from('gpi_clients').select('*').eq('id', unit.client_id).single()
  if (!client || !canAccessGpiClient(caller, client as GpiClientRow)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const propertyLabel = [(unit as GpiUnitRow).project, (unit as GpiUnitRow).unit_name].filter(Boolean).join(' — ')
  const subject = `KW Athens Center — Exclusive Leasing Agreement${propertyLabel ? ` (${propertyLabel})` : ''}`

  if (!confirm) {
    return NextResponse.json({ ok: true, preview: true, to: email, subject, message: 'Preview only — resend with confirm:true to actually send.' })
  }

  const token = generateShareToken()
  const { error: shareErr } = await db.from('gpi_agreement_shares').insert({
    agency_id: client.agency_id, unit_id: unit.id, token, sent_to_email: email, created_by: caller.id,
    expires_at: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
  })
  if (shareErr) return NextResponse.json({ error: shareErr.message }, { status: 500 })

  const viewUrl = `${req.nextUrl.origin}/gpi/agreement/view/${token}`

  const BREVO_API_KEY = process.env.BREVO_API_KEY
  if (!BREVO_API_KEY) {
    return NextResponse.json({ ok: true, warning: 'BREVO_API_KEY not configured — link created but no email sent', view_url: viewUrl })
  }

  const BREVO_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || 'kwathenscenter@kwgreece.gr'
  const BREVO_SENDER_NAME = process.env.BREVO_SENDER_NAME || 'KW Athens Center'
  const agentName = caller.full_name || caller.email

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender: { name: BREVO_SENDER_NAME, email: BREVO_SENDER_EMAIL },
      to: [{ email }], subject,
      htmlContent: buildEmailHtml(agentName, caller.email, '', propertyLabel, viewUrl),
      tags: ['gpi-agreement'],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    return NextResponse.json({ error: `Brevo error: ${err}` }, { status: 502 })
  }

  return NextResponse.json({ ok: true, to: email, view_url: viewUrl })
}
