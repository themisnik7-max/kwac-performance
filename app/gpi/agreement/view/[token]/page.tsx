'use client'
import { useState, useEffect } from 'react'
import GpiAgreementDocument, { type GpiAgreementData } from '@/components/GpiAgreementDocument'

export default function GpiAgreementPublicViewPage({ params }: { params: { token: string } }) {
  const [data, setData] = useState<GpiAgreementData | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/gpi/agreement/public/${params.token}`).then(async res => {
      const json = await res.json()
      if (!res.ok) { setErr(json.error || 'Δεν βρέθηκε'); return }
      setData(json.data)
    })
  }, [params.token])

  if (err) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'sans-serif', color: '#B91C1C', fontSize: 14 }}>{err}</div>
  if (!data) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'sans-serif', color: '#888', fontSize: 13 }}>Φόρτωση...</div>

  return (
    <div style={{ background: '#F0F0F0', minHeight: '100vh' }}>
      <div className="no-print" style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 999 }}>
        <button onClick={() => window.print()} style={{ background: '#CC2229', color: '#fff', border: 'none', padding: '12px 24px', fontSize: 13, fontWeight: 700, cursor: 'pointer', borderRadius: 4, boxShadow: '0 4px 16px rgba(204,34,41,0.35)' }}>
          🖨 Εκτύπωση / PDF
        </button>
      </div>
      <div style={{ padding: '20px 0 60px' }}><GpiAgreementDocument data={data} /></div>
    </div>
  )
}
