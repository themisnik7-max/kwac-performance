'use client'
import { useState, useEffect } from 'react'
import Shell from '@/components/Shell'
import { useApp } from '@/lib/AppContext'
import { authedFetch } from '@/lib/authedFetch'

const fmt = (n) => (n || 0).toLocaleString('el-GR')
const pct = (a, b) => b > 0 ? Math.round((a / b) * 100) : 0

function KPI({ label, value, sub, color }) {
  return (
    <div style={{ background: '#fff', border: '0.5px solid #e8e8e8', borderRadius: 12, padding: '1rem 1.25rem' }}>
      <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 600, color: color || '#1a1a1a' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function MiniBar({ label, actual, target, color }) {
  const ratio100 = target > 0 ? Math.min((actual / target) * 100, 150) : 0
  const onTrack = actual >= target
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 13 }}>{label}</span>
        <span style={{ fontSize: 12, color: onTrack ? '#3B6D11' : '#CC2229', fontWeight: 500 }}>{actual} / {target} {onTrack ? '✓' : ''}</span>
      </div>
      <div style={{ background: '#f0f0f0', borderRadius: 100, height: 8, overflow: 'hidden' }}>
        <div style={{ height: '100%', background: onTrack ? '#3B6D11' : color, width: ratio100 + '%', borderRadius: 100, transition: 'width .5s ease' }} />
      </div>
    </div>
  )
}

