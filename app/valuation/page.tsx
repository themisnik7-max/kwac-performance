'use client'
import { useState } from 'react'
import Shell from '@/components/Shell'

export default function ValuationPage() {
  const [form, setForm] = useState({ address:'', area:'', sqm:'', floor:'', year_built:'', condition:'good', rooms:'' })
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  async function estimate() {
    setLoading(true)
    try {
      const res = await fetch('/api/valuation-v2', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      const data = await res.json()
      setResult(data)
    } catch(e) { setResult({ error: 'Σφαλμα επικοινωνιας' }) }
    setLoading(false)
  }

  const inp = (label: string, key: string, placeholder?: string, type='text') => (
    <div style={{ marginBottom:14 }}>
      <div style={{ fontSize:12, color:'#888', marginBottom:4 }}>{label}</div>
      <input type={type} value={(form as any)[key]} onChange={e=>setForm(p=>({...p,[key]:e.target.value}))}
        placeholder={placeholder}
        style={{ width:'100%', padding:'8px 12px', border:'0.5px solid #ddd', borderRadius:8, fontSize:13, background:'#fff' }} />
    </div>
  )

  return (
    <Shell>
      <div style={{ padding:'2rem', maxWidth:900 }}>
        <h1 style={{ fontSize:22, fontWeight:500, color:'#1a1a1a', margin:'0 0 4px' }}>Εκτιμηση Ακινητου</h1>
        <p style={{ color:'#888', fontSize:14, margin:'0 0 1.5rem' }}>Βασισμενη στα πραγματικα δεδομενα του KWAC portfolio</p>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          <div style={{ background:'#fff', border:'0.5px solid #e8e8e8', borderRadius:12, padding:'1.25rem' }}>
            <div style={{ fontSize:14, fontWeight:500, marginBottom:14 }}>Στοιχεια ακινητου</div>
            {inp('Διευθυνση', 'address', 'π.χ. Κηφισιας 10, Μαρουσι')}
            {inp('Περιοχη', 'area', 'π.χ. Γλυφαδα')}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              {inp('Τ.μ.', 'sqm', '85', 'number')}
              {inp('Οροφος', 'floor', '2ος')}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              {inp('Ετος κατασκευης', 'year_built', '1995', 'number')}
              {inp('Δωματια', 'rooms', '3', 'number')}
            </div>
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:12, color:'#888', marginBottom:4 }}>Κατασταση</div>
              <select value={form.condition} onChange={e=>setForm(p=>({...p,condition:e.target.value}))}
                style={{ width:'100%', padding:'8px 12px', border:'0.5px solid #ddd', borderRadius:8, fontSize:13, background:'#fff' }}>
                <option value="excellent">Αριστη</option>
                <option value="good">Καλη</option>
                <option value="fair">Μετρια</option>
                <option value="needs_work">Χρειαζεται εργασιες</option>
              </select>
            </div>
            <button onClick={estimate} disabled={loading || !form.sqm}
              style={{ width:'100%', padding:'10px', background:'#CC2229', color:'#fff', border:'none', borderRadius:8, fontSize:14, fontWeight:500, cursor:'pointer', opacity:loading||!form.sqm?0.6:1 }}>
              {loading ? 'Υπολογισμος...' : 'Εκτιμηση'}
            </button>
          </div>

          <div>
            {!result && (
              <div style={{ background:'#f8f8f7', border:'0.5px solid #e8e8e8', borderRadius:12, padding:'1.25rem', height:'100%', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <p style={{ color:'#bbb', fontSize:14, textAlign:'center' }}>Συμπλήρωσε τα στοιχεία και πατα Εκτιμηση</p>
              </div>
            )}
            {result && !result.error && (
              <div style={{ background:'#fff', border:'0.5px solid #e8e8e8', borderRadius:12, padding:'1.25rem' }}>
                <div style={{ fontSize:14, fontWeight:500, marginBottom:12 }}>Αποτελεσμα εκτιμησης</div>
                <div style={{ background:'#1a1a1a', borderRadius:10, padding:'1.25rem', marginBottom:12, color:'#fff', textAlign:'center' }}>
                  <div style={{ fontSize:11, color:'#888', marginBottom:6 }}>ΕΚΤΙΜΩΜΕΝΗ ΑΞΙΑ</div>
                  <div style={{ fontSize:30, fontWeight:700, color:'#CC2229' }}>
                    {result.min_price && result.max_price ? '€'+result.min_price.toLocaleString('el-GR')+' – €'+result.max_price.toLocaleString('el-GR') : result.estimated_value ? '€'+result.estimated_value.toLocaleString('el-GR') : '–'}
                  </div>
                  {result.price_per_sqm && <div style={{ fontSize:13, color:'#888', marginTop:4 }}>€{result.price_per_sqm.toLocaleString('el-GR')}/τμ</div>}
                </div>
                {result.reasoning && <p style={{ fontSize:13, color:'#555', lineHeight:1.6 }}>{result.reasoning}</p>}
                {result.comparables && result.comparables.length > 0 && (
                  <div style={{ marginTop:12 }}>
                    <div style={{ fontSize:12, color:'#888', marginBottom:8 }}>Συγκρισιμα ακινητα</div>
                    {result.comparables.map((c: any, i: number) => (
                      <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:12, padding:'6px 0', borderBottom:'0.5px solid #f5f5f5' }}>
                        <span>{c.area} · {c.sqm}τμ</span>
                        <span style={{ fontWeight:500 }}>€{c.price?.toLocaleString('el-GR')}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {result?.error && (
              <div style={{ background:'#FCEBEB', border:'0.5px solid #f5c6c6', borderRadius:12, padding:'1.25rem' }}>
                <p style={{ color:'#A32D2D', fontSize:13 }}>{result.error}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Shell>
  )
}