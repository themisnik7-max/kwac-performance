// Shared logic for the AI Admin chat/voice assistant (app/api/intelligence-chat,
// components/AiAdminChat.tsx). Handles tool-calling against Claude, the daily
// per-agent usage cap, and the audit log every turn writes to regardless of
// outcome — see PRODUCT_SPEC.md / CLAUDE.md on admin oversight.
import { SupabaseClient } from '@supabase/supabase-js'
import { contactName, splitName } from '@/lib/contacts'

export const DAILY_ACTION_CAP = 50
// Haiku, not Sonnet — this route is mostly short structured extraction (which
// tool, which args) plus grounded one-paragraph answers, not deep reasoning,
// so the cheaper/faster model is the right default. Swap here if answer
// quality on open-ended portfolio questions ever feels thin.
const MODEL = 'claude-haiku-4-5-20251001'

export type ToolName =
  | 'add_contact' | 'create_open_house' | 'send_email'
  | 'log_call' | 'set_gps_goal' | 'cancel_room_booking' | 'join_open_house' | 'leave_open_house'
  | 'add_property_comment' | 'run_property_valuation'
  | 'send_property_sms' | 'send_property_newsletter'

// Tools whose executor calls an existing, already-gated route rather than
// touching tables directly — keeps eligibility/consent/tracking logic in
// exactly one place instead of re-implementing it here.
export const CONFIRM_REQUIRED_TOOLS: ToolName[] = ['send_email', 'send_property_sms', 'send_property_newsletter']

