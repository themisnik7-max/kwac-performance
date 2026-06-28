'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient }                      from '@supabase/supabase-js'
import { VoiceMemoButton }                   from '@/components/VoiceMemoButton'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type ScoutedRow = {
  id: string
  owner_name: string | null
  owner_phone: string | null
  owner_email: string | null
  area: string | null
  address: string | null
  transaction_type: string | null
  asking_price: number | null
  size_sqm: number | null
  floor: number | null
  rooms: number | null
  condition: string | null
  year_built: number | null
  year_renovated: number | null
  balcony: boolean | null
  parking: boolean | null
  security_door: boolean | null
  seller_motivation: string | null
  ai_summary: string | null
  status: string
  updated_at: string
  voice_note_ids: string[]
}

type DemandRow = {
  id: string
  client_name: string | null
  client_phone: string | null
  client_email: string | null
  transaction_type: string | null
  property_type: string | null
  budget_eur: number | null
  size_min: number | null
  size_max: number | null
  floor_min: number | null
  floor_max: number | null
  areas_preferred: string[]
  must_have: string[]
  nice_to_have: string[]
  condition_req: string | null
  ai_summary: string | null
  status: string
  updated_at: string
  voice_note_ids: string[]
}

const RED   = '#CC2229'
const CARD  = { background: '#161616', border: '1px solid #1e1e1e', borderRadius: 8, padding: '14px 16px', marginBottom: 10 }
const LABEL = { fontSize: 10, color: '#555', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: 2, margin: 0 }
const VAL   = { fontSize: 13, color: '#d0d0d0', margin: 0 }
const BADGE: Record<string, { bg: string; color: string }> = {
  scouted:           { bg: '#1e293b', color: '#94a3b8' },
  contacted:         { bg: '#1c2e1c', color: '#86efac' },
  listing_requested: { bg: '#2d1b00', color: '#fbbf24' },
  listed:            { bg: '#1a1a2e', color: '#818cf8' },
  lost:              { bg: '#2d0a0a', color: '#f87171' },
  active:            { bg: '#1c2e1c', color: '#86efac' },
  matched:           { bg: '#1a1a2e', color: '#818cf8' },
  closed:            { bg: '#1e293b', color: '#94a3b8' },
  inactive:          { bg: '#1e1e1e', color: '#555' },
}

