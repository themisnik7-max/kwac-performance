'use client'
import { useState, useEffect } from 'react'
import Shell from '@/components/Shell'
import LockedFeature from '@/components/LockedFeature'
import { useApp } from '@/lib/AppContext'
import { authedFetch } from '@/lib/authedFetch'

const fmt = (n) => (n || 0).toLocaleString('el-GR')
const pct = (a, b) => b > 0 ? Math.round((a / b) * 100) : 0

function KPI({ label, value, sub = null, color = null }) {
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

function CeoIntelligence() {
  const [data, setData] = useState(null)
  const [production, setProduction] = useState(null)
  const [tab, setTab] = useState('overview')
  const [chatQ, setChatQ] = useState('')
  const [chatA, setChatA] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [loading, setLoading] = useState(true)

  // Office GPS — target office GCI reverse-engineered into required weekly
  // office-wide activity, using real aggregate conversion rates (see
  // lib/officeMetrics.ts getOfficeConversionRates). Individual GPS's exact
  // model at office scale, minus the agent-split step (not meaningful for
  // the office's own cut).
  const [ogTarget, setOgTarget] = useState(500000)
  const [ogAvgPrice, setOgAvgPrice] = useState(200000)
  const [ogCommRate, setOgCommRate] = useState(4)
  const [ogWeeks, setOgWeeks] = useState(48)
  const [ogCr1, setOgCr1] = useState(10)
  const [ogCr2, setOgCr2] = useState(50)
  const [ogCr3, setOgCr3] = useState(40)
  const [ogCr4, setOgCr4] = useState(60)
  const [ogRealRates, setOgRealRates] = useState(null)
  const [ogSaving, setOgSaving] = useState(false)
  const [ogToast, setOgToast] = useState('')

  useEffect(() => {
    // Same lib/officeMetrics.ts aggregation Monitor's Παραγωγή tab uses — this
    // page shows the macro/office-wide read of it, Monitor has the per-agent
    // operational drill-down.
    authedFetch('/api/monitor/production').then(r => r.json()).then(setProduction).catch(() => {})
  }, [])

  useEffect(() => {
    authedFetch('/api/gps/office').then(r => r.json()).then(({ goal, realRates }) => {
      if (goal) {
        setOgTarget(goal.target_income || 500000); setOgAvgPrice(goal.avg_property_price || 200000)
        setOgCommRate(goal.commission_rate || 4); setOgWeeks(goal.work_weeks || 48)
        if (goal.cr_call_appt1) setOgCr1(goal.cr_call_appt1); if (goal.cr_appt1_appt2) setOgCr2(goal.cr_appt1_appt2)
        if (goal.cr_appt2_listing) setOgCr3(goal.cr_appt2_listing); if (goal.cr_listing_deal) setOgCr4(goal.cr_listing_deal)
      } else if (realRates) {
        if (realRates.cr_call_appt1) setOgCr1(realRates.cr_call_appt1); if (realRates.cr_appt1_appt2) setOgCr2(realRates.cr_appt1_appt2)
        if (realRates.cr_appt2_listing) setOgCr3(realRates.cr_appt2_listing); if (realRates.cr_listing_deal) setOgCr4(realRates.cr_listing_deal)
      }
      setOgRealRates(realRates)
    }).catch(() => {})
  }, [])

  async function saveOfficeGoal() {
    setOgSaving(true)
    await authedFetch('/api/gps/office', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_income: ogTarget, avg_property_price: ogAvgPrice, commission_rate: ogCommRate, work_weeks: ogWeeks, cr_call_appt1: ogCr1, cr_appt1_appt2: ogCr2, cr_appt2_listing: ogCr3, cr_listing_deal: ogCr4 }),
    })
    setOgToast('✅ Αποθηκεύτηκε!'); setOgSaving(false); setTimeout(() => setOgToast(''), 2500)
  }

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
    const res = await authedFetch('/api/intelligence-chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: chatQ }) })
    const d = await res.json()
    setChatA(d.reply || d.error || 'Δεν ήρθε απάντηση.')
    setChatLoading(false)
  }

  const insightBorder = (type) => type === 'warning' ? '#CC2229' : type === 'opportunity' ? '#3B6D11' : '#378ADD'
  const TABS = [{ key: 'overview', label: 'Επισκόπηση' }, { key: 'production', label: 'Παραγωγή' }, { key: 'officegps', label: 'GPS Γραφείου' }, { key: 'agents', label: 'Μεσίτες' }, { key: 'areas', label: 'Περιοχές' }, { key: 'chat', label: '🤖 AI Ανάλυση' }]

  // Office GPS funnel math — identical shape to app/gps/page.tsx's
  // individual calculator, minus the agent-split step (this is the office's
  // own GCI target, not one agent's post-split take-home).
  const ogPerDeal = ogAvgPrice * (ogCommRate / 100)
  const ogDealsNeeded = Math.ceil(ogTarget / ogPerDeal)
  const ogListingsNeeded = Math.ceil(ogDealsNeeded / (ogCr4 / 100))
  const ogAppt2Needed = Math.ceil(ogListingsNeeded / (ogCr3 / 100))
  const ogAppt1Needed = Math.ceil(ogAppt2Needed / (ogCr2 / 100))
  const ogCallsNeeded = Math.ceil(ogAppt1Needed / (ogCr1 / 100))
  const ogCallsW = Math.ceil(ogCallsNeeded / ogWeeks)
  const ogAppt1W = Math.ceil(ogAppt1Needed / ogWeeks)
  const ogAppt2W = Math.ceil(ogAppt2Needed / ogWeeks)
  const ogListW = Math.ceil(ogListingsNeeded / ogWeeks)
  // Current pace, from real data — avg per agent-week-submitted, the closest
  // honest proxy to "typical office week" without assuming every agent
  // submitted every calendar week uniformly.
  const currentCallsW = production?.officeTotals?.weeks_submitted ? Math.round(production.officeTotals.calls / production.officeTotals.weeks_submitted) : null
  const ogSlider = (label, val, set, min, max, step, f = null) => (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: '#888' }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 500 }}>{f ? f(val) : val}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={val} onChange={e => set(Number(e.target.value))} style={{ width: '100%' }} />
    </div>
  )

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
      {tab === 'production' && (() => {
        if (!production) return <div style={{ padding: '3rem', textAlign: 'center', color: '#bbb' }}>Φόρτωση...</div>
        const t = production.officeTotals
        return (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
              <KPI label="Καταγραφές" value={fmt(t.calls)} sub="σύνολο γραφείου" />
              <KPI label="Αναθέσεις" value={fmt(t.mandates)} sub="σύνολο γραφείου" color="#CC2229" />
              <KPI label="Προσφορές" value={fmt(t.offers)} sub="σύνολο γραφείου" />
              <KPI label="Κλεισίματα" value={fmt(t.closings)} sub="σύνολο γραφείου" color="#3B6D11" />
              <KPI label="Ζητήσεις" value={fmt(t.demand)} sub="ενεργές" />
              <KPI label="Προκαταβολές" value={fmt(t.deposits)} sub="σύνολο γραφείου" />
              <KPI label="2α Ραντεβού" value={fmt(t.second_appointments)} sub="σύνολο γραφείου" />
              <KPI label="Εβδ. Υποβολές" value={fmt(t.weeks_submitted)} sub="σύνολο γραφείου" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: production.teams.length ? '1fr 1fr' : '1fr', gap: 16 }}>
              {production.teams.map(team => (
                <div key={team.team} style={{ background: '#fff', border: '0.5px solid #e8e8e8', borderRadius: 12, padding: '1.25rem' }}>
                  <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>👥 Ομάδα: {team.team}</div>
                  <div style={{ fontSize: 12, color: '#888', marginBottom: 14 }}>{team.agents.length} μεσίτες</div>
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    {[['Αναθέσεις', team.totals.mandates], ['Προσφορές', team.totals.offers], ['Κλεισίματα', team.totals.closings], ['Ζητήσεις', team.totals.demand]].map(([l, v]) => (
                      <div key={l}><div style={{ fontSize: 20, fontWeight: 600 }}>{v}</div><div style={{ fontSize: 11, color: '#888' }}>{l}</div></div>
                    ))}
                  </div>
                </div>
              ))}
              {production.solo.length > 0 && (
                <div style={{ background: '#fff', border: '0.5px solid #e8e8e8', borderRadius: 12, padding: '1.25rem' }}>
                  <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>🧍 Solo Μεσίτες</div>
                  <div style={{ fontSize: 12, color: '#888', marginBottom: 14 }}>{production.solo.length} μεσίτες</div>
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    {[['Αναθέσεις', production.solo.reduce((s,a)=>s+a.mandates,0)], ['Προσφορές', production.solo.reduce((s,a)=>s+a.offers,0)], ['Κλεισίματα', production.solo.reduce((s,a)=>s+a.closings,0)], ['Ζητήσεις', production.solo.reduce((s,a)=>s+a.demand,0)]].map(([l, v]) => (
                      <div key={l}><div style={{ fontSize: 20, fontWeight: 600 }}>{v}</div><div style={{ fontSize: 11, color: '#888' }}>{l}</div></div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div style={{ marginTop: 12, fontSize: 11, color: '#bbb' }}>Λεπτομέρεια ανά μεσίτη στο <a href="/monitor" style={{ color: '#CC2229' }}>Monitor → Παραγωγή</a>.</div>
          </div>
        )
      })()}

      {tab === 'officegps' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <p style={{ fontSize: 13, color: '#888', margin: 0, maxWidth: 560 }}>Όπως το GPS δίνει σε έναν μεσίτη τις εβδομαδιαίες ενέργειες που χρειάζεται για τον στόχο του, εδώ γίνεται το ίδιο για όλο το γραφείο — με βάση τα πραγματικά conversion rates απ' όλες τις εβδομαδιαίες υποβολές.</p>
            <button onClick={saveOfficeGoal} disabled={ogSaving} style={{ padding: '8px 16px', background: '#CC2229', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', flexShrink: 0 }}>{ogSaving ? '...' : 'Αποθήκευση'}</button>
          </div>
          {ogToast && <div style={{ background: '#EAF3DE', color: '#3B6D11', padding: '10px 16px', borderRadius: 8, marginBottom: 16, fontSize: 14 }}>{ogToast}</div>}
          {ogRealRates && ogRealRates.weeks_of_data < 8 && (
            <div style={{ background: '#FFF8E6', color: '#BA7517', padding: '10px 16px', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
              ⚠️ Τα conversion rates βασίζονται σε μόλις {ogRealRates.weeks_of_data} εβδομαδιαίες υποβολές συνολικά στο γραφείο — ενδεικτικά προς το παρόν, θα σταθεροποιηθούν με περισσότερα δεδομένα.
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 16 }}>
            <div>
              <div style={{ background: '#fff', border: '0.5px solid #e8e8e8', borderRadius: 12, padding: '1.25rem', marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>Στόχος Γραφείου (GCI/έτος)</div>
                {ogSlider('Στόχος GCI (€)', ogTarget, setOgTarget, 100000, 3000000, 25000, v => '€' + fmt(v))}
                {ogSlider('Μέση αξία ακινήτου (€)', ogAvgPrice, setOgAvgPrice, 50000, 1000000, 10000, v => '€' + fmt(v))}
                {ogSlider('Αμοιβή γραφείου (%)', ogCommRate, setOgCommRate, 1, 6, 0.5, v => v + '%')}
                {ogSlider('Εβδομάδες/χρόνο', ogWeeks, setOgWeeks, 40, 52, 1)}
              </div>
              <div style={{ background: '#fff', border: '0.5px solid #e8e8e8', borderRadius: 12, padding: '1.25rem' }}>
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Conversion rates γραφείου</div>
                <div style={{ fontSize: 11, color: '#aaa', marginBottom: 12 }}>Προσυμπληρωμένα από τα πραγματικά δεδομένα — προσαρμόσιμα.</div>
                {ogSlider('Call → 1ο Ραντεβού', ogCr1, setOgCr1, 1, 50, 1, v => v + '%')}
                {ogSlider('1ο → 2ο Ραντεβού', ogCr2, setOgCr2, 10, 90, 5, v => v + '%')}
                {ogSlider('2ο Ραντεβού → Ανάθεση', ogCr3, setOgCr3, 10, 90, 5, v => v + '%')}
                {ogSlider('Ανάθεση → Συμβόλαιο', ogCr4, setOgCr4, 10, 90, 5, v => v + '%')}
              </div>
            </div>
            <div>
              <div style={{ background: '#1a1a1a', borderRadius: 12, padding: '1.25rem', marginBottom: 12, color: '#fff' }}>
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>Στόχος Γραφείου</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  {[{ l: 'GCI/χρόνο', v: '€' + fmt(ogTarget) }, { l: 'Αμοιβή/συμβόλαιο', v: '€' + fmt(Math.round(ogPerDeal)) }, { l: 'GCI/μήνα', v: '€' + fmt(Math.round(ogTarget / 12)) }].map(m => (
                    <div key={m.l} style={{ background: 'rgba(255,255,255,.08)', borderRadius: 8, padding: '10px 12px' }}>
                      <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>{m.l}</div>
                      <div style={{ fontSize: 18, fontWeight: 500 }}>{m.v}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ background: '#fff', border: '0.5px solid #e8e8e8', borderRadius: 12, padding: '1.25rem' }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#888', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '.05em' }}>Εβδομαδιαίος στόχος γραφείου</div>
                {[{ l: '📞 Calls', v: ogCallsNeeded, w: ogCallsW, c: '#378ADD', current: currentCallsW }, { l: '📅 1ο Ραντεβού', v: ogAppt1Needed, w: ogAppt1W, c: '#BA7517' }, { l: '🤝 2ο Ραντεβού', v: ogAppt2Needed, w: ogAppt2W, c: '#534AB7' }, { l: '📋 Αναθέσεις', v: ogListingsNeeded, w: ogListW, c: '#0F6E56' }].map(m => (
                  <div key={m.l} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontSize: 13 }}>{m.l}</span>
                      <span style={{ fontSize: 12, color: '#888' }}>
                        χρειάζεται {m.w}/εβδ
                        {m.current != null && <span style={{ marginLeft: 6, color: m.current >= m.w ? '#3B6D11' : '#CC2229', fontWeight: 500 }}>· τώρα ~{m.current}/εβδ</span>}
                      </span>
                    </div>
                    <div style={{ background: '#f0f0f0', borderRadius: 100, height: 8, overflow: 'hidden' }}>
                      <div style={{ height: '100%', background: m.c, borderRadius: 100, width: '100%' }} />
                    </div>
                  </div>
                ))}
                <div style={{ marginTop: 12, padding: '10px 12px', background: '#f8f8f7', borderRadius: 8, fontSize: 13, color: '#555' }}>
                  <strong>Εβδ. στόχος γραφείου:</strong> {ogCallsW} calls → {ogAppt1W} ραντ.1 → {ogAppt2W} ραντ.2 → {ogListW} αναθέσεις, από όλο το γραφείο μαζί
                </div>
              </div>
            </div>
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
  const { role, loading } = useApp()
  const isCeo = role === 'ceo'

  // Locked for regular agents by product decision — Intelligence OP is
  // admin/CEO-only now, same treatment as GPI. `loading` must gate FIRST:
  // while useApp() is still resolving the real role, isCeo is only
  // provisionally false, and falling through to the real page below
  // (instead of a neutral loading state) would flash the full CEO view
  // before access is actually known. Server-side, CeoIntelligence's own
  // data route (/api/monitor/production) is already admin-gated regardless.
  if (loading) return <Shell><div style={{ padding: '3rem', textAlign: 'center', color: '#888', fontSize: 13 }}>Φόρτωση...</div></Shell>
  if (!isCeo) {
    return <Shell><LockedFeature title="Το Intelligence OP είναι κλειδωμένο" message="Αυτή η προβολή είναι διαθέσιμη μόνο σε CEO/Admin." /></Shell>
  }

  return (
    <Shell>
      <div style={{ padding: '2rem', maxWidth: 1100 }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <h1 style={{ fontSize: 22, fontWeight: 500, color: '#1a1a1a', margin: 0 }}>Intelligence OP — Εταιρική Εικόνα</h1>
          <p style={{ color: '#888', fontSize: 14, margin: '4px 0 0' }}>Συγκεντρωτική εικόνα portfolio, παραγωγής και περιοχών — όλο το γραφείο μακροσκοπικά</p>
        </div>
        <CeoIntelligence />
      </div>
    </Shell>
  )
}