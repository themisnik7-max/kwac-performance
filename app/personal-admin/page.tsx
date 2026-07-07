'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter }           from 'next/navigation'
import { createClient }        from '@supabase/supabase-js'
import { VoiceMemoButton }     from '@/components/VoiceMemoButton'
import { contactName }         from '@/lib/contacts'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ── Types ─────────────────────────────────────────────────────────

type OwnerContact = { id: string; full_name: string | null; first_name: string | null; last_name: string | null; phone: string | null; email: string | null }

type PropertyRow = {
  id: string; ilist_id: string | null; title: string | null
  owner_name: string | null; owner_phone: string | null; owner_email: string | null
  owner_contact_id: string | null; contacts: OwnerContact | null
  transaction_type: string | null; address: string | null; area: string | null
  floor: number | null; sqm: number | null; rooms: number | null
  condition: string | null; year_built: number | null; year_renovated: number | null
  balcony: boolean | null; parking: boolean | null; security_door: boolean | null
  asking_price: number | null; seller_motivation: string | null
  ai_summary: string | null; status: string
  voice_note_ids: string[]; created_at: string; updated_at: string | null
}

type DemandRow = {
  id: string; client_name: string | null; client_phone: string | null; client_email: string | null
  transaction_type: string | null; property_type: string | null; budget_eur: number | null
  size_min: number | null; size_max: number | null; floor_min: number | null; floor_max: number | null
  areas_preferred: string[]; must_have: string[]; nice_to_have: string[]
  condition_req: string | null; ai_summary: string | null; status: string
  updated_at: string; voice_note_ids: string[]
}

// ── Constants ─────────────────────────────────────────────────────

const RED = '#CC2229'

const PROP_STATUSES = [
  { v: 'pending',       l: 'Καταγραφή'     },
  { v: 'for_appraisal', l: 'Προς Εκτίμηση' },
  { v: 'estimated',     l: 'Εκτιμήθηκε'   },
  { v: 'completed',     l: 'Ανέθεσε'      },
  { v: 'inactive',      l: 'Ανενεργό'     },
]

const DEM_STATUSES = [
  { v: 'active',   l: 'Ενεργή'   },
  { v: 'matched',  l: 'Ταίριαξε' },
  { v: 'closed',   l: 'Έκλεισε'  },
  { v: 'inactive', l: 'Ανενεργή' },
]

const STATUS_COLORS: Record<string, [string, string]> = {
  pending:       ['#1e293b', '#94a3b8'],
  for_appraisal: ['#2d1b00', '#fbbf24'],
  estimated:     ['#1a1a2e', '#818cf8'],
  completed:     ['#1c2e1c', '#86efac'],
  active:        ['#1c2e1c', '#86efac'],
  matched:       ['#1a1a2e', '#818cf8'],
  closed:        ['#1e293b', '#94a3b8'],
  inactive:      ['#1e1e1e', '#555'],
}

const TTL_MAP: Record<string, string> = { sale: 'Πώληση', rent: 'Ενοίκιο', buy: 'Αγορά' }

