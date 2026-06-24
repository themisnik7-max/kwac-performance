'use client'
// app/monitor/page.tsx
// CEO/Admin only: compliance dashboard — who has profiles, who submitted, meeting props, sprints

import { useState, useEffect } from 'react'
import Shell from '@/components/Shell'
import { useApp } from '@/lib/AppContext'
import { authedFetch } from '@/lib/authedFetch'

type Agent = {
  id:                  string
  full_name:           string | null
  email:               string
  role:                string
  joined_at:           string | null
  has_gps_goal:        boolean
  submitted_this_week: boolean
  total_submissions:   number
  meeting_props_count: number
  last_sprint_at:      string | null
  last_submission_at:  string | null
}

function Badge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 10px', borderRadius: 100, fontSize: 11, fontWeight: 500,
      background: ok ? '#EAF3DE' : '#FFF5F5',
      color:      ok ? '#3B6D11'  : '#CC2229',
    }}>
      {ok ? '✓' : '✗'} {label}
    </span>
  )
}

function relativeDate(dateStr: string | null) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  const diffDays = Math.floor((Date.now() - d.getTime()) / 86400000)
  if (diffDays === 0) return 'Σήμερα'
  if (diffDays === 1) return 'Χθες'
  if (diffDays < 7)  return `${diffDays}μ πριν`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}εβδ πριν`
  return `${Math.floor(diffDays / 30)}μήν πριν`
}

export default function MonitorPage() {
  const { role } = useApp()
  const isCeo = role === 'ceo' || role === 'admin'

  const [agents, setAgents]   = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState<'all' | 'missing' | 'ok'>('all')

  useEffect(() => {
    if (!isCeo) return
    authedFetch('/api/monitor')
      .then(r => r.json())
      .then(d => { setAgents(d.agents || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [isCeo])

  if (!isCeo) {
    return (
      <Shell>
        <div style={{ padding: '4rem', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
          <div style={{ fontSize: 16, color: '#888' }}>Η σελίδα αυτή είναι διαθέσιμη μόνο σε CEO / Admin.</div>
        </div>
      </Shell>
    )
  }

  // ── Summary counts ─────────────────────────────────────────────────────────
  const total          = agents.length
  const submitted      = agents.filter(a => a.submitted_this_week).length
  const hasGPS         = agents.filter(a => a.has_gps_goal).length
  const hasMeeting     = agents.filter(a => a.meeting_props_count > 0).length
  const activeLastWeek = agents.filter(a => a.last_sprint_at && new Date(a.last_sprint_at) > new Date(Date.now() - 7 * 86400000)).length

  // ── Score per agent: 0-4 ──────────────────────────────────────────────────
  function score(a: Agent) {
    return [a.submitted_this_week, a.has_gps_goal, a.meeting_props_count > 0, !!a.last_sprint_at].filter(Boolean).length
  }

  const visible = agents
    .filter(a => {
      if (filter === 'missing') return score(a) < 3
      if (filter === 'ok')      return score(a) >= 3
      return true
    })
    .sort((a, b) => score(b) - score(a))

  return (
    <Shell>
      <div style={{ padding: '2rem', maxWidth: 1100 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 500, color: '#1a1a1a', margin: 0 }}>Monitor — Παρακολούθηση Ομάδας</h1>
            <p style={{ color: '#888', fontSize: 14, margin: '4px 0 0' }}>Compliance overview: εβδ. Μετρησιμότητα, GPS, Meeting, Sprint</p>
          </div>
        </div>

        {/* Summary KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { l: 'Σύνολο Μεσιτών', v: total, c: '#1a1a1a' },
            { l: 'Μετρ. αυτή την εβδ', v: `${submitted}/${total}`, c: submitted === total ? '#3B6D11' : '#CC2229' },
            { l: 'Έχουν GPS Στόχο', v: `${hasGPS}/${total}`, c: hasGPS === total ? '#3B6D11' : '#BA7517' },
            { l: 'Ακίνητα σε Meeting', v: `${hasMeeting}/${total}`, c: '#378ADD' },
            { l: 'Sprint τελ. 7μ.', v: `${activeLastWeek}/${total}`, c: activeLastWeek >= total * 0.7 ? '#3B6D11' : '#CC2229' },
          ].map(k => (
            <div key={k.l} style={{ background: '#fff', border: '0.5px solid #e8e8e8', borderRadius: 12, padding: '1rem 1.25rem' }}>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>{k.l}</div>
              <div style={{ fontSize: 22, fontWeight: 600, color: k.c }}>{k.v}</div>
            </div>
          ))}
        </div>

        {/* Compliance bar */}
        {total > 0 && (
          <div style={{ background: '#fff', border: '0.5px solid #e8e8e8', borderRadius: 12, padding: '1rem 1.25rem', marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>Μετρησιμότητα αυτής της εβδομάδας</span>
              <span style={{ fontSize: 13, color: '#888' }}>{submitted}/{total} μεσίτες</span>
            </div>
            <div style={{ background: '#f0f0f0', borderRadius: 100, height: 10, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 100,
                background: submitted === total ? '#3B6D11' : submitted >= total * 0.7 ? '#BA7517' : '#CC2229',
                width: `${pct(submitted, total)}%`,
                transition: 'width .5s ease',
              }} />
            </div>
          </div>
        )}

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {([
            { key: 'all',     label: 'Όλοι' },
            { key: 'missing', label: '⚠️ Ελλιπείς' },
            { key: 'ok',      label: '✅ Πλήρεις' },
          ] as const).map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              style={{ padding: '6px 14px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 500, cursor: 'pointer',
                background: filter === f.key ? '#1a1a1a' : '#fff',
                color: filter === f.key ? '#fff' : '#666',
                border: filter === f.key ? 'none' : '0.5px solid #e8e8e8',
              }}>
              {f.label} {f.key === 'all' ? `(${total})` : f.key === 'missing' ? `(${agents.filter(a => score(a) < 3).length})` : `(${agents.filter(a => score(a) >= 3).length})`}
            </button>
          ))}
        </div>

        {/* Agent table */}
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#bbb' }}>Φόρτωση...</div>
        ) : (
          <div style={{ background: '#fff', border: '0.5px solid #e8e8e8', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#F8F8F7', borderBottom: '1px solid #F0F0F0' }}>
                  {['Μεσίτης', 'Μετρ. εβδ.', 'GPS Στόχος', 'Meeting Ακινήτων', 'Τελ. Sprint', 'Τελ. Υποβολή', 'Score'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 500, color: '#888', fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 && (
                  <tr><td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: '#bbb' }}>Δεν υπάρχουν αποτελέσματα.</td></tr>
                )}
                {visible.map(a => {
                  const sc = score(a)
                  return (
                    <tr key={a.id} style={{ borderBottom: '0.5px solid #F8F8F8' }}>
                      <td style={{ padding: '12px' }}>
                        <div style={{ fontWeight: 500 }}>{a.full_name || '—'}</div>
                        <div style={{ fontSize: 11, color: '#aaa' }}>{a.email}</div>
                      </td>
                      <td style={{ padding: '12px' }}><Badge ok={a.submitted_this_week} label={a.submitted_this_week ? 'Υπεβλήθη' : 'Εκκρεμεί'} /></td>
                      <td style={{ padding: '12px' }}><Badge ok={a.has_gps_goal} label={a.has_gps_goal ? 'Ορίστηκε' : 'Λείπει'} /></td>
                      <td style={{ padding: '12px' }}>
                        {a.meeting_props_count > 0
                          ? <span style={{ color: '#3B6D11', fontWeight: 500 }}>{a.meeting_props_count} ακίνητα</span>
                          : <span style={{ color: '#CC2229' }}>Κανένα</span>}
                      </td>
                      <td style={{ padding: '12px', color: '#888' }}>{relativeDate(a.last_sprint_at)}</td>
                      <td style={{ padding: '12px', color: '#888' }}>
                        <div>{relativeDate(a.last_submission_at)}</div>
                        <div style={{ fontSize: 11, color: '#ccc' }}>{a.total_submissions} συνολικά</div>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <div style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          width: 28, height: 28, borderRadius: '50%',
                          background: sc === 4 ? '#EAF3DE' : sc >= 2 ? '#FFF8E6' : '#FFF5F5',
                          color:      sc === 4 ? '#3B6D11'  : sc >= 2 ? '#BA7517'  : '#CC2229',
                          fontWeight: 700, fontSize: 13,
                        }}>
                          {sc}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ marginTop: 16, fontSize: 11, color: '#ccc' }}>
          Score = Μετρησιμότητα + GPS + Meeting + Sprint (max 4) · Ανανεώνεται real-time
        </div>
      </div>
    </Shell>
  )
}

function pct(a: number, b: number) { return b > 0 ? Math.round((a / b) * 100) : 0 }
