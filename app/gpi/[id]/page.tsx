'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Shell from '@/components/Shell'
import { authedFetch } from '@/lib/authedFetch'

const C = { red: '#CC2229', dark: '#1A1A1A', muted: '#6B7280', border: '#EBEBEB', subtle: '#F7F7F7', white: '#FFFFFF', green: '#16A34A', blue: '#2563EB' }

function Field({ label, value, onChange, type = 'text', placeholder }: any) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: C.muted, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: .4 }}>{label}</label>
      <input type={type} value={value ?? ''} placeholder={placeholder} onChange={e => onChange(e.target.value)}
        style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid ' + C.border, fontSize: 13, background: '#FAFAFA', color: C.dark, boxSizing: 'border-box', outline: 'none' }} />
    </div>
  )
}
function Sec({ children }: any) { return <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: .8, textTransform: 'uppercase', margin: '20px 0 12px', paddingBottom: 8, borderBottom: '1px solid ' + C.border }}>{children}</div> }
function Check({ label, checked, onChange }: any) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.dark, cursor: 'pointer', padding: '4px 0' }}>
      <input type="checkbox" checked={!!checked} onChange={e => onChange(e.target.checked)} /> {label}
    </label>
  )
}

type Client = {
  id: string; full_name: string; father_name: string | null; tin_number: string | null
  id_passport_number: string | null; address: string | null; bank_account: string | null
  agent_id: string | null; id_photo_url: string | null
  has_taxisnet_username: boolean; has_taxisnet_password: boolean; has_taxisnet_auth_key: boolean
}
type Unit = {
  id: string; sqm: number | null; floor: string | null; project: string | null; address: string | null
  unit_name: string | null; expected_rent: number | null; brochure_sent: boolean; exclusive_agreement_sent: boolean
  exclusive_agreement_date: string | null; exclusive_agreement_duration_months: number | null
  rented: boolean; energy_certificate: boolean; advertisement: boolean
  ad_link: string | null; project_delivered: boolean; keys_received: boolean
  description: string | null; notices: string | null
}
const EMPTY_UNIT: Partial<Unit> = { sqm: null, floor: '', project: '', address: '', unit_name: '', expected_rent: null, ad_link: '', exclusive_agreement_date: '', exclusive_agreement_duration_months: null, description: '', notices: '' }

