'use client'
import { useState, useEffect } from 'react'
import Shell from '@/components/Shell'
import { authedFetch } from '@/lib/authedFetch'
import GpiAgreementDocument, { type GpiAgreementData } from '@/components/GpiAgreementDocument'

const C = { red: '#CC2229', dark: '#1A1A1A', muted: '#6B7280', border: '#EBEBEB', green: '#16A34A' }

export default function GpiAgreementPreviewPage({ params }: { params: { unitId: string } }) {
  const [data, setData] = useState<GpiAgreementData | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [showSend, setShowSend] = useState(false)
  const [email, setEmail] = useState('')
  const [preview, setPreview] = useState<{ to: string; subject: string } | null>(null)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState<{ view_url: string; warning?: string } | null>(null)

  useEffect(() => {
    authedFetch(`/api/gpi/units/${params.unitId}/agreement`).then(async res => {
      const json = await res.json()
      if (!res.ok) { setErr(json.error || 'Σφάλμα'); return }
      setData(json.data)
    })
  }, [params.unitId])

  async function handlePreviewSend() {
    if (!email.trim()) return
    setSending(true); setErr(null)
    const res = await authedFetch(`/api/gpi/units/${params.unitId}/agreement/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.trim() }) })
    const json = await res.json()
    setSending(false)
    if (!res.ok) { setErr(json.error || 'Σφάλμα'); return }
    setPreview({ to: json.to, subject: json.subject })
  }

  async function handleConfirmSend() {
    setSending(true); setErr(null)
    const res = await authedFetch(`/api/gpi/units/${params.unitId}/agreement/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.trim(), confirm: true }) })
    const json = await res.json()
    setSending(false)
    if (!res.ok) { setErr(json.error || 'Σφάλμα'); return }
    setSent(json)
    setPreview(null)
  }

  return (
    <Shell>
      <div className="no-print" style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 999, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
        {sent ? (
          <div style={{ background: C.green, color: '#fff', padding: '12px 18px', borderRadius: 8, fontSize: 12, maxWidth: 260 }}>
            ✓ Στάλθηκε στο {email}. {sent.warning && <div style={{ marginTop: 4, opacity: .85 }}>{sent.warning}</div>}
          </div>
        ) : showSend ? (
          <div style={{ background: '#fff', border: '1px solid ' + C.border, borderRadius: 10, padding: 16, width: 280, boxShadow: '0 8px 30px rgba(0,0,0,.15)' }}>
            {!preview ? (
              <>
                <label style={{ fontSize: 11, fontWeight: 600, color: C.muted, display: 'block', marginBottom: 6, textTransform: 'uppercase' }}>Email Πελάτη</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="owner@example.com"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid ' + C.border, fontSize: 13, marginBottom: 10, boxSizing: 'border-box' }} />
                <button onClick={handlePreviewSend} disabled={sending || !email.trim()} style={{ width: '100%', background: C.red, color: '#fff', border: 'none', borderRadius: 6, padding: '9px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  {sending ? 'Φόρτωση...' : 'Προεπισκόπηση Αποστολής'}
                </button>
              </>
            ) : (
              <>
                <p style={{ fontSize: 12, color: C.dark, marginBottom: 10 }}>Αποστολή προς <b>{preview.to}</b><br />Θέμα: {preview.subject}</p>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={handleConfirmSend} disabled={sending} style={{ flex: 1, background: C.green, color: '#fff', border: 'none', borderRadius: 6, padding: '9px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                    {sending ? 'Αποστολή...' : '✓ Επιβεβαίωση & Αποστολή'}
                  </button>
                  <button onClick={() => setPreview(null)} style={{ background: 'transparent', border: '1px solid ' + C.border, borderRadius: 6, padding: '9px 12px', fontSize: 12, cursor: 'pointer' }}>Άκυρο</button>
                </div>
              </>
            )}
          </div>
        ) : (
          <button onClick={() => setShowSend(true)} style={{ background: C.dark, color: '#fff', border: 'none', padding: '12px 22px', fontSize: 13, fontWeight: 700, cursor: 'pointer', borderRadius: 4 }}>
            ✉️ Αποστολή για Υπογραφή
          </button>
        )}
        <button onClick={() => window.print()} style={{ background: C.red, color: '#fff', border: 'none', padding: '12px 24px', fontSize: 13, fontWeight: 700, cursor: 'pointer', borderRadius: 4, boxShadow: '0 4px 16px rgba(204,34,41,0.35)' }}>
          🖨 Εκτύπωση / PDF
        </button>
      </div>

      {err && <div className="no-print" style={{ margin: '20px 28px', padding: '10px 14px', background: '#FEE2E2', color: '#B91C1C', borderRadius: 8, fontSize: 13 }}>{err}</div>}

      {data ? <div style={{ padding: '20px 0 60px' }}><GpiAgreementDocument data={data} /></div> : !err && <div style={{ padding: 40, color: C.muted, fontSize: 13 }}>Φόρτωση...</div>}
    </Shell>
  )
}
