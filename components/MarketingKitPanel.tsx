'use client'
// ─────────────────────────────────────────────────────────
// MarketingKitPanel.tsx
// Target: components/MarketingKitPanel.tsx
//
// Drop into the 'marketing' phase of app/properties/[id]/page.tsx.
// Provides 4 one-click actions per property:
//   1. Newsletter  → Brevo campaign draft via /api/marketing/send-email
//   2. LinkedIn    → caption generator + copy modal (client-side)
//   3. Brochure A4 → opens /marketing/brochure?d=... in new tab
//   4. Open House  → date picker modal → /marketing/open-house?d=... in new tab
// ─────────────────────────────────────────────────────────
import { useState } from 'react'
import { authedFetch } from '@/lib/authedFetch'

const C = {
  red: '#CC2229', dark: '#1A1A1A', muted: '#6B7280',
  border: '#EBEBEB', subtle: '#F7F7F7', white: '#FFFFFF',
  green: '#16A34A', greenLight: '#F0FDF4',
}

// ── Types ────────────────────────────────────────────────
interface PropData {
  id?: string
  address?: string
  area?: string
  city?: string
  property_type?: string
  deal_type?: string
  sqm?: string | number
  floor?: string | number
  bedrooms?: string | number
  bathrooms?: string | number
  year_built?: string | number
  condition?: string
  heating?: string
  description?: string
  price_asking?: string | number
  ilist_code?: string
}

interface AgentData {
  id: string
  email?: string
}

interface Props {
  prop: PropData
  user: AgentData
}

// ── Encode prop data for URL (brochure pages) ─────────────
function encodeData(data: object): string {
  return btoa(encodeURIComponent(JSON.stringify(data)))
}

// ── LinkedIn caption generator ────────────────────────────
function buildLinkedInCaption(prop: PropData): string {
  const price = prop.price_asking
    ? `€${Number(prop.price_asking).toLocaleString('el-GR')}`
    : 'Τιμή κατόπιν επικοινωνίας'
  const title = `${prop.property_type || 'Ακίνητο'} στο ${prop.area || ''}`
  const url = prop.ilist_code
    ? `https://kwac.gr/results?q=${prop.ilist_code}`
    : 'https://kwac.gr/results'
  const neighborhood = (prop.area || '').replace(/\s+/g, '')

  return `🏠 Νέα Αποκλειστική Καταχώρηση — ${prop.area || ''}

${title}
📍 ${prop.address}, ${prop.city || 'Αθήνα'}

${prop.description ? prop.description.slice(0, 200) + (prop.description.length > 200 ? '...' : '') : 'Επικοινωνήστε για περισσότερες πληροφορίες.'}

📐 ${prop.sqm || '—'} τ.μ.  ·  🛏 ${prop.bedrooms || '—'} υπνοδωμάτια  ·  🚿 ${prop.bathrooms || '—'} μπάνια
💰 ${price}

Αν ψάχνετε για κατοικία στην περιοχή ή γνωρίζετε κάποιον που ψάχνει, επικοινωνήστε μαζί μου.

👇 Λεπτομέρειες:
${url}

#RealEstate #${neighborhood} #KWAthensCenter #KellerWilliams #AthensProperty #Ακίνητα`
}

// ── Sub-components ────────────────────────────────────────
function ActionCard({
  icon, title, desc, btnLabel, btnColor = C.red,
  loading, done, doneLabel = '✓ Έτοιμο', onClick, extra
}: {
  icon: string; title: string; desc: string; btnLabel: string
  btnColor?: string; loading?: boolean; done?: boolean; doneLabel?: string
  onClick: () => void; extra?: React.ReactNode
}) {
  return (
    <div style={{
      background: C.white, borderRadius: 12, border: `1px solid ${C.border}`,
      padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 10
    }}>
      <div style={{ fontSize: 28 }}>{icon}</div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.dark, marginBottom: 3 }}>{title}</div>
        <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>{desc}</div>
      </div>
      {extra}
      <button
        onClick={onClick}
        disabled={loading || done}
        style={{
          marginTop: 'auto', padding: '9px 0', borderRadius: 8, border: 'none',
          background: done ? C.green : btnColor,
          color: '#fff', fontSize: 12, fontWeight: 700, cursor: loading || done ? 'default' : 'pointer',
          opacity: loading ? 0.7 : 1, transition: 'background .2s',
        }}
      >
        {loading ? '⏳ Φόρτωση...' : done ? doneLabel : btnLabel}
      </button>
    </div>
  )
}