export const TOOLS = [
  {
    name: 'add_contact',
    description: 'Add a new client/lead to the contact list. Call this directly as soon as you have a name and at least one of phone/email — it executes immediately, no confirmation needed. Do not invent a phone or email that wasn\'t given.',
    input_schema: {
      type: 'object',
      properties: {
        full_name: { type: 'string', description: 'Contact full name' },
        phone: { type: 'string', description: 'Phone number, digits as given' },
        email: { type: 'string', description: 'Email address' },
      },
      required: ['full_name'],
    },
  },
  {
    name: 'create_open_house',
    description: 'Schedule an open house at an address. Call this directly once you have an address and a date/time — it executes immediately, no confirmation needed. Resolve relative days ("Τετάρτη", "αύριο") to an absolute YYYY-MM-DD using the current date given in your instructions.',
    input_schema: {
      type: 'object',
      properties: {
        address: { type: 'string', description: 'Street address / area, as given' },
        date: { type: 'string', description: 'Resolved absolute date, YYYY-MM-DD' },
        start_time: { type: 'string', description: 'HH:MM 24h, default 11:00 if not given' },
        end_time: { type: 'string', description: 'HH:MM 24h, default 13:00 if not given' },
      },
      required: ['address', 'date'],
    },
  },
  {
    name: 'send_email',
    description: 'Send an email to a named contact. This NEVER sends immediately — the system always shows the user a preview and only sends after they explicitly confirm, so you may call this freely once you have a recipient name, subject, and body. If the user did not say what the email should contain, do not call this tool — ask a short clarifying question in plain text instead of inventing content.',
    input_schema: {
      type: 'object',
      properties: {
        recipient_name: { type: 'string', description: 'Name of the contact to look up' },
        subject: { type: 'string' },
        body: { type: 'string', description: 'Plain-text email body' },
      },
      required: ['recipient_name', 'subject', 'body'],
    },
  },
  {
    name: 'log_call',
    description: 'Log a call the agent just made to a phone number, counting toward their weekly call total. Call directly, executes immediately.',
    input_schema: {
      type: 'object',
      properties: { phone: { type: 'string', description: 'Phone number called' } },
      required: ['phone'],
    },
  },
  {
    name: 'set_gps_goal',
    description: 'Set or update the calling agent\'s own annual income goal / GPS targets. Only ever affects the caller\'s own goal. Call directly, executes immediately. Only include fields the user actually gave a number for.',
    input_schema: {
      type: 'object',
      properties: {
        target_income: { type: 'number', description: 'Annual income target in EUR' },
        avg_property_price: { type: 'number' },
        commission_rate: { type: 'number', description: 'Percent, e.g. 3 for 3%' },
        agent_split: { type: 'number', description: 'Percent of commission the agent keeps' },
      },
      required: [],
    },
  },
  {
    name: 'cancel_room_booking',
    description: 'Cancel a meeting room booking by its id. Call directly, executes immediately (only the booking owner or admin can actually cancel it — the system enforces that, not you).',
    input_schema: {
      type: 'object',
      properties: { booking_id: { type: 'string' } },
      required: ['booking_id'],
    },
  },
  {
    name: 'join_open_house',
    description: 'Sign the calling agent up as a volunteer for an open house by its id. Call directly, executes immediately.',
    input_schema: {
      type: 'object',
      properties: { open_house_id: { type: 'string' } },
      required: ['open_house_id'],
    },
  },
  {
    name: 'leave_open_house',
    description: 'Withdraw the calling agent from an open house they volunteered for. Call directly, executes immediately.',
    input_schema: {
      type: 'object',
      properties: { open_house_id: { type: 'string' } },
      required: ['open_house_id'],
    },
  },
  {
    name: 'add_property_comment',
    description: 'Post the agent\'s feedback/estimate on a property\'s AI valuation, for Meeting Ακινήτων. Call directly — the system will reject it if the agent isn\'t eligible (only the property area\'s top producers or admin can comment, and only once a valuation exists), just relay that message back if so.',
    input_schema: {
      type: 'object',
      properties: {
        property_id: { type: 'string' },
        comment: { type: 'string' },
        agrees_with_ai: { type: 'boolean' },
        agent_estimate: { type: 'number', description: 'Optional — the agent\'s own price estimate in EUR' },
      },
      required: ['property_id', 'comment', 'agrees_with_ai'],
    },
  },
  {
    name: 'run_property_valuation',
    description: 'Trigger a fresh AI comp-based valuation for a property in Meeting Ακινήτων. Admin/CEO only — the system enforces that, just relay the error back if the caller isn\'t eligible. Call directly, no preview needed (the valuation itself is the output).',
    input_schema: {
      type: 'object',
      properties: { property_id: { type: 'string' } },
      required: ['property_id'],
    },
  },
  {
    name: 'send_property_sms',
    description: 'Send an SMS about a property to every SMS-consented contact. NEVER sends immediately — always preview first, send only after explicit confirmation.',
    input_schema: {
      type: 'object',
      properties: {
        property_id: { type: 'string' },
        message: { type: 'string', description: 'Optional custom message; a sensible default is used if omitted' },
      },
      required: ['property_id'],
    },
  },
  {
    name: 'send_property_newsletter',
    description: 'Send an email newsletter for one or more properties to every email-consented contact. NEVER sends immediately — always preview first, send only after explicit confirmation.',
    input_schema: {
      type: 'object',
      properties: {
        property_ids: { type: 'array', items: { type: 'string' } },
        subject: { type: 'string', description: 'Optional custom subject' },
      },
      required: ['property_ids'],
    },
  },
]