function StatusBadge({ s }: { s: string }) {
  const style = BADGE[s] ?? { bg: '#1e1e1e', color: '#888' }
  return (
    <span style={{ background: style.bg, color: style.color, borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>
      {s}
    </span>
  )
}

function fmt(n: number | null | undefined, unit = '') {
  if (n == null) return '—'
  return n.toLocaleString('el-GR') + (unit ? ' ' + unit : '')
}

// ── Inline edit helpers ──────────────────────────────────────────

type EditState = Record<string, string | number | boolean | null>

function toEditState(row: Record<string, unknown>): EditState {
  const state: EditState = {}
  for (const [k, v] of Object.entries(row)) {
    if (Array.isArray(v)) state[k] = (v as string[]).join(', ')
    else state[k] = v as string | number | boolean | null
  }
  return state
}

function fromEditState(state: EditState, original: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(state)) {
    if (v === null || v === '') { out[k] = null; continue }
    const orig = original[k as keyof typeof original]
    if (Array.isArray(orig)) {
      out[k] = String(v).split(',').map((s: string) => s.trim()).filter(Boolean)
    } else if (typeof orig === 'number') {
      out[k] = Number(v)
    } else if (typeof orig === 'boolean') {
      out[k] = v === 'true' || v === true
    } else {
      out[k] = v
    }
  }
  return out
}

function EditField({ label, k, type, state, onChange }: {
  label: string; k: string; type: 'text' | 'number' | 'checkbox'
  state: EditState; onChange: (k: string, v: string | boolean) => void
}) {
  const val = state[k]
  return (
    <div>
      <p style={LABEL}>{label}</p>
      {type === 'checkbox' ? (
        <label style={{ display: 'flex', gap: 5, alignItems: 'center', cursor: 'pointer' }}>
          <input type="checkbox" checked={!!val} onChange={e => onChange(k, e.target.checked)}
            style={{ accentColor: RED, width: 13, height: 13 }} />
          <span style={{ fontSize: 12, color: '#888' }}>{val ? 'Ναι' : 'Όχι'}</span>
        </label>
      ) : (
        <input
          type={type === 'number' ? 'number' : 'text'}
          value={val == null ? '' : String(val)}
          onChange={e => onChange(k, e.target.value)}
          style={{ width: '100%', boxSizing: 'border-box', background: '#0d0d0d', border: '1px solid #2a2a2a', borderRadius: 4, color: '#e0e0e0', fontSize: 13, padding: '4px 7px', outline: 'none' }}
        />
      )}
    </div>
  )
}

// ── Scouted card ─────────────────────────────────────────────────

function ScoutedCard({ row, onSaved }: { row: ScoutedRow; onSaved: () => void }) {
  const [editing, setEditing] = useState(false)
  const [state,   setState]   = useState<EditState>({})
  const [saving,  setSaving]  = useState(false)
  const [err,     setErr]     = useState<string | null>(null)

  function startEdit() { setState(toEditState(row as unknown as Record<string, unknown>)); setEditing(true); setErr(null) }
  function cancel()    { setEditing(false) }

  async function save() {
    setSaving(true); setErr(null)
    const payload = fromEditState(state, row as unknown as Record<string, unknown>)
    delete payload.id; delete payload.updated_at; delete payload.voice_note_ids
    const { error } = await supabase.from('property_scouted').update(payload).eq('id', row.id)
    setSaving(false)
    if (error) { setErr(error.message); return }
    setEditing(false)
    onSaved()
  }

  if (editing) {
    return (
      <div style={{ ...CARD, border: `1px solid ${RED}33` }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '8px 12px', marginBottom: 12 }}>
          <EditField label="Ιδιοκτήτης"        k="owner_name"        type="text"     state={state} onChange={(k,v) => setState(p => ({...p,[k]:v}))} />
          <EditField label="Τηλέφωνο"          k="owner_phone"       type="text"     state={state} onChange={(k,v) => setState(p => ({...p,[k]:v}))} />
          <EditField label="Διεύθυνση"         k="address"           type="text"     state={state} onChange={(k,v) => setState(p => ({...p,[k]:v}))} />
          <EditField label="Περιοχή"           k="area"              type="text"     state={state} onChange={(k,v) => setState(p => ({...p,[k]:v}))} />
          <EditField label="Τιμή (€)"          k="asking_price"      type="number"   state={state} onChange={(k,v) => setState(p => ({...p,[k]:v}))} />
          <EditField label="τμ"                k="size_sqm"          type="number"   state={state} onChange={(k,v) => setState(p => ({...p,[k]:v}))} />
          <EditField label="Όροφος"            k="floor"             type="number"   state={state} onChange={(k,v) => setState(p => ({...p,[k]:v}))} />
          <EditField label="Υ/Δ"              k="rooms"             type="number"   state={state} onChange={(k,v) => setState(p => ({...p,[k]:v}))} />
          <EditField label="Έτος κατ."        k="year_built"        type="number"   state={state} onChange={(k,v) => setState(p => ({...p,[k]:v}))} />
          <EditField label="Έτος ανακ."       k="year_renovated"    type="number"   state={state} onChange={(k,v) => setState(p => ({...p,[k]:v}))} />
          <EditField label="Κατάσταση"         k="condition"         type="text"     state={state} onChange={(k,v) => setState(p => ({...p,[k]:v}))} />
          <EditField label="Μπαλκόνι"         k="balcony"           type="checkbox" state={state} onChange={(k,v) => setState(p => ({...p,[k]:v}))} />
          <EditField label="Πάρκινγκ"         k="parking"           type="checkbox" state={state} onChange={(k,v) => setState(p => ({...p,[k]:v}))} />
          <EditField label="Ασφ. Πόρτα"       k="security_door"     type="checkbox" state={state} onChange={(k,v) => setState(p => ({...p,[k]:v}))} />
          <div style={{ gridColumn: '1 / -1' }}>
            <EditField label="Κίνητρο"         k="seller_motivation" type="text"     state={state} onChange={(k,v) => setState(p => ({...p,[k]:v}))} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <EditField label="Σύνοψη"          k="ai_summary"        type="text"     state={state} onChange={(k,v) => setState(p => ({...p,[k]:v}))} />
          </div>
        </div>
        {err && <p style={{ fontSize: 12, color: '#f87171', margin: '0 0 8px' }}>{err}</p>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={save} disabled={saving} style={{ padding: '7px 14px', background: RED, color: '#fff', border: 'none', borderRadius: 5, fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Αποθήκευση…' : 'Αποθήκευση'}
          </button>
          <button onClick={cancel} disabled={saving} style={{ padding: '7px 12px', background: '#1e1e1e', color: '#888', border: '1px solid #2a2a2a', borderRadius: 5, fontSize: 13, cursor: 'pointer' }}>Ακύρωση</button>
        </div>
      </div>
    )
  }

  return (
    <div key={row.id} style={CARD}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
        <div>
          <span style={{ fontSize: 15, fontWeight: 600, color: '#f0f0f0' }}>{row.owner_name ?? 'Άγνωστος Ιδιοκτήτης'}</span>
          {row.owner_phone && <span style={{ fontSize: 12, color: '#555', marginLeft: 10 }}>{row.owner_phone}</span>}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <StatusBadge s={row.status} />
          <button onClick={startEdit} style={{ padding: '3px 10px', fontSize: 11, background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: 4, color: '#888', cursor: 'pointer' }}>✏ Επεξ.</button>
        </div>
      </div>
      {row.ai_summary && <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 10px', fontStyle: 'italic' }}>{row.ai_summary}</p>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '8px 16px' }}>
        <div><p style={LABEL}>Περιοχή</p><p style={VAL}>{row.area ?? '—'}</p></div>
        <div><p style={LABEL}>Διεύθυνση</p><p style={VAL}>{row.address ?? '—'}</p></div>
        <div><p style={LABEL}>Τύπος</p><p style={VAL}>{row.transaction_type === 'sale' ? 'Πώληση' : row.transaction_type === 'rent' ? 'Ενοίκιο' : '—'}</p></div>
        <div><p style={LABEL}>Τιμή</p><p style={VAL}>{fmt(row.asking_price, '€')}</p></div>
        <div><p style={LABEL}>τμ</p><p style={VAL}>{fmt(row.size_sqm, 'τμ')}</p></div>
        <div><p style={LABEL}>Όροφος</p><p style={VAL}>{row.floor === 0 ? 'Ισόγειο' : fmt(row.floor, 'ος')}</p></div>
        <div><p style={LABEL}>Υ/Δ</p><p style={VAL}>{fmt(row.rooms)}</p></div>
        <div><p style={LABEL}>Έτος κατ.</p><p style={VAL}>{fmt(row.year_built)}</p></div>
        <div><p style={LABEL}>Μπαλκόνι</p><p style={VAL}>{row.balcony == null ? '—' : row.balcony ? 'Ναι' : 'Όχι'}</p></div>
        <div><p style={LABEL}>Πάρκινγκ</p><p style={VAL}>{row.parking == null ? '—' : row.parking ? 'Ναι' : 'Όχι'}</p></div>
        <div><p style={LABEL}>Κατάσταση</p><p style={VAL}>{row.condition ?? '—'}</p></div>
        <div><p style={LABEL}>Σημειώσεις</p><p style={VAL}>{row.voice_note_ids.length} φωνητικά</p></div>
      </div>
      <p style={{ fontSize: 10, color: '#333', marginTop: 10, marginBottom: 0 }}>Τελ. ενημ. {new Date(row.updated_at).toLocaleDateString('el-GR')}</p>
    </div>
  )
}

// ── Demand card ──────────────────────────────────────────────────

function DemandCard({ row, onSaved }: { row: DemandRow; onSaved: () => void }) {
  const [editing, setEditing] = useState(false)
  const [state,   setState]   = useState<EditState>({})
  const [saving,  setSaving]  = useState(false)
  const [err,     setErr]     = useState<string | null>(null)

  function startEdit() { setState(toEditState(row as unknown as Record<string, unknown>)); setEditing(true); setErr(null) }
  function cancel()    { setEditing(false) }

  async function save() {
    setSaving(true); setErr(null)
    const payload = fromEditState(state, row as unknown as Record<string, unknown>)
    delete payload.id; delete payload.updated_at; delete payload.voice_note_ids
    const { error } = await supabase.from('demand_profiles').update(payload).eq('id', row.id)
    setSaving(false)
    if (error) { setErr(error.message); return }
    setEditing(false)
    onSaved()
  }

  if (editing) {
    return (
      <div style={{ ...CARD, border: `1px solid ${RED}33` }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '8px 12px', marginBottom: 12 }}>
          <EditField label="Πελάτης"     k="client_name"     type="text"   state={state} onChange={(k,v) => setState(p => ({...p,[k]:v}))} />
          <EditField label="Τηλέφωνο"   k="client_phone"    type="text"   state={state} onChange={(k,v) => setState(p => ({...p,[k]:v}))} />
          <EditField label="Budget (€)"  k="budget_eur"      type="number" state={state} onChange={(k,v) => setState(p => ({...p,[k]:v}))} />
          <EditField label="Ακίνητο"    k="property_type"   type="text"   state={state} onChange={(k,v) => setState(p => ({...p,[k]:v}))} />
          <EditField label="τμ από"     k="size_min"        type="number" state={state} onChange={(k,v) => setState(p => ({...p,[k]:v}))} />
          <EditField label="τμ έως"     k="size_max"        type="number" state={state} onChange={(k,v) => setState(p => ({...p,[k]:v}))} />
          <EditField label="Όροφ. από"  k="floor_min"       type="number" state={state} onChange={(k,v) => setState(p => ({...p,[k]:v}))} />
          <EditField label="Όροφ. έως"  k="floor_max"       type="number" state={state} onChange={(k,v) => setState(p => ({...p,[k]:v}))} />
          <EditField label="Κατάσταση"  k="condition_req"   type="text"   state={state} onChange={(k,v) => setState(p => ({...p,[k]:v}))} />
          <div style={{ gridColumn: '1 / -1' }}>
            <EditField label="Περιοχές (comma-separated)" k="areas_preferred" type="text" state={state} onChange={(k,v) => setState(p => ({...p,[k]:v}))} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <EditField label="Must-have (comma-separated)" k="must_have"  type="text"   state={state} onChange={(k,v) => setState(p => ({...p,[k]:v}))} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <EditField label="Σύνοψη"   k="ai_summary"      type="text"   state={state} onChange={(k,v) => setState(p => ({...p,[k]:v}))} />
          </div>
        </div>
        {err && <p style={{ fontSize: 12, color: '#f87171', margin: '0 0 8px' }}>{err}</p>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={save} disabled={saving} style={{ padding: '7px 14px', background: RED, color: '#fff', border: 'none', borderRadius: 5, fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Αποθήκευση…' : 'Αποθήκευση'}
          </button>
          <button onClick={cancel} disabled={saving} style={{ padding: '7px 12px', background: '#1e1e1e', color: '#888', border: '1px solid #2a2a2a', borderRadius: 5, fontSize: 13, cursor: 'pointer' }}>Ακύρωση</button>
        </div>
      </div>
    )
  }

  return (
    <div style={CARD}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
        <div>
          <span style={{ fontSize: 15, fontWeight: 600, color: '#f0f0f0' }}>{row.client_name ?? 'Άγνωστος Πελάτης'}</span>
          {row.client_phone && <span style={{ fontSize: 12, color: '#555', marginLeft: 10 }}>{row.client_phone}</span>}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <StatusBadge s={row.status} />
          <button onClick={startEdit} style={{ padding: '3px 10px', fontSize: 11, background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: 4, color: '#888', cursor: 'pointer' }}>✏ Επεξ.</button>
        </div>
      </div>
      {row.ai_summary && <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 10px', fontStyle: 'italic' }}>{row.ai_summary}</p>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '8px 16px' }}>
        <div><p style={LABEL}>Τύπος</p><p style={VAL}>{row.transaction_type === 'buy' ? 'Αγορά' : row.transaction_type === 'rent' ? 'Ενοίκιο' : '—'}</p></div>
        <div><p style={LABEL}>Ακίνητο</p><p style={VAL}>{row.property_type ?? '—'}</p></div>
        <div><p style={LABEL}>Budget</p><p style={VAL}>{fmt(row.budget_eur, '€')}</p></div>
        <div><p style={LABEL}>Εμβαδόν</p><p style={VAL}>{row.size_min || row.size_max ? `${row.size_min ?? '?'}–${row.size_max ?? '?'} τμ` : '—'}</p></div>
        <div><p style={LABEL}>Περιοχές</p><p style={VAL}>{row.areas_preferred.length ? row.areas_preferred.join(', ') : '—'}</p></div>
        <div><p style={LABEL}>Must-have</p><p style={VAL}>{row.must_have.length ? row.must_have.join(', ') : '—'}</p></div>
        <div><p style={LABEL}>Σημειώσεις</p><p style={VAL}>{row.voice_note_ids.length} φωνητικά</p></div>
      </div>
      <p style={{ fontSize: 10, color: '#333', marginTop: 10, marginBottom: 0 }}>Τελ. ενημ. {new Date(row.updated_at).toLocaleDateString('el-GR')}</p>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────

export default function PersonalAdminPage() {
  const [tab,     setTab]     = useState<'scouted' | 'demand'>('scouted')
  const [scouted, setScouted] = useState<ScoutedRow[]>([])
  const [demands, setDemands] = useState<DemandRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: s }, { data: d }] = await Promise.all([
      supabase
        .from('property_scouted')
        .select('id,owner_name,owner_phone,owner_email,area,address,transaction_type,asking_price,size_sqm,floor,rooms,condition,year_built,year_renovated,balcony,parking,security_door,seller_motivation,ai_summary,status,updated_at,voice_note_ids')
        .order('updated_at', { ascending: false })
        .limit(50),
      supabase
        .from('demand_profiles')
        .select('id,client_name,client_phone,client_email,transaction_type,property_type,budget_eur,size_min,size_max,floor_min,floor_max,areas_preferred,must_have,nice_to_have,condition_req,ai_summary,status,updated_at,voice_note_ids')
        .order('updated_at', { ascending: false })
        .limit(50),
    ])
    setScouted((s ?? []) as ScoutedRow[])
    setDemands((d ?? []) as DemandRow[])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#f0f0f0', padding: '32px 24px' }}>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>Personal Admin</h1>
          <p style={{ fontSize: 13, color: '#555', marginTop: 4 }}>Καταγραφή ακινήτων & ζητήσεων μέσω φωνής</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, color: '#444' }}>Νέα εγγραφή:</span>
          <VoiceMemoButton onSuccess={() => load()} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid #1e1e1e' }}>
        {(['scouted', 'demand'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '8px 16px', fontSize: 13, background: 'none', border: 'none',
              color: tab === t ? '#f0f0f0' : '#555', cursor: 'pointer', fontWeight: tab === t ? 600 : 400,
              borderBottom: tab === t ? `2px solid ${RED}` : '2px solid transparent', marginBottom: -1,
            }}
          >
            {t === 'scouted' ? `Ακίνητα (${scouted.length})` : `Ζητήσεις (${demands.length})`}
          </button>
        ))}
      </div>

      {loading && <p style={{ color: '#444', fontSize: 13 }}>Φόρτωση…</p>}

      {!loading && tab === 'scouted' && (
        <>
          {scouted.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#444' }}>
              <p style={{ fontSize: 32, margin: 0 }}>🎙</p>
              <p style={{ fontSize: 14, marginTop: 12 }}>Καμία καταγραφή ακόμα.</p>
              <p style={{ fontSize: 12, color: '#333' }}>Πάτα το μικρόφωνο και μίλησε για το πρώτο ακίνητο που επισκέφτηκες.</p>
            </div>
          )}
          {scouted.map(row => <ScoutedCard key={row.id} row={row} onSaved={load} />)}
        </>
      )}

      {!loading && tab === 'demand' && (
        <>
          {demands.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#444' }}>
              <p style={{ fontSize: 32, margin: 0 }}>🎙</p>
              <p style={{ fontSize: 14, marginTop: 12 }}>Καμία ζήτηση ακόμα.</p>
              <p style={{ fontSize: 12, color: '#333' }}>Πάτα το μικρόφωνο και περιέγραψε τι ζητάει ο πελάτης σου.</p>
            </div>
          )}
          {demands.map(row => <DemandCard key={row.id} row={row} onSaved={load} />)}
        </>
      )}
    </div>
  )
}
