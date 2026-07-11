import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { secureCompare } from '@/lib/secureCompare'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Triggered daily at 04:00 by Vercel Cron (vercel.json).
// Manually: GET /api/ingest-cron with Authorization: Bearer <CRON_SECRET>

// Vercel Hobby max — now loops every agency with its own ilist_export_url
// configured (migration 20260711120400), so total duration scales with
// agency count, not just one fixed import.
export const maxDuration = 60

const CRON_SECRET = process.env.CRON_SECRET

function verifyCronAuth(req: NextRequest): boolean {
  if (!CRON_SECRET) return false
  return secureCompare(req.headers.get('authorization') ?? '', `Bearer ${CRON_SECRET}`)
}

function parseRow(headers: string[], cols: string[]): Record<string, string> {
  const row: Record<string, string> = {}
  headers.forEach((h, i) => { row[h] = (cols[i] ?? '').trim() })
  return row
}

function extractField(row: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) if (row[k]) return row[k]
  return ''
}

interface ParsedProperty {
  ilist_id: string; title: string; area: string; address: string
  sqm: number | null; price: number | null; floor: string | null
  year_built: number | null; property_type: string | null; deal_type: string
  ilist_url: string | null; agent_name: string | null; agent_email: string | null
  price_per_sqm: number | null
}

function parseTSV(text: string): ParsedProperty[] {
  const lines = text.split('\n').filter(l => l.trim())
  if (lines.length < 2) return []
  const headers = lines[0].split('\t').map(h => h.trim().toLowerCase())
  const results: ParsedProperty[] = []
  for (let i = 1; i < lines.length; i++) {
    const row = parseRow(headers, lines[i].split('\t'))
    const ilist_id = extractField(row, 'κωδικος', 'code', 'id', 'κωδ')
    if (!ilist_id) continue
    const sqm   = parseFloat(extractField(row, 'τμ', 'εμβαδο', 'sqm') || '0') || null
    const price = parseFloat((extractField(row, 'τιμη', 'price') || '0').replace(/[^0-9.]/g, '')) || null
    results.push({
      ilist_id, title: extractField(row, 'τιτλος', 'title', 'ακινητο') || 'Ακίνητο ' + ilist_id,
      area: extractField(row, 'περιοχη', 'area', 'περιοχή'), address: extractField(row, 'διευθυνση', 'address', 'οδος', 'δ/νση'),
      sqm, price, floor: extractField(row, 'οροφος', 'floor') || null,
      year_built: parseInt(extractField(row, 'ετος', 'year') || '0') || null,
      property_type: extractField(row, 'τυπος', 'type', 'category') || null,
      deal_type: extractField(row, 'τυπος_συναλλαγης', 'deal_type', 'προς') || 'sale',
      ilist_url: extractField(row, 'url', 'link') || null,
      agent_name: extractField(row, 'μεσιτης', 'agent', 'agent_name') || null,
      agent_email: extractField(row, 'email_μεσιτη', 'agent_email') || null,
      price_per_sqm: sqm && price ? Math.round(price / sqm) : null,
    })
  }
  return results
}

async function fetchFromURL(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) })
    return res.ok ? await res.text() : null
  } catch { return null }
}

// Global bucket-root fallback (no per-agency folder convention exists for
// this bucket today) — only ever used for the single legacy-fallback
// target below, never looped across multiple configured agencies, since
// that would mean two different agencies importing the same file into
// their own agency_id.
async function fetchFromStorage(): Promise<string | null> {
  const { data: files } = await sb.storage.from('ilist-exports').list('', { limit: 1, sortBy: { column: 'created_at', order: 'desc' } })
  if (!files?.length) return null
  const { data } = await sb.storage.from('ilist-exports').download(files[0].name)
  return data ? await data.text() : null
}

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const startTime = Date.now()

  const { data: agencies } = await sb.from('agencies').select('id, ilist_export_url').order('created_at')
  const configured = (agencies ?? []).filter((a): a is { id: string; ilist_export_url: string } => !!a.ilist_export_url)

  // Legacy fallback: no agency has opted into its own ilist_export_url yet,
  // so behave exactly as before (single global env var -> the one agency
  // that exists today) rather than breaking the working nightly cron. The
  // moment any agency sets its own ilist_export_url, this fallback stops
  // applying at all — per-agency config becomes authoritative, not "the
  // first agency ever created."
  const targets = configured.length > 0
    ? configured.map(a => ({ id: a.id, url: a.ilist_export_url, useStorageFallback: false }))
    : (process.env.ILIST_EXPORT_URL && agencies?.[0]
        ? [{ id: agencies[0].id, url: process.env.ILIST_EXPORT_URL, useStorageFallback: true }]
        : [])

  if (targets.length === 0) {
    return NextResponse.json({ ok: false, message: 'No agency has ilist_export_url configured, and ILIST_EXPORT_URL fallback is unset.' })
  }

  const results: Array<{ agency_id: string; ok: boolean; source?: string; rows?: number; message?: string }> = []

  for (const target of targets) {
    let rawText = await fetchFromURL(target.url)
    let source = rawText ? 'url' : 'none'
    if (!rawText && target.useStorageFallback) { rawText = await fetchFromStorage(); if (rawText) source = 'storage' }

    if (!rawText) { results.push({ agency_id: target.id, ok: false, message: 'No data source reachable' }); continue }

    const rows = parseTSV(rawText)
    if (rows.length === 0) { results.push({ agency_id: target.id, ok: false, source, message: 'File parsed but 0 valid rows.' }); continue }

    const upsertPayload = rows.map(r => ({ ...r, agency_id: target.id, updated_at: new Date().toISOString() }))
    const { error } = await sb.from('properties').upsert(upsertPayload, { onConflict: 'ilist_id', ignoreDuplicates: false })

    results.push({ agency_id: target.id, ok: !error, source, rows: rows.length, message: error?.message })
  }

  return NextResponse.json({ ok: results.every(r => r.ok), results, elapsed_ms: Date.now() - startTime })
}