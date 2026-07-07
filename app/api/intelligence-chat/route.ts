import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthedAgent } from '@/lib/auth'
import { getIntelligenceData } from '@/lib/intelligenceData'
import {
  DAILY_ACTION_CAP, buildSystemPrompt, callClaude, checkAndIncrementUsage, logAction,
  findContactsByName, executeAddContact, executeCreateOpenHouse, executeSendEmail,
} from '@/lib/aiAdmin'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// AI Admin: portfolio Q&A plus action execution (add_contact, create_open_house,
// send_email) via Claude tool-calling. Two request shapes:
//   { message }        — a new turn (typed or transcribed-from-voice text)
//   { confirm_action } — user confirmed a previously-previewed send_email;
//                        this path never calls Claude (see lib/aiAdmin.ts).
export async function POST(req: NextRequest) {
  const caller = await getAuthedAgent(req)
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await req.json()

  if (body.confirm_action) {
    const { tool_name, tool_args } = body.confirm_action as { tool_name: string; tool_args: Record<string, any> }
    if (tool_name !== 'send_email') return NextResponse.json({ error: 'Invalid confirm action' }, { status: 400 })

    const contacts = await findContactsByName(sb, caller.agency_id, tool_args.recipient_name)
    const contact = contacts.find(c => c.id === tool_args.contact_id)
    if (!contact || !contact.email) {
      await logAction(sb, { agencyId: caller.agency_id, agentId: caller.id, inputText: '[confirm send_email]', toolName: 'send_email', toolArgs: tool_args, status: 'error', resultSummary: 'contact no longer found on confirm' })
      return NextResponse.json({ reply: 'Δεν βρέθηκε πλέον ο παραλήπτης — ακυρώθηκε.' })
    }

    const result = await executeSendEmail(sb, contact, caller.email, caller.full_name || caller.email, tool_args as any)
    await logAction(sb, { agencyId: caller.agency_id, agentId: caller.id, inputText: '[confirm send_email]', toolName: 'send_email', toolArgs: tool_args, status: result.ok ? 'confirmed_executed' : 'error', resultSummary: result.summary })
    return NextResponse.json({ reply: result.summary, executed: result.ok })
  }

  const message = ((body.message ?? '') as string).trim()
  if (!message) return NextResponse.json({ error: 'message required' }, { status: 400 })

  const count = await checkAndIncrementUsage(sb, caller.id, caller.agency_id)
  if (count > DAILY_ACTION_CAP) {
    await logAction(sb, { agencyId: caller.agency_id, agentId: caller.id, inputText: message, status: 'blocked_cap' })
    return NextResponse.json({ reply: `Έφτασες το ημερήσιο όριο των ${DAILY_ACTION_CAP} ενεργειών AI Admin. Δοκίμασε ξανά αύριο.`, blocked: true })
  }

  const d = await getIntelligenceData(caller.agency_id)
  const portfolioContext = `Τρέχον portfolio: ${d.totals.totalCount} ακίνητα (${d.totals.salesCount} πωλήσεις, ${d.totals.rentalCount} ενοικιάσεις). Συνολική αξία πωλήσεων €${d.totals.portfolioValue.toLocaleString('el-GR')}, μέση τιμή πώλησης €${d.totals.avgSale.toLocaleString('el-GR')}, μέση ενοικίαση €${d.totals.avgRental.toLocaleString('el-GR')}/μήνα.
Agents: ${d.agents.map(a => `${a.name} (${a.total} ακίνητα, ${a.pct}% του χαρτοφυλακίου)`).join(', ') || 'δεν υπάρχουν καταχωρημένα ακίνητα ακόμα'}.
Περιοχές: ${d.areas.map(a => `${a.area} (${a.count})`).join(', ') || '—'}.
Τύποι ακινήτων: ${d.types.map(t => `${t.type} ${t.pct}%`).join(', ') || '—'}.`

  let claudeResult
  try {
    claudeResult = await callClaude(buildSystemPrompt(portfolioContext), message)
  } catch (e) {
    await logAction(sb, { agencyId: caller.agency_id, agentId: caller.id, inputText: message, status: 'error', resultSummary: String(e) })
    return NextResponse.json({ reply: 'Σφάλμα επικοινωνίας με AI' }, { status: 502 })
  }

  const { text, toolUse } = claudeResult

  if (!toolUse) {
    await logAction(sb, { agencyId: caller.agency_id, agentId: caller.id, inputText: message, status: 'answered', resultSummary: text?.slice(0, 200) })
    return NextResponse.json({ reply: text || 'Δεν ήρθε απάντηση.' })
  }

  if (toolUse.name === 'add_contact') {
    const result = await executeAddContact(sb, caller.agency_id, toolUse.input as any)
    await logAction(sb, { agencyId: caller.agency_id, agentId: caller.id, inputText: message, toolName: 'add_contact', toolArgs: toolUse.input, status: result.ok ? 'executed' : 'error', resultSummary: result.summary })
    return NextResponse.json({ reply: result.summary, executed: result.ok })
  }

  if (toolUse.name === 'create_open_house') {
    const result = await executeCreateOpenHouse(sb, caller.agency_id, caller.id, toolUse.input as any)
    await logAction(sb, { agencyId: caller.agency_id, agentId: caller.id, inputText: message, toolName: 'create_open_house', toolArgs: toolUse.input, status: result.ok ? 'executed' : 'error', resultSummary: result.summary })
    return NextResponse.json({ reply: result.summary, executed: result.ok })
  }

  if (toolUse.name === 'send_email') {
    const args = toolUse.input as { recipient_name: string; subject: string; body: string }
    const contacts = await findContactsByName(sb, caller.agency_id, args.recipient_name)

    if (contacts.length === 0) {
      await logAction(sb, { agencyId: caller.agency_id, agentId: caller.id, inputText: message, toolName: 'send_email', toolArgs: args, status: 'error', resultSummary: 'contact not found' })
      return NextResponse.json({ reply: `Δεν βρήκα πελάτη με το όνομα "${args.recipient_name}".` })
    }
    if (contacts.length > 1) {
      return NextResponse.json({ reply: `Βρήκα ${contacts.length} πελάτες με αυτό το όνομα: ${contacts.map(c => c.full_name).join(', ')}. Διευκρίνισε ποιον εννοείς.` })
    }

    const contact = contacts[0]
    if (!contact.email) {
      await logAction(sb, { agencyId: caller.agency_id, agentId: caller.id, inputText: message, toolName: 'send_email', toolArgs: args, status: 'error', resultSummary: 'contact has no email' })
      return NextResponse.json({ reply: `Ο πελάτης ${contact.full_name} δεν έχει καταχωρημένο email.` })
    }

    const pendingArgs = { ...args, contact_id: contact.id }
    await logAction(sb, { agencyId: caller.agency_id, agentId: caller.id, inputText: message, toolName: 'send_email', toolArgs: pendingArgs, status: 'proposed' })
    return NextResponse.json({
      reply: `📧 Προεπισκόπηση email προς ${contact.full_name} (${contact.email})\nΘέμα: ${args.subject}\n\n${args.body}\n\nΝα το στείλω;`,
      pending_action: { tool_name: 'send_email', tool_args: pendingArgs },
    })
  }

  return NextResponse.json({ reply: text || 'Δεν κατάλαβα το αίτημα.' })
}
