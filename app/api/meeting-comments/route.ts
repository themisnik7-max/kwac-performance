import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthedAgent } from '@/lib/auth'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// POST { property_id, comment, agent_estimate?, agrees_with_ai }
// Open to any authenticated agent in the property's agency, once an AI
// valuation already exists to react to. By explicit product decision, this
// is a history/engagement log for everyone — whether a given comment's
// agent_estimate actually moves the price is decided downstream, in
// meeting-valuation and pricing-model/train, which only count feedback from
// that area's top producers. Previously this route itself gated writes to
// top-producers-or-admin, but top_producers_by_area matches sold comps to an
// agent via properties.agent_email (null on every closed comp today), so it
// was silently open to everyone in practice anyway — this makes that
// intentional instead of accidental.
export async function POST(req: NextRequest) {
  const caller = await getAuthedAgent(req)
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { property_id, comment, agent_estimate, agrees_with_ai } = await req.json() as
    { property_id: string; comment: string; agent_estimate?: number | null; agrees_with_ai: boolean }
  if (!property_id || !comment?.trim() || agrees_with_ai == null)
    return NextResponse.json({ error: 'property_id, comment, agrees_with_ai required' }, { status: 400 })

  const { data: prop } = await sb.from('meeting_properties').select('area, agency_id, status').eq('id', property_id).single()
  if (!prop || prop.agency_id !== caller.agency_id) return NextResponse.json({ error: 'Property not found' }, { status: 404 })

  const { data: valuation } = await sb.from('meeting_valuations').select('property_id').eq('property_id', property_id).maybeSingle()
  if (!valuation) return NextResponse.json({ error: 'Δεν υπάρχει ακόμα εκτίμηση για αυτό το ακίνητο' }, { status: 409 })

  const { error } = await sb.from('meeting_comments').insert({
    property_id, agent_id: caller.id, agent_name: caller.full_name || caller.email,
    comment: comment.trim(), agent_estimate: agent_estimate ?? null, agrees_with_ai,
    feedback_processed: false, feedback_weight: 1.0,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // A property only counts as genuinely "estimated" once a top producer for
  // its area has weighed in — the AI number alone used to flip this
  // automatically the moment it was computed (see migration
  // 20260712120000), leaving no real window to review or undo. Scoped to
  // status='for_appraisal' so this can't resurrect an already-completed
  // property or fire twice.
  let markedEstimated = false
  if (prop.status === 'for_appraisal' && prop.area) {
    const { data: topProducers } = await sb.rpc('top_producers_by_area', { p_area: prop.area })
    const isTopProducer = (topProducers || []).some((tp: any) => tp.agent_id === caller.id)
    if (isTopProducer) {
      const { data: updated } = await sb.from('meeting_properties')
        .update({ status: 'estimated' }).eq('id', property_id).eq('status', 'for_appraisal').select('id')
      markedEstimated = !!updated?.length
    }
  }

  return NextResponse.json({ ok: true, marked_estimated: markedEstimated })
}
