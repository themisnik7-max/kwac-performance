import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthedAgent } from '@/lib/auth'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const SILENCE = new NextResponse(null, { status: 204 })

export async function POST(req: NextRequest) {
  try {
    const caller = await getAuthedAgent(req)
    if (!caller) return SILENCE
    const body = await req.json().catch(() => ({}))
    const route = typeof body.route === 'string' ? body.route.slice(0, 200) : null
    if (!route) return SILENCE

    const { count } = await sb
      .from('page_views')
      .select('id', { count: 'exact', head: true })
      .eq('agent_id', caller.id)
      .eq('route', route)
      .gte('viewed_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())

    if ((count || 0) > 0) return SILENCE

    await sb.from('page_views').insert({ agent_id: caller.id, agency_id: caller.agency_id, route })
  } catch { }
  return SILENCE
}