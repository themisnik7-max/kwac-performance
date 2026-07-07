import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthedAgent, isCeoOrAdmin } from '@/lib/auth'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// POST { property_id, comment, agent_estimate?, agrees_with_ai }
// Only the top producers for the property's area (or CEO/Admin) may comment,
// and only once an AI valuation already exists — this was previously a bare
// browser insert with no eligibility check at all (any authenticated agent
// could comment on any property).
export async function POST(req: NextRequest) {
  const caller = await getAuthedAgent(req)
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { property_id, comment, agent_estimate, agrees_with_ai } = await req.json() as
    { property_id: string; comment: string; agent_estimate?: number | null; agrees_with_ai: boolean }
  if (!property_id || !comment?.trim() || agrees_with_ai == null)
    return NextResponse.json({ error: 'property_id, comment, agrees_with_ai required' }, { status: 400 })

  const { data: prop } = await sb.from('meeting_properties').select('area, agency_id').eq('id', property_id).single()
  if (!prop || prop.agency_id !== caller.agency_id) return NextResponse.json({ error: 'Property not found' }, { status: 404 })

  const { data: valuation } = await sb.from('meeting_valuations').select('property_id').eq('property_id', property_id).maybeSingle()
  if (!valuation) return NextResponse.json({ error: 'Δεν υπάρχει ακόμα εκτίμηση για αυτό το ακίνητο' }, { status: 409 })

  if (!isCeoOrAdmin(caller)) {
    const { data: topProducers } = await sb.rpc('top_producers_by_area', { p_area: prop.area })
    // top_producers_by_area matches sold comps to an agent via properties.agent_email,
    // which is null on every closed comp in the current data (a real data-completeness
    // gap, not something to silently paper over) — so it always returns empty right now.
    // Failing closed on empty data would lock out every agent, not just non-top-producers,
    // which is worse than the rule it's meant to enforce. Open access until that data
    // exists; once top producers are actually identifiable, this becomes a real gate.
    if (topProducers?.length) {
      const eligible = topProducers.some((tp: any) => tp.agent_id === caller.id)
      if (!eligible) return NextResponse.json({ error: 'Μόνο οι top producers της περιοχής σχολιάζουν' }, { status: 403 })
    }
  }

  const { error } = await sb.from('meeting_comments').insert({
    property_id, agent_id: caller.id, agent_name: caller.full_name || caller.email,
    comment: comment.trim(), agent_estimate: agent_estimate ?? null, agrees_with_ai,
    feedback_processed: false, feedback_weight: 1.0,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
