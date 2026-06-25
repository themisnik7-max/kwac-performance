// SLICE: replace handleExcelImport + addManual in app/meeting/page.tsx
// Changes vs original:
// 1. Pre-check for existing ilist_ids BEFORE upsert — never overwrites agent_id
// 2. Tracks already_registered / updated / new separately
// 3. Shows actionable warning toast for cross-agent duplicates
// 4. addManual checks area+sqm similarity to catch MAN-* duplicates

async function handleExcelImport(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0]
  if (!file) return
  setImporting(true)
  showToast('Εισαγωγή...')

  const text = await file.text()
  const lines = text.split('\n').filter(l => l.trim())
  const headers = lines[0].split('\t').map(h => h.trim().toLowerCase())

  type ParsedRow = { ilist_id: string; title: string; area: string; address: string; sqm: number | null; price: number | null; floor: string | null; year_built: number | null; ilist_url: string | null }

  const rows: ParsedRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split('\t')
    const row: Record<string, string> = {}
    headers.forEach((h, j) => { row[h] = (cols[j] || '').trim() })
    const ilist_id = row['κωδικος'] || row['code'] || row['id'] || row['κωδ'] || String(i)
    const title    = row['τιτλος'] || row['title'] || row['ακινητο'] || 'Ακίνητο ' + ilist_id
    const area     = row['περιοχη'] || row['area'] || ''
    const address  = row['διευθυνση'] || row['address'] || row['οδος'] || row['δ/νση'] || ''
    const sqm      = parseFloat(row['τμ'] || row['εμβαδο'] || row['sqm'] || '0') || null
    const price    = parseFloat((row['τιμη'] || row['price'] || '0').replace(/[^0-9.]/g, '')) || null
    const floor_val = row['οροφος'] || row['floor'] || null
    const year_built = parseInt(row['ετος'] || row['year'] || '0') || null
    const ilist_url = row['url'] || row['link'] || null
    if (!title && !area) continue
    rows.push({ ilist_id, title, area, address, sqm, price, floor: floor_val, year_built, ilist_url })
  }

  if (rows.length === 0) {
    setImporting(false)
    showToast('❌ Δεν βρέθηκαν έγκυρες γραμμές')
    if (fileRef.current) fileRef.current.value = ''
    return
  }

  const ilistIds = rows.map(r => r.ilist_id)
  const { data: existing } = await sb
    .from('meeting_properties')
    .select('ilist_id, agent_id, agents(full_name)')
    .in('ilist_id', ilistIds)

  const existingMap = new Map<string, { agent_id: string; agentName: string }>(
    (existing || []).map(e => [e.ilist_id, { agent_id: e.agent_id, agentName: (e as any).agents?.full_name || 'άλλος μεσίτης' }])
  )

  let imported = 0, updated = 0, skipped = 0
  const conflicts: string[] = []

  for (const r of rows) {
    const hit = existingMap.get(r.ilist_id)
    if (hit && hit.agent_id !== agent?.id) {
      skipped++
      conflicts.push(`#${r.ilist_id} → ${hit.agentName}`)
      continue
    }
    const payload = { ilist_id: r.ilist_id, title: r.title, area: r.area, address: r.address, sqm: r.sqm, asking_price: r.price, floor: r.floor, year_built: r.year_built, meeting_date: new Date().toISOString().split('T')[0], ilist_url: r.ilist_url, status: 'pending' }
    if (hit && hit.agent_id === agent?.id) {
      await sb.from('meeting_properties').update({ ...payload }).eq('ilist_id', r.ilist_id)
      updated++
    } else {
      await sb.from('meeting_properties').insert({ ...payload, agent_id: agent?.id || null, agency_id: agent?.agency_id || null, first_registered_by: agent?.id || null, created_at: new Date().toISOString() })
      imported++
    }
  }

  setImporting(false)
  const parts: string[] = []
  if (imported > 0) parts.push(`✅ ${imported} νέα ακίνητα`)
  if (updated  > 0) parts.push(`🔄 ${updated} ενημερώθηκαν`)
  if (skipped  > 0) parts.push(`⚠️ ${skipped} παραλείφθηκαν (ήδη καταχωρημένα από άλλο μεσίτη)`)
  showToast(parts.join(' · '))

  if (conflicts.length > 0) {
    setTimeout(() => {
      showToast(`⚠️ Σύγκρουση: ${conflicts.slice(0, 3).join(', ')}${conflicts.length > 3 ? ` +${conflicts.length - 3}` : ''}`)
    }, 3500)
  }

  if (fileRef.current) fileRef.current.value = ''
  fetchProps()
}

async function addManual() {
  const area  = prompt('Περιοχή ακινήτου (για έλεγχο διπλοκαταχώρησης):')?.trim()
  const sqmIn = prompt('Τ.μ. ακινήτου (προαιρετικά):')?.trim()
  const sqm   = sqmIn ? parseFloat(sqmIn) : null

  if (area) {
    let q = sb.from('meeting_properties').select('id, title, sqm, agent_id, agents(full_name)').eq('area', area).in('status', ['pending', 'for_appraisal', 'estimated']).limit(5)
    if (sqm) q = q.gte('sqm', sqm * 0.85).lte('sqm', sqm * 1.15)
    const { data: similar } = await q
    if (similar && similar.length > 0) {
      const names = similar.map(s => `"${s.title}" (${s.sqm}τμ) — ${(s as any).agents?.full_name || 'άγνωστος'}`).join('\n')
      const proceed = confirm(`⚠️ Βρέθηκαν ${similar.length} παρόμοια ακίνητα στην περιοχή ${area}:\n\n${names}\n\nΣυνέχεια;`)
      if (!proceed) return
    }
  }

  const { data } = await sb.from('meeting_properties').insert({
    ilist_id: 'MAN-' + Date.now(), title: 'Νέο Ακίνητο' + (area ? ` — ${area}` : ''),
    area: area || null, sqm: sqm || null, agent_id: agent?.id || null, agency_id: agent?.agency_id || null,
    first_registered_by: agent?.id || null, meeting_date: new Date().toISOString().split('T')[0],
    status: 'pending', created_at: new Date().toISOString(),
  }).select('*, agents(id, full_name, email)').single()

  if (data) { setProps(prev => [data, ...prev]); setSelected(data) }
}