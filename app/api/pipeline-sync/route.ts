import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthedAgent } from '@/lib/auth'
import { secureCompare } from '@/lib/secureCompare'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Vercel Hobby max — now loops every agency with its own wp_source_url
// configured (migration 20260711120400), so total duration scales with
// agency count.
export const maxDuration = 60

const CRON_SECRET = process.env.CRON_SECRET

function verifyCronAuth(req: NextRequest): boolean {
  if (!CRON_SECRET) return false
  return secureCompare(req.headers.get('authorization') ?? '', `Bearer ${CRON_SECRET}`)
}

const LEGACY_WP_SOURCE = 'https://www.zadeshome.com'

export async function GET(req: NextRequest) {
  // Two legitimate callers: an automated webhook/cron with CRON_SECRET, or a
  // logged-in agent clicking "Sync Now" (see app/pipeline/page.tsx) with their
  // own session — the latter scopes the sync to their own agency below instead
  // of trusting a client-supplied tenant.
  const cronOk = verifyCronAuth(req)
  const caller = cronOk ? null : await getAuthedAgent(req)
  if (!cronOk && !caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.ZADESHOME_WP_USER || !process.env.ZADESHOME_WP_APP_PASSWORD) {
    return NextResponse.json({
      success: false,
      synced: 0,
      new_properties: 0,
      errors: ['Χρειάζεται ZADESHOME_WP_USER και ZADESHOME_WP_APP_PASSWORD στο Vercel → Environment Variables'],
      synced_at: new Date().toISOString()
    })
  }

  // Targets: an interactive caller syncs only their own agency, from that
  // agency's own wp_source_url. The cron path loops every agency that has
  // opted into wp_source_url; if none have (nobody's configured it yet),
  // it falls back to the single legacy zadeshome.com target on whichever
  // agency doesn't have its own value — same "don't break the working
  // cron, but per-agency config wins the moment it exists" pattern as
  // ingest-cron. Credentials stay global (one real WP-integrated agency
  // today); per-agency encrypted credentials are a when-a-second-one-
  // actually-exists problem, not a build-it-now one.
  type Target = { agency_id: string; wpSourceUrl: string }
  let targets: Target[] = []

  if (caller) {
    const { data: a } = await supabase.from('agencies').select('wp_source_url').eq('id', caller.agency_id).single()
    targets = [{ agency_id: caller.agency_id, wpSourceUrl: a?.wp_source_url || LEGACY_WP_SOURCE }]
  } else {
    const { data: agencies } = await supabase.from('agencies').select('id, wp_source_url').order('created_at')
    const configured = (agencies ?? [])
      .filter((a): a is { id: string; wp_source_url: string } => !!a.wp_source_url)
      .map(a => ({ agency_id: a.id, wpSourceUrl: a.wp_source_url }))
    targets = configured.length > 0
      ? configured
      : (agencies?.[0] ? [{ agency_id: agencies[0].id, wpSourceUrl: LEGACY_WP_SOURCE }] : [])
  }

  const user = process.env.ZADESHOME_WP_USER
  const pass = process.env.ZADESHOME_WP_APP_PASSWORD
  const creds = Buffer.from(user + ':' + pass).toString('base64')

  let synced = 0, newProps = 0
  const errors: string[] = []

  for (const target of targets) {
    try {
      const res = await fetch(`${target.wpSourceUrl}/wp-json/wp/v2/property?per_page=50&status=publish&_fields=id,title,link,date,meta,acf`, {
        headers: {
          'Authorization': 'Basic ' + creds,
          'User-Agent': 'KWACBot/1.0'
        }
      })

      if (!res.ok) throw new Error('WordPress API: ' + res.status + ' - Έλεγξε credentials')

      const props = await res.json() as any[]
      const wpIds = props.map(p => String(p.id))

      // One query to know which of this batch already exist, instead of one
      // exists-check per property (was up to ~150 sequential round trips/call).
      const { data: existingRows } = await supabase.from('pipeline_properties').select('wp_id').in('wp_id', wpIds)
      const existingWpIds = new Set((existingRows || []).map(r => r.wp_id))

      const payloads = props.map(prop => {
        const wpId = String(prop.id)
        const meta = prop.meta || prop.acf || {}
        const title = typeof prop.title === 'object' ? (prop.title.rendered || 'Ακίνητο') : (prop.title || 'Ακίνητο')
        return {
          wp_id: wpId,
          agency_id: target.agency_id,
          title: title.replace(/<[^>]*>/g, ''),
          wp_url: prop.link || null,
          address: meta.fave_property_address || null,
          area: meta.fave_property_city || null,
          price: parseFloat(meta.fave_property_price || '0') || null,
          sqm: parseFloat(meta.fave_property_size || '0') || null,
          property_type: meta.fave_property_type || null,
          deal_type: String(meta.fave_property_status || '').includes('rent') ? 'rent' : 'sale',
          synced_at: new Date().toISOString(),
          ...(existingWpIds.has(wpId) ? {} : { stage: 'listing', listed_at: prop.date || new Date().toISOString() }),
        }
      })

      // Single batched upsert covers both inserts and updates.
      const { data: upserted, error: upsertErr } = await supabase
        .from('pipeline_properties')
        .upsert(payloads, { onConflict: 'wp_id' })
        .select('id, wp_id')

      if (upsertErr) throw upsertErr

      const newlyInserted = (upserted || []).filter(row => !existingWpIds.has(row.wp_id))
      if (newlyInserted.length > 0) {
        const { error: eventsErr } = await supabase.from('pipeline_events').insert(newlyInserted.map(row => ({
          property_id: row.id,
          event_type: 'listing',
          title: 'Νέα Ανάθεση',
          description: `Συγχρονίστηκε από ${target.wpSourceUrl.replace(/^https?:\/\//, '')}`,
          event_date: new Date().toISOString().split('T')[0],
        })))
        if (eventsErr) errors.push(`agency ${target.agency_id}: pipeline_events insert failed — ${eventsErr.message}`)
      }

      newProps += newlyInserted.length
      synced += props.length
    } catch (e: any) {
      errors.push(`agency ${target.agency_id}: ${e.message || 'Άγνωστο σφάλμα'}`)
    }
  }

  return NextResponse.json({ success: true, synced, new_properties: newProps, errors, synced_at: new Date().toISOString() })
}

export async function POST(req: NextRequest) {
  return GET(req)
}