export function buildSystemPrompt(portfolioContext: string): string {
  const now = new Date()
  const todayIso = now.toISOString().split('T')[0]
  const weekday = now.toLocaleDateString('el-GR', { weekday: 'long' })
  return `Είσαι ο AI Admin assistant ενός μεσιτικού γραφείου — απαντάς ερωτήσεις πάνω στο portfolio ΚΑΙ εκτελείς ενέργειες (προσθήκη πελάτη, δημιουργία open house, αποστολή email) μέσω των εργαλείων που έχεις.

Σήμερα είναι ${weekday}, ${todayIso}.

${portfolioContext}

Κανόνες:
- Απαντάς ΜΟΝΟ βάσει των δεδομένων που βλέπεις εδώ πάνω, ποτέ επινοημένους αριθμούς.
- Άμεση εκτέλεση, χωρίς επιβεβαίωση: add_contact, create_open_house, log_call, set_gps_goal, cancel_room_booking, join_open_house, leave_open_house, add_property_comment, run_property_valuation. Αν το σύστημα απορρίψει μια ενέργεια (π.χ. δεν είσαι top producer ή admin), απλά μετέφερε το μήνυμα σφάλματος στον χρήστη — μην προσπαθήσεις να το παρακάμψεις.
- Πάντα preview πρώτα, ποτέ άμεση αποστολή: send_email, send_property_sms, send_property_newsletter. ΠΟΤΕ μην επινοήσεις περιεχόμενο — αν ο χρήστης δεν είπε τι να γράφει, ρώτα τον πρώτα σε απλό κείμενο.
- Στα ελληνικά, σύντομα και συγκεκριμένα.`
}

type ClaudeContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: ToolName; input: Record<string, any> }

