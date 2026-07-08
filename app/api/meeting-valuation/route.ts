import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthedAgent, isCeoOrAdmin } from '@/lib/auth'
import { runValuation } from '@/lib/pricingEngine'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Manual (re-)run — admin/CEO only, since this is what sets "the price" for
// a property in Meeting Ακινήτων. The automatic run that fires the moment a
// property enters for_appraisal (app/api/meeting-properties/set-status) uses
// the same lib/pricingEngine.ts computation directly, without this gate,
// since that's a system-triggered action tied to the status change itself.
export async function POST(req: NextRequest) {
  const caller = await getAuthedAgent(req)
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (!isCeoOrAdmin(caller)) return NextResponse.json({ error: 'Μόνο Admin/CEO μπορεί να εκτελέσει εκτίμηση' }, { status: 403 })

  const { property_id } = await req.json()
  const result = await runValuation(sb, property_id, caller.agency_id)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.error === 'Not found' ? 404 : 500 })
  return NextResponse.json(result)
}
