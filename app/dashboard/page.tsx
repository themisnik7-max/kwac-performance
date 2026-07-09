'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useApp } from '@/lib/AppContext'
import { authedFetch } from '@/lib/authedFetch'
import QuickLinks from '@/components/QuickLinks'

const RED = '#CC2229'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtE(n: number | null) { return n ? '€' + Math.round(n).toLocaleString('el-GR') : '—' }

function nextSaturday() {
  const d = new Date()
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7))
  return d.toISOString().split('T')[0]
}

function relativeDate(dateStr: string) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const diff = Math.floor((Date.now() - d.getTime()) / 86400000)
  if (diff === 0) return 'σήμερα'
  if (diff === 1) return 'χθες'
  if (diff < 7) return `${diff} μέρες πριν`
  return d.toLocaleDateString('el-GR', { day: 'numeric', month: 'short' })
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetricCard({ label, value, sub, accent }: any) {
  return (
    <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 12, padding: '20px 24px', borderLeft: accent ? `3px solid ${RED}` : undefined }}>
      <div style={{ fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 600, color: accent ? RED : '#f0f0f0', letterSpacing: '-0.02em' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#444', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function StatRow({ label, value, total, color }: any) {
  const pct = total ? Math.round((value / total) * 100) : 0
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
        <span style={{ color: '#888' }}>{label}</span>
        <span style={{ color: '#f0f0f0', fontWeight: 500 }}>{value}</span>
      </div>
      <div style={{ height: 4, background: '#1e1e1e', borderRadius: 999 }}>
        <div style={{ height: '100%', background: color || RED, borderRadius: 999, width: pct + '%', transition: 'width .6s ease' }} />
      </div>
    </div>
  )
}

// ─── Active Listings ──────────────────────────────────────────────────────────