export async function callClaude(system: string, message: string): Promise<{ text: string | null; toolUse: { name: ToolName; input: Record<string, any> } | null }> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 500,
      system,
      tools: TOOLS,
      messages: [{ role: 'user', content: message }],
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${data?.error?.message || JSON.stringify(data)}`)
  const blocks = (data.content ?? []) as ClaudeContentBlock[]
  const textBlock = blocks.find((b): b is { type: 'text'; text: string } => b.type === 'text')
  const toolBlock = blocks.find((b): b is { type: 'tool_use'; id: string; name: ToolName; input: Record<string, any> } => b.type === 'tool_use')
  return {
    text: textBlock?.text ?? null,
    toolUse: toolBlock ? { name: toolBlock.name, input: toolBlock.input } : null,
  }
}

// Returns the new count; caller rejects the request if it exceeds the cap.
// Checked/incremented BEFORE calling Claude so a request that's over the cap
// never spends a token.
export async function checkAndIncrementUsage(sb: SupabaseClient, agentId: string, agencyId: string): Promise<number> {
  const { data, error } = await sb.rpc('increment_ai_admin_usage', { p_agent_id: agentId, p_agency_id: agencyId })
  if (error) throw error
  return data as number
}

export async function logAction(sb: SupabaseClient, row: {
  agencyId: string; agentId: string; inputText: string
  toolName?: string | null; toolArgs?: Record<string, any> | null
  status: 'answered' | 'proposed' | 'executed' | 'confirmed_executed' | 'blocked_cap' | 'error'
  resultSummary?: string
}) {
  await sb.from('ai_admin_actions_log').insert({
    agency_id: row.agencyId, agent_id: row.agentId, input_text: row.inputText,
    tool_name: row.toolName ?? null, tool_args: row.toolArgs ?? null,
    status: row.status, result_summary: row.resultSummary ?? null,
  })
}

// contacts has two overlapping name schemes in the live data (full_name from
// AI Admin/marketing, first_name+last_name from the original Google Contacts
// import) — search and write both, see lib/contacts.ts.
export async function findContactsByName(sb: SupabaseClient, agencyId: string, name: string) {
  const { data } = await sb.from('contacts').select('id, full_name, first_name, last_name, email')
    .eq('agency_id', agencyId)
    .or(`full_name.ilike.%${name}%,first_name.ilike.%${name}%,last_name.ilike.%${name}%`)
    .limit(5)
  return (data || []).map(c => ({ ...c, full_name: contactName(c) }))
}

export async function executeAddContact(sb: SupabaseClient, agencyId: string, args: { full_name: string; phone?: string; email?: string }) {
  if (!args.phone && !args.email) return { ok: false, summary: 'Χρειάζομαι τηλέφωνο ή email για να προσθέσω τον πελάτη.' }
  // email_consent/sms_consent default to false (DB default) — adding a
  // contact is never itself consent to be marketed to.
  const { first_name, last_name } = splitName(args.full_name)
  const { error } = await sb.from('contacts').insert({
    agency_id: agencyId, full_name: args.full_name, first_name, last_name,
    phone: args.phone ?? null, email: args.email ?? null, type: 'contact',
  })
  if (error) return { ok: false, summary: `Σφάλμα: ${error.message}` }
  return { ok: true, summary: `✅ Πρόσθεσα τον πελάτη ${args.full_name}${args.phone ? ` (${args.phone})` : ''}.` }
}

export async function executeCreateOpenHouse(sb: SupabaseClient, agencyId: string, agentId: string, args: { address: string; date: string; start_time?: string; end_time?: string }) {
  const { error } = await sb.from('open_houses').insert({
    agency_id: agencyId, agent_id: agentId, address: args.address, date: args.date,
    start_time: args.start_time || '11:00', end_time: args.end_time || '13:00',
  })
  if (error) return { ok: false, summary: `Σφάλμα: ${error.message}` }
  return { ok: true, summary: `✅ Δημιούργησα open house στις ${args.date} (${args.start_time || '11:00'}–${args.end_time || '13:00'}) στη διεύθυνση ${args.address}.` }
}

export async function executeLogCall(sb: SupabaseClient, agentId: string, agencyId: string, args: { phone: string }) {
  const now = new Date()
  await sb.from('call_events').insert({ agent_id: agentId, agency_id: agencyId, phone: args.phone, called_at: now.toISOString() })
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  weekStart.setHours(0, 0, 0, 0)
  await sb.rpc('increment_weekly_call_count', { p_agent_id: agentId, p_agency_id: agencyId, p_week_start: weekStart.toISOString().split('T')[0] })
  return { ok: true, summary: `✅ Καταχωρήθηκε κλήση προς ${args.phone}.` }
}

export async function executeSetGpsGoal(sb: SupabaseClient, agentId: string, agencyId: string, args: Record<string, number | undefined>) {
  const rest = Object.fromEntries(Object.entries(args).filter(([, v]) => v != null))
  if (Object.keys(rest).length === 0) return { ok: false, summary: 'Δεν έδωσες καμία τιμή στόχου.' }
  const { error } = await sb.from('gps_goals').upsert(
    { agent_id: agentId, agency_id: agencyId, ...rest, updated_at: new Date().toISOString() },
    { onConflict: 'agent_id' },
  )
  if (error) return { ok: false, summary: `Σφάλμα: ${error.message}` }
  return { ok: true, summary: `✅ Ενημερώθηκε ο στόχος GPS.` }
}

export async function executeCancelRoomBooking(sb: SupabaseClient, agentId: string, agencyId: string, isAdmin: boolean, args: { booking_id: string }) {
  const { data: booking } = await sb.from('room_bookings').select('agent_id, agency_id').eq('id', args.booking_id).single()
  if (!booking || booking.agency_id !== agencyId) return { ok: false, summary: 'Δεν βρέθηκε η κράτηση.' }
  if (booking.agent_id !== agentId && !isAdmin) return { ok: false, summary: 'Δεν μπορείς να ακυρώσεις κράτηση άλλου μεσίτη.' }
  const { error } = await sb.from('room_bookings').delete().eq('id', args.booking_id)
  if (error) return { ok: false, summary: `Σφάλμα: ${error.message}` }
  return { ok: true, summary: '✅ Η κράτηση ακυρώθηκε.' }
}

export async function executeOpenHouseVolunteer(sb: SupabaseClient, agentId: string, agencyId: string, action: 'join' | 'leave', args: { open_house_id: string }) {
  const { data: openHouse } = await sb.from('open_houses').select('agency_id').eq('id', args.open_house_id).single()
  if (!openHouse || openHouse.agency_id !== agencyId) return { ok: false, summary: 'Δεν βρέθηκε το open house.' }

  if (action === 'leave') {
    const { error } = await sb.from('open_house_volunteers').delete().eq('open_house_id', args.open_house_id).eq('agent_id', agentId)
    if (error) return { ok: false, summary: `Σφάλμα: ${error.message}` }
    return { ok: true, summary: '✅ Αποσύρθηκες από το open house.' }
  }

  const { data: existing } = await sb.from('open_house_volunteers').select('id, agent_id').eq('open_house_id', args.open_house_id)
  if ((existing || []).length >= 2) return { ok: false, summary: 'Οι 2 θέσεις εθελοντών έχουν συμπληρωθεί.' }
  if ((existing || []).some(v => v.agent_id === agentId)) return { ok: false, summary: 'Έχεις ήδη δηλώσει συμμετοχή.' }
  const { error } = await sb.from('open_house_volunteers').insert({ open_house_id: args.open_house_id, agent_id: agentId, agency_id: agencyId })
  if (error) return { ok: false, summary: `Σφάλμα: ${error.message}` }
  return { ok: true, summary: '✅ Δήλωσες συμμετοχή στο open house.' }
}

// The remaining tools call an already-gated route instead of touching tables
// directly — eligibility (top-producer/admin), consent filtering, and
// tracked-link/campaign logic all already live in exactly one place there.
async function callInternalRoute(origin: string, token: string, path: string, body: Record<string, any>) {
  const res = await fetch(`${origin}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, data }
}

