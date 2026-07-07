import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@supabase/supabase-js'
import { getAuthedAgent }            from '@/lib/auth'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// Reachable two ways: (1) voice-ingest calls this in-process right after saving
// a demand profile, tagging the trusted internal secret since that request has
// no end-user bearer token; (2) an agent manually re-triggers matching from the
// UI with their own session token — that path must prove they own the demand.
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET

// Called internally after a demand_profile is saved.
// Finds active listed properties that match, sends email to client,
// and an in-app notification to the involved agent(s).

type DemandProfile = {
  id: string
  agency_id: string
  agent_id: string
  client_name: string | null
  client_phone: string | null
  client_email: string | null
  transaction_type: string | null
  property_type: string | null
  size_min: number | null
  size_max: number | null
  floor_min: number | null
  floor_max: number | null
  budget_eur: number | null
  areas_preferred: string[]
  must_have: string[]
  condition_req: string | null
}

type MatchedProperty = {
  id: string
  ilist_id: string | null
  title: string | null
  address: string | null
  area: string | null
  sqm: number | null
  asking_price: number | null
  floor: number | null
  rooms: number | null
  balcony: boolean | null
  parking: boolean | null
  condition: string | null
  transaction_type: string | null
  year_built: number | null
  agent_id: string
  agency_id: string
}

// ── Match scoring ─────────────────────────────────────────────────

function scoreMatch(demand: DemandProfile, prop: MatchedProperty): number {
  let score = 0

  // Transaction type must match — map demand side ('buy'→'sale') to property side
  if (demand.transaction_type && prop.transaction_type) {
    const demandSide = demand.transaction_type === 'buy' ? 'sale' : demand.transaction_type
    if (demandSide !== prop.transaction_type) return 0
  }

  // Budget: property asking_price must be within budget (with 15% flexibility)
  if (demand.budget_eur && prop.asking_price) {
    if (prop.asking_price > demand.budget_eur * 1.15) return 0
    score += prop.asking_price <= demand.budget_eur ? 30 : 15
  }

  // Size: sqm within requested range (with 15% flexibility)
  if (prop.sqm) {
    const min = demand.size_min ? demand.size_min * 0.85 : 0
    const max = demand.size_max ? demand.size_max * 1.15 : Infinity
    if (prop.sqm < min || prop.sqm > max) return 0
    score += 25
  }

  // Area match
  if (demand.areas_preferred?.length && prop.area) {
    const areaLower = prop.area.toLowerCase()
    if (demand.areas_preferred.some(a => areaLower.includes(a.toLowerCase()) || a.toLowerCase().includes(areaLower))) {
      score += 30
    }
  } else if (!demand.areas_preferred?.length) {
    score += 15 // no preference = partial credit
  }

  // Floor
  if (demand.floor_min != null && prop.floor != null && prop.floor < demand.floor_min) score -= 10
  if (demand.floor_max != null && prop.floor != null && prop.floor > demand.floor_max) score -= 10

  // Must-have features
  if (demand.must_have?.length) {
    for (const feat of demand.must_have) {
      const f = feat.toLowerCase()
      if ((f.includes('μπαλκ') || f.includes('balcon')) && prop.balcony) score += 5
      if ((f.includes('πάρκ') || f.includes('park'))    && prop.parking) score += 5
    }
  }

  return score
}

// ── Email template ────────────────────────────────────────────────