function PropertyCard({ prop, agentId, onToast }: { prop: any; agentId: string; onToast: (msg: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  const [date, setDate]         = useState(nextSaturday())
  const [startTime, setStart]   = useState('11:00')
  const [endTime, setEnd]       = useState('13:00')
  const [loading, setLoading]   = useState<'oh' | 'nl' | null>(null)

  async function createOpenHouse() {
    setLoading('oh')
    const res = await fetch('/api/open-house-quick', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ property_id: prop.id, agent_id: agentId, date, start_time: startTime, end_time: endTime }),
    })
    const data = await res.json()
    setLoading(null)
    setExpanded(false)
    onToast(data.ok ? `✅ Open House δημιουργήθηκε — ${new Date(date).toLocaleDateString('el-GR')}` : `❌ ${data.error}`)
  }

  async function sendNewsletter() {
    setLoading('nl')
    const res = await authedFetch('/api/marketing/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ property_id: prop.id, agent_id: agentId }),
    })
    const data = await res.json()
    setLoading(null)
    onToast(data.ok ? `✅ Newsletter απεστάλη (${data.recipients || 0} παραλήπτες)` : `❌ ${data.error || 'Σφάλμα'}`)
  }

  return (
    <div style={{ background: '#151515', border: '1px solid #1e1e1e', borderRadius: 10, overflow: 'hidden', transition: 'border-color .15s' }}
      onMouseOver={e => (e.currentTarget.style.borderColor = '#2a2a2a')}
      onMouseOut={e => (e.currentTarget.style.borderColor = '#1e1e1e')}>
      {/* Main row */}
      <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#f0f0f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {prop.address || prop.area || 'Ακίνητο'}
          </div>
          <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>
            {[prop.area, prop.sqm ? prop.sqm + 'τμ' : null].filter(Boolean).join(' · ')}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: RED }}>{fmtE(prop.price_asking)}</div>
          {prop.ilist_id && <div style={{ fontSize: 10, color: '#444', marginTop: 1 }}>#{prop.ilist_id}</div>}
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ padding: '0 14px 12px', display: 'flex', gap: 6 }}>
        <button onClick={() => setExpanded(v => !v)}
          style={{ flex: 1, padding: '6px 0', background: expanded ? '#1e1e1e' : '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: 6, fontSize: 11, color: '#aaa', cursor: 'pointer', transition: 'all .15s' }}>
          📢 {expanded ? 'Άκυρο' : 'Open House'}
        </button>
        <button onClick={sendNewsletter} disabled={loading === 'nl'}
          style={{ flex: 1, padding: '6px 0', background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: 6, fontSize: 11, color: '#aaa', cursor: 'pointer', opacity: loading === 'nl' ? 0.5 : 1, transition: 'all .15s' }}>
          {loading === 'nl' ? '...' : '📧 Newsletter'}
        </button>
      </div>

      {/* Open House inline form */}
      {expanded && (
        <div style={{ padding: '10px 14px 14px', borderTop: '1px solid #1e1e1e', background: '#0d0d0d' }}>
          <div style={{ fontSize: 11, color: '#555', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.08em' }}>Ημ/νία Open House</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              style={{ flex: 2, padding: '6px 8px', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 6, fontSize: 12, color: '#f0f0f0', outline: 'none' }} />
            <input type="time" value={startTime} onChange={e => setStart(e.target.value)}
              style={{ flex: 1, padding: '6px 8px', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 6, fontSize: 12, color: '#f0f0f0', outline: 'none' }} />
            <input type="time" value={endTime} onChange={e => setEnd(e.target.value)}
              style={{ flex: 1, padding: '6px 8px', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 6, fontSize: 12, color: '#f0f0f0', outline: 'none' }} />
          </div>
          <button onClick={createOpenHouse} disabled={loading === 'oh'}
            style={{ width: '100%', padding: '8px', background: RED, border: 'none', borderRadius: 6, fontSize: 12, color: '#fff', fontWeight: 500, cursor: 'pointer', opacity: loading === 'oh' ? 0.6 : 1 }}>
            {loading === 'oh' ? 'Δημιουργία...' : '✓ Δημιουργία & Ανάρτηση'}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Market News ──────────────────────────────────────────────────────────────

function NewsPanel({ articles, loading }: { articles: any[]; loading: boolean }) {
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} style={{ height: 54, background: '#151515', borderRadius: 8, animation: 'pulse 1.5s infinite' }} />
        ))}
      </div>
    )
  }
  if (!articles.length) {
    return <div style={{ color: '#444', fontSize: 13, textAlign: 'center', padding: '2rem 0' }}>Δεν βρέθηκαν άρθρα</div>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {articles.map((a, i) => (
        <a key={i} href={a.link} target="_blank" rel="noopener noreferrer"
          style={{ display: 'block', padding: '9px 0', borderBottom: '1px solid #1a1a1a', textDecoration: 'none', transition: 'all .1s' }}
          onMouseOver={e => { (e.currentTarget.querySelector('.news-title') as HTMLElement).style.color = RED }}
          onMouseOut={e => { (e.currentTarget.querySelector('.news-title') as HTMLElement).style.color = '#d0d0d0' }}>
          <div className="news-title" style={{ fontSize: 12, color: '#d0d0d0', lineHeight: 1.45, marginBottom: 3, transition: 'color .1s' }}>
            {a.title}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: '#444', background: '#161616', padding: '1px 6px', borderRadius: 4 }}>{a.source}</span>
            <span style={{ fontSize: 10, color: '#333' }}>{relativeDate(a.pubDate)}</span>
          </div>
        </a>
      ))}
    </div>
  )
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const { agent, loading: agentLoading } = useApp()
  const [stats, setStats]               = useState({ agents: 0, contacts: 0, properties: 0, submissions: 0 })
  const [statsLoading, setStatsLoading] = useState(true)
  const [myProps, setMyProps]           = useState<any[]>([])
  const [propsLoading, setPropsLoading] = useState(true)
  const [news, setNews]                 = useState<any[]>([])
  const [newsLoading, setNewsLoading]   = useState(true)
  const [toast, setToast]               = useState('')
  const [sprint, setSprint]             = useState<any>(null)
  const [sprintBoard, setSprintBoard]   = useState<any[]>([])
  const [sprintLoading, setSprintLoading] = useState(true)
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [annLoading, setAnnLoading]     = useState(true)

  const now     = new Date()
  const hour    = now.getHours()
  const greeting = hour < 12 ? 'Καλημέρα' : 'Καλησπέρα'

  // Global stats
  useEffect(() => {
    Promise.all([
      supabase.from('agents').select('id', { count: 'exact', head: true }).then(r => r.count || 0),
      supabase.from('contacts').select('id', { count: 'exact', head: true }).then(r => r.count || 0),
      supabase.from('properties').select('id', { count: 'exact', head: true }).then(r => r.count || 0),
      supabase.from('weekly_submissions').select('id', { count: 'exact', head: true }).then(r => r.count || 0),
    ]).then(([agents, contacts, properties, submissions]) => {
      setStats({ agents, contacts, properties, submissions })
      setStatsLoading(false)
    }).catch(() => setStatsLoading(false))
  }, [])

  // My active listings — wait for agent to load
  useEffect(() => {
    if (agentLoading || !agent?.id) return
    supabase
      .from('properties')
      .select('id, address, area, sqm, price_asking, ilist_id, status, property_type')
      .eq('agent_id', agent.id)
      .neq('status', 'sold')
      .order('listed_at', { ascending: false })
      .limit(12)
      .then(({ data }) => {
        setMyProps(data || [])
        setPropsLoading(false)
      }, () => setPropsLoading(false))
  }, [agent, agentLoading])

  // Market news
  useEffect(() => {
    fetch('/api/market-news')
      .then(r => r.json())
      .then(d => { setNews(d.articles || []); setNewsLoading(false) })
      .catch(() => setNewsLoading(false))
  }, [])

  // Latest sprint session's live leaderboard — same data /sprint shows,
  // surfaced here so results are visible without leaving the dashboard.
  useEffect(() => {
    supabase.from('sprint_sessions').select('*').order('date', { ascending: false }).limit(1)
      .then(({ data }) => {
        const latest = data?.[0] || null
        setSprint(latest)
        if (!latest) { setSprintLoading(false); return }
        supabase.from('sprint_entries').select('*, agents(full_name)').eq('sprint_id', latest.id)
          .then(({ data: entries }) => {
            const sorted = (entries || []).sort((a, b) => ((b.calls || 0) + (b.leads || 0) + (b.appointments || 0)) - ((a.calls || 0) + (a.leads || 0) + (a.appointments || 0)))
            setSprintBoard(sorted.slice(0, 5))
            setSprintLoading(false)
          }, () => setSprintLoading(false))
      }, () => setSprintLoading(false))
  }, [])

  // Recent announcements — same data /board's Ανακοινώσεις tab shows.
  useEffect(() => {
    supabase.from('announcements').select('*, agents(full_name)').order('created_at', { ascending: false }).limit(4)
      .then(({ data }) => { setAnnouncements(data || []); setAnnLoading(false) }, () => setAnnLoading(false))
  }, [])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 4000)
  }

  return (
    <div style={{ padding: '32px 40px', minHeight: '100vh', background: '#0d0d0d' }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: 6 }}>KWAC · ZadesHome</div>
          <h1 style={{ fontSize: 28, fontWeight: 600, color: '#f0f0f0', letterSpacing: '-0.02em', margin: 0 }}>
            {greeting}{agent?.full_name ? `, ${agent.full_name.split(' ')[0]}` : ''}
          </h1>
          <div style={{ fontSize: 13, color: '#555', marginTop: 4 }}>
            {now.toLocaleDateString('el-GR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <a href="/submit" style={{ padding: '9px 18px', borderRadius: 8, background: RED, color: 'white', fontSize: 13, fontWeight: 500, textDecoration: 'none' }}>+ Μετρησιμότητα</a>
          <a href="/import" style={{ padding: '9px 18px', borderRadius: 8, background: '#1a1a1a', color: '#888', fontSize: 13, border: '1px solid #2a2a2a', textDecoration: 'none' }}>iList Import</a>
        </div>
      </div>

      {/* ── Toast ── */}
      {toast && (
        <div style={{ background: toast.startsWith('❌') ? '#2d0f0f' : '#0f1f0f', border: `1px solid ${toast.startsWith('❌') ? '#5a1a1a' : '#1a3a1a'}`, color: toast.startsWith('❌') ? '#ff8080' : '#80c880', padding: '10px 16px', borderRadius: 8, marginBottom: 20, fontSize: 13 }}>
          {toast}
        </div>
      )}

      {/* ── KPI Row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
        <MetricCard label="Μεσίτες"         value={statsLoading ? '—' : stats.agents}                  sub="Ενεργά μέλη" accent />
        <MetricCard label="Επαφές"           value={statsLoading ? '—' : stats.contacts.toLocaleString()} sub="Στη βάση δεδομένων" />
        <MetricCard label="Ακίνητα"          value={statsLoading ? '—' : stats.properties.toLocaleString()} sub="Καταχωρημένα" />
        <MetricCard label="Ενεργά μου"       value={propsLoading ? '—' : myProps.length}                 sub="Σε εξέλιξη" />
      </div>

      {/* ── Quick-access external shortcuts ── */}
      <QuickLinks />

      {/* ── Main 3-column grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr 300px', gap: 16, marginBottom: 16 }}>

        {/* ── Col 1: Quick Actions ── */}
        <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 12, padding: '20px' }}>
          <div style={{ fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 14 }}>Γρήγορες ενέργειες</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              { href: '/meeting',     label: 'Meeting ακινήτων', icon: '⬡', desc: 'Αξιολόγηση + εκτίμηση' },
              { href: '/submit',      label: 'Εβδ. ενέργειες',  icon: '✎', desc: 'Καταχώρηση εβδομάδας' },
              { href: '/sprint',      label: 'Sprint Calls',     icon: '▶', desc: 'Καταχώρηση sprint' },
              { href: '/board',       label: 'Ανακοινώσεις',    icon: '◈', desc: 'Open Houses & events' },
              { href: '/intelligence',label: 'AI Insights',      icon: '✦', desc: 'Ανάλυση δεδομένων' },
              { href: '/gps',         label: 'GPS Goals',        icon: '◉', desc: 'Οικονομικοί στόχοι' },
              { href: '/profile',     label: 'Χάρτης',           icon: '◎', desc: 'Portfolio map' },
            ].map(a => (
              <a key={a.href} href={a.href}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, background: '#151515', border: '1px solid #1e1e1e', textDecoration: 'none', transition: 'all .15s' }}
                onMouseOver={e => { e.currentTarget.style.borderColor = RED; e.currentTarget.style.background = '#1a1a1a' }}
                onMouseOut={e => { e.currentTarget.style.borderColor = '#1e1e1e'; e.currentTarget.style.background = '#151515' }}>
                <span style={{ fontSize: 16, width: 22, textAlign: 'center', flexShrink: 0 }}>{a.icon}</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#f0f0f0' }}>{a.label}</div>
                  <div style={{ fontSize: 10, color: '#444', marginTop: 1 }}>{a.desc}</div>
                </div>
              </a>
            ))}
          </div>

          {/* System pillars */}
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #1e1e1e' }}>
            <div style={{ fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 12 }}>Πυλώνες</div>
            <StatRow label="Επαφές"  value={statsLoading ? 0 : stats.contacts}  total={500} color={RED} />
            <StatRow label="Ακίνητα" value={statsLoading ? 0 : stats.properties} total={200} color="#3b82f6" />
            <StatRow label="Μεσίτες" value={statsLoading ? 0 : stats.agents}     total={60}  color="#22c55e" />
          </div>
        </div>

        {/* ── Col 2: My Active Listings ── */}
        <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 12, padding: '20px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: '.1em' }}>
              Ενεργά μου ακίνητα
            </div>
            <a href="/profile" style={{ fontSize: 11, color: '#555', textDecoration: 'none' }}
              onMouseOver={e => (e.currentTarget.style.color = '#888')}
              onMouseOut={e => (e.currentTarget.style.color = '#555')}>
              Όλα →
            </a>
          </div>

          {propsLoading || agentLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[1, 2, 3].map(i => (
                <div key={i} style={{ height: 70, background: '#151515', borderRadius: 10 }} />
              ))}
            </div>
          ) : myProps.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#333', padding: '2rem 0' }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>🏠</div>
              <div style={{ fontSize: 13, marginBottom: 6 }}>Δεν υπάρχουν ενεργά ακίνητα</div>
              <a href="/import" style={{ fontSize: 12, color: RED, textDecoration: 'none' }}>↑ Import από iList</a>
            </div>
          ) : (
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 520, paddingRight: 2 }}>
              {myProps.map(p => (
                <PropertyCard key={p.id} prop={p} agentId={agent?.id} onToast={showToast} />
              ))}
            </div>
          )}

          {!propsLoading && myProps.length > 0 && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #1e1e1e', fontSize: 11, color: '#333', textAlign: 'center' }}>
              📢 OpenHouse → ανεβαίνει αυτόματα στις Ανακοινώσεις &nbsp;·&nbsp; 📧 Newsletter → Brevo
            </div>
          )}
        </div>

        {/* ── Col 3: Νέα Αγοράς ── */}
        <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 12, padding: '20px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: '.1em' }}>Νέα Αγοράς</div>
            <div style={{ fontSize: 10, color: '#333' }}>ανανεώνεται /30λ</div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', maxHeight: 560, paddingRight: 2 }}>
            <NewsPanel articles={news} loading={newsLoading} />
          </div>

          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #1e1e1e', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {['realestatemagazine.gr', 'propertyclub.gr', 'geoaxis.gr'].map(s => (
              <a key={s} href={`https://${s}`} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 10, color: '#333', textDecoration: 'none', padding: '2px 6px', background: '#161616', borderRadius: 4, border: '1px solid #1e1e1e' }}
                onMouseOver={e => (e.currentTarget.style.color = '#888')}
                onMouseOut={e => (e.currentTarget.style.color = '#333')}>
                {s}
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* ── Sprint results + Announcements ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 12, padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: '.1em' }}>
              🔥 Sprint Calls {sprint ? `— ${sprint.label}` : ''}
            </div>
            <a href="/sprint" style={{ fontSize: 11, color: '#555', textDecoration: 'none' }}>Όλα →</a>
          </div>
          {sprintLoading ? (
            <div style={{ color: '#444', fontSize: 13 }}>Φόρτωση...</div>
          ) : !sprint ? (
            <div style={{ color: '#444', fontSize: 13, textAlign: 'center', padding: '1rem 0' }}>Κανένα sprint ακόμα.</div>
          ) : sprintBoard.length === 0 ? (
            <div style={{ color: '#444', fontSize: 13, textAlign: 'center', padding: '1rem 0' }}>Κανείς δεν έχει καταχωρήσει ακόμα.</div>
          ) : sprintBoard.map((e, i) => (
            <div key={e.agent_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: i < sprintBoard.length - 1 ? '1px solid #1a1a1a' : 'none' }}>
              <span style={{ fontSize: 14, minWidth: 20, textAlign: 'center' }}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '#' + (i + 1)}</span>
              <span style={{ flex: 1, fontSize: 13, color: '#f0f0f0' }}>{e.agents?.full_name || 'Agent'}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: RED }}>{(e.calls || 0) + (e.leads || 0) + (e.appointments || 0)}</span>
            </div>
          ))}
        </div>

        <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 12, padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: '.1em' }}>📣 Ανακοινώσεις</div>
            <a href="/board" style={{ fontSize: 11, color: '#555', textDecoration: 'none' }}>Όλα →</a>
          </div>
          {annLoading ? (
            <div style={{ color: '#444', fontSize: 13 }}>Φόρτωση...</div>
          ) : announcements.length === 0 ? (
            <div style={{ color: '#444', fontSize: 13, textAlign: 'center', padding: '1rem 0' }}>Καμία ανακοίνωση ακόμα.</div>
          ) : announcements.map((a, i) => (
            <div key={a.id} style={{ padding: '7px 0', borderBottom: i < announcements.length - 1 ? '1px solid #1a1a1a' : 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 13, color: '#f0f0f0', fontWeight: 500 }}>{a.title || 'Ανακοίνωση'}</span>
                <span style={{ fontSize: 10, color: '#444', flexShrink: 0 }}>{relativeDate(a.created_at)}</span>
              </div>
              {a.content && <div style={{ fontSize: 12, color: '#666', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.content}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* ── Status bar ── */}
      <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 12, padding: '14px 24px', display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
        {[
          { l: 'Vercel',    v: 'Production', c: '#22c55e' },
          { l: 'Supabase',  v: 'Connected',  c: '#22c55e' },
          { l: 'Make.com',  v: 'Active',     c: '#22c55e' },
          { l: 'News feed', v: newsLoading ? '...' : `${news.length} άρθρα`, c: newsLoading ? '#555' : '#3b82f6' },
        ].map(s => (
          <div key={s.l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: s.c, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: '#555' }}>{s.l}:</span>
            <span style={{ fontSize: 12, color: '#888', fontWeight: 500 }}>{s.v}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
