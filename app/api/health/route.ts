import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// Public, unauthenticated, cheap — meant for an external uptime monitor
// (nothing in this app pinged one before this route existed; a stopped
// cron or a dead DB connection was invisible until a human noticed). No
// tenant data leaves here, just reachability + one freshness signal.
export const dynamic = 'force-dynamic'

export async function GET() {
  const start = Date.now()
  try {
    const { error: dbError } = await sb.from('agencies').select('id').limit(1)
    if (dbError) throw dbError

    // Cheap data-freshness proxy: ingest-cron stamps updated_at on every
    // upserted row, so "how long since the last import" is visible here
    // without needing a dedicated cron-run-log table.
    const { data: lastImport } = await sb
      .from('properties').select('updated_at')
      .order('updated_at', { ascending: false }).limit(1).maybeSingle()

    return NextResponse.json({
      ok: true,
      db_latency_ms: Date.now() - start,
      last_property_import_at: lastImport?.updated_at ?? null,
      timestamp: new Date().toISOString(),
    })
  } catch (e: any) {
    return NextResponse.json({
      ok: false,
      error: e.message || 'Unreachable',
      timestamp: new Date().toISOString(),
    }, { status: 503 })
  }
}