function Badge({ s }: { s: string }) {
  const [bg, color] = STATUS_COLORS[s] ?? ['#1e1e1e', '#888']
  const label = [...PROP_STATUSES, ...DEM_STATUSES].find(x => x.v === s)?.l ?? s
  return <span style={{ background: bg, color, borderRadius: 4, padding: '2px 7px', fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>{label}</span>
}

function fmt(n: number | null | undefined, u = '') {
  return n == null ? '—' : n.toLocaleString('el-GR') + (u ? ' ' + u : '')
}

// ── Edit helpers ──────────────────────────────────────────────────

type ES = Record<string, unknown>

const ARRAY_KEYS = new Set(['areas_preferred', 'must_have', 'nice_to_have', 'voice_note_ids'])
const NUM_KEYS   = new Set(['sqm','floor','rooms','year_built','year_renovated','asking_price','budget_eur','size_min','size_max','floor_min','floor_max'])

function toES(row: ES): ES {
  const s: ES = {}
  for (const [k, v] of Object.entries(row))
    s[k] = Array.isArray(v) ? (v as string[]).join(', ') : v
  return s
}

function fromES(state: ES, orig: ES): ES {
  const out: ES = {}
  for (const [k, v] of Object.entries(state)) {
    if (v === null || v === '') { out[k] = null; continue }
    if (ARRAY_KEYS.has(k) || Array.isArray(orig[k])) {
      out[k] = String(v).split(',').map(s => s.trim()).filter(Boolean)
    } else if (NUM_KEYS.has(k) || typeof orig[k] === 'number') {
      out[k] = Number(v)
    } else if (typeof orig[k] === 'boolean') {
      out[k] = v === 'true' || v === true
    } else {
      out[k] = v
    }
  }
  return out
}

// ── Shared field input ────────────────────────────────────────────

const LBL: React.CSSProperties = { fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 2px' }
const VAL: React.CSSProperties = { fontSize: 12, color: '#d0d0d0', margin: 0 }

function FI({ label, k, type, state, set }: {
  label: string; k: string; type: 'text' | 'number' | 'checkbox'
  state: ES; set: (k: string, v: unknown) => void
}) {
  const val = state[k]
  return (
    <div>
      <p style={LBL}>{label}</p>
      {type === 'checkbox'
        ? <label style={{ display: 'flex', gap: 5, alignItems: 'center', cursor: 'pointer' }}>
            <input type="checkbox" checked={!!val} onChange={e => set(k, e.target.checked)} style={{ accentColor: RED }} />
            <span style={{ fontSize: 12, color: '#888' }}>{val ? 'Ναι' : 'Όχι'}</span>
          </label>
        : <input type={type === 'number' ? 'number' : 'text'} value={val == null ? '' : String(val)}
            onChange={e => set(k, e.target.value)} placeholder="—"
            style={{ width: '100%', boxSizing: 'border-box', background: '#0d0d0d', border: '1px solid #222', borderRadius: 4, color: '#e0e0e0', fontSize: 12, padding: '4px 7px', outline: 'none' }}
          />
      }
    </div>
  )
}

// ── Slot row (collapsed) ──────────────────────────────────────────

const SLOT: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
  background: '#111', border: '1px solid #1a1a1a', borderRadius: 6,
  marginBottom: 4, cursor: 'pointer', userSelect: 'none',
}

function btnS(bg: string, color: string): React.CSSProperties {
  return { padding: '4px 10px', fontSize: 11, background: bg, color, border: '1px solid #252525', borderRadius: 4, cursor: 'pointer' }
}

// ── New property quick-add form ────────────────────────────────────
// Existing properties are no longer edited inline here — browse them in the
// table below and click through to /properties/[id] for the full profile
// (edit, history, photos, docs). This form only covers fast manual capture.

const EMPTY_PROP: ES = {
  owner_name: '', owner_phone: '', owner_email: '', address: '', area: '',
  transaction_type: 'sale', asking_price: null, sqm: null, floor: null, rooms: null,
  year_built: null, year_renovated: null, condition: '', balcony: false, parking: false,
  security_door: false, seller_motivation: '', ai_summary: '',
}

function NewPropertyForm({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const [state,  setState]  = useState<ES>({ ...EMPTY_PROP })
  const [saving, setSaving] = useState(false)
  const [err,    setErr]    = useState<string | null>(null)

  const set = (k: string, v: unknown) => setState(p => ({ ...p, [k]: v }))

  async function save() {
    setSaving(true); setErr(null)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setErr('Δεν βρέθηκε session'); setSaving(false); return }

    const fields = fromES(state, EMPTY_PROP)
    const res = await fetch('/api/voice-ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ transcript: '(manual entry)', intent: 'property_scouted', fields }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setErr(data.error ?? 'Σφάλμα'); return }
    onSaved()
  }

  return (
    <div style={{ background: '#161616', border: '1px solid #1e1e1e', borderRadius: 8, padding: '12px 14px', marginBottom: 6 }}>
      <span style={{ fontSize: 14, fontWeight: 700, color: '#f0f0f0', display: 'block', marginBottom: 10 }}>Νέο Ακίνητο</span>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: '8px 12px', marginBottom: 12 }}>
        <FI label="Ιδιοκτήτης"      k="owner_name"        type="text"     state={state} set={set} />
        <FI label="Τηλέφωνο"        k="owner_phone"       type="text"     state={state} set={set} />
        <FI label="Email ιδιοκτήτη" k="owner_email"       type="text"     state={state} set={set} />
        <FI label="Τύπος"           k="transaction_type"  type="text"     state={state} set={set} />
        <FI label="Διεύθυνση"       k="address"           type="text"     state={state} set={set} />
        <FI label="Περιοχή"         k="area"              type="text"     state={state} set={set} />
        <FI label="Τιμή (€)"        k="asking_price"      type="number"   state={state} set={set} />
        <FI label="τμ"              k="sqm"               type="number"   state={state} set={set} />
        <FI label="Όροφος"          k="floor"             type="number"   state={state} set={set} />
        <FI label="Υ/Δ"            k="rooms"             type="number"   state={state} set={set} />
        <FI label="Έτος κατ."      k="year_built"        type="number"   state={state} set={set} />
        <FI label="Έτος ανακ."     k="year_renovated"    type="number"   state={state} set={set} />
        <FI label="Κατάσταση"       k="condition"         type="text"     state={state} set={set} />
        <FI label="Μπαλκόνι"       k="balcony"           type="checkbox" state={state} set={set} />
        <FI label="Πάρκινγκ"       k="parking"           type="checkbox" state={state} set={set} />
        <FI label="Ασφ. Πόρτα"     k="security_door"     type="checkbox" state={state} set={set} />
        <div style={{ gridColumn: '1/-1' }}><FI label="Κίνητρο πωλητή" k="seller_motivation" type="text" state={state} set={set} /></div>
        <div style={{ gridColumn: '1/-1' }}><FI label="Σύνοψη"         k="ai_summary"        type="text" state={state} set={set} /></div>
      </div>
      {err && <p style={{ fontSize: 12, color: '#f87171', margin: '0 0 8px' }}>{err}</p>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={save} disabled={saving}
          style={{ padding: '7px 16px', background: RED, color: '#fff', border: 'none', borderRadius: 5, fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Αποθήκευση…' : 'Αποθήκευση'}
        </button>
        <button onClick={onCancel} style={btnS('#1e1e1e', '#666')}>Ακύρωση</button>
      </div>
    </div>
  )
}

// ── Properties + owners table ────────────────────────────────────

function PropertiesTable({ rows }: { rows: PropertyRow[] }) {
  const router = useRouter()

  const th: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', fontSize: 10, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #1e1e1e' }
  const td: React.CSSProperties = { padding: '9px 10px', fontSize: 12.5, color: '#d0d0d0', borderBottom: '1px solid #161616', verticalAlign: 'top' }

  return (
    <div style={{ overflowX: 'auto', border: '1px solid #1a1a1a', borderRadius: 8 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={th}>Ακίνητο</th>
            <th style={th}>Ιδιοκτήτης</th>
            <th style={th}>Τύπος</th>
            <th style={th}>Τιμή</th>
            <th style={th}>Κατάσταση</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            const linkedOwner = row.contacts
            const ownerLabel = linkedOwner ? contactName(linkedOwner) : row.owner_name
            const ownerPhone = linkedOwner?.phone ?? row.owner_phone
            return (
              <tr key={row.id} style={{ cursor: 'default' }}>
                <td style={td}>
                  <span
                    onClick={() => router.push(`/properties/${row.id}`)}
                    style={{ cursor: 'pointer', color: '#f0f0f0', fontWeight: 600 }}
                    title="Άνοιγμα φακέλου ακινήτου"
                  >
                    {row.address || row.title || 'Ακίνητο'}
                  </span>
                  {row.area && <span style={{ color: '#555', marginLeft: 6 }}>· {row.area}</span>}
                  {row.sqm && <span style={{ color: '#555', marginLeft: 6 }}>· {row.sqm}τμ</span>}
                </td>
                <td style={td}>
                  {ownerLabel ? (
                    linkedOwner ? (
                      <span
                        onClick={() => router.push(`/contacts/${linkedOwner.id}`)}
                        style={{ cursor: 'pointer', color: '#93c5fd' }}
                        title="Άνοιγμα προφίλ ιδιοκτήτη"
                      >
                        {ownerLabel}
                      </span>
                    ) : (
                      <span title="Δεν έχει συνδεθεί ακόμα με καρτέλα επαφής">{ownerLabel}</span>
                    )
                  ) : <span style={{ color: '#333' }}>—</span>}
                  {ownerPhone && <div style={{ color: '#555', fontSize: 11 }}>{ownerPhone}</div>}
                </td>
                <td style={td}>{TTL_MAP[row.transaction_type ?? ''] ?? row.transaction_type ?? '—'}</td>
                <td style={td}>{row.asking_price ? fmt(row.asking_price, '€') : '—'}</td>
                <td style={td}><Badge s={row.status} /></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Demand card ───────────────────────────────────────────────────

const EMPTY_DEM: ES = {
  client_name: '', client_phone: '', client_email: '', transaction_type: 'buy',
  property_type: '', budget_eur: null, size_min: null, size_max: null,
  floor_min: null, floor_max: null,
  areas_preferred: [], must_have: [], nice_to_have: [],
  condition_req: '', ai_summary: '',
}

function DemandCard({ row, onSaved, onCancel, isNew }: {
  row: DemandRow | null; onSaved: () => void; onCancel?: () => void; isNew?: boolean
}) {
  const [open,        setOpen]        = useState(!!isNew)
  const [editMode,    setEditMode]    = useState(!!isNew)
  const [state,       setState]       = useState<ES>(row ? toES(row as unknown as ES) : { ...EMPTY_DEM })
  const [saving,      setSaving]      = useState(false)
  const [err,         setErr]         = useState<string | null>(null)
  const [matching,    setMatching]    = useState(false)
  const [matchResult, setMatchResult] = useState<string | null>(null)

  const set = (k: string, v: unknown) => setState(p => ({ ...p, [k]: v }))

  async function save() {
    setSaving(true); setErr(null)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setErr('Δεν βρέθηκε session'); setSaving(false); return }

    if (isNew) {
      const fields = fromES(state, EMPTY_DEM)
      const res = await fetch('/api/voice-ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ transcript: '(manual entry)', intent: 'demand_profile', fields }),
      })
      const data = await res.json()
      setSaving(false)
      if (!res.ok) { setErr(data.error ?? 'Σφάλμα'); return }
      onSaved()
    } else if (row) {
      const payload = fromES(state, row as unknown as ES)
      delete payload.id; delete payload.updated_at; delete payload.voice_note_ids
      const { error } = await supabase.from('demand_profiles').update(payload).eq('id', row.id)
      setSaving(false)
      if (error) { setErr(error.message); return }
      setEditMode(false); onSaved()
    }
  }

  async function setStatus(s: string) {
    if (!row) return
    await supabase.from('demand_profiles').update({ status: s }).eq('id', row.id)
    onSaved()
  }

  async function testMatch() {
    if (!row) return
    setMatching(true); setMatchResult(null)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setMatchResult('Δεν βρέθηκε session'); setMatching(false); return }
    try {
      const res  = await fetch('/api/demand-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ demand_id: row.id }),
      })
      const data = await res.json()
      if (!res.ok) { setMatchResult(`Σφάλμα: ${data.error}`); setMatching(false); return }
      setMatchResult(
        data.matched === 0
          ? 'Κανένα ταίριασμα με ενεργά ακίνητα.'
          : `✅ ${data.matched} ακίνητ${data.matched === 1 ? 'ο' : 'α'} ταίριαξαν` +
            (data.email_sent ? ` — email → ${row.client_email} ✉️` : row.client_email ? ' (έλεγξε BREVO_API_KEY)' : ' — λείπει email πελάτη')
      )
    } catch (e) { setMatchResult(`Σφάλμα: ${e}`) }
    setMatching(false)
  }

  if (!open && !isNew && row) {
    return (
      <div style={SLOT} onClick={() => setOpen(true)}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#e0e0e0', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {row.client_name ?? 'Ζήτηση'}
        </span>
        {(row.areas_preferred ?? [])[0] && <span style={{ fontSize: 11, color: '#555', flexShrink: 0 }}>{row.areas_preferred[0]}</span>}
        {row.budget_eur && <span style={{ fontSize: 11, color: '#888', flexShrink: 0 }}>{(row.budget_eur / 1000).toFixed(0)}κ€</span>}
        <Badge s={row.status} />
        <span style={{ color: '#333' }}>›</span>
      </div>
    )
  }

  const editFields = (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: '8px 12px', marginBottom: 12 }}>
      <FI label="Πελάτης"     k="client_name"      type="text"   state={state} set={set} />
      <FI label="Τηλέφωνο"   k="client_phone"     type="text"   state={state} set={set} />
      <FI label="Email"       k="client_email"     type="text"   state={state} set={set} />
      <FI label="Τύπος"      k="transaction_type" type="text"   state={state} set={set} />
      <FI label="Ακίνητο"   k="property_type"    type="text"   state={state} set={set} />
      <FI label="Budget (€)" k="budget_eur"       type="number" state={state} set={set} />
      <FI label="τμ από"    k="size_min"         type="number" state={state} set={set} />
      <FI label="τμ έως"    k="size_max"         type="number" state={state} set={set} />
      <FI label="Όρ. από"   k="floor_min"        type="number" state={state} set={set} />
      <FI label="Όρ. έως"   k="floor_max"        type="number" state={state} set={set} />
      <FI label="Κατάσταση" k="condition_req"    type="text"   state={state} set={set} />
      <div style={{ gridColumn: '1/-1' }}><FI label="Περιοχές (με κόμμα)"  k="areas_preferred" type="text" state={state} set={set} /></div>
      <div style={{ gridColumn: '1/-1' }}><FI label="Must-have (με κόμμα)" k="must_have"       type="text" state={state} set={set} /></div>
      <div style={{ gridColumn: '1/-1' }}><FI label="Σύνοψη"               k="ai_summary"      type="text" state={state} set={set} /></div>
    </div>
  )

  const staticView = row && (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(110px,1fr))', gap: '5px 12px', marginBottom: 8 }}>
      {([
        ['Τύπος',    TTL_MAP[row.transaction_type ?? ''] ?? row.transaction_type],
        ['Ακίνητο',  row.property_type],
        ['Budget',   row.budget_eur ? fmt(row.budget_eur, '€') : null],
        ['τμ',       (row.size_min || row.size_max) ? `${row.size_min ?? '?'}–${row.size_max ?? '?'}` : null],
        ['Περιοχές', (row.areas_preferred ?? []).join(', ') || null],
        ['Must-have',(row.must_have ?? []).join(', ') || null],
        ['Email',    row.client_email],
      ] as [string, string | null][]).filter(([, v]) => !!v).map(([l, v]) => (
        <div key={l}><p style={LBL}>{l}</p><p style={VAL}>{v}</p></div>
      ))}
    </div>
  )

  return (
    <div style={{ background: '#161616', border: '1px solid #1e1e1e', borderRadius: 8, padding: '12px 14px', marginBottom: 6 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#f0f0f0' }}>{row?.client_name ?? 'Νέα Ζήτηση'}</span>
          {row?.client_phone && <span style={{ fontSize: 11, color: '#555', marginLeft: 10 }}>{row.client_phone}</span>}
        </div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
          {row && <Badge s={row.status} />}
          {row && (
            <button onClick={testMatch} disabled={matching}
              style={{ padding: '4px 10px', fontSize: 11, background: '#1c2e1c', color: '#86efac', border: '1px solid #166534', borderRadius: 4, cursor: matching ? 'not-allowed' : 'pointer', opacity: matching ? 0.6 : 1 }}>
              {matching ? '⏳' : '📧 Match'}
            </button>
          )}
          {!isNew && <button onClick={() => { setEditMode(p => !p); setErr(null) }} style={btnS('#1e1e1e', '#666')}>{editMode ? 'Άκυρο' : '✏'}</button>}
          {!isNew && <button onClick={() => { setOpen(false); setEditMode(false) }} style={btnS('#0a0a0a', '#333')}>✕</button>}
        </div>
      </div>

      {/* Status chips */}
      {row && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
          {DEM_STATUSES.map(s => {
            const active = row.status === s.v
            const [bg, col] = STATUS_COLORS[s.v] ?? ['#1a1a1a', '#444']
            return (
              <button key={s.v} onClick={() => setStatus(s.v)}
                style={{ padding: '3px 8px', fontSize: 10, fontWeight: 600, borderRadius: 4, cursor: 'pointer', border: 'none',
                  background: active ? bg : '#1a1a1a', color: active ? col : '#444',
                  outline: active ? `1px solid ${col}44` : 'none' }}>
                {s.l}
              </button>
            )
          })}
        </div>
      )}

      {matchResult && (
        <p style={{ fontSize: 12, color: matchResult.startsWith('✅') ? '#86efac' : '#f87171', margin: '0 0 8px', padding: '6px 8px', background: '#0d0d0d', borderRadius: 4 }}>
          {matchResult}
        </p>
      )}

      {row?.ai_summary && !editMode && <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 8px', fontStyle: 'italic' }}>{row.ai_summary}</p>}

      {editMode ? editFields : staticView}

      {editMode && (
        <>
          {err && <p style={{ fontSize: 12, color: '#f87171', margin: '0 0 8px' }}>{err}</p>}
          <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
            <button onClick={save} disabled={saving}
              style={{ padding: '7px 16px', background: RED, color: '#fff', border: 'none', borderRadius: 5, fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Αποθήκευση…' : 'Αποθήκευση'}
            </button>
            {isNew && onCancel && <button onClick={onCancel} style={btnS('#1e1e1e', '#666')}>Ακύρωση</button>}
          </div>
        </>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────

export default function PersonalAdminPage() {
  const [tab,        setTab]        = useState<'properties' | 'demand'>('properties')
  const [properties, setProperties] = useState<PropertyRow[]>([])
  const [demands,    setDemands]    = useState<DemandRow[]>([])
  const [loading,    setLoading]    = useState(true)
  const [loadError,  setLoadError]  = useState<string | null>(null)
  const [userId,     setUserId]     = useState<string | null>(null)
  const [showNew,    setShowNew]    = useState(false)
  const [search,     setSearch]     = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUserId(session?.user?.id ?? null))
  }, [])

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true); setLoadError(null)
    const [propsRes, demsRes] = await Promise.all([
      supabase.from('meeting_properties')
        .select('id,ilist_id,title,owner_name,owner_phone,owner_email,owner_contact_id,contacts(id,full_name,first_name,last_name,phone,email),transaction_type,address,area,floor,sqm,rooms,condition,year_built,year_renovated,balcony,parking,security_door,asking_price,seller_motivation,ai_summary,status,voice_note_ids,created_at,updated_at')
        .eq('agent_id', userId)
        .order('created_at', { ascending: false })
        .limit(200),
      supabase.from('demand_profiles')
        .select('id,client_name,client_phone,client_email,transaction_type,property_type,budget_eur,size_min,size_max,floor_min,floor_max,areas_preferred,must_have,nice_to_have,condition_req,ai_summary,status,updated_at,voice_note_ids')
        .eq('agent_id', userId)
        .order('updated_at', { ascending: false })
        .limit(200),
    ])
    if (propsRes.error) setLoadError(`Ακίνητα: ${propsRes.error.message}`)
    if (demsRes.error)  setLoadError(e => e ? e + ' | ' + demsRes.error!.message : `Ζητήσεις: ${demsRes.error!.message}`)
    setProperties((propsRes.data ?? []) as unknown as PropertyRow[])
    setDemands((demsRes.data ?? []) as DemandRow[])
    setLoading(false)
  }, [userId])

  useEffect(() => { load() }, [load])

  function afterSave() { setShowNew(false); load() }

  const q = search.toLowerCase().trim()

  const filteredProps = useMemo(() => !q ? properties : properties.filter(r =>
    [r.owner_name, r.owner_phone, r.address, r.area, r.ilist_id, r.owner_email]
      .some(f => f?.toLowerCase().includes(q))
  ), [properties, q])

  const filteredDems = useMemo(() => !q ? demands : demands.filter(r =>
    [r.client_name, r.client_phone, r.client_email, ...(r.areas_preferred ?? [])]
      .some(f => f?.toLowerCase().includes(q))
  ), [demands, q])

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#f0f0f0', padding: '20px 14px', maxWidth: 680, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 10 }}>
        <h1 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Personal Admin</h1>
        <VoiceMemoButton onSuccess={load} />
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 10 }}>
        <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#444', pointerEvents: 'none', fontSize: 13 }}>🔍</span>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Αναζήτηση — όνομα, τηλ., περιοχή, διεύθυνση…"
          style={{ width: '100%', boxSizing: 'border-box', padding: '8px 32px', background: '#111', border: '1px solid #1e1e1e', borderRadius: 7, color: '#e0e0e0', fontSize: 13, outline: 'none' }}
        />
        {search && (
          <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#444', cursor: 'pointer', fontSize: 14, padding: 0 }}>✕</button>
        )}
      </div>

      {/* Tabs + New button */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 10, borderBottom: '1px solid #1a1a1a', alignItems: 'flex-end' }}>
        {(['properties', 'demand'] as const).map(t => (
          <button key={t} onClick={() => { setTab(t); setShowNew(false) }}
            style={{ padding: '6px 13px', fontSize: 13, background: 'none', border: 'none',
              color: tab === t ? '#f0f0f0' : '#555', cursor: 'pointer', fontWeight: tab === t ? 600 : 400,
              borderBottom: tab === t ? `2px solid ${RED}` : '2px solid transparent', marginBottom: -1 }}>
            {t === 'properties' ? `Ακίνητα (${filteredProps.length})` : `Ζητήσεις (${filteredDems.length})`}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', paddingBottom: 4 }}>
          <button onClick={() => setShowNew(p => !p)}
            style={{ padding: '5px 12px', fontSize: 12, background: showNew ? '#1a0a0a' : RED, color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer', fontWeight: 600 }}>
            {showNew ? '✕' : '+ Νέο'}
          </button>
        </div>
      </div>

      {loading   && <p style={{ color: '#444', fontSize: 13 }}>Φόρτωση…</p>}
      {loadError && <p style={{ fontSize: 12, color: '#f87171', marginBottom: 10, padding: '8px 10px', background: '#1a0000', borderRadius: 6 }}>⚠ {loadError}</p>}

      {/* New entry */}
      {showNew && tab === 'properties' && <NewPropertyForm onSaved={afterSave} onCancel={() => setShowNew(false)} />}
      {showNew && tab === 'demand'     && <DemandCard   row={null} isNew onSaved={afterSave} onCancel={() => setShowNew(false)} />}

      {/* Lists */}
      {!loading && tab === 'properties' && (
        <>
          {filteredProps.length === 0 && !showNew && (
            <p style={{ textAlign: 'center', color: '#333', fontSize: 13, paddingTop: 40 }}>
              {search ? 'Κανένα αποτέλεσμα.' : 'Κανένα ακίνητο — πάτα + Νέο ή μίλα.'}
            </p>
          )}
          {filteredProps.length > 0 && <PropertiesTable rows={filteredProps} />}
        </>
      )}

      {!loading && tab === 'demand' && (
        <>
          {filteredDems.length === 0 && !showNew && (
            <p style={{ textAlign: 'center', color: '#333', fontSize: 13, paddingTop: 40 }}>
              {search ? 'Κανένα αποτέλεσμα.' : 'Καμία ζήτηση — πάτα + Νέο.'}
            </p>
          )}
          {filteredDems.map(row => <DemandCard key={row.id} row={row} onSaved={load} />)}
        </>
      )}
    </div>
  )
}
