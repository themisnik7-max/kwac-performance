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

export type ToolName = 'add_contact' | 'create_open_house' | 'send_email'

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
- Για add_contact και create_open_house: κάλεσε το εργαλείο απευθείας μόλις έχεις αρκετές πληροφορίες — εκτελούνται αμέσως.
- Για send_email: ΠΟΤΕ μην επινοήσεις περιεχόμενο. Αν ο χρήστης δεν είπε τι να γράφει το email, ρώτα τον πρώτα σε απλό κείμενο.
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
