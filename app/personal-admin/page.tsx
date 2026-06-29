'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient }         from '@supabase/supabase-js'
import { VoiceMemoButton }      from '@/components/VoiceMemoButton'
import { PropertyPhotoUpload }  from '@/components/PropertyPhotoUpload'
import { PropertyDocUpload }    from '@/components/PropertyDocUpload'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ── Types ─────────────────────────────────────────────────────────

type PropertyRow = {
  id: string; ilist_id: string | null; title: string | null
  owner_name: string | null; owner_phone: string | null; owner_email: string | null
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

// ── Styling ───────────────────────────────────────────────────────

const RED  = '#CC2229'
const CARD = { background: '#161616', border: '1px solid #1e1e1e', borderRadius: 8, padding: '14px 16px', marginBottom: 10 }
const LBL  = { fontSize: 10, color: '#555', textTransform: 'uppercase' as const, letterSpacing: '0.05em', margin: 0 }
const VAL  = { fontSize: 13, color: '#d0d0d0', margin: 0 }

function Badge({ s }: { s: string }) {
  const map: Record<string, [string,string]> = {
    pending: ['#1e293b','#94a3b8'], for_appraisal: ['#2d1b00','#fbbf24'],
    estimated: ['#1a1a2e','#818cf8'], completed: ['#1c2e1c','#86efac'],
    active: ['#1c2e1c','#86efac'], matched: ['#1a1a2e','#818cf8'],
    closed: ['#1e293b','#94a3b8'], inactive: ['#1e1e1e','#555'],
  }
  const [bg, color] = map[s] ?? ['#1e1e1e','#888']
  return <span style={{ background: bg, color, borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>{s}</span>
}

function fmt(n: number | null | undefined, u = '') {
  return n == null ? '—' : n.toLocaleString('el-GR') + (u ? ' ' + u : '')
}

// ── Inline-edit helpers ───────────────────────────────────────────

type ES = Record<string, unknown>

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
    const o = orig[k]
    if (Array.isArray(o))        out[k] = String(v).split(',').map(s => s.trim()).filter(Boolean)
    else if (typeof o === 'number')  out[k] = Number(v)
    else if (typeof o === 'boolean') out[k] = v === 'true' || v === true
    else out[k] = v
  }
  return out
}

function EI({ label, k, type, state, set }: {
  label: string; k: string; type: 'text'|'number'|'checkbox'|'select'
  state: ES; set: (k: string, v: unknown) => void
  options?: string[]
}) {
  const val = state[k]
  return (
    <div>
      <p style={LBL}>{label}</p>
      {type === 'checkbox' ? (
        <label style={{ display:'flex', gap:5, alignItems:'center', cursor:'pointer' }}>
          <input type="checkbox" checked={!!val} onChange={e=>set(k,e.target.checked)} style={{ accentColor:RED, width:13, height:13 }} />
          <span style={{ fontSize:12, color:'#888' }}>{val?'Ναι':'Όχι'}</span>
        </label>
      ) : (
        <input type={type==='number'?'number':'text'} value={val==null?'':String(val)}
          onChange={e=>set(k,e.target.value)} placeholder="—"
          style={{ width:'100%', boxSizing:'border-box', background:'#0d0d0d', border:'1px solid #2a2a2a', borderRadius:4, color:'#e0e0e0', fontSize:13, padding:'4px 7px', outline:'none' }}
        />
      )}
    </div>
  )
}

// ── Manual entry forms ────────────────────────────────────────────

const EMPTY_PROP: ES = {
  owner_name:'', owner_phone:'', owner_email:'', address:'', area:'',
  transaction_type:'sale', asking_price:'', sqm:'', floor:'', rooms:'',
  year_built:'', year_renovated:'', condition:'', balcony:false, parking:false,
  security_door:false, seller_motivation:'', ai_summary:'',
}
const EMPTY_DEM: ES = {
  client_name:'', client_phone:'', client_email:'', transaction_type:'buy',
  property_type:'', budget_eur:'', size_min:'', size_max:'', floor_min:'', floor_max:'',
  areas_preferred:'', must_have:'', condition_req:'', ai_summary:'',
}

function ManualPropertyForm({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const [state, setState] = useState<ES>({ ...EMPTY_PROP })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string|null>(null)
  const set = (k: string, v: unknown) => setState(p => ({ ...p, [k]: v }))

  async function submit() {
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
    if (!res.ok) { setErr(data.error ?? 'Σφάλμα'); setSaving(false); return }
    onSaved()
  }

  return (
    <div style={{ ...CARD, border: `1px solid ${RED}44` }}>
      <p style={{ fontSize: 12, fontWeight: 700, color: RED, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 12px' }}>Νέα Καταγραφή Ακινήτου</p>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:'8px 12px', marginBottom:12 }}>
        <EI label="Ιδιοκτήτης"       k="owner_name"        type="text"     state={state} set={set} />
        <EI label="Τηλέφωνο"         k="owner_phone"       type="text"     state={state} set={set} />
        <EI label="Email ιδιοκτήτη"  k="owner_email"       type="text"     state={state} set={set} />
        <EI label="Τύπος"            k="transaction_type"  type="text"     state={state} set={set} />
        <EI label="Διεύθυνση"        k="address"           type="text"     state={state} set={set} />
        <EI label="Περιοχή"          k="area"              type="text"     state={state} set={set} />
        <EI label="Τιμή (€)"         k="asking_price"      type="number"   state={state} set={set} />
        <EI label="τμ"               k="sqm"               type="number"   state={state} set={set} />
        <EI label="Όροφος"           k="floor"             type="number"   state={state} set={set} />
        <EI label="Υ/Δ"             k="rooms"             type="number"   state={state} set={set} />
        <EI label="Έτος κατ."       k="year_built"        type="number"   state={state} set={set} />
        <EI label="Έτος ανακ."      k="year_renovated"    type="number"   state={state} set={set} />
        <EI label="Κατάσταση"        k="condition"         type="text"     state={state} set={set} />
        <EI label="Μπαλκόνι"        k="balcony"           type="checkbox" state={state} set={set} />
        <EI label="Πάρκινγκ"        k="parking"           type="checkbox" state={state} set={set} />
        <EI label="Ασφ. Πόρτα"      k="security_door"     type="checkbox" state={state} set={set} />
        <div style={{ gridColumn:'1/-1' }}><EI label="Κίνητρο πωλητή" k="seller_motivation" type="text" state={state} set={set} /></div>
        <div style={{ gridColumn:'1/-1' }}><EI label="Σύνοψη"         k="ai_summary"        type="text" state={state} set={set} /></div>
      </div>
      {err && <p style={{ fontSize:12, color:'#f87171', margin:'0 0 8px' }}>{err}</p>}
      <div style={{ display:'flex', gap:8 }}>
        <button onClick={submit} disabled={saving} style={{ padding:'7px 16px', background:RED, color:'#fff', border:'none', borderRadius:5, fontSize:13, fontWeight:600, cursor:saving?'not-allowed':'pointer', opacity:saving?0.6:1 }}>
          {saving?'Αποθήκευση…':'Αποθήκευση'}
        </button>
        <button onClick={onCancel} disabled={saving} style={{ padding:'7px 12px', background:'#1e1e1e', color:'#888', border:'1px solid #2a2a2a', borderRadius:5, fontSize:13, cursor:'pointer' }}>Ακύρωση</button>
      </div>
    </div>
  )
}

function ManualDemandForm({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const [state, setState] = useState<ES>({ ...EMPTY_DEM })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string|null>(null)
  const set = (k: string, v: unknown) => setState(p => ({ ...p, [k]: v }))

  async function submit() {
    setSaving(true); setErr(null)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setErr('Δεν βρέθηκε session'); setSaving(false); return }

    const fields = fromES(state, EMPTY_DEM)
    const res = await fetch('/api/voice-ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ transcript: '(manual entry)', intent: 'demand_profile', fields }),
    })
    const data = await res.json()
    if (!res.ok) { setErr(data.error ?? 'Σφάλμα'); setSaving(false); return }
    onSaved()
  }

  return (
    <div style={{ ...CARD, border: `1px solid ${RED}44` }}>
      <p style={{ fontSize: 12, fontWeight: 700, color: RED, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 12px' }}>Νέα Ζήτηση Πελάτη</p>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:'8px 12px', marginBottom:12 }}>
        <EI label="Πελάτης"     k="client_name"     type="text"   state={state} set={set} />
        <EI label="Τηλέφωνο"   k="client_phone"    type="text"   state={state} set={set} />
        <EI label="Email"       k="client_email"    type="text"   state={state} set={set} />
        <EI label="Τύπος"      k="transaction_type" type="text"  state={state} set={set} />
        <EI label="Ακίνητο"   k="property_type"   type="text"   state={state} set={set} />
        <EI label="Budget (€)" k="budget_eur"      type="number" state={state} set={set} />
        <EI label="τμ από"    k="size_min"        type="number" state={state} set={set} />
        <EI label="τμ έως"    k="size_max"        type="number" state={state} set={set} />
        <EI label="Όροφ. από" k="floor_min"       type="number" state={state} set={set} />
        <EI label="Όροφ. έως" k="floor_max"       type="number" state={state} set={set} />
        <EI label="Κατάσταση" k="condition_req"   type="text"   state={state} set={set} />
        <div style={{ gridColumn:'1/-1' }}><EI label="Περιοχές (comma)"  k="areas_preferred" type="text" state={state} set={set} /></div>
        <div style={{ gridColumn:'1/-1' }}><EI label="Must-have (comma)" k="must_have"       type="text" state={state} set={set} /></div>
        <div style={{ gridColumn:'1/-1' }}><EI label="Σύνοψη"           k="ai_summary"      type="text" state={state} set={set} /></div>
      </div>
      {err && <p style={{ fontSize:12, color:'#f87171', margin:'0 0 8px' }}>{err}</p>}
      <div style={{ display:'flex', gap:8 }}>
        <button onClick={submit} disabled={saving} style={{ padding:'7px 16px', background:RED, color:'#fff', border:'none', borderRadius:5, fontSize:13, fontWeight:600, cursor:saving?'not-allowed':'pointer', opacity:saving?0.6:1 }}>
          {saving?'Αποθήκευση…':'Αποθήκευση'}
        </button>
        <button onClick={onCancel} disabled={saving} style={{ padding:'7px 12px', background:'#1e1e1e', color:'#888', border:'1px solid #2a2a2a', borderRadius:5, fontSize:13, cursor:'pointer' }}>Ακύρωση</button>
      </div>
    </div>
  )
}

// ── Property card ─────────────────────────────────────────────────

function PropertyCard({ row, onSaved }: { row: PropertyRow; onSaved: () => void }) {
  const [editing, setEditing] = useState(false)
  const [showPhotos, setShowPhotos] = useState(false)
  const [showDocs,   setShowDocs]   = useState(false)
  const [state, setState] = useState<ES>({})
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string|null>(null)

  function startEdit() { setState(toES(row as unknown as ES)); setEditing(true); setErr(null) }

  async function save() {
    setSaving(true); setErr(null)
    const payload = fromES(state, row as unknown as ES)
    delete payload.id; delete payload.updated_at; delete payload.created_at; delete payload.voice_note_ids
    const { error } = await supabase.from('meeting_properties').update(payload).eq('id', row.id)
    setSaving(false)
    if (error) { setErr(error.message); return }
    setEditing(false); onSaved()
  }

  const btns = (
    <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
      <Badge s={row.status} />
      <button onClick={()=>setShowPhotos(p=>!p)} style={{ padding:'3px 9px', fontSize:11, background:'#1e1e1e', border:'1px solid #2a2a2a', borderRadius:4, color:'#888', cursor:'pointer' }}>📷 {showPhotos?'▲':'Φωτ.'}</button>
      <button onClick={()=>setShowDocs(p=>!p)}   style={{ padding:'3px 9px', fontSize:11, background:'#1e1e1e', border:'1px solid #2a2a2a', borderRadius:4, color:'#888', cursor:'pointer' }}>📁 {showDocs?'▲':'Φάκελος'}</button>
      {!editing && <button onClick={startEdit} style={{ padding:'3px 9px', fontSize:11, background:'#1e1e1e', border:'1px solid #2a2a2a', borderRadius:4, color:'#888', cursor:'pointer' }}>✏ Επεξ.</button>}
    </div>
  )

  const head = (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12, flexWrap:'wrap', marginBottom:10 }}>
      <div>
        <span style={{ fontSize:15, fontWeight:600, color:'#f0f0f0' }}>{row.owner_name ?? row.title ?? 'Ακίνητο'}</span>
        {row.owner_phone && <span style={{ fontSize:12, color:'#555', marginLeft:10 }}>{row.owner_phone}</span>}
        {row.ilist_id    && <span style={{ fontSize:10, color:'#333', marginLeft:10 }}>{row.ilist_id}</span>}
      </div>
      {btns}
    </div>
  )

  if (editing) {
    return (
      <div style={{ ...CARD, border:`1px solid ${RED}33` }}>
        {head}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:'8px 12px', marginBottom:12 }}>
          <EI label="Ιδιοκτήτης"      k="owner_name"        type="text"     state={state} set={(k,v)=>setState(p=>({...p,[k]:v}))} />
          <EI label="Τηλέφωνο"        k="owner_phone"       type="text"     state={state} set={(k,v)=>setState(p=>({...p,[k]:v}))} />
          <EI label="Email ιδιοκτήτη" k="owner_email"       type="text"     state={state} set={(k,v)=>setState(p=>({...p,[k]:v}))} />
          <EI label="Τύπος"           k="transaction_type"  type="text"     state={state} set={(k,v)=>setState(p=>({...p,[k]:v}))} />
          <EI label="Διεύθυνση"       k="address"           type="text"     state={state} set={(k,v)=>setState(p=>({...p,[k]:v}))} />
          <EI label="Περιοχή"         k="area"              type="text"     state={state} set={(k,v)=>setState(p=>({...p,[k]:v}))} />
          <EI label="Τιμή (€)"        k="asking_price"      type="number"   state={state} set={(k,v)=>setState(p=>({...p,[k]:v}))} />
          <EI label="τμ"              k="sqm"               type="number"   state={state} set={(k,v)=>setState(p=>({...p,[k]:v}))} />
          <EI label="Όροφος"          k="floor"             type="number"   state={state} set={(k,v)=>setState(p=>({...p,[k]:v}))} />
          <EI label="Υ/Δ"            k="rooms"             type="number"   state={state} set={(k,v)=>setState(p=>({...p,[k]:v}))} />
          <EI label="Έτος κατ."      k="year_built"        type="number"   state={state} set={(k,v)=>setState(p=>({...p,[k]:v}))} />
          <EI label="Έτος ανακ."     k="year_renovated"    type="number"   state={state} set={(k,v)=>setState(p=>({...p,[k]:v}))} />
          <EI label="Κατάσταση"       k="condition"         type="text"     state={state} set={(k,v)=>setState(p=>({...p,[k]:v}))} />
          <EI label="Μπαλκόνι"       k="balcony"           type="checkbox" state={state} set={(k,v)=>setState(p=>({...p,[k]:v}))} />
          <EI label="Πάρκινγκ"       k="parking"           type="checkbox" state={state} set={(k,v)=>setState(p=>({...p,[k]:v}))} />
          <EI label="Ασφ. Πόρτα"     k="security_door"     type="checkbox" state={state} set={(k,v)=>setState(p=>({...p,[k]:v}))} />
          <div style={{ gridColumn:'1/-1' }}><EI label="Κίνητρο" k="seller_motivation" type="text" state={state} set={(k,v)=>setState(p=>({...p,[k]:v}))} /></div>
          <div style={{ gridColumn:'1/-1' }}><EI label="Σύνοψη"  k="ai_summary"        type="text" state={state} set={(k,v)=>setState(p=>({...p,[k]:v}))} /></div>
        </div>
        {err && <p style={{ fontSize:12, color:'#f87171', margin:'0 0 8px' }}>{err}</p>}
        <div style={{ display:'flex', gap:8, marginBottom:12 }}>
          <button onClick={save} disabled={saving} style={{ padding:'7px 14px', background:RED, color:'#fff', border:'none', borderRadius:5, fontSize:13, fontWeight:600, cursor:saving?'not-allowed':'pointer', opacity:saving?0.6:1 }}>{saving?'…':'Αποθήκευση'}</button>
          <button onClick={()=>setEditing(false)} style={{ padding:'7px 12px', background:'#1e1e1e', color:'#888', border:'1px solid #2a2a2a', borderRadius:5, fontSize:13, cursor:'pointer' }}>Ακύρωση</button>
        </div>
        {showPhotos && <PropertyPhotoUpload propertyId={row.id} />}
        {showDocs   && <PropertyDocUpload   propertyId={row.id} />}
      </div>
    )
  }

  return (
    <div style={CARD}>
      {head}
      {row.ai_summary && <p style={{ fontSize:13, color:'#94a3b8', margin:'0 0 10px', fontStyle:'italic' }}>{row.ai_summary}</p>}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(120px,1fr))', gap:'6px 14px' }}>
        <div><p style={LBL}>Περιοχή</p><p style={VAL}>{row.area??'—'}</p></div>
        <div><p style={LBL}>Διεύθυνση</p><p style={VAL}>{row.address??'—'}</p></div>
        <div><p style={LBL}>Τύπος</p><p style={VAL}>{row.transaction_type==='sale'?'Πώληση':row.transaction_type==='rent'?'Ενοίκιο':'—'}</p></div>
        <div><p style={LBL}>Τιμή</p><p style={VAL}>{fmt(row.asking_price,'€')}</p></div>
        <div><p style={LBL}>τμ</p><p style={VAL}>{fmt(row.sqm,'τμ')}</p></div>
        <div><p style={LBL}>Όροφος</p><p style={VAL}>{row.floor===0?'Ισόγειο':fmt(row.floor,'ος')}</p></div>
        <div><p style={LBL}>Υ/Δ</p><p style={VAL}>{fmt(row.rooms)}</p></div>
        <div><p style={LBL}>Έτος κατ.</p><p style={VAL}>{fmt(row.year_built)}</p></div>
        <div><p style={LBL}>Μπαλκόνι</p><p style={VAL}>{row.balcony==null?'—':row.balcony?'Ναι':'Όχι'}</p></div>
        <div><p style={LBL}>Πάρκινγκ</p><p style={VAL}>{row.parking==null?'—':row.parking?'Ναι':'Όχι'}</p></div>
        <div><p style={LBL}>Κατάσταση</p><p style={VAL}>{row.condition??'—'}</p></div>
      </div>
      <p style={{ fontSize:10, color:'#333', marginTop:8, marginBottom:0 }}>{new Date(row.created_at).toLocaleDateString('el-GR')}</p>
      {showPhotos && <PropertyPhotoUpload propertyId={row.id} />}
      {showDocs   && <PropertyDocUpload   propertyId={row.id} />}
    </div>
  )
}