function buildMatchEmail(
  props: MatchedProperty[],
  demand: DemandProfile,
  clientName: string,
  agentName: string,
  agentPhone: string,
  agentEmail: string,
): string {
  const year = new Date().getFullYear()

  const propCards = props.slice(0, 3).map(p => {
    const price = p.asking_price ? `€${p.asking_price.toLocaleString('el-GR')}` : 'Κατόπιν επικοινωνίας'
    const code  = p.ilist_id ?? ''
    return `
    <!-- Property Card -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
      style="margin-bottom:16px;border:1px solid #EEEEEE;border-radius:4px;overflow:hidden;">
      <tr>
        <td style="padding:20px 24px;background:#FFFFFF;">
          ${code ? `<div style="font-size:10px;color:#AAAAAA;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px;">Κωδικός: <strong style="color:#CC2229;">${code}</strong></div>` : ''}
          <div style="font-size:17px;font-weight:700;color:#1A1A1A;margin-bottom:4px;">${p.area ?? ''}</div>
          <div style="font-size:13px;color:#888;margin-bottom:14px;">${p.address ?? ''}</div>

          <!-- Stats row -->
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom:16px;">
            <tr>
              ${p.sqm ? `<td style="padding-right:16px;"><div style="font-size:20px;font-weight:700;color:#1A1A1A;">${p.sqm}</div><div style="font-size:10px;color:#AAAAAA;letter-spacing:1px;text-transform:uppercase;">τ.μ.</div></td>` : ''}
              ${p.rooms ? `<td style="padding-right:16px;"><div style="font-size:20px;font-weight:700;color:#1A1A1A;">${p.rooms}</div><div style="font-size:10px;color:#AAAAAA;letter-spacing:1px;text-transform:uppercase;">Υπνοδωμ.</div></td>` : ''}
              ${p.floor != null ? `<td style="padding-right:16px;"><div style="font-size:20px;font-weight:700;color:#1A1A1A;">${p.floor === 0 ? 'Ισόγ.' : p.floor + 'ος'}</div><div style="font-size:10px;color:#AAAAAA;letter-spacing:1px;text-transform:uppercase;">Όροφος</div></td>` : ''}
              <td><div style="font-size:20px;font-weight:700;color:#CC2229;">${price}</div><div style="font-size:10px;color:#AAAAAA;letter-spacing:1px;text-transform:uppercase;">Τιμή</div></td>
            </tr>
          </table>

          <!-- Feature pills -->
          <div style="margin-bottom:16px;">
            ${p.balcony ? '<span style="display:inline-block;background:#F5F5F5;color:#444;font-size:11px;padding:3px 10px;border-radius:20px;margin:2px 4px 2px 0;">🌿 Μπαλκόνι</span>' : ''}
            ${p.parking ? '<span style="display:inline-block;background:#F5F5F5;color:#444;font-size:11px;padding:3px 10px;border-radius:20px;margin:2px 4px 2px 0;">🚗 Πάρκινγκ</span>' : ''}
            ${p.condition ? `<span style="display:inline-block;background:#F5F5F5;color:#444;font-size:11px;padding:3px 10px;border-radius:20px;margin:2px 4px 2px 0;">✨ ${p.condition}</span>` : ''}
          </div>

          <!-- CTA button -->
          <table role="presentation" cellspacing="0" cellpadding="0" border="0">
            <tr><td style="background:#CC2229;border-radius:2px;">
              <a href="mailto:${agentEmail}?subject=Ενδιαφέρον για ${code || p.area}&body=Γεια σας, ενδιαφέρομαι για το ακίνητο ${code} στο ${p.area}."
                style="display:inline-block;padding:11px 24px;font-size:13px;font-weight:700;color:#FFFFFF;text-decoration:none;letter-spacing:0.5px;">
                Εκδήλωση Ενδιαφέροντος →
              </a>
            </td></tr>
          </table>
        </td>
      </tr>
    </table>`
  }).join('')

  return `<!DOCTYPE html>
<html lang="el">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Βρήκαμε ακίνητα για σας | KW Athens Center</title></head>
<body style="margin:0;padding:0;background:#F4F4F4;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#F4F4F4;">
<tr><td style="padding:24px 0;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" align="center"
  style="margin:0 auto;background:#FFFFFF;box-shadow:0 2px 20px rgba(0,0,0,.08);">

  <!-- LOGO BAR -->
  <tr><td style="background:#1A1A1A;padding:18px 40px;">
    <img src="https://www.kwac.gr/images/logow.png" alt="KW Athens Center" width="130"
      style="display:block;max-width:130px;">
  </td></tr>
  <tr><td style="background:#CC2229;height:3px;font-size:0;line-height:0;">&nbsp;</td></tr>

  <!-- HERO -->
  <tr><td style="padding:40px 44px 32px;border-bottom:1px solid #F0F0F0;">
    <div style="font-size:11px;color:#CC2229;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:12px;">
      Εξατομικευμένη Πρόταση
    </div>
    <h1 style="margin:0 0 12px;font-size:24px;font-weight:700;color:#1A1A1A;line-height:1.3;">
      Βρήκαμε ${props.length} ακίνητ${props.length === 1 ? 'ο' : 'α'} που ταιριάζ${props.length === 1 ? 'ει' : 'ουν'} με την αναζήτησή σας
    </h1>
    <p style="margin:0;font-size:15px;color:#555;line-height:1.7;">
      Γεια σας ${clientName ? clientName.split(' ')[0] : ''},<br>
      με βάση τα κριτήριά σας — ${[
        demand.transaction_type === 'buy' ? 'αγορά' : 'ενοίκιο',
        demand.areas_preferred?.length ? demand.areas_preferred.join('/') : null,
        demand.size_min || demand.size_max ? `${demand.size_min ?? '?'}–${demand.size_max ?? '?'} τ.μ.` : null,
        demand.budget_eur ? `έως €${demand.budget_eur.toLocaleString('el-GR')}` : null,
      ].filter(Boolean).join(', ')} — επιλέξαμε τα παρακάτω ακίνητα από το χαρτοφυλάκιό μας.
    </p>
  </td></tr>

  <!-- PROPERTY CARDS -->
  <tr><td style="padding:28px 44px;">
    ${propCards}
  </td></tr>

  <!-- DIVIDER -->
  <tr><td style="padding:0 44px;"><div style="height:1px;background:#F0F0F0;"></div></td></tr>

  <!-- AGENT BLOCK -->
  <tr><td style="padding:28px 44px 36px;">
    <div style="font-size:11px;color:#AAAAAA;letter-spacing:1px;text-transform:uppercase;margin-bottom:14px;">Ο σύμβουλός σας</div>
    <div style="font-size:17px;font-weight:700;color:#1A1A1A;margin-bottom:2px;">${agentName}</div>
    <div style="font-size:11px;color:#CC2229;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:14px;">Real Estate Consultant · KW Athens Center</div>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
      <td style="padding-right:20px;">
        <a href="tel:${agentPhone}" style="display:flex;align-items:center;gap:6px;font-size:14px;color:#1A1A1A;text-decoration:none;font-weight:600;">
          📞 ${agentPhone}
        </a>
      </td>
      <td>
        <a href="mailto:${agentEmail}" style="font-size:14px;color:#CC2229;text-decoration:none;font-weight:600;">
          ✉️ ${agentEmail}
        </a>
      </td>
    </tr></table>
  </td></tr>

  <!-- FOOTER -->
  <tr><td style="background:#1A1A1A;padding:22px 40px;text-align:center;">
    <p style="margin:0 0 8px;font-size:11px;color:#555;line-height:1.8;">
      KW Athens Center &mdash; Λεωφ. Βασιλίσσης Σοφίας 10, Αθήνα 106 74<br>
      (+30) 211 0131911 &middot; kwathenscenter@kwgreece.gr
    </p>
    <p style="margin:0;font-size:10px;color:#3A3A3A;">
      &copy; ${year} KW Athens Center.&nbsp;
      <a href="{{unsubscribe}}" style="color:#CC2229;text-decoration:none;">Διαγραφή</a>
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`
}

