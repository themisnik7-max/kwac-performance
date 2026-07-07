import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'
import { getAuthedAgent, isCeoOrAdmin } from '@/lib/auth'
import { parseRegistryRows, type RawRegistryRow } from '@/lib/mamaRegistry'

export const maxDuration = 60 // Vercel Hobby max — a 4-5MB workbook can take a while to parse+upsert

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const REGISTRY_BASE = 'https://www.gsis.gr/sites/default/files/akinhta'

// POST { year: number } — admin/CEO only. Fetches that year's public MAMA
// registry export, filters to Attica residential transactions, and upserts
// into market_transactions. Safe to re-run (dedupe index on the row).
export async function POST(req: NextRequest) {
  const caller = await getAuthedAgent(req)
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (!isCeoOrAdmin(caller)) return NextResponse.json({ error: 'Admin/CEO only' }, { status: 403 })

  const { year } = await req.json() as { year: number }
  if (!year || year < 2017 || year > new Date().getFullYear() + 1)
    return NextResponse.json({ error: 'Invalid year' }, { status: 400 })

  const fileRes = await fetch(`${REGISTRY_BASE}/mhtrwo-ax-met-ak-${year}.xlsx`)
  if (!fileRes.ok) return NextResponse.json({ error: `Registry file for ${year} not available (${fileRes.status})` }, { status: 502 })

  const buf = await fileRes.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, range: 1 }) as RawRegistryRow[]

  const parsed = parseRegistryRows(rows, year)

  let imported = 0
  const errors: string[] = []
  const BATCH = 500
  for (let i = 0; i < parsed.length; i += BATCH) {
    // DO UPDATE errors if two rows in the same batch collide on the conflict
    // key (happens with identical-unit sales, e.g. same building/price/sqm on
    // the same day) — ignoreDuplicates avoids that; re-running after a
    // mapping-table change won't refresh existing rows' `area`, but that's a
    // rare, deliberate correction better done as a one-off backfill than a
    // routine reimport risk.
    const { error } = await sb.from('market_transactions')
      .upsert(parsed.slice(i, i + BATCH), { onConflict: 'municipality,district_raw,contract_date,price,sqm_main', ignoreDuplicates: true })
    if (error) { if (errors.length < 3) errors.push(error.message) }
    else imported += Math.min(BATCH, parsed.length - i)
  }

  const mapped = parsed.filter(p => p.area).length
  return NextResponse.json({
    ok: errors.length === 0, year, total_rows: rows.length, attica_residential_rows: parsed.length,
    imported, mapped_to_known_area: mapped, unmapped: parsed.length - mapped, errors,
  })
}
