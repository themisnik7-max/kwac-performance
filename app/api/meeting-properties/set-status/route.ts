import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthedAgent, isCeoOrAdmin } from '@/lib/auth'
import { runValuation } from '@/lib/pricingEngine'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ALLOWED = ['pending', 'for_appraisal'] as const

// Moves a property between "Εκκρεμεί" and "Προς Εκτίμηση". Previously done
// as a bare client-side Supabase update with only a client-side ownership
// check (trivially bypassable, and RLS was the only real backstop) — this
// route enforces ownership server-side, and is also the trigger point for
// "the AI estimate should already exist by the time anyone opens the
// property, not require a manual click": the moment a property enters
// for_appraisal with no valuation yet, this fires lib/pricingEngine.ts
// directly, bypassing meeting-valuation's admin-only gate on purpose — this
// is a system-triggered side effect of the status change, not a user
// manually invoking "set the price."
export async function POST(req: NextRequest) {
  const caller = await getAuthedAgent(req)
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { property_id, status } = await req.json()
  if (!ALLOWED.includes(status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 })

  const { data: prop } = await sb
    .from('meeting_properties').select('id, agent_id, agency_id, status').eq('id', property_id).single()
  if (!prop || prop.agency_id !== caller.agency_id) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (prop.agent_id !== caller.id && !isCeoOrAdmin(caller)) {
    return NextResponse.json({ error: 'Μόνο ο υπεύθυνος μεσίτης μπορεί να αλλάξει την κατάσταση' }, { status: 403 })
  }
  // This route is only the pre-review pending<->for_appraisal toggle. Once
  // a top producer has commented (status='estimated') or an admin has
  // closed it out (status='completed'), reverting is a bigger, more
  // deliberate action than "I clicked the wrong button" — not offered by
  // this endpoint.
  if (prop.status !== 'pending' && prop.status !== 'for_appraisal') {
    return NextResponse.json({ error: 'Δεν μπορεί να αλλάξει κατάσταση πλέον — έχει ήδη εκτιμηθεί.' }, { status: 409 })
  }

  const { error: updErr } = await sb.from('meeting_properties').update({ status }).eq('id', property_id)
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

  let valuationTriggered = false
  if (status === 'for_appraisal') {
    const { data: existing } = await sb.from('meeting_valuations').select('property_id').eq('property_id', property_id).maybeSingle()
    if (!existing) {
      const result = await runValuation(sb, property_id, caller.agency_id)
      valuationTriggered = result.success
      if ('error' in result) console.error('[set-status] auto-valuation failed (non-fatal, status change still applied)', result.error)
    }
  }

  return NextResponse.json({ ok: true, status, valuation_triggered: valuationTriggered })
}
