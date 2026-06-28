'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient }                      from '@supabase/supabase-js'
import { VoiceMemoButton }                   from '@/components/VoiceMemoButton'
import { PropertyPhotoUpload }               from '@/components/PropertyPhotoUpload'
import { PropertyDocUpload }                from '@/components/PropertyDocUpload'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ── Types ─────────────────────────────────────────────────────────

type PropertyRow = {
  id: string
  ilist_id: string | null
  title: string | null
  owner_name: string | null
  owner_phone: string | null
  owner_email: string | null
  transaction_type: string | null
  address: string | null
  area: string | null
  floor: number | null
  sqm: number | null
  rooms: number | null
  condition: string | null
  year_built: number | null
  year_renovated: number | null
  balcony: boolean | null
  parking: boolean | null
  security_door: boolean | null
  asking_price: number | null
  seller_motivation: string | null
  ai_summary: string | null
  status: string
  voice_note_ids: string[]
  updated_at: string
  created_at: string
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

// ── Styling constants ─────────────────────────────────────────────

const RED   = '#CC2229'
const CARD  = { background: '#161616', border: '1px solid #1e1e1e', borderRadius: 8, padding: '14px 16px', marginBottom: 10 }
const LABEL = { fontSize: 10, color: '#555', textTransform: 'uppercase' as const, letterSpacing: '0.05em', margin: 0 }
const VAL   = { fontSize: 13, color: '#d0d0d0', margin: 0 }

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  pending:           { bg: '#1e293b', color: '#94a3b8' },
  for_appraisal:     { bg: '#2d1b00', color: '#fbbf24' },
  estimated:         { bg: '#1a1a2e', color: '#818cf8' },
  completed:         { bg: '#1c2e1c', color: '#86efac' },
  active:            { bg: '#1c2e1c', color: '#86efac' },
  matched:           { bg: '#1a1a2e', color: '#818cf8' },
  closed:            { bg: '#1e293b', color: '#94a3b8' },
  inactive:          { bg: '#1e1e1e', color: '#555' },
}