function AgentIntelligence() {
  const [data, setData] = useState(null)
  const [tab, setTab] = useState('overview')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    authedFetch('/api/intelligence-agent').then(r => r.json()).then(d => { setData(d); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding: '4rem', textAlign: 'center', color: '#bbb' }}>Φόρτωση...</div>
  if (!data) return <div style={{ padding: '4rem', textAlign: 'center', color: '#CC2229' }}>Σφάλμα φόρτωσης.</div>

  const { actuals, weeklyTargets, gps, submissions, insights } = data
  const TABS = [{ key: 'overview', label: 'Επισκόπηση' }, { key: 'trend', label: 'Εβδομαδιαία' }, { key: 'funnel', label: 'Funnel vs GPS' }]

  return (
    <div>
      <div style={{ background: '#1a1a1a', color: '#fff', borderRadius: 12, padding: '1.25rem 1.5rem', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{actuals.dealsThisMonth > 0 ? '🔥' : '🎯'} Γεια σου, {data.agent?.name?.split(' ')[0]}!</div>
          <div style={{ fontSize: 13, color: '#aaa', marginTop: 2 }}>{actuals.activeListings} ενεργά ακίνητα · {actuals.dealsThisMonth} deals αυτό τον μήνα{gps ? ` · Στόχος €${fmt(Math.round(gps.targetIncome / 12))}/μήνα` : ' · Δεν έχεις GPS στόχο'}</div>
        </div>
        {!gps && <a href="/gps" style={{ padding: '8px 16px', background: '#CC2229', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 500, textDecoration: 'none' }}>Ορισμός GPS →</a>}
      </div>
      <div style={{ marginBottom: 20 }}>
        {(insights || []).map((ins, i) => (
          <div key={i} style={{ padding: '10px 14px', borderLeft: '3px solid #CC2229', background: '#fff', marginBottom: 8, borderRadius: '0 8px 8px 0', fontSize: 13, lineHeight: 1.5 }}>{ins}</div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{ padding: '7px 16px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 500, cursor: 'pointer', background: tab === t.key ? '#1a1a1a' : '#fff', color: tab === t.key ? '#fff' : '#666', outline: tab === t.key ? 'none' : '0.5px solid #e8e8e8' }}>{t.label}</button>
        ))}
      </div>
      {tab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          <KPI label="Avg Calls/εβδ" value={actuals.avgCalls} sub={weeklyTargets ? `στόχος ${weeklyTargets.calls}/εβδ` : 'Ορίσου GPS'} color={weeklyTargets && actuals.avgCalls >= weeklyTargets.calls ? '#3B6D11' : '#CC2229'} />
          <KPI label="Avg Ραντεβού/εβδ" value={actuals.avgAppt1} sub={weeklyTargets ? `στόχος ${weeklyTargets.appt1}/εβδ` : ''} color={weeklyTargets && actuals.avgAppt1 >= weeklyTargets.appt1 ? '#3B6D11' : '#CC2229'} />
          <KPI label="Deals αυτό τον μήνα" value={actuals.dealsThisMonth} color="#1a1a1a" />
          <KPI label="Εβδ. Μετρησιμότητες" value={actuals.submissionsCount} sub="συνολικά" />
          <KPI label="Ενεργά Ακίνητα" value={actuals.activeListings} sub="στο iList" />
          <KPI label="CR Call→Ραντ" value={actuals.avgCalls > 0 ? pct(actuals.avgAppt1, actuals.avgCalls) + '%' : '—'} color={gps && pct(actuals.avgAppt1, actuals.avgCalls) >= gps.crCallAppt1 ? '#3B6D11' : '#CC2229'} />
        </div>
      )}
      {tab === 'funnel' && (
        <div style={{ background: '#fff', border: '0.5px solid #e8e8e8', borderRadius: 12, padding: '1.25rem' }}>
          {!weeklyTargets ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <div style={{ fontSize: 14, color: '#888', marginBottom: 12 }}>Δεν έχεις GPS στόχο ακόμα.</div>
              <a href="/gps" style={{ padding: '10px 20px', background: '#CC2229', color: '#fff', borderRadius: 8, fontSize: 14, fontWeight: 500, textDecoration: 'none' }}>Ορισμός GPS →</a>
            </div>
          ) : (
            <div>
              <MiniBar label="📞 Calls/εβδ" actual={actuals.avgCalls} target={weeklyTargets.calls} color="#378ADD" />
              <MiniBar label="📅 1α Ραντεβού/εβδ" actual={actuals.avgAppt1} target={weeklyTargets.appt1} color="#BA7517" />
              <MiniBar label="🤝 2α Ραντεβού/εβδ" actual={actuals.avgAppt2} target={weeklyTargets.appt2} color="#534AB7" />
              <MiniBar label="📋 Αναθέσεις/εβδ" actual={actuals.avgExclusives} target={weeklyTargets.listings} color="#0F6E56" />
              <MiniBar label="✅ Deals/εβδ" actual={actuals.avgContracts} target={weeklyTargets.deals} color="#3B6D11" />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function CeoIntelligence() {
  const [data, setData] = useState(null)
  const [tab, setTab] = useState('overview')
  const [chatQ, setChatQ] = useState('')
  const [chatA, setChatA] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    authedFetch('/api/intelligence').then(r => r.json()).then(raw => {
      const t = raw.totals || {}
      setData({
        ...raw,
        totalValue:      t.portfolioValue || 0,
        totalProperties: t.totalCount     || 0,
        soldYTD:         t.salesCount     || 0,
        avgPricePerSqm:  raw.psqm?.[0]?.price_sqm || 0,
        byAgent: (raw.agents || []).map(a => ({
          agent_name: a.name, active: a.total, sold: a.sales,
          portfolio_value: a.portfolio,
          avg_price: a.sales > 0 ? Math.round(a.portfolio / a.sales) : 0,
        })),
        byArea: (raw.areas || []).map(a => {
          const p = (raw.psqm || []).find(p => p.area === a.area)
          return { ...a, avg_ppsqm: p?.price_sqm || 0 }
        }),
      })
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding: '4rem', textAlign: 'center', color: '#bbb' }}>Φόρτωση...</div>
  if (!data)   return <div style={{ padding: '4rem', textAlign: 'center', color: '#CC2229' }}>Σφάλμα φόρτωσης.</div>

  async function askAI(e) {
    e.preventDefault()
    if (!chatQ.trim()) return
    setChatLoading(true); setChatA('')
    const res = await authedFetch('/api/intelligence-chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: chatQ, context: data }) })
    const d = await res.json()
    setChatA(d.answer || d.error || 'Δεν ήρθε απάντηση.')
    setChatLoading(false)
  }

  const insightBorder = (type) => type === 'warning' ? '#CC2229' : type === 'opportunity' ? '#3B6D11' : '#378ADD'
  const TABS = [{ key: 'overview', label: 'Επισκόπηση' }, { key: 'agents', label: 'Μεσίτες' }, { key: 'areas', label: 'Περιοχές' }, { key: 'chat', label: '🤖 AI Ανάλυση' }]

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{ padding: '7px 16px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 500, cursor: 'pointer', background: tab === t.key ? '#1a1a1a' : '#fff', color: tab === t.key ? '#fff' : '#666', outline: tab === t.key ? 'none' : '0.5px solid #e8e8e8' }}>{t.label}</button>
        ))}
        <a href="/monitor" style={{ marginLeft: 'auto', padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, textDecoration: 'none', background: '#fff5f5', color: '#CC2229', border: '0.5px solid #CC2229' }}>📊 Monitor →</a>
      </div>
      {tab === 'overview' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
            <KPI label="Portfolio Value" value={'€' + fmt(Math.round((data.totalValue || 0) / 1e6 * 10) / 10) + 'M'} />
            <KPI label="Ενεργά Ακίνητα" value={data.totalProperties || 0} />
            <KPI label="Πωλήσεις YTD"   value={data.soldYTD || 0} />
            <KPI label="Μέση Τιμή/τ.μ." value={'€' + fmt(Math.round(data.avgPricePerSqm || 0))} />
          </div>
          <div style={{ background: '#fff', border: '0.5px solid #e8e8e8', borderRadius: 12, padding: '1.25rem' }}>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 16 }}>Insights</div>
            {(data.insights || []).map((ins, i) => (
              <div key={i} style={{ padding: '8px 12px', borderLeft: `3px solid ${insightBorder(ins.type)}`, background: '#fafafa', marginBottom: 8, borderRadius: '0 6px 6px 0', fontSize: 13, lineHeight: 1.5 }}>
                <strong>{ins.icon} {ins.title}:</strong> {ins.text}
              </div>
            ))}
          </div>
        </div>
      )}
      {tab === 'agents' && (
        <div style={{ background: '#fff', border: '0.5px solid #e8e8e8', borderRadius: 12, padding: '1.25rem' }}>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 16 }}>Απόδοση ανά Μεσίτη</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ borderBottom: '1px solid #f0f0f0' }}>{['Μεσίτης','Σύνολο','Πωλήσεις','Αξία Port.','Avg Τιμή'].map(h => <th key={h} style={{ textAlign: 'left', padding: '8px', fontWeight: 500, color: '#888' }}>{h}</th>)}</tr></thead>
            <tbody>{(data.byAgent || []).map(a => (
              <tr key={a.agent_name} style={{ borderBottom: '0.5px solid #f8f8f8' }}>
                <td style={{ padding: '8px', fontWeight: 500 }}>{a.agent_name}</td>
                <td style={{ padding: '8px' }}>{a.active || 0}</td>
                <td style={{ padding: '8px' }}>{a.sold || 0}</td>
                <td style={{ padding: '8px' }}>€{fmt(Math.round((a.portfolio_value || 0) / 1000))}K</td>
                <td style={{ padding: '8px' }}>€{fmt(Math.round(a.avg_price || 0))}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      {tab === 'areas' && (
        <div style={{ background: '#fff', border: '0.5px solid #e8e8e8', borderRadius: 12, padding: '1.25rem' }}>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 16 }}>Top Περιοχές</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ borderBottom: '1px solid #f0f0f0' }}>{['Περιοχή','Ακίνητα','Avg €/τ.μ.'].map(h => <th key={h} style={{ textAlign: 'left', padding: '8px', fontWeight: 500, color: '#888' }}>{h}</th>)}</tr></thead>
            <tbody>{(data.byArea || []).map(a => (
              <tr key={a.area} style={{ borderBottom: '0.5px solid #f8f8f8' }}>
                <td style={{ padding: '8px', fontWeight: 500 }}>{a.area}</td>
                <td style={{ padding: '8px' }}>{a.count}</td>
                <td style={{ padding: '8px' }}>{a.avg_ppsqm ? '€' + fmt(Math.round(a.avg_ppsqm)) : '—'}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      {tab === 'chat' && (
        <div style={{ background: '#fff', border: '0.5px solid #e8e8e8', borderRadius: 12, padding: '1.25rem' }}>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 16 }}>AI Ερώτηση στο Portfolio</div>
          <form onSubmit={askAI} style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            <input value={chatQ} onChange={e => setChatQ(e.target.value)} placeholder="π.χ. Ποιος μεσίτης έχει τη μεγαλύτερη ανάπτυξη;" style={{ flex: 1, padding: '10px 14px', border: '0.5px solid #ddd', borderRadius: 8, fontSize: 14 }} />
            <button type="submit" disabled={chatLoading} style={{ padding: '10px 20px', background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>{chatLoading ? '...' : 'Ρώτα'}</button>
          </form>
          {chatA && <div style={{ padding: '1rem', background: '#F8F8F7', borderRadius: 8, fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{chatA}</div>}
        </div>
      )}
    </div>
  )
}

export default function IntelligencePage() {
  const { role } = useApp()
  const isCeo = role === 'ceo' || role === 'admin'
  return (
    <Shell>
      <div style={{ padding: '2rem', maxWidth: 1100 }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <h1 style={{ fontSize: 22, fontWeight: 500, color: '#1a1a1a', margin: 0 }}>{isCeo ? 'Intelligence — Εταιρική Εικόνα' : 'Intelligence — Η Πρόοδός μου'}</h1>
          <p style={{ color: '#888', fontSize: 14, margin: '4px 0 0' }}>{isCeo ? 'Συγκεντρωτική εικόνα portfolio, μεσιτών, περιοχών' : 'Προσωπική ανάλυση, coaching insights, στόχοι vs πραγματικότητα'}</p>
        </div>
        {isCeo ? <CeoIntelligence /> : <AgentIntelligence />}
      </div>
    </Shell>
  )
}