// ── Route ─────────────────────────────────────────────────────────

// POST { demand_id }
// Called from voice-ingest immediately after saving a demand profile.
// Also callable manually to re-run matching.
export async function POST(req: NextRequest) {
  const { demand_id } = await req.json()
  if (!demand_id) return NextResponse.json({ error: 'demand_id required' }, { status: 400 })

  const isInternalCall = !!INTERNAL_API_SECRET && req.headers.get('x-internal-secret') === INTERNAL_API_SECRET
  const caller = isInternalCall ? null : await getAuthedAgent(req)
  if (!isInternalCall && !caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 1. Load demand
  const { data: demand } = await db
    .from('demand_profiles')
    .select('*')
    .eq('id', demand_id)
    .single()
  if (!demand) return NextResponse.json({ error: 'Demand not found' }, { status: 404 })
  if (caller && demand.agency_id !== caller.agency_id)
    return NextResponse.json({ error: 'Demand not found' }, { status: 404 })

  const d = demand as DemandProfile
  if (!d.client_email) return NextResponse.json({ ok: true, matched: 0, reason: 'No client email' })

  // 2. Fetch active listed properties in the same agency
  // "Active" = meeting_properties with assignment doc OR status in for_appraisal/estimated/completed
  const { data: props } = await db
    .from('meeting_properties')
    .select('id,ilist_id,title,address,area,sqm,asking_price,floor,rooms,balcony,parking,condition,transaction_type,year_built,agent_id,agency_id')
    .eq('agency_id', d.agency_id)
    .in('status', ['for_appraisal', 'estimated', 'completed'])

  if (!props?.length) return NextResponse.json({ ok: true, matched: 0 })

  // 3. Score and filter
  const scored = (props as MatchedProperty[])
    .map(p => ({ prop: p, score: scoreMatch(d, p) }))
    .filter(x => x.score >= 30)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)

  if (!scored.length) return NextResponse.json({ ok: true, matched: 0 })

  const matchedProps = scored.map(x => x.prop)

  // 4. Fetch demand agent info
  const { data: demandAgent } = await db
    .from('agents')
    .select('id,full_name,email,phone')
    .eq('id', d.agent_id)
    .single()

  const agentName  = demandAgent?.full_name ?? 'Σύμβουλος'
  const agentPhone = demandAgent?.phone     ?? '(+30) 211 0131911'
  const agentEmail = demandAgent?.email     ?? 'kwathenscenter@kwgreece.gr'

  // 5. Send email to client via Brevo transactional
  const BREVO_API_KEY      = process.env.BREVO_API_KEY?.trim()
  const BREVO_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || 'kwathenscenter@kwgreece.gr'
  const BREVO_SENDER_NAME  = process.env.BREVO_SENDER_NAME  || 'KW Athens Center'

  let emailSent = false

  if (BREVO_API_KEY) {
    const htmlContent = buildMatchEmail(
      matchedProps, d,
      d.client_name ?? '',
      agentName, agentPhone, agentEmail,
    )

    const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
      method:  'POST',
      headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender:      { name: BREVO_SENDER_NAME, email: BREVO_SENDER_EMAIL },
        to:          [{ email: d.client_email, name: d.client_name ?? undefined }],
        subject:     `Βρήκαμε ${matchedProps.length} ακίνητ${matchedProps.length === 1 ? 'ο' : 'α'} για σας | KW Athens Center`,
        htmlContent,
        tags:        ['demand-match'],
      }),
    })

    emailSent = brevoRes.ok
    if (!brevoRes.ok) console.error('[demand-match] Brevo error', await brevoRes.text())
  }

  // 6. Notify agents (demand agent + any property agent that differs)
  const propertyAgentIds = [...new Set(matchedProps.map(p => p.agent_id).filter(id => id !== d.agent_id))]
  const allAgentIds = [d.agent_id, ...propertyAgentIds]

  const notifRows = allAgentIds.map(agentId => ({
    agency_id:  d.agency_id,
    agent_id:   agentId,
    type:       'demand_match',
    title:      `Ματσάρισμα ζήτησης${emailSent ? ' — email στάλθηκε' : ''}`,
    body:       `${d.client_name ?? d.client_phone ?? 'Πελάτης'} ζητά ${d.transaction_type === 'buy' ? 'αγορά' : 'ενοίκιο'} — ${matchedProps.length} ακίνητ${matchedProps.length === 1 ? 'ο' : 'α'} βρέθηκαν.${emailSent ? ` Email στάλθηκε στο ${d.client_email}.` : ''}`,
    meta:       { demand_id, matched_property_ids: matchedProps.map(p => p.id), email_sent: emailSent },
    read:       false,
  }))

  // Insert notifications if table exists (non-fatal)
  try {
    await db.from('notifications').insert(notifRows)
  } catch {
    console.warn('[demand-match] notifications table not found — skipping')
  }

  return NextResponse.json({
    ok:       true,
    matched:  matchedProps.length,
    email_sent: emailSent,
    property_ids: matchedProps.map(p => p.id),
  })
}
