import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthedAgent, isCeoOrAdmin } from '@/lib/auth'
import { getOfficeActivityMetrics } from '@/lib/officeMetrics'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// Admin-only cross-agent activity view — Monitor's "Παραγωγή" tab. Same
// aggregation lib/officeMetrics.ts feeds Intelligence OP, so the two never
// disagree on what a number means.
export async function GET(req: NextRequest) {
  const caller = await getAuthedAgent(req)
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isCeoOrAdmin(caller)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const result = await getOfficeActivityMetrics(sb, caller.agency_id)
  return NextResponse.json(result)
}
