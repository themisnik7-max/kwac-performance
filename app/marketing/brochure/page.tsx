'use client'
// ─────────────────────────────────────────────────────────
// app/marketing/brochure/page.tsx  (NEW FILE)
//
// Print-ready A4 property brochure.
// Receives encoded property data via ?d= URL param.
// Usage (from MarketingKitPanel):
//   window.open(`/marketing/brochure?d=${encodeData(prop)}`, '_blank')
// ─────────────────────────────────────────────────────────
import { useEffect, useState } from 'react'

interface BrochureData {
  title: string
  address: string
  area: string
  price: string
  sqm: string | number
  bedrooms: string | number
  bathrooms: string | number
  floor: string | number
  year: string | number
  condition: string
  heating: string
  description: string
  code: string
  type: string
}

function decode(raw: string | null): BrochureData | null {
  if (!raw) return null
  try {
    return JSON.parse(decodeURIComponent(atob(raw)))
  } catch {
    return null
  }
}

export default function BrochurePage() {
  const [data, setData] = useState<BrochureData | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const d = decode(params.get('d'))
    setData(d)
    // Auto-open print dialog after render
    if (d) setTimeout(() => window.print(), 800)
  }, [])

  if (!data) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'sans-serif', color: '#888' }}>
        Φόρτωση μπροσούρας...
      </div>
    )
  }

  return (
    <>
      <style>{`
        @page { size: A4 portrait; margin: 0; }
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #F0F0F0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; }
      `}</style>

      {/* Print button — hidden on print */}
      <div className="no-print" style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 999,
        display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end'
      }}>
        <button onClick={() => window.print()} style={{
          background: '#CC2229', color: '#fff', border: 'none', padding: '12px 24px',
          fontSize: 13, fontWeight: 700, cursor: 'pointer', borderRadius: 4,
          boxShadow: '0 4px 16px rgba(204,34,41,0.35)', letterSpacing: 1
        }}>🖨 Εκτύπωση / PDF</button>
        <button onClick={() => window.close()} style={{
          background: '#fff', color: '#444', border: '1px solid #ddd', padding: '8px 16px',
          fontSize: 12, cursor: 'pointer', borderRadius: 4
        }}>✕ Κλείσιμο</button>
      </div>

      {/* A4 Page */}
      <div style={{
        width: 794, height: 1123, background: '#FFFFFF',
        margin: '0 auto', boxShadow: '0 8px 40px rgba(0,0,0,.18)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        position: 'relative'
      }}>

        {/* ══ HEADER ══ */}
        <div style={{ background: '#1A1A1A', padding: '18px 36px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <img src="https://www.kwac.gr/images/logow.png" alt="KW Athens Center" style={{ height: 36 }} />
          <div style={{ background: '#CC2229', padding: '7px 16px', fontSize: 10, fontWeight: 700, color: '#fff', letterSpacing: 1.5, textTransform: 'uppercase' }}>
            Αποκλειστική Εκπροσώπηση
          </div>
        </div>

        {/* RED LINE */}
        <div style={{ height: 4, background: '#CC2229', flexShrink: 0 }} />

        {/* ══ TITLE BLOCK ══ */}
        <div style={{ background: '#1A1A1A', padding: '32px 36px 28px', flexShrink: 0 }}>
          <div style={{ fontSize: 11, color: '#CC2229', fontWeight: 700, letterSpacing: 2.5, textTransform: 'uppercase', marginBottom: 8 }}>
            {data.area}
          </div>
          <div style={{ fontSize: 30, fontWeight: 700, color: '#FFFFFF', lineHeight: 1.2, marginBottom: 8 }}>
            {data.title}
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>📍 {data.address}</div>
        </div>

        {/* ══ STATS BAR ══ */}
        <div style={{ background: '#111111', display: 'flex', flexShrink: 0 }}>
          {[
            { v: data.sqm, l: 'τ.μ.' },
            { v: data.bedrooms, l: 'Υπνοδωμ.' },
            { v: data.bathrooms, l: 'Μπάνια' },
            { v: data.floor ? `${data.floor}ος` : '—', l: 'Όροφος' },
            { v: data.year || '—', l: 'Κατ/ή' },
          ].map((s, i) => (
            <div key={i} style={{
              flex: 1, textAlign: 'center', padding: '16px 8px',
              borderRight: i < 4 ? '1px solid #2A2A2A' : 'none'
            }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#fff', lineHeight: 1 }}>{s.v || '—'}</div>
              <div style={{ fontSize: 9, color: '#666', letterSpacing: 1, textTransform: 'uppercase', marginTop: 4 }}>{s.l}</div>
            </div>
          ))}
          <div style={{ flex: '0 0 140px', textAlign: 'center', padding: '16px 8px' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#CC2229', lineHeight: 1 }}>{data.price}</div>
            <div style={{ fontSize: 9, color: '#666', letterSpacing: 1, textTransform: 'uppercase', marginTop: 4 }}>Τιμή Πώλησης</div>
          </div>
        </div>

        {/* ══ BODY ══ */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* LEFT: Description */}
          <div style={{ flex: 1, padding: '28px 24px 24px 36px', borderRight: '1px solid #EEEEEE', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#CC2229', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>Περιγραφή</div>
            <div style={{ fontSize: 13.5, color: '#444', lineHeight: 1.75, flex: 1 }}>{data.description || 'Επικοινωνήστε για περισσότερες πληροφορίες.'}</div>

            {/* Feature pills */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 20 }}>
              {[
                { l: 'Κατηγορία', v: data.type },
                { l: 'Κατάσταση', v: data.condition },
                { l: 'Θέρμανση', v: data.heating || '—' },
                { l: 'Κωδικός', v: data.code || '—' },
              ].map((f, i) => (
                <div key={i} style={{ background: '#F8F8F8', borderLeft: '3px solid #CC2229', padding: '10px 12px' }}>
                  <div style={{ fontSize: 9, color: '#999', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 }}>{f.l}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A' }}>{f.v || '—'}</div>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT: Contact + QR */}
          <div style={{ flexBasis: 220, padding: '28px 28px 24px 20px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#CC2229', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 }}>Σύμβουλος Ακινήτων</div>

            <div style={{ fontSize: 16, fontWeight: 700, color: '#1A1A1A', marginBottom: 3 }}>KW Athens Center</div>
            <div style={{ fontSize: 10, color: '#CC2229', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 }}>Real Estate Professionals</div>
            <div style={{ fontSize: 12, color: '#555', lineHeight: 2 }}>
              <div>📞 (+30) 211 0131911</div>
              <div>✉️ kwathenscenter@kwgreece.gr</div>
              <div>🌐 kwac.gr</div>
            </div>

            <div style={{ height: 1, background: '#EEEEEE', margin: '20px 0' }} />

            {/* QR placeholder */}
            {data.code && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 'auto' }}>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=72x72&data=https://kwac.gr/results?q=${data.code}`}
                  alt="QR" width={72} height={72}
                  style={{ display: 'block', border: '1px solid #EEE' }}
                />
                <div>
                  <div style={{ fontSize: 10, color: '#888', lineHeight: 1.6 }}>Σαρώστε για<br />online προβολή</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#1A1A1A', marginTop: 4 }}>Κωδ: {data.code}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ══ FOOTER ══ */}
        <div style={{
          background: '#1A1A1A', padding: '0 36px', height: 44,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0
        }}>
          <div style={{ fontSize: 10, color: '#555' }}>Λεωφ. Βασιλίσσης Σοφίας 10, Αθήνα 106 74 · (+30) 211 0131911 · kwac.gr</div>
          <div style={{ fontSize: 10, color: '#CC2229', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>KW Athens Center</div>
        </div>

      </div>
    </>
  )
}