export async function executeAddPropertyComment(origin: string, token: string, args: { property_id: string; comment: string; agrees_with_ai: boolean; agent_estimate?: number }) {
  const { ok, data } = await callInternalRoute(origin, token, '/api/meeting-comments', args)
  return { ok, summary: ok ? '✅ Το σχόλιο καταχωρήθηκε.' : (data.error || 'Σφάλμα.') }
}

export async function executeRunPropertyValuation(origin: string, token: string, args: { property_id: string }) {
  const { ok, data } = await callInternalRoute(origin, token, '/api/meeting-valuation', args)
  if (!ok) return { ok: false, summary: data.error || 'Σφάλμα.' }
  const v = data.valuation
  return { ok: true, summary: `✅ Νέα εκτίμηση: €${Number(v.recommended ?? 0).toLocaleString('el-GR')} (εμπιστοσύνη ${Math.round((v.confidence || 0) * 100)}%).` }
}

// SMS/newsletter route straight to the caller's own agent_id (canActAs trivially
// passes for self) — preview (confirm:false) and confirm (confirm:true) both go
// through this, matching the routes' own two-call design.
export async function previewOrSendPropertySms(origin: string, token: string, agentId: string, args: { property_id: string; message?: string }, confirm: boolean) {
  return callInternalRoute(origin, token, '/api/marketing/sms', { ...args, agent_id: agentId, confirm })
}

export async function previewOrSendPropertyNewsletter(origin: string, token: string, agentId: string, args: { property_ids: string[]; subject?: string }, confirm: boolean) {
  return callInternalRoute(origin, token, '/api/marketing/newsletter', { ...args, agent_id: agentId, confirm })
}

export async function executeSendEmail(sb: SupabaseClient, contact: { id: string; email: string; full_name: string }, agentEmail: string, agentName: string, args: { subject: string; body: string }) {
  const BREVO_API_KEY = process.env.BREVO_API_KEY
  if (!BREVO_API_KEY) return { ok: false, summary: 'BREVO_API_KEY δεν έχει ρυθμιστεί.' }

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender: { name: process.env.BREVO_SENDER_NAME || 'KW Athens Center', email: process.env.BREVO_SENDER_EMAIL || 'kwathenscenter@kwgreece.gr' },
      to: [{ email: contact.email, name: contact.full_name }],
      replyTo: { email: agentEmail, name: agentName },
      subject: args.subject,
      htmlContent: `<p>${args.body.replace(/\n/g, '<br>')}</p><p>${agentName}<br>KW Athens Center</p>`,
      tags: ['ai-admin'],
    }),
  })
  if (!res.ok) return { ok: false, summary: `Brevo error: ${res.status}` }
  return { ok: true, summary: `✅ Το email στάλθηκε στον/στην ${contact.full_name}.` }
}