export default function GpiClientPage({ params }: { params: { id: string } }) {
  const id = params.id
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [client, setClient] = useState<Client | null>(null)
  const [units, setUnits] = useState<Unit[]>([])
  const [taxisnetEdits, setTaxisnetEdits] = useState<Record<string, string>>({})
  const [revealed, setRevealed] = useState<Record<string, string> | null>(null)
  const [revealing, setRevealing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [showNewUnit, setShowNewUnit] = useState(false)
  const [newUnit, setNewUnit] = useState<Partial<Unit>>(EMPTY_UNIT)

  async function load() {
    setLoading(true)
    const res = await authedFetch(`/api/gpi/clients/${id}`)
    const data = await res.json()
    if (!res.ok) { setErr(data.error || 'Δεν βρέθηκε ο πελάτης'); setLoading(false); return }
    setClient(data.client); setUnits(data.units || []); setLoading(false)
  }
  useEffect(() => { load() }, [id])

  const set = (k: keyof Client) => (v: any) => setClient(c => c ? { ...c, [k]: v } : c)

  async function handleSave() {
    if (!client) return
    setSaving(true); setErr(null)
    const payload: Record<string, any> = {
      full_name: client.full_name, father_name: client.father_name, tin_number: client.tin_number,
      id_passport_number: client.id_passport_number, address: client.address, bank_account: client.bank_account,
      ...taxisnetEdits,
    }
    const res = await authedFetch(`/api/gpi/clients/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setErr(data.error || 'Σφάλμα αποθήκευσης'); return }
    setTaxisnetEdits({})
    setClient(c => c ? { ...c, ...data.client } : c)
    setSaved(true); setTimeout(() => setSaved(false), 3000)
  }

  async function handleReveal() {
    setRevealing(true); setErr(null)
    const res = await authedFetch(`/api/gpi/clients/${id}/reveal`, { method: 'POST' })
    const data = await res.json()
    setRevealing(false)
    if (!res.ok) { setErr(data.error || 'Σφάλμα'); return }
    setRevealed(data)
  }

  async function handleUpload(file: File) {
    setUploading(true); setErr(null)
    const form = new FormData()
    form.append('client_id', id)
    form.append('file', file)
    const res = await authedFetch('/api/gpi/upload', { method: 'POST', body: form })
    const data = await res.json()
    setUploading(false)
    if (!res.ok) { setErr(data.error || 'Σφάλμα ανεβάσματος'); return }
    setClient(c => c ? { ...c, id_photo_url: data.url } : c)
  }

  async function handleDeleteClient() {
    if (!confirm('Διαγραφή πελάτη GPI; Αυτό θα διαγράψει και όλες τις μονάδες του.')) return
    const res = await authedFetch(`/api/gpi/clients/${id}`, { method: 'DELETE' })
    if (res.ok) router.push('/gpi')
  }

  async function handleCreateUnit() {
    const res = await authedFetch('/api/gpi/units', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client_id: id, ...newUnit }) })
    const data = await res.json()
    if (!res.ok) { setErr(data.error || 'Σφάλμα'); return }
    setUnits(u => [...u, data.unit])
    setNewUnit(EMPTY_UNIT); setShowNewUnit(false)
  }

  async function handleUpdateUnit(unitId: string, patch: Partial<Unit>) {
    const res = await authedFetch(`/api/gpi/units/${unitId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) })
    const data = await res.json()
    if (!res.ok) { setErr(data.error || 'Σφάλμα'); return }
    setUnits(list => list.map(u => u.id === unitId ? { ...u, ...data.unit } : u))
  }

  async function handleDeleteUnit(unitId: string) {
    if (!confirm('Διαγραφή μονάδας;')) return
    const res = await authedFetch(`/api/gpi/units/${unitId}`, { method: 'DELETE' })
    if (res.ok) setUnits(list => list.filter(u => u.id !== unitId))
  }

  if (loading) return <Shell><div style={{ padding: 40, color: C.muted, fontSize: 13 }}>Φόρτωση...</div></Shell>
  if (!client) return <Shell><div style={{ padding: 40, color: C.red, fontSize: 13 }}>{err || 'Δεν βρέθηκε.'}</div></Shell>

  return (
    <Shell>
      <div style={{ fontFamily: "-apple-system,BlinkMacSystemFont,'Inter',sans-serif", color: C.dark }}>
        <div style={{ background: C.dark, padding: '16px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <a href="/gpi" style={{ color: 'rgba(255,255,255,.5)', textDecoration: 'none', fontSize: 12, fontWeight: 500 }}>← GPI</a>
            <span style={{ color: 'rgba(255,255,255,.2)' }}>|</span>
            <h1 style={{ fontSize: 15, fontWeight: 700, color: '#fff', margin: 0 }}>{client.full_name}</h1>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleDeleteClient} style={{ background: 'transparent', color: 'rgba(255,255,255,.5)', border: '1px solid rgba(255,255,255,.2)', borderRadius: 10, padding: '10px 16px', fontSize: 12, cursor: 'pointer' }}>Διαγραφή</button>
            <button onClick={handleSave} disabled={saving} style={{ background: saved ? C.green : C.red, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 22px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              {saving ? 'Αποθήκευση...' : saved ? '✓ Αποθηκεύτηκε' : 'Αποθήκευση'}
            </button>
          </div>
        </div>

        <div style={{ padding: '24px 28px', background: '#F4F4F4', minHeight: 'calc(100vh - 68px)' }}>
          {err && <div style={{ marginBottom: 16, padding: '10px 14px', background: '#FEE2E2', color: '#B91C1C', borderRadius: 8, fontSize: 13 }}>{err}</div>}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <div style={{ background: C.white, border: '1px solid ' + C.border, borderRadius: 12, padding: 20 }}>
              <Sec>Στοιχεία Πελάτη</Sec>
              <Field label="Ονοματεπώνυμο" value={client.full_name} onChange={set('full_name')} />
              <Field label="Όνομα Πατρός" value={client.father_name} onChange={set('father_name')} />
              <Field label="ΑΦΜ" value={client.tin_number} onChange={set('tin_number')} />
              <Field label="Αρ. Ταυτότητας / Διαβατηρίου" value={client.id_passport_number} onChange={set('id_passport_number')} />
              <Field label="Διεύθυνση" value={client.address} onChange={set('address')} />
              <Field label="Ελληνικός Τραπεζικός Λογαριασμός (IBAN)" value={client.bank_account} onChange={set('bank_account')} />

              <div style={{ marginTop: 8 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: C.muted, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: .4 }}>Φωτογραφία Ταυτότητας/Διαβατηρίου</label>
                {client.id_photo_url && <img src={client.id_photo_url} alt="ID" style={{ maxWidth: '100%', borderRadius: 8, marginBottom: 8, border: '1px solid ' + C.border }} />}
                <input type="file" accept="image/*,application/pdf" disabled={uploading}
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f) }} style={{ fontSize: 12 }} />
                {uploading && <span style={{ fontSize: 12, color: C.muted, marginLeft: 8 }}>Ανέβασμα...</span>}
              </div>

              <Sec>Στοιχεία Taxisnet</Sec>
              <p style={{ fontSize: 11, color: C.muted, margin: '0 0 12px' }}>Αποθηκεύονται κρυπτογραφημένα. Κάθε προβολή καταγράφεται.</p>
              {(['username', 'password', 'auth_key'] as const).map(f => {
                const has = f === 'username' ? client.has_taxisnet_username : f === 'password' ? client.has_taxisnet_password : client.has_taxisnet_auth_key
                const label = f === 'username' ? 'Όνομα Χρήστη Taxisnet' : f === 'password' ? 'Κωδικός Taxisnet' : 'Κλειδί Αυθεντικοποίησης'
                const key = `taxisnet_${f}`
                return (
                  <div key={f} style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: C.muted, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: .4 }}>
                      {label} {has && <span style={{ color: C.green }}>· καταχωρημένο</span>}
                    </label>
                    <input type="text" value={taxisnetEdits[key] ?? (revealed ? revealed[key] : '')}
                      placeholder={has ? '•••••••• (άφησέ το κενό για να μείνει ίδιο)' : 'Δεν έχει καταχωρηθεί'}
                      onChange={e => setTaxisnetEdits(t => ({ ...t, [key]: e.target.value }))}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid ' + C.border, fontSize: 13, background: '#FAFAFA', color: C.dark, boxSizing: 'border-box', outline: 'none' }} />
                  </div>
                )
              })}
              <button onClick={handleReveal} disabled={revealing} style={{ background: 'transparent', color: C.blue, border: '1px solid ' + C.blue, borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                {revealing ? 'Φόρτωση...' : revealed ? '✓ Εμφανίστηκαν' : '👁 Εμφάνιση καταχωρημένων στοιχείων'}
              </button>
            </div>

            <div>
              <div style={{ background: C.white, border: '1px solid ' + C.border, borderRadius: 12, padding: 20, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Sec>Μονάδες ({units.length})</Sec>
                  <button onClick={() => setShowNewUnit(s => !s)} style={{ background: C.red, color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', marginTop: -12 }}>+ Μονάδα</button>
                </div>

                {showNewUnit && (
                  <div style={{ padding: 14, background: C.subtle, borderRadius: 10, marginBottom: 14 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
                      <Field label="Project" value={newUnit.project} onChange={(v: string) => setNewUnit(u => ({ ...u, project: v }))} />
                      <Field label="Unit Name" value={newUnit.unit_name} onChange={(v: string) => setNewUnit(u => ({ ...u, unit_name: v }))} />
                      <Field label="Διεύθυνση" value={newUnit.address} onChange={(v: string) => setNewUnit(u => ({ ...u, address: v }))} />
                      <Field label="Όροφος" value={newUnit.floor} onChange={(v: string) => setNewUnit(u => ({ ...u, floor: v }))} />
                      <Field label="Τ.μ." type="number" value={newUnit.sqm} onChange={(v: string) => setNewUnit(u => ({ ...u, sqm: v ? Number(v) : null }))} />
                      <Field label="Αναμενόμενο Ενοίκιο" type="number" value={newUnit.expected_rent} onChange={(v: string) => setNewUnit(u => ({ ...u, expected_rent: v ? Number(v) : null }))} />
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                      <button onClick={handleCreateUnit} style={{ background: C.red, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Δημιουργία Μονάδας</button>
                      <button onClick={() => setShowNewUnit(false)} style={{ background: 'transparent', color: C.muted, border: '1px solid ' + C.border, borderRadius: 8, padding: '8px 16px', fontSize: 12, cursor: 'pointer' }}>Άκυρο</button>
                    </div>
                  </div>
                )}

                {units.length === 0 && !showNewUnit && <div style={{ padding: 16, textAlign: 'center', color: C.muted, fontSize: 13, background: C.subtle, borderRadius: 10 }}>Δεν υπάρχουν μονάδες ακόμα.</div>}

                {units.map(u => <UnitCard key={u.id} unit={u} onUpdate={p => handleUpdateUnit(u.id, p)} onDelete={() => handleDeleteUnit(u.id)} />)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Shell>
  )
}

function UnitCard({ unit, onUpdate, onDelete }: { unit: Unit; onUpdate: (p: Partial<Unit>) => void; onDelete: () => void }) {
  const [draft, setDraft] = useState(unit)
  useEffect(() => setDraft(unit), [unit])
  const dset = (k: keyof Unit) => (v: any) => setDraft(d => ({ ...d, [k]: v }))
  const dirty = JSON.stringify(draft) !== JSON.stringify(unit)

  return (
    <div style={{ border: '1px solid ' + C.border, borderRadius: 10, padding: 14, marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <strong style={{ fontSize: 13 }}>{unit.unit_name || unit.project || 'Μονάδα'}</strong>
        <div style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
          <a href={`/gpi/agreement/${unit.id}`} target="_blank" rel="noreferrer" style={{ color: C.blue, fontSize: 11, fontWeight: 600, textDecoration: 'none' }}>📄 Συμφωνητικό Αποκλειστικότητας</a>
          <button onClick={onDelete} style={{ background: 'transparent', border: 'none', color: C.muted, fontSize: 11, cursor: 'pointer' }}>Διαγραφή</button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
        <Field label="Project" value={draft.project} onChange={dset('project')} />
        <Field label="Unit Name" value={draft.unit_name} onChange={dset('unit_name')} />
        <Field label="Διεύθυνση" value={draft.address} onChange={dset('address')} />
        <Field label="Όροφος" value={draft.floor} onChange={dset('floor')} />
        <Field label="Τ.μ." type="number" value={draft.sqm} onChange={(v: string) => dset('sqm')(v ? Number(v) : null)} />
        <Field label="Αναμενόμενο Ενοίκιο" type="number" value={draft.expected_rent} onChange={(v: string) => dset('expected_rent')(v ? Number(v) : null)} />
        <Field label="Ημ/νία Αποκλειστικής Ανάθεσης" type="date" value={draft.exclusive_agreement_date} onChange={dset('exclusive_agreement_date')} />
        <Field label="Διάρκεια Αποκλειστικότητας (μήνες)" type="number" value={draft.exclusive_agreement_duration_months} onChange={(v: string) => dset('exclusive_agreement_duration_months')(v ? Number(v) : null)} />
        <Field label="Ad Link" value={draft.ad_link} onChange={dset('ad_link')} />
      </div>
      <Field label="Περιγραφή (για το συμφωνητικό)" value={draft.description} onChange={dset('description')} />
      <Field label="Σημειώσεις (για το συμφωνητικό)" value={draft.notices} onChange={dset('notices')} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 12 }}>
        <Check label="Brochure Sent" checked={draft.brochure_sent} onChange={dset('brochure_sent')} />
        <Check label="Exclusive Agreement Sent" checked={draft.exclusive_agreement_sent} onChange={dset('exclusive_agreement_sent')} />
        <Check label="Rented" checked={draft.rented} onChange={dset('rented')} />
        <Check label="Energy Certificate" checked={draft.energy_certificate} onChange={dset('energy_certificate')} />
        <Check label="Advertisement" checked={draft.advertisement} onChange={dset('advertisement')} />
        <Check label="Project Delivered" checked={draft.project_delivered} onChange={dset('project_delivered')} />
        <Check label="Keys Received" checked={draft.keys_received} onChange={dset('keys_received')} />
      </div>
      {dirty && (
        <button onClick={() => onUpdate(draft)} style={{ marginTop: 8, background: C.red, color: '#fff', border: 'none', borderRadius: 8, padding: '7px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
          Αποθήκευση Μονάδας
        </button>
      )}
    </div>
  )
}
