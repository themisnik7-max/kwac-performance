'use client'
import { useState, useEffect } from 'react'
import Shell from '@/components/Shell'
import { useApp } from '@/lib/AppContext'
import { authedFetch } from '@/lib/authedFetch'

function fmt(n: number) { return (n || 0).toLocaleString('el-GR') }
function fmtM(n: number) { return ((n || 0) / 1000000).toFixed(1) + 'M' }

const IC: Record<string, string> = { warning: '#FEF3C7', opportunity: '#EAF3DE', insight: '#E6F1FB' }
const IB: Record<string, string> = { warning: '#FCD34D', opportunity: '#86EFAC', insight: '#93C5FD' }

type IntelData = {
  totals: { portfolioValue: number; avgSale: number; avgRental: number; salesCount: number; rentalCount: number; totalCount: number }
  insights: { type: string; icon: string; title: string; text: string }[]
  agents: { name: string; total: number; sales: number; rentals: number; portfolio: number; pct: number }[]
  areas: { area: string; count: number }[]
  psqm: { area: string; price_sqm: number; n: number }[]
  types: { type: string; count: number; pct: number }[]
}

export default function IntelligencePage() {
  const { agent } = useApp()
  const [tab, setTab] = useState<'overview' | 'agents' | 'areas' | 'chat'>('overview')
  const [chatInput, setChatInput] = useState('')
  const [messages, setMessages] = useState([{ role: 'assistant', text: 'Καλημέρα! Ρώτα με οτιδήποτε για το χαρτοφυλάκιο.' }])
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<IntelData | null>(null)
  const [dataLoading, setDataLoading] = useState(true)

  useEffect(() => {
    if (!agent) return
    authedFetch('/api/intelligence').then(r => r.json()).then(d => {
      setData(d)
      setDataLoading(false)
      setMessages([{ role: 'assistant', text: `Καλημέρα! Έχω ${d?.totals?.totalCount || 0} ακίνητα στο χαρτοφυλάκιο. Ρώτα με οτιδήποτε.` }])
    }).catch(() => setDataLoading(false))
  }, [agent])

  async function sendMessage() {
    if (!chatInput.trim() || loading) return
    const userMsg = chatInput.trim(); setChatInput('')
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]); setLoading(true)
    try {
      const res = await authedFetch('/api/intelligence-chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: userMsg }) })
      const d = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', text: d.reply || 'Σφάλμα' }])
    } catch (e) { setMessages(prev => [...prev, { role: 'assistant', text: 'Σφάλμα σύνδεσης.' }]) }
    setLoading(false)
  }

  const tabs = [{ key: 'overview', label: 'Overview' }, { key: 'agents', label: 'Agents' }, { key: 'areas', label: 'Περιοχές' }, { key: 'chat', label: 'AI Analyst' }] as const

  if (dataLoading) return <Shell><div style={{ padding: '2rem', color: '#888' }}>Φόρτωση...</div></Shell>

  const d: IntelData = data || { totals: { portfolioValue: 0, avgSale: 0, avgRental: 0, salesCount: 0, rentalCount: 0, totalCount: 0 }, insights: [], agents: [], areas: [], psqm: [], types: [] }
  const maxAreaCount = Math.max(1, ...d.areas.map(a => a.count))
  const maxPsqm = Math.max(1, ...d.psqm.map(a => a.price_sqm))

  return (
    <Shell>
      <div style={{ padding: '2rem', maxWidth: 1100 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 500, color: '#1a1a1a', margin: 0 }}>Intelligence Dashboard</h1>
            <p style={{ color: '#888', fontSize: 14, margin: '4px 0 0' }}>{d.totals.totalCount} ακίνητα · Portfolio €{fmtM(d.totals.portfolioValue)} · live από τη βάση</p>
          </div>
          <div style={{ background: '#EAF3DE', color: '#3B6D11', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 500 }}>🟢 Live</div>
        </div>

        <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '0.5px solid #e8e8e8' }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{ padding: '8px 18px', border: 'none', background: 'none', fontSize: 13, cursor: 'pointer',
                color: tab === t.key ? '#CC2229' : '#888', fontWeight: tab === t.key ? 500 : 400,
                borderBottom: tab === t.key ? '2px solid #CC2229' : '2px solid transparent', marginBottom: -1 }}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
              {[
                { l: 'Portfolio', v: '€' + fmtM(d.totals.portfolioValue), sub: `${d.totals.salesCount} πωλ. + ${d.totals.rentalCount} ενοικ.`, c: '#CC2229' },
                { l: 'Avg Πώληση', v: '€' + fmt(d.totals.avgSale), sub: '', c: '#185FA5' },
                { l: 'Avg Ενοικίαση', v: '€' + fmt(d.totals.avgRental), sub: 'ανά μήνα', c: '#534AB7' },
                { l: 'Gross Comm.', v: '€' + fmtM(d.totals.portfolioValue * 0.04), sub: '@4% αν κλείσουν όλα', c: '#3B6D11' },
              ].map(k => (
                <div key={k.l} style={{ background: '#fff', border: '0.5px solid #e8e8e8', borderRadius: 12, padding: '1rem' }}>
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.05em' }}>{k.l}</div>
                  <div style={{ fontSize: 22, fontWeight: 600, color: k.c, marginBottom: 2 }}>{k.v}</div>
                  <div style={{ fontSize: 12, color: '#888' }}>{k.sub}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              {d.insights.length === 0 && <p style={{ color: '#bbb', fontSize: 14 }}>Δεν υπάρχουν ακόμα αρκετά δεδομένα για insights.</p>}
              {d.insights.map((ins, i) => (
                <div key={i} style={{ background: IC[ins.type], border: '0.5px solid ' + IB[ins.type], borderRadius: 12, padding: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 18 }}>{ins.icon}</span>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{ins.title}</span>
                  </div>
                  <p style={{ fontSize: 13, color: '#555', lineHeight: 1.6, margin: 0 }}>{ins.text}</p>
                </div>
              ))}
            </div>
            <div style={{ background: '#fff', border: '0.5px solid #e8e8e8', borderRadius: 12, padding: '1.25rem' }}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>Mix ακινήτων</div>
              {d.types.length === 0 && <p style={{ color: '#bbb', fontSize: 14 }}>—</p>}
              {d.types.map(pt => (
                <div key={pt.type} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: 13 }}>{pt.type}</span>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{pt.count} <span style={{ color: '#888', fontWeight: 400 }}>({pt.pct}%)</span></span>
                  </div>
                  <div style={{ background: '#f0f0f0', borderRadius: 100, height: 6, overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: '#CC2229', borderRadius: 100, width: pt.pct + '%' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'agents' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {d.agents.length === 0 && <p style={{ color: '#bbb', fontSize: 14 }}>Δεν υπάρχουν ακόμα ακίνητα συνδεδεμένα με agents.</p>}
            {d.agents.map((a, i) => (
              <div key={a.name} style={{ background: '#fff', border: '0.5px solid #e8e8e8', borderRadius: 12, padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 500 }}>{a.name}</div>
                    <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{a.pct}% portfolio</div>
                  </div>
                  <div style={{ background: i === 0 ? '#FAEEDA' : '#f0f0f0', color: i === 0 ? '#854F0B' : '#666', borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 500 }}>#{i + 1}</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
                  {[{ l: 'Ακίνητα', v: a.total }, { l: 'Πωλήσεις', v: a.sales }, { l: 'Ενοικ.', v: a.rentals }].map(m => (
                    <div key={m.l} style={{ background: '#f8f8f7', borderRadius: 8, padding: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: 11, color: '#888' }}>{m.l}</div>
                      <div style={{ fontSize: 18, fontWeight: 500 }}>{m.v}</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 12, color: '#888' }}>Portfolio αξία</div>
                <div style={{ fontSize: 20, fontWeight: 600, color: '#CC2229' }}>€{fmtM(a.portfolio)}</div>
                <div style={{ background: '#f0f0f0', borderRadius: 100, height: 6, overflow: 'hidden', marginTop: 8 }}>
                  <div style={{ height: '100%', background: '#CC2229', borderRadius: 100, width: a.pct + '%' }} />
                </div>
                {a.pct > 50 && <div style={{ marginTop: 10, background: '#FEF3C7', borderRadius: 8, padding: '8px', fontSize: 12, color: '#854F0B' }}>⚠️ {a.pct}% εξάρτηση — ρίσκο συγκέντρωσης</div>}
              </div>
            ))}
          </div>
        )}

        {tab === 'areas' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ background: '#fff', border: '0.5px solid #e8e8e8', borderRadius: 12, padding: '1.25rem' }}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>Αριθμός ακινήτων ανά περιοχή</div>
              {d.areas.length === 0 && <p style={{ color: '#bbb', fontSize: 14 }}>—</p>}
              {d.areas.map((a, i) => (
                <div key={a.area} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '0.5px solid #f5f5f5' }}>
                  <span style={{ fontSize: 12, color: '#bbb', minWidth: 18 }}>#{i + 1}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13 }}>{a.area}</div>
                    <div style={{ background: '#f0f0f0', borderRadius: 100, height: 5, overflow: 'hidden', marginTop: 3 }}>
                      <div style={{ height: '100%', background: '#CC2229', borderRadius: 100, width: (a.count / maxAreaCount * 100) + '%' }} />
                    </div>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{a.count}</span>
                </div>
              ))}
            </div>
            <div style={{ background: '#fff', border: '0.5px solid #e8e8e8', borderRadius: 12, padding: '1.25rem' }}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>Premium €/τμ ανά περιοχή</div>
              {d.psqm.length === 0 && <p style={{ color: '#bbb', fontSize: 14 }}>—</p>}
              {d.psqm.map((a, i) => (
                <div key={a.area} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '0.5px solid #f5f5f5' }}>
                  <span style={{ fontSize: 12, color: '#bbb', minWidth: 18 }}>#{i + 1}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13 }}>{a.area} <span style={{ color: '#bbb', fontSize: 11 }}>n={a.n}</span></div>
                    <div style={{ background: '#f0f0f0', borderRadius: 100, height: 5, overflow: 'hidden', marginTop: 3 }}>
                      <div style={{ height: '100%', background: '#185FA5', borderRadius: 100, width: (a.price_sqm / maxPsqm * 100) + '%' }} />
                    </div>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 500, color: '#185FA5' }}>€{fmt(a.price_sqm)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'chat' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '58vh' }}>
            <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 12 }}>
              {messages.map((m, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div style={{ maxWidth: '75%', padding: '10px 14px', borderRadius: 12, fontSize: 13, lineHeight: 1.6,
                    background: m.role === 'user' ? '#CC2229' : '#fff', color: m.role === 'user' ? '#fff' : '#1a1a1a',
                    border: m.role === 'assistant' ? '0.5px solid #e8e8e8' : 'none' }}>
                    {m.text}
                  </div>
                </div>
              ))}
              {loading && <div style={{ background: '#fff', border: '0.5px solid #e8e8e8', borderRadius: 12, padding: '10px 14px', fontSize: 13, color: '#888', width: 'fit-content' }}>Αναλύω...</div>}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {['Ποιος agent έχει μεγαλύτερο ρίσκο;', 'Πού να επεκταθούμε;', 'Ανάλυση pricing strategy'].map(q => (
                <button key={q} onClick={() => setChatInput(q)} style={{ padding: '4px 10px', background: '#f5f5f5', border: '0.5px solid #e8e8e8', borderRadius: 100, fontSize: 12, cursor: 'pointer', color: '#666' }}>{q}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, paddingTop: 8, borderTop: '0.5px solid #e8e8e8' }}>
              <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()}
                placeholder="Ρώτα για το portfolio..." style={{ flex: 1, padding: '10px 14px', border: '0.5px solid #ddd', borderRadius: 10, fontSize: 13 }} />
              <button onClick={sendMessage} disabled={loading || !chatInput.trim()}
                style={{ padding: '10px 20px', background: '#CC2229', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>
                Αποστολή
              </button>
            </div>
          </div>
        )}
      </div>
    </Shell>
  )
}