function StatusBadge({ s }: { s: string }) {
  const style = STATUS_COLORS[s] ?? { bg: '#1e1e1e', color: '#888' }
  return <span style={{ background: style.bg, color: style.color, borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>{s}</span>
}

function fmt(n: number | null | undefined, unit = '') {
  if (n == null) return '—'
  return n.toLocaleString('el-GR') + (unit ? ' ' + unit : '')
}

// ── Inline edit helpers ───────────────────────────────────────────

type EditState = Record<string, unknown>

function toEditState(row: Record<string, unknown>): EditState {
  const s: EditState = {}
  for (const [k, v] of Object.entries(row))
    s[k] = Array.isArray(v) ? (v as string[]).join(', ') : v
  return s
}

function fromEditState(state: EditState, original: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(state)) {
    if (v === null || v === '') { out[k] = null; continue }
    const orig = original[k]
    if (Array.isArray(orig)) out[k] = String(v).split(',').map(s => s.trim()).filter(Boolean)
    else if (typeof orig === 'number') out[k] = Number(v)
    else if (typeof orig === 'boolean') out[k] = v === 'true' || v === true
    else out[k] = v
  }
  return out
}

function EditInput({ label, k, type, state, onChange }: {
  label: string; k: string; type: 'text' | 'number' | 'checkbox'
  state: EditState; onChange: (k: string, v: unknown) => void
}) {
  const val = state[k]
  return (
    <div>
      <p style={LABEL}>{label}</p>
      {type === 'checkbox' ? (
        <label style={{ display: 'flex', gap: 5, alignItems: 'center', cursor: 'pointer' }}>
          <input type="checkbox" checked={!!val} onChange={e => onChange(k, e.target.checked)} style={{ accentColor: RED, width: 13, height: 13 }} />
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

// ── Property card ─────────────────────────────────────────────────

function PropertyCard({ row, onSaved }: { row: PropertyRow; onSaved: () => void }) {
  const [editing,      setEditing]      = useState(false)
  const [showPhotos,   setShowPhotos]   = useState(false)
  const [showDocs,     setShowDocs]     = useState(false)
  const [state,        setState]        = useState<EditState>({})
  const [saving,       setSaving]       = useState(false)
  const [err,          setErr]          = useState<string | null>(null)

  function startEdit() { setState(toEditState(row as unknown as Record<string, unknown>)); setEditing(true); setErr(null) }
  function cancel()    { setEditing(false) }

  async function save() {
    setSaving(true); setErr(null)
    const payload = fromEditState(state, row as unknown as Record<string, unknown>)
    delete payload.id; delete payload.updated_at; delete payload.created_at; delete payload.voice_note_ids
    const { error } = await supabase.from('meeting_properties').update(payload).eq('id', row.id)
    setSaving(false)
    if (error) { setErr(error.message); return }
    setEditing(false)
    onSaved()
  }

  const header = (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
      <div>
        <span style={{ fontSize: 15, fontWeight: 600, color: '#f0f0f0' }}>
          {row.owner_name ?? row.title ?? 'Ακίνητο'}
        </span>
        {row.owner_phone && <span style={{ fontSize: 12, color: '#555', marginLeft: 10 }}>{row.owner_phone}</span>}
        {row.ilist_id && <span style={{ fontSize: 10, color: '#333', marginLeft: 10 }}>{row.ilist_id}</span>}
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <StatusBadge s={row.status} />
        <button onClick={() => setShowPhotos(p => !p)} style={{ padding: '3px 9px', fontSize: 11, background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: 4, color: '#888', cursor: 'pointer' }}>
          📷 {showPhotos ? 'Κλείσιμο' : 'Φωτ.'}
        </button>
        <button onClick={() => setShowDocs(p => !p)} style={{ padding: '3px 9px', fontSize: 11, background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: 4, color: '#888', cursor: 'pointer' }}>
          📁 {showDocs ? 'Κλείσιμο' : 'Φάκελος'}
        </button>
        {!editing && <button onClick={startEdit} style={{ padding: '3px 9px', fontSize: 11, background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: 4, color: '#888', cursor: 'pointer' }}>✏ Επεξ.</button>}
      </div>
    </div>
  )

  if (editing) {
    return (
      <div style={{ ...CARD, border: `1px solid ${RED}33` }}>
        {header}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '8px 12px', marginBottom: 12 }}>
          <EditInput label="Ιδιοκτήτης"       k="owner_name"        type="text"     state={state} onChange={(k,v)=>setState(p=>({...p,[k]:v}))} />
          <EditInput label="Τηλέφωνο"         k="owner_phone"       type="text"     state={state} onChange={(k,v)=>setState(p=>({...p,[k]:v}))} />
          <EditInput label="Διεύθυνση"        k="address"           type="text"     state={state} onChange={(k,v)=>setState(p=>({...p,[k]:v}))} />
          <EditInput label="Περιοχή"          k="area"              type="text"     state={state} onChange={(k,v)=>setState(p=>({...p,[k]:v}))} />
          <EditInput label="Τιμή (€)"         k="asking_price"      type="number"   state={state} onChange={(k,v)=>setState(p=>({...p,[k]:v}))} />
          <EditInput label="τμ"               k="sqm"               type="number"   state={state} onChange={(k,v)=>setState(p=>({...p,[k]:v}))} />
          <EditInput label="Όροφος"           k="floor"             type="number"   state={state} onChange={(k,v)=>setState(p=>({...p,[k]:v}))} />
          <EditInput label="Υ/Δ"             k="rooms"             type="number"   state={state} onChange={(k,v)=>setState(p=>({...p,[k]:v}))} />
          <EditInput label="Έτος κατ."       k="year_built"        type="number"   state={state} onChange={(k,v)=>setState(p=>({...p,[k]:v}))} />
          <EditInput label="Έτος ανακ."      k="year_renovated"    type="number"   state={state} onChange={(k,v)=>setState(p=>({...p,[k]:v}))} />
          <EditInput label="Κατάσταση"        k="condition"         type="text"     state={state} onChange={(k,v)=>setState(p=>({...p,[k]:v}))} />
          <EditInput label="Μπαλκόνι"        k="balcony"           type="checkbox" state={state} onChange={(k,v)=>setState(p=>({...p,[k]:v}))} />
          <EditInput label="Πάρκινγκ"        k="parking"           type="checkbox" state={state} onChange={(k,v)=>setState(p=>({...p,[k]:v}))} />
          <EditInput label="Ασφ. Πόρτα"      k="security_door"     type="checkbox" state={state} onChange={(k,v)=>setState(p=>({...p,[k]:v}))} />
          <div style={{ gridColumn: '1 / -1' }}>
            <EditInput label="Κίνητρο πωλητή" k="seller_motivation" type="text"    state={state} onChange={(k,v)=>setState(p=>({...p,[k]:v}))} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <EditInput label="Σύνοψη"          k="ai_summary"        type="text"    state={state} onChange={(k,v)=>setState(p=>({...p,[k]:v}))} />
          </div>
        </div>
        {err && <p style={{ fontSize: 12, color: '#f87171', margin: '0 0 8px' }}>{err}</p>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={save} disabled={saving} style={{ padding: '7px 14px', background: RED, color: '#fff', border: 'none', borderRadius: 5, fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Αποθήκευση…' : 'Αποθήκευση'}
          </button>
          <button onClick={cancel} disabled={saving} style={{ padding: '7px 12px', background: '#1e1e1e', color: '#888', border: '1px solid #2a2a2a', borderRadius: 5, fontSize: 13, cursor: 'pointer' }}>Ακύρωση</button>
        </div>
        {showPhotos && <PropertyPhotoUpload propertyId={row.id} />}
        {showDocs   && <PropertyDocUpload   propertyId={row.id} />}
      </div>
    )
  }

  return (
    <div style={CARD}>
      {header}
      {row.ai_summary && <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 10px', fontStyle: 'italic' }}>{row.ai_summary}</p>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '6px 14px' }}>
        <div><p style={LABEL}>Περιοχή</p><p style={VAL}>{row.area ?? '—'}</p></div>
        <div><p style={LABEL}>Διεύθυνση</p><p style={VAL}>{row.address ?? '—'}</p></div>
        <div><p style={LABEL}>Τύπος</p><p style={VAL}>{row.transaction_type === 'sale' ? 'Πώληση' : row.transaction_type === 'rent' ? 'Ενοίκιο' : '—'}</p></div>
        <div><p style={LABEL}>Τιμή</p><p style={VAL}>{fmt(row.asking_price, '€')}</p></div>
        <div><p style={LABEL}>τμ</p><p style={VAL}>{fmt(row.sqm, 'τμ')}</p></div>
        <div><p style={LABEL}>Όροφος</p><p style={VAL}>{row.floor === 0 ? 'Ισόγειο' : fmt(row.floor, 'ος')}</p></div>
        <div><p style={LABEL}>Υ/Δ</p><p style={VAL}>{fmt(row.rooms)}</p></div>
        <div><p style={LABEL}>Έτος κατ.</p><p style={VAL}>{fmt(row.year_built)}</p></div>
        <div><p style={LABEL}>Μπαλκόνι</p><p style={VAL}>{row.balcony == null ? '—' : row.balcony ? 'Ναι' : 'Όχι'}</p></div>
        <div><p style={LABEL}>Πάρκινγκ</p><p style={VAL}>{row.parking == null ? '—' : row.parking ? 'Ναι' : 'Όχι'}</p></div>
        <div><p style={LABEL}>Κατάσταση</p><p style={VAL}>{row.condition ?? '—'}</p></div>
        <div><p style={LABEL}>Φωτ.</p><p style={VAL}>{(row.voice_note_ids ?? []).length} 🎙</p></div>
      </div>
      <p style={{ fontSize: 10, color: '#333', marginTop: 8, marginBottom: 0 }}>
        {new Date(row.created_at).toLocaleDateString('el-GR')}
      </p>
      {showPhotos && <PropertyPhotoUpload propertyId={row.id} />}
      {showDocs   && <PropertyDocUpload   propertyId={row.id} />}
    </div>
  )
}

// ── Demand card ───────────────────────────────────────────────────

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
          <EditInput label="Πελάτης"     k="client_name"     type="text"   state={state} onChange={(k,v)=>setState(p=>({...p,[k]:v}))} />
          <EditInput label="Τηλέφωνο"   k="client_phone"    type="text"   state={state} onChange={(k,v)=>setState(p=>({...p,[k]:v}))} />
          <EditInput label="Budget (€)"  k="budget_eur"      type="number" state={state} onChange={(k,v)=>setState(p=>({...p,[k]:v}))} />
          <EditInput label="Ακίνητο"    k="property_type"   type="text"   state={state} onChange={(k,v)=>setState(p=>({...p,[k]:v}))} />
          <EditInput label="τμ από"     k="size_min"        type="number" state={state} onChange={(k,v)=>setState(p=>({...p,[k]:v}))} />
          <EditInput label="τμ έως"     k="size_max"        type="number" state={state} onChange={(k,v)=>setState(p=>({...p,[k]:v}))} />
          <EditInput label="Κατάσταση"  k="condition_req"   type="text"   state={state} onChange={(k,v)=>setState(p=>({...p,[k]:v}))} />
          <div style={{ gridColumn: '1 / -1' }}>
            <EditInput label="Περιοχές" k="areas_preferred" type="text"   state={state} onChange={(k,v)=>setState(p=>({...p,[k]:v}))} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <EditInput label="Must-have" k="must_have"       type="text"   state={state} onChange={(k,v)=>setState(p=>({...p,[k]:v}))} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <EditInput label="Σύνοψη"   k="ai_summary"      type="text"   state={state} onChange={(k,v)=>setState(p=>({...p,[k]:v}))} />
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
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <StatusBadge s={row.status} />
          <button onClick={startEdit} style={{ padding: '3px 9px', fontSize: 11, background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: 4, color: '#888', cursor: 'pointer' }}>✏ Επεξ.</button>
        </div>
      </div>
      {row.ai_summary && <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 10px', fontStyle: 'italic' }}>{row.ai_summary}</p>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '6px 14px' }}>
        <div><p style={LABEL}>Τύπος</p><p style={VAL}>{row.transaction_type === 'buy' ? 'Αγορά' : row.transaction_type === 'rent' ? 'Ενοίκιο' : '—'}</p></div>
        <div><p style={LABEL}>Ακίνητο</p><p style={VAL}>{row.property_type ?? '—'}</p></div>
        <div><p style={LABEL}>Budget</p><p style={VAL}>{fmt(row.budget_eur, '€')}</p></div>
        <div><p style={LABEL}>Εμβαδόν</p><p style={VAL}>{row.size_min || row.size_max ? `${row.size_min ?? '?'}–${row.size_max ?? '?'} τμ` : '—'}</p></div>
        <div><p style={LABEL}>Περιοχές</p><p style={VAL}>{(row.areas_preferred ?? []).join(', ') || '—'}</p></div>
        <div><p style={LABEL}>Must-have</p><p style={VAL}>{(row.must_have ?? []).join(', ') || '—'}</p></div>
      </div>
      <p style={{ fontSize: 10, color: '#333', marginTop: 8, marginBottom: 0 }}>
        Τελ. ενημ. {new Date(row.updated_at).toLocaleDateString('el-GR')}
      </p>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────

export default function PersonalAdminPage() {
  const [tab,       setTab]       = useState<'properties' | 'demand'>('properties')
  const [properties,setProperties]= useState<PropertyRow[]>([])
  const [demands,   setDemands]   = useState<DemandRow[]>([])
  const [loading,   setLoading]   = useState(true)
  const [userId,    setUserId]    = useState<string | null>(null)

  // Get current user id on mount
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null)
    })
  }, [])

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    const [{ data: props }, { data: dems }] = await Promise.all([
      supabase
        .from('meeting_properties')
        .select('id,ilist_id,title,owner_name,owner_phone,owner_email,transaction_type,address,area,floor,sqm,rooms,condition,year_built,year_renovated,balcony,parking,security_door,asking_price,seller_motivation,ai_summary,status,voice_note_ids,created_at,updated_at')
        .eq('agent_id', userId)               // personal: only own records
        .order('created_at', { ascending: false })
        .limit(100),
      supabase
        .from('demand_profiles')
        .select('id,client_name,client_phone,client_email,transaction_type,property_type,budget_eur,size_min,size_max,floor_min,floor_max,areas_preferred,must_have,nice_to_have,condition_req,ai_summary,status,updated_at,voice_note_ids')
        .eq('agent_id', userId)
        .order('updated_at', { ascending: false })
        .limit(100),
    ])
    setProperties((props ?? []) as PropertyRow[])
    setDemands((dems ?? []) as DemandRow[])
    setLoading(false)
  }, [userId])

  useEffect(() => { load() }, [load])

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#f0f0f0', padding: '24px 16px', maxWidth: 680, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>Personal Admin</h1>
          <p style={{ fontSize: 12, color: '#444', marginTop: 4 }}>Καταγραφές μόνο για σένα</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: '#444' }}>Νέα εγγραφή:</span>
          <VoiceMemoButton onSuccess={() => load()} />
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid #1e1e1e' }}>
        {(['properties', 'demand'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '7px 14px', fontSize: 13, background: 'none', border: 'none',
              color: tab === t ? '#f0f0f0' : '#555', cursor: 'pointer', fontWeight: tab === t ? 600 : 400,
              borderBottom: tab === t ? `2px solid ${RED}` : '2px solid transparent', marginBottom: -1,
            }}
          >
            {t === 'properties' ? `Ακίνητα (${properties.length})` : `Ζητήσεις (${demands.length})`}
          </button>
        ))}
      </div>

      {loading && <p style={{ color: '#444', fontSize: 13 }}>Φόρτωση…</p>}

      {!loading && tab === 'properties' && (
        <>
          {properties.length === 0 && (
            <div style={{ textAlign: 'center', padding: '50px 0', color: '#444' }}>
              <p style={{ fontSize: 28 }}>🎙</p>
              <p style={{ fontSize: 14 }}>Καμία καταγραφή ακόμα.</p>
              <p style={{ fontSize: 12, color: '#333' }}>Πάτα το μικρόφωνο και μίλα για ένα ακίνητο.</p>
            </div>
          )}
          {properties.map(row => <PropertyCard key={row.id} row={row} onSaved={load} />)}
        </>
      )}

      {!loading && tab === 'demand' && (
        <>
          {demands.length === 0 && (
            <div style={{ textAlign: 'center', padding: '50px 0', color: '#444' }}>
              <p style={{ fontSize: 28 }}>🎙</p>
              <p style={{ fontSize: 14 }}>Καμία ζήτηση ακόμα.</p>
            </div>
          )}
          {demands.map(row => <DemandCard key={row.id} row={row} onSaved={load} />)}
        </>
      )}
    </div>
  )
}