// ── Demand card ───────────────────────────────────────────────────

function DemandCard({ row, onSaved }: { row: DemandRow; onSaved: () => void }) {
  const [editing,     setEditing]     = useState(false)
  const [state,       setState]       = useState<ES>({})
  const [saving,      setSaving]      = useState(false)
  const [err,         setErr]         = useState<string|null>(null)
  const [matching,    setMatching]    = useState(false)
  const [matchResult, setMatchResult] = useState<string|null>(null)

  async function testMatch() {
    setMatching(true); setMatchResult(null)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setMatchResult('Δεν βρέθηκε session'); setMatching(false); return }
    try {
      const res  = await fetch('/api/demand-match', {
        method: 'POST',
        headers: { 'Content-Type':'application/json', Authorization:`Bearer ${session.access_token}` },
        body: JSON.stringify({ demand_id: row.id }),
      })
      const data = await res.json()
      if (!res.ok) { setMatchResult(`Σφάλμα: ${data.error}`); setMatching(false); return }
      setMatchResult(
        data.matched === 0
          ? 'Κανένα ταίριασμα με ενεργά ακίνητα (for_appraisal/estimated/completed).'
          : `✅ ${data.matched} ακίνητ${data.matched===1?'ο':'α'} ταίριαξαν${data.email_sent?' — email στάλθηκε στο '+row.client_email+' ✉️':row.client_email?' — BREVO_API_KEY δεν βρέθηκε':' — δεν υπάρχει email πελάτη'}`
      )
    } catch(e) { setMatchResult(`Σφάλμα: ${e}`) }
    setMatching(false)
  }

  async function save() {
    setSaving(true); setErr(null)
    const payload = fromES(state, row as unknown as ES)
    delete payload.id; delete payload.updated_at; delete payload.voice_note_ids
    const { error } = await supabase.from('demand_profiles').update(payload).eq('id', row.id)
    setSaving(false)
    if (error) { setErr(error.message); return }
    setEditing(false); onSaved()
  }

  if (editing) {
    return (
      <div style={{ ...CARD, border:`1px solid ${RED}33` }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:'8px 12px', marginBottom:12 }}>
          <EI label="Πελάτης"     k="client_name"     type="text"   state={state} set={(k,v)=>setState(p=>({...p,[k]:v}))} />
          <EI label="Τηλέφωνο"   k="client_phone"    type="text"   state={state} set={(k,v)=>setState(p=>({...p,[k]:v}))} />
          <EI label="Email"       k="client_email"    type="text"   state={state} set={(k,v)=>setState(p=>({...p,[k]:v}))} />
          <EI label="Τύπος"      k="transaction_type" type="text"  state={state} set={(k,v)=>setState(p=>({...p,[k]:v}))} />
          <EI label="Ακίνητο"   k="property_type"   type="text"   state={state} set={(k,v)=>setState(p=>({...p,[k]:v}))} />
          <EI label="Budget (€)" k="budget_eur"      type="number" state={state} set={(k,v)=>setState(p=>({...p,[k]:v}))} />
          <EI label="τμ από"    k="size_min"        type="number" state={state} set={(k,v)=>setState(p=>({...p,[k]:v}))} />
          <EI label="τμ έως"    k="size_max"        type="number" state={state} set={(k,v)=>setState(p=>({...p,[k]:v}))} />
          <EI label="Κατάσταση" k="condition_req"   type="text"   state={state} set={(k,v)=>setState(p=>({...p,[k]:v}))} />
          <div style={{ gridColumn:'1/-1' }}><EI label="Περιοχές (comma)" k="areas_preferred" type="text" state={state} set={(k,v)=>setState(p=>({...p,[k]:v}))} /></div>
          <div style={{ gridColumn:'1/-1' }}><EI label="Must-have"        k="must_have"       type="text" state={state} set={(k,v)=>setState(p=>({...p,[k]:v}))} /></div>
          <div style={{ gridColumn:'1/-1' }}><EI label="Σύνοψη"           k="ai_summary"      type="text" state={state} set={(k,v)=>setState(p=>({...p,[k]:v}))} /></div>
        </div>
        {err && <p style={{ fontSize:12, color:'#f87171', margin:'0 0 8px' }}>{err}</p>}
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={save} disabled={saving} style={{ padding:'7px 14px', background:RED, color:'#fff', border:'none', borderRadius:5, fontSize:13, fontWeight:600, cursor:saving?'not-allowed':'pointer', opacity:saving?0.6:1 }}>{saving?'…':'Αποθήκευση'}</button>
          <button onClick={()=>setEditing(false)} style={{ padding:'7px 12px', background:'#1e1e1e', color:'#888', border:'1px solid #2a2a2a', borderRadius:5, fontSize:13, cursor:'pointer' }}>Ακύρωση</button>
        </div>
      </div>
    )
  }

  return (
    <div style={CARD}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12, flexWrap:'wrap', marginBottom:10 }}>
        <div>
          <span style={{ fontSize:15, fontWeight:600, color:'#f0f0f0' }}>{row.client_name??'Άγνωστος Πελάτης'}</span>
          {row.client_phone && <span style={{ fontSize:12, color:'#555', marginLeft:10 }}>{row.client_phone}</span>}
          {row.client_email && <span style={{ fontSize:11, color:'#444', marginLeft:10 }}>{row.client_email}</span>}
        </div>
        <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
          <Badge s={row.status} />
          <button onClick={testMatch} disabled={matching} style={{ padding:'3px 9px', fontSize:11, background:'#1c2e1c', border:'1px solid #166534', borderRadius:4, color:'#86efac', cursor:matching?'not-allowed':'pointer', opacity:matching?0.6:1 }}>
            {matching?'⏳':'📧 Match'}
          </button>
          <button onClick={()=>{setState(toES(row as unknown as ES));setEditing(true);setErr(null)}} style={{ padding:'3px 9px', fontSize:11, background:'#1e1e1e', border:'1px solid #2a2a2a', borderRadius:4, color:'#888', cursor:'pointer' }}>✏ Επεξ.</button>
        </div>
      </div>
      {matchResult && <p style={{ fontSize:12, color:matchResult.startsWith('✅')?'#86efac':'#f87171', margin:'0 0 8px', padding:'6px 8px', background:'#0d0d0d', borderRadius:4 }}>{matchResult}</p>}
      {row.ai_summary && <p style={{ fontSize:13, color:'#94a3b8', margin:'0 0 10px', fontStyle:'italic' }}>{row.ai_summary}</p>}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(120px,1fr))', gap:'6px 14px' }}>
        <div><p style={LBL}>Τύπος</p><p style={VAL}>{row.transaction_type==='buy'?'Αγορά':row.transaction_type==='rent'?'Ενοίκιο':'—'}</p></div>
        <div><p style={LBL}>Ακίνητο</p><p style={VAL}>{row.property_type??'—'}</p></div>
        <div><p style={LBL}>Budget</p><p style={VAL}>{fmt(row.budget_eur,'€')}</p></div>
        <div><p style={LBL}>τμ</p><p style={VAL}>{row.size_min||row.size_max?`${row.size_min??'?'}–${row.size_max??'?'} τμ`:'—'}</p></div>
        <div><p style={LBL}>Περιοχές</p><p style={VAL}>{(row.areas_preferred??[]).join(', ')||'—'}</p></div>
        <div><p style={LBL}>Must-have</p><p style={VAL}>{(row.must_have??[]).join(', ')||'—'}</p></div>
      </div>
      <p style={{ fontSize:10, color:'#333', marginTop:8, marginBottom:0 }}>Τελ. ενημ. {new Date(row.updated_at).toLocaleDateString('el-GR')}</p>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────

