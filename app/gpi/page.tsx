'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Shell from '@/components/Shell'
import LockedFeature from '@/components/LockedFeature'
import { authedFetch } from '@/lib/authedFetch'
import { useApp } from '@/lib/AppContext'

const C = { red: '#CC2229', dark: '#1A1A1A', muted: '#6B7280', border: '#EBEBEB', subtle: '#F7F7F7', white: '#FFFFFF', green: '#16A34A' }

type GpiClientListItem = {
  id: string
  full_name: string
  tin_number: string | null
  address: string | null
  agent_id: string | null
  has_id_photo: boolean
  has_taxisnet_username: boolean
  created_at: string
}

function Field({ label, value, onChange, type = 'text' }: any) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: C.muted, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: .4 }}>{label}</label>
      <input type={type} value={value ?? ''} onChange={e => onChange(e.target.value)}
        style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid ' + C.border, fontSize: 13, background: '#FAFAFA', color: C.dark, boxSizing: 'border-box', outline: 'none' }} />
    </div>
  )
}

export default function GpiListPage() {
  const router = useRouter()
  const { role, agent, loading: appLoading } = useApp()
  const hasAccess = role === 'ceo' || agent?.gpi_access === true
  const [clients, setClients] = useState<GpiClientListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)

  async function load() {
    setLoading(true)
    const res = await authedFetch('/api/gpi/clients')
    const data = await res.json()
    if (!res.ok) { setErr(data.error || 'Σφάλμα φόρτωσης'); setLoading(false); return }
    setClients(data.clients || [])
    setLoading(false)
  }

  // Wait for the real access flag before deciding — avoids a flash of the
  // locked state while useApp() is still resolving the agent row. The real
  // boundary is server-side (hasGpiFeatureAccess in every /api/gpi/** route)
  // — this is purely to skip a pointless 403 round trip and show a clean
  // message instead of a raw error banner.
  useEffect(() => { if (!appLoading && hasAccess) load() }, [appLoading, hasAccess])

  // appLoading must gate first: while useApp() is still resolving the
  // agent row, hasAccess is only provisionally false, and falling through
  // to the real page below (rather than a neutral loading state) would
  // flash the full GPI UI — including the client-creation form — before
  // access is actually known. The real boundary stays server-side
  // (hasGpiFeatureAccess in every /api/gpi/** route) either way.
  if (appLoading) return <Shell><div style={{ padding: '3rem', textAlign: 'center', color: C.muted, fontSize: 13 }}>Φόρτωση...</div></Shell>
  if (!hasAccess) {
    return <Shell><LockedFeature title="Το GPI είναι κλειδωμένο" message="Αυτό το feature είναι διαθέσιμο μόνο στον ορισμένο λογαριασμό GPI της υπηρεσίας, ή σε CEO/Admin." /></Shell>
  }

  async function createClient() {
    if (!newName.trim()) return
    setCreating(true)
    const res = await authedFetch('/api/gpi/clients', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ full_name: newName.trim() }) })
    const data = await res.json()
    setCreating(false)
    if (!res.ok) { setErr(data.error || 'Σφάλμα δημιουργίας'); return }
    router.push(`/gpi/${data.client.id}`)
  }

  return (
    <Shell>
      <div style={{ fontFamily: "-apple-system,BlinkMacSystemFont,'Inter',sans-serif", color: C.dark }}>
        <div style={{ background: C.dark, padding: '16px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: 15, fontWeight: 700, color: '#fff', margin: 0 }}>GPI</h1>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', margin: '3px 0 0' }}>
              {role === 'ceo' ? `${clients.length} πελάτ${clients.length === 1 ? 'ης' : 'ες'} — όλο το γραφείο` : `${clients.length} δικ${clients.length === 1 ? 'ός σου πελάτης' : 'οί σου πελάτες'}`}
            </p>
          </div>
          <button onClick={() => setShowNew(true)} style={{ background: C.red, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 22px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            + Νέος Πελάτης
          </button>
        </div>

        <div style={{ padding: '24px 28px', background: '#F4F4F4', minHeight: 'calc(100vh - 68px)' }}>
          {err && <div style={{ marginBottom: 16, padding: '10px 14px', background: '#FEE2E2', color: '#B91C1C', borderRadius: 8, fontSize: 13 }}>{err}</div>}

          {showNew && (
            <div style={{ background: C.white, border: '1px solid ' + C.border, borderRadius: 12, padding: 20, marginBottom: 20, maxWidth: 420 }}>
              <Field label="Ονοματεπώνυμο Πελάτη" value={newName} onChange={setNewName} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={createClient} disabled={creating || !newName.trim()} style={{ background: C.red, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: creating || !newName.trim() ? .6 : 1 }}>
                  {creating ? 'Δημιουργία...' : 'Δημιουργία'}
                </button>
                <button onClick={() => { setShowNew(false); setNewName('') }} style={{ background: 'transparent', color: C.muted, border: '1px solid ' + C.border, borderRadius: 8, padding: '9px 18px', fontSize: 13, cursor: 'pointer' }}>
                  Άκυρο
                </button>
              </div>
            </div>
          )}

          {loading && <div style={{ color: C.muted, fontSize: 13 }}>Φόρτωση...</div>}

          {!loading && clients.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: C.muted, fontSize: 13, background: C.subtle, borderRadius: 12 }}>Δεν υπάρχουν πελάτες GPI ακόμα.</div>
          )}

          <div style={{ display: 'grid', gap: 10 }}>
            {clients.map(c => (
              <a key={c.id} href={`/gpi/${c.id}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', background: C.white, border: '1px solid ' + C.border, borderRadius: 10, textDecoration: 'none', color: C.dark }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{c.full_name}</div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                    {c.tin_number && `ΑΦΜ ${c.tin_number}`}{c.tin_number && c.address ? ' · ' : ''}{c.address}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, fontSize: 11, color: C.muted }}>
                  {c.has_id_photo && <span style={{ padding: '3px 8px', background: C.subtle, borderRadius: 100 }}>📷 ID</span>}
                  {c.has_taxisnet_username && <span style={{ padding: '3px 8px', background: C.subtle, borderRadius: 100 }}>🔐 Taxisnet</span>}
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>
    </Shell>
  )
}
