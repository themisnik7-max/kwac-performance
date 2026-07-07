import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthedAgent, isCeoOrAdmin } from '@/lib/auth'
import { getIntelligenceData } from '@/lib/intelligenceData'
import {
  DAILY_ACTION_CAP, CONFIRM_REQUIRED_TOOLS, buildSystemPrompt, callClaude, checkAndIncrementUsage, logAction,
  findContactsByName, executeAddContact, executeCreateOpenHouse, executeSendEmail,
  executeLogCall, executeSetGpsGoal, executeCancelRoomBooking, executeOpenHouseVolunteer,
  executeAddPropertyComment, executeRunPropertyValuation,
  previewOrSendPropertySms, previewOrSendPropertyNewsletter,
} from '@/lib/aiAdmin'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// AI Admin: portfolio Q&A plus action execution via Claude tool-calling —
// see lib/aiAdmin.ts's TOOLS array for the full action list. Two request shapes:
//   { message }        — a new turn (typed or transcribed-from-voice text)
//   { confirm_action }  — user confirmed a previously-previewed send (email/sms/
//                        newsletter); this path never calls Claude again.
export async function POST(req: NextRequest) {
  const caller = await getAuthedAgent(req)
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await req.json()
  const origin = req.nextUrl.origin
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')

  if (body.confirm_action) {
    const { tool_name, tool_args } = body.confirm_action as { tool_name: string; tool_args: Record<string, any> }
    if (!CONFIRM_REQUIRED_TOOLS.includes(tool_name as any)) return NextResponse.json({ error: 'Invalid confirm action' }, { status: 400 })

    if (tool_name === 'send_email') {
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

    if (tool_name === 'send_property_sms') {
      const { ok, data } = await previewOrSendPropertySms(origin, token, caller.id, tool_args as any, true)
      const summary = ok ? `✅ SMS στάλθηκε (${data.sent}/${data.total}).` : (data.error || 'Σφάλμα.')
      await logAction(sb, { agencyId: caller.agency_id, agentId: caller.id, inputText: '[confirm send_property_sms]', toolName: tool_name, toolArgs: tool_args, status: ok ? 'confirmed_executed' : 'error', resultSummary: summary })
      return NextResponse.json({ reply: summary, executed: ok })
    }

    if (tool_name === 'send_property_newsletter') {
      const { ok, data } = await previewOrSendPropertyNewsletter(origin, token, caller.id, tool_args as any, true)
      const summary = ok ? `✅ Newsletter στάλθηκε (${data.sent}/${data.total}).` : (data.error || 'Σφάλμα.')
      await logAction(sb, { agencyId: caller.agency_id, agentId: caller.id, inputText: '[confirm send_property_newsletter]', toolName: tool_name, toolArgs: tool_args, status: ok ? 'confirmed_executed' : 'error', resultSummary: summary })
      return NextResponse.json({ reply: summary, executed: ok })
    }
  }

  // Input guardrail: cap length before it ever reaches Claude — bounds token
  // cost per turn and blocks stuffing huge/adversarial text into the prompt.
  const MAX_MESSAGE_LENGTH = 2000
  const message = ((body.message ?? '') as string).trim().slice(0, MAX_MESSAGE_LENGTH)
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

  // Auto-executing tools that only touch tables the caller already owns/is
  // scoped to — log + return uniformly.
  const autoExecutors: Partial<Record<string, () => Promise<{ ok: boolean; summary: string }>>> = {
    add_contact: () => executeAddContact(sb, caller.agency_id, toolUse.input as any),
    create_open_house: () => executeCreateOpenHouse(sb, caller.agency_id, caller.id, toolUse.input as any),
    log_call: () => executeLogCall(sb, caller.id, caller.agency_id, toolUse.input as any),
    set_gps_goal: () => executeSetGpsGoal(sb, caller.id, caller.agency_id, toolUse.input as any),
    cancel_room_booking: () => executeCancelRoomBooking(sb, caller.id, caller.agency_id, isCeoOrAdmin(caller), toolUse.input as any),
    join_open_house: () => executeOpenHouseVolunteer(sb, caller.id, caller.agency_id, 'join', toolUse.input as any),
    leave_open_house: () => executeOpenHouseVolunteer(sb, caller.id, caller.agency_id, 'leave', toolUse.input as any),
    add_property_comment: () => executeAddPropertyComment(origin, token, toolUse.input as any),
    run_property_valuation: () => executeRunPropertyValuation(origin, token, toolUse.input as any),
  }

  const autoExec = autoExecutors[toolUse.name]
  if (autoExec) {
    const result = await autoExec()
    await logAction(sb, { agencyId: caller.agency_id, agentId: caller.id, inputText: message, toolName: toolUse.name, toolArgs: toolUse.input, status: result.ok ? 'executed' : 'error', resultSummary: result.summary })
    return NextResponse.json({ reply: result.summary, executed: result.ok })
  }

  if (toolUse.name === 'send_property_sms') {
    const args = toolUse.input as { property_id: string; message?: string }
    const { ok, data } = await previewOrSendPropertySms(origin, token, caller.id, args, false)
    if (!ok) {
      await logAction(sb, { agencyId: caller.agency_id, agentId: caller.id, inputText: message, toolName: 'send_property_sms', toolArgs: args, status: 'error', resultSummary: data.error })
      return NextResponse.json({ reply: data.error || 'Σφάλμα.' })
    }
    await logAction(sb, { agencyId: caller.agency_id, agentId: caller.id, inputText: message, toolName: 'send_property_sms', toolArgs: args, status: 'proposed' })
    return NextResponse.json({
      reply: `📱 Προεπισκόπηση SMS σε ${data.recipients} παραλήπτες:\n"${data.sample_message}"\n\nΝα το στείλω;`,
      pending_action: { tool_name: 'send_property_sms', tool_args: args },
    })
  }

  if (toolUse.name === 'send_property_newsletter') {
    const args = toolUse.input as { property_ids: string[]; subject?: string }
    const { ok, data } = await previewOrSendPropertyNewsletter(origin, token, caller.id, args, false)
    if (!ok) {
      await logAction(sb, { agencyId: caller.agency_id, agentId: caller.id, inputText: message, toolName: 'send_property_newsletter', toolArgs: args, status: 'error', resultSummary: data.error })
      return NextResponse.json({ reply: data.error || 'Σφάλμα.' })
    }
    await logAction(sb, { agencyId: caller.agency_id, agentId: caller.id, inputText: message, toolName: 'send_property_newsletter', toolArgs: args, status: 'proposed' })
    return NextResponse.json({
      reply: `📧 Προεπισκόπηση newsletter (θέμα: "${data.subject}") σε ${data.recipients} παραλήπτες.\n\nΝα το στείλω;`,
      pending_action: { tool_name: 'send_property_newsletter', tool_args: args },
    })
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