// ── Modal shell ────────────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
      zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, width: 520, maxHeight: '90vh',
        overflow: 'auto', boxShadow: '0 24px 80px rgba(0,0,0,0.25)'
      }}>
        <div style={{
          padding: '18px 24px', borderBottom: `1px solid ${C.border}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.dark }}>{title}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: C.muted }}>×</button>
        </div>
        <div style={{ padding: '20px 24px' }}>{children}</div>
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────
export default function MarketingKitPanel({ prop, user }: Props) {
  // Newsletter state
  const [nlLoading, setNlLoading] = useState(false)
  const [nlDone, setNlDone] = useState(false)
  const [nlResult, setNlResult] = useState<{ url?: string; error?: string } | null>(null)

  // LinkedIn state
  const [liModal, setLiModal] = useState(false)
  const [liCopied, setLiCopied] = useState(false)

  // Open House modal state
  const [ohModal, setOhModal] = useState(false)
  const [ohDate, setOhDate] = useState('')
  const [ohStart, setOhStart] = useState('11:00')
  const [ohEnd, setOhEnd] = useState('14:00')
  const [ohH1, setOhH1] = useState('')
  const [ohH2, setOhH2] = useState('')
  const [ohH3, setOhH3] = useState('')
  const [ohH4, setOhH4] = useState('')

  // ── Newsletter ─────────────────────────────────────────
  async function handleNewsletter() {
    setNlLoading(true)
    setNlResult(null)
    try {
      const res = await authedFetch('/api/marketing/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prop, agent_id: user.id }),
      })
      const json = await res.json()
      if (!res.ok) {
        setNlResult({ error: json.error || 'Σφάλμα' })
      } else {
        setNlDone(true)
        setNlResult({ url: json.campaign_url })
      }
    } catch {
      setNlResult({ error: 'Network error' })
    } finally {
      setNlLoading(false)
    }
  }

  // ── LinkedIn caption copy ──────────────────────────────
  async function handleLiCopy() {
    const caption = buildLinkedInCaption(prop)
    await navigator.clipboard.writeText(caption)
    setLiCopied(true)
    setTimeout(() => setLiCopied(false), 3000)
  }

  // ── Brochure (A4 print) ────────────────────────────────
  function handleBrochure() {
    const d = encodeData({
      title: `${prop.property_type || 'Ακίνητο'} στο ${prop.area || ''}`,
      address: `${prop.address || ''}, ${prop.city || 'Αθήνα'}`,
      area: prop.area || '',
      price: prop.price_asking ? `€${Number(prop.price_asking).toLocaleString('el-GR')}` : '—',
      sqm: prop.sqm || '—',
      bedrooms: prop.bedrooms || '—',
      bathrooms: prop.bathrooms || '—',
      floor: prop.floor || '—',
      year: prop.year_built || '—',
      condition: prop.condition || '—',
      heating: prop.heating || '—',
      description: prop.description || '',
      code: prop.ilist_code || '',
      type: prop.property_type || '',
    })
    window.open(`/marketing/brochure?d=${d}`, '_blank')
  }

  // ── Open House brochure ───────────────────────────────
  function handleOpenHouse() {
    if (!ohDate) return
    const dateObj = new Date(ohDate)
    const day = dateObj.getDate().toString()
    const monthNames = ['ΙΑΝΟΥΑΡΙΟΥ','ΦΕΒΡΟΥΑΡΙΟΥ','ΜΑΡΤΙΟΥ','ΑΠΡΙΛΙΟΥ','ΜΑΪΟΥ','ΙΟΥΝΙΟΥ','ΙΟΥΛΙΟΥ','ΑΥΓΟΥΣΤΟΥ','ΣΕΠΤΕΜΒΡΙΟΥ','ΟΚΤΩΒΡΙΟΥ','ΝΟΕΜΒΡΙΟΥ','ΔΕΚΕΜΒΡΙΟΥ']
    const dayNames = ['Κυριακή','Δευτέρα','Τρίτη','Τετάρτη','Πέμπτη','Παρασκευή','Σάββατο']
    const monthYear = `${monthNames[dateObj.getMonth()]} ${dateObj.getFullYear()}`
    const dateFull = `${dayNames[dateObj.getDay()]}, ${day} ${monthNames[dateObj.getMonth()]} ${dateObj.getFullYear()}`

    const d = encodeData({
      title: `${prop.property_type || 'Ακίνητο'} στο ${prop.area || ''}`,
      address: `${prop.address || ''}, ${prop.city || 'Αθήνα'}`,
      area: prop.area || '',
      price: prop.price_asking ? `€${Number(prop.price_asking).toLocaleString('el-GR')}` : '—',
      sqm: prop.sqm || '—',
      bedrooms: prop.bedrooms || '—',
      bathrooms: prop.bathrooms || '—',
      description: prop.description || '',
      eventDay: day,
      eventMonthYear: monthYear,
      eventDateFull: dateFull,
      eventStart: ohStart,
      eventEnd: ohEnd,
      highlights: [ohH1, ohH2, ohH3, ohH4].filter(Boolean),
    })
    window.open(`/marketing/open-house?d=${d}`, '_blank')
    setOhModal(false)

    // Also schedules the event + posts it to the Board's Ανακοινώσεις tab
    // with a 2-slot volunteer signup — fire-and-forget, the brochure itself
    // already opened and shouldn't wait on this.
    authedFetch('/api/marketing/open-house-announce', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address: prop.address || prop.area || 'Ακίνητο', area: prop.area || null,
        ilist_code: prop.ilist_code || null, property_type: prop.property_type || null,
        sqm: prop.sqm || null, price: prop.price_asking || null,
        date: ohDate, start_time: ohStart, end_time: ohEnd,
      }),
    }).catch(() => {})
  }

  return (
    <>
      {/* ── Panel ── */}
      <div style={{
        background: 'linear-gradient(135deg, #1A1A1A 0%, #2A2A2A 100%)',
        borderRadius: 14, padding: '20px 24px', marginBottom: 24,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{
            background: C.red, borderRadius: 8, padding: '4px 10px',
            fontSize: 10, fontWeight: 700, color: '#fff', letterSpacing: 1.2, textTransform: 'uppercase'
          }}>Marketing Kit</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>
            1-click actions για αυτό το ακίνητο
          </div>
        </div>

        {/* 4 Cards grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>

          {/* 1. Newsletter */}
          <ActionCard
            icon="📧"
            title="Newsletter"
            desc="Brevo campaign draft στο πελατολόγιό σου"
            btnLabel="Δημιούργησε Draft"
            loading={nlLoading}
            done={nlDone}
            doneLabel="✓ Draft στο Brevo"
            onClick={handleNewsletter}
            extra={
              nlResult && (
                <div style={{
                  fontSize: 11, padding: '7px 10px', borderRadius: 6,
                  background: nlResult.error ? '#FEE2E2' : C.greenLight,
                  color: nlResult.error ? '#B91C1C' : C.green,
                }}>
                  {nlResult.error ? `⚠ ${nlResult.error}` : (
                    <>✓ {' '}
                      {nlResult.url
                        ? <a href={nlResult.url} target="_blank" rel="noreferrer" style={{ color: C.green }}>Άνοιγμα στο Brevo →</a>
                        : 'Draft δημιουργήθηκε'
                      }
                    </>
                  )}
                </div>
              )
            }
          />

          {/* 2. LinkedIn */}
          <ActionCard
            icon="💼"
            title="LinkedIn"
            desc="Έτοιμο caption + visual για post"
            btnLabel="Δημιούργησε Post"
            btnColor="#0A66C2"
            onClick={() => setLiModal(true)}
          />

          {/* 3. Brochure A4 */}
          <ActionCard
            icon="🖨️"
            title="Μπροσούρα Α4"
            desc="Print-ready brochure για εκτύπωση"
            btnLabel="Άνοιγμα & Εκτύπωση"
            btnColor="#6D28D9"
            onClick={handleBrochure}
          />

          {/* 4. Open House */}
          <ActionCard
            icon="🏡"
            title="Open House"
            desc="Μπροσούρα εκδήλωσης με ημερομηνία"
            btnLabel="Ρύθμιση & Εκτύπωση"
            btnColor="#D97706"
            onClick={() => setOhModal(true)}
          />

        </div>
      </div>

      {/* ── LinkedIn Modal ── */}
      {liModal && (
        <Modal title="LinkedIn Post" onClose={() => setLiModal(false)}>
          <p style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>
            Αντέγραψε το caption, κατέβασε το visual, και ανέβασέ τα στο LinkedIn.
          </p>

          {/* Caption box */}
          <div style={{
            background: C.subtle, border: `1px solid ${C.border}`, borderRadius: 8,
            padding: '12px 14px', fontSize: 12, color: C.dark, lineHeight: 1.8,
            whiteSpace: 'pre-wrap', maxHeight: 260, overflowY: 'auto', marginBottom: 14, fontFamily: 'monospace'
          }}>
            {buildLinkedInCaption(prop)}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={handleLiCopy} style={{
              flex: 1, padding: '10px', borderRadius: 8, border: 'none',
              background: liCopied ? C.green : C.dark, color: '#fff',
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}>
              {liCopied ? '✓ Αντιγράφηκε!' : '📋 Αντιγραφή Caption'}
            </button>
            <a
              href="https://www.linkedin.com/feed/"
              target="_blank" rel="noreferrer"
              style={{
                flex: 1, padding: '10px', borderRadius: 8, border: 'none',
                background: '#0A66C2', color: '#fff',
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
                textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
            >
              Άνοιγμα LinkedIn →
            </a>
          </div>
          <p style={{ fontSize: 10, color: C.muted, marginTop: 10, textAlign: 'center' }}>
            Tip: Αντέγραψε πρώτα το caption, μετά ανέβασε την εικόνα από το LinkedIn visual template.
          </p>
        </Modal>
      )}

      {/* ── Open House Modal ── */}
      {ohModal && (
        <Modal title="🏡 Open House — Στοιχεία Εκδήλωσης" onClose={() => setOhModal(false)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: C.muted, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: .4 }}>Ημερομηνία*</label>
              <input type="date" value={ohDate} onChange={e => setOhDate(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13 }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: C.muted, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: .4 }}>Ώρα Έναρξης</label>
              <input type="time" value={ohStart} onChange={e => setOhStart(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13 }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: C.muted, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: .4 }}>Ώρα Λήξης</label>
              <input type="time" value={ohEnd} onChange={e => setOhEnd(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13 }} />
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: .4 }}>Highlights ακινήτου (έως 4)</div>
            {[
              [ohH1, setOhH1, 'π.χ. Αυτόνομη θέρμανση'],
              [ohH2, setOhH2, 'π.χ. Θέση parking'],
              [ohH3, setOhH3, 'π.χ. Εκτεταμένη θέα'],
              [ohH4, setOhH4, 'π.χ. Ανακαινισμένο 2023'],
            ].map(([val, setVal, ph], i) => (
              <input key={i} type="text" value={val as string}
                onChange={e => (setVal as (v: string) => void)(e.target.value)}
                placeholder={ph as string}
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: 8,
                  border: `1px solid ${C.border}`, fontSize: 12, marginBottom: 7, boxSizing: 'border-box' as const
                }}
              />
            ))}
          </div>

          <button
            onClick={handleOpenHouse}
            disabled={!ohDate}
            style={{
              width: '100%', padding: '12px', borderRadius: 8, border: 'none',
              background: ohDate ? '#D97706' : '#E5E7EB', color: ohDate ? '#fff' : C.muted,
              fontSize: 14, fontWeight: 700, cursor: ohDate ? 'pointer' : 'not-allowed',
            }}
          >
            🖨️ Δημιούργησε & Εκτύπωσε Μπροσούρα
          </button>
        </Modal>
      )}
    </>
  )
}