export default function PersonalAdminPage() {
  const [tab,         setTab]         = useState<'properties'|'demand'>('properties')
  const [properties,  setProperties]  = useState<PropertyRow[]>([])
  const [demands,     setDemands]     = useState<DemandRow[]>([])
  const [loading,     setLoading]     = useState(true)
  const [loadError,   setLoadError]   = useState<string|null>(null)
  const [userId,      setUserId]      = useState<string|null>(null)
  const [showManual,  setShowManual]  = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null)
    })
  }, [])

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true); setLoadError(null)
    const [propsRes, demsRes] = await Promise.all([
      supabase.from('meeting_properties')
        .select('id,ilist_id,title,owner_name,owner_phone,owner_email,transaction_type,address,area,floor,sqm,rooms,condition,year_built,year_renovated,balcony,parking,security_door,asking_price,seller_motivation,ai_summary,status,voice_note_ids,created_at,updated_at')
        .eq('agent_id', userId)
        .order('created_at', { ascending: false })
        .limit(100),
      supabase.from('demand_profiles')
        .select('id,client_name,client_phone,client_email,transaction_type,property_type,budget_eur,size_min,size_max,floor_min,floor_max,areas_preferred,must_have,nice_to_have,condition_req,ai_summary,status,updated_at,voice_note_ids')
        .eq('agent_id', userId)
        .order('updated_at', { ascending: false })
        .limit(100),
    ])
    if (propsRes.error) setLoadError(`Ακίνητα: ${propsRes.error.message}`)
    if (demsRes.error)  setLoadError(e => e ? e+' | '+demsRes.error!.message : `Ζητήσεις: ${demsRes.error!.message}`)
    setProperties((propsRes.data ?? []) as PropertyRow[])
    setDemands((demsRes.data ?? []) as DemandRow[])
    setLoading(false)
  }, [userId])

  useEffect(() => { load() }, [load])

  function afterSave() { setShowManual(false); load() }

  return (
    <div style={{ minHeight:'100vh', background:'#0a0a0a', color:'#f0f0f0', padding:'24px 16px', maxWidth:680, margin:'0 auto' }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontSize:20, fontWeight:700, margin:0, letterSpacing:'-0.02em' }}>Personal Admin</h1>
          <p style={{ fontSize:12, color:'#444', marginTop:4 }}>Οι καταγραφές σου — φωνή, χειροκίνητα, ή Excel</p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
          <VoiceMemoButton onSuccess={load} />
        </div>
      </div>

      {/* Tabs + manual add button */}
      <div style={{ display:'flex', gap:4, marginBottom:12, borderBottom:'1px solid #1e1e1e', alignItems:'flex-end' }}>
        {(['properties','demand'] as const).map(t => (
          <button key={t} onClick={()=>{setTab(t);setShowManual(false)}}
            style={{ padding:'7px 14px', fontSize:13, background:'none', border:'none',
              color:tab===t?'#f0f0f0':'#555', cursor:'pointer', fontWeight:tab===t?600:400,
              borderBottom:tab===t?`2px solid ${RED}`:'2px solid transparent', marginBottom:-1 }}>
            {t==='properties'?`Ακίνητα (${properties.length})`:`Ζητήσεις (${demands.length})`}
          </button>
        ))}
        <div style={{ marginLeft:'auto', paddingBottom:4 }}>
          <button onClick={()=>setShowManual(p=>!p)}
            style={{ padding:'5px 12px', fontSize:12, background: showManual?'#2a0a0a':RED, color:'#fff', border:'none', borderRadius:5, cursor:'pointer', fontWeight:600 }}>
            {showManual ? '✕ Κλείσιμο' : '+ Χειροκίνητη'}
          </button>
        </div>
      </div>

      {/* Manual entry form */}
      {showManual && tab === 'properties' && <ManualPropertyForm onSaved={afterSave} onCancel={()=>setShowManual(false)} />}
      {showManual && tab === 'demand'     && <ManualDemandForm   onSaved={afterSave} onCancel={()=>setShowManual(false)} />}

      {loading    && <p style={{ color:'#444', fontSize:13 }}>Φόρτωση…</p>}
      {loadError  && <p style={{ fontSize:12, color:'#f87171', marginBottom:12, padding:'8px 10px', background:'#1a0000', borderRadius:6 }}>⚠ {loadError}</p>}

      {!loading && tab === 'properties' && (
        <>
          {properties.length === 0 && !showManual && (
            <div style={{ textAlign:'center', padding:'50px 0', color:'#444' }}>
              <p style={{ fontSize:28 }}>🎙</p>
              <p style={{ fontSize:14 }}>Κανένα ακίνητο ακόμα.</p>
              <p style={{ fontSize:12, color:'#333' }}>Χρησιμοποίησε το μικρόφωνο ή το κουμπί "+ Χειροκίνητη".</p>
            </div>
          )}
          {properties.map(row => <PropertyCard key={row.id} row={row} onSaved={load} />)}
        </>
      )}

      {!loading && tab === 'demand' && (
        <>
          {demands.length === 0 && !showManual && (
            <div style={{ textAlign:'center', padding:'50px 0', color:'#444' }}>
              <p style={{ fontSize:28 }}>🎙</p>
              <p style={{ fontSize:14 }}>Καμία ζήτηση ακόμα.</p>
            </div>
          )}
          {demands.map(row => <DemandCard key={row.id} row={row} onSaved={load} />)}
        </>
      )}
    </div>
  )
}
