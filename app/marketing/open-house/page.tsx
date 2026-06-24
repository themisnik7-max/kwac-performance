'use client'
// ─────────────────────────────────────────────────────────
// app/marketing/open-house/page.tsx  (NEW FILE)
//
// Print-ready A4 Open House event brochure.
// Receives encoded event+property data via ?d= URL param.
// ─────────────────────────────────────────────────────────
import { useEffect, useState } from 'react'

interface OpenHouseData {
  title: string
  address: string
  area: string
  price: string
  sqm: string | number
  bedrooms: string | number
  bathrooms: string | number
  description: string
  eventDay: string
  eventMonthYear: string
  eventDateFull: string
  eventStart: string
  eventEnd: string
  highlights: string[]
}

function decode(raw: string | null): OpenHouseData | null {
  if (!raw) return null
  try {
    return JSON.parse(decodeURIComponent(atob(raw)))
  } catch {
    return null
  }
}

export default function OpenHousePage() {
  const [data, setData] = useState<OpenHouseData | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const d = decode(params.get('d'))
    setData(d)
    if (d) setTimeout(() => window.print(), 800)
  }, [])

  if (!data) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'sans-serif', color: '#888' }}>
        Φόρτωση μπροσούρας Open House...
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

      {/* Controls */}
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
        display: 'flex', flexDirection: 'column', overflow: 'hidden'
      }}>

        {/* ══ DARK HEADER ══ */}
        <div style={{ background: '#1A1A1A', padding: '20px 36px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <img src="https://www.kwac.gr/images/logow.png" alt="KW Athens Center" style={{ height: 34 }} />
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,.5)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 5 }}>Σας προσκαλούμε σε</div>
            <div style={{ background: '#CC2229', padding: '8px 18px', display: 'inline-block' }}>
              <span style={{ fontSize: 20, fontWeight: 900, color: '#fff', letterSpacing: 3, textTransform: 'uppercase' }}>Open House</span>
            </div>
          </div>
        </div>

        {/* RED LINE */}
        <div style={{ height: 4, background: '#CC2229', flexShrink: 0 }} />

        {/* ══ BIG DATE HERO ══ */}
        <div style={{
          background: '#1A1A1A', flex: '0 0 280px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          position: 'relative'
        }}>
          {/* Background pattern */}
          <div style={{
            position: 'absolute', inset: 0, opacity: 0.04,
            backgroundImage: 'repeating-linear-gradient(45deg, #CC2229 0, #CC2229 1px, transparent 0, transparent 50%)',
            backgroundSize: '20px 20px'
          }} />

          <div style={{ position: 'relative', textAlign: 'center' }}>
            <div style={{ fontSize: 100, fontWeight: 900, color: '#FFFFFF', lineHeight: 1, textShadow: '0 4px 24px rgba(0,0,0,0.5)' }}>
              {data.eventDay}
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'rgba(255,255,255,0.7)', letterSpacing: 4, textTransform: 'uppercase', marginTop: -4 }}>
              {data.eventMonthYear}
            </div>
            <div style={{ width: 60, height: 2, background: '#CC2229', margin: '16px auto' }} />
            <div style={{ fontSize: 26, fontWeight: 700, color: '#FFFFFF' }}>
              {data.eventStart} — {data.eventEnd}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.5)', letterSpacing: 2, textTransform: 'uppercase', marginTop: 6 }}>
              Ώρες επίσκεψης
            </div>
          </div>
        </div>

        {/* ══ PROPERTY TITLE ══ */}
        <div style={{ background: '#222', padding: '18px 36px', flexShrink: 0 }}>
          <div style={{ fontSize: 11, color: '#CC2229', fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 5 }}>{data.area}</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{data.title}</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.5)' }}>📍 {data.address}</div>
        </div>

        {/* ══ STATS ══ */}
        <div style={{ display: 'flex', background: '#111', flexShrink: 0 }}>
          {[
            { v: data.sqm, l: 'τ.μ.' },
            { v: data.bedrooms, l: 'Υπνοδωμ.' },
            { v: data.bathrooms, l: 'Μπάνια' },
            { v: data.price, l: 'Τιμή', red: true },
          ].map((s, i) => (
            <div key={i} style={{
              flex: 1, textAlign: 'center', padding: '14px 8px',
              borderRight: i < 3 ? '1px solid #2A2A2A' : 'none'
            }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: s.red ? '#CC2229' : '#fff', lineHeight: 1 }}>{s.v || '—'}</div>
              <div style={{ fontSize: 9, color: '#666', letterSpacing: 1, textTransform: 'uppercase', marginTop: 3 }}>{s.l}</div>
            </div>
          ))}
        </div>

        {/* ══ BODY ══ */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* LEFT */}
          <div style={{ flex: 1, padding: '24px 24px 20px 36px', borderRight: '1px solid #EEE', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#CC2229', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>Περιγραφή</div>
            <div style={{ fontSize: 13, color: '#444', lineHeight: 1.75, flex: 1 }}>{data.description || ''}</div>

            {/* Highlights */}
            {data.highlights && data.highlights.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#CC2229', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>Highlights</div>
                {data.highlights.map((h, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid #F0F0F0' }}>
                    <div style={{ width: 8, height: 8, background: '#CC2229', borderRadius: '50%', flexShrink: 0 }} />
                    <div style={{ fontSize: 13, color: '#333' }}>{h}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT */}
          <div style={{ flexBasis: 210, padding: '24px 24px 20px 20px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#CC2229', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>Πληροφορίες</div>

            {[
              { l: '📅 Ημερομηνία', v: data.eventDateFull },
              { l: '🕙 Ώρες', v: `${data.eventStart} — ${data.eventEnd}` },
              { l: '📍 Τοποθεσία', v: data.address },
            ].map((item, i) => (
              <div key={i} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 9, color: '#CC2229', fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 3 }}>{item.l}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A', lineHeight: 1.4 }}>{item.v}</div>
              </div>
            ))}

            <div style={{ height: 1, background: '#EEE', margin: '10px 0 16px' }} />

            <div style={{ fontSize: 10, fontWeight: 700, color: '#CC2229', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>KW Athens Center</div>
            <div style={{ fontSize: 12, color: '#555', lineHeight: 1.9 }}>
              <div>📞 (+30) 211 0131911</div>
              <div>✉️ kwathenscenter@kwgreece.gr</div>
              <div>🌐 kwac.gr</div>
            </div>

            {/* RSVP box */}
            <div style={{ marginTop: 'auto', background: '#1A1A1A', padding: '14px', textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,.4)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>Δήλωση συμμετοχής</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#CC2229', marginBottom: 3 }}>(+30) 211 0131911</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,.35)' }}>Περιορισμένες θέσεις</div>
            </div>
          </div>
        </div>

        {/* ══ FOOTER ══ */}
        <div style={{
          background: '#1A1A1A', padding: '0 36px', height: 40,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0
        }}>
          <div style={{ fontSize: 10, color: '#555' }}>Λεωφ. Βασιλίσσης Σοφίας 10, Αθήνα 106 74 · (+30) 211 0131911 · kwac.gr</div>
          <div style={{ fontSize: 10, color: '#CC2229', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>KW Athens Center</div>
        </div>

      </div>
    </>
  )
}
