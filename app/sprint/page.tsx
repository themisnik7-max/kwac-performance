'use client'
import { useState, useEffect } from 'react'
import Shell from '@/components/Shell'
import { useApp } from '@/lib/AppContext'
import { createClient } from '@/lib/supabase'

export default function SprintPage() {
  const { agent, role } = useApp()
  const isCeo = role === 'ceo'
  const [sprints, setSprints] = useState<any[]>([])
  const [entries, setEntries] = useState<Record<string, any>>({})
  const [active, setActive] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [creating, setCreating] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const supabase = createClient()

  useEffect(() => { fetchSprints() }, [])

  async function fetchSprints() {
    const { data } = await supabase.from('sprint_sessions').select('*').order('date', { ascending: false }).limit(10)
    setSprints(data || [])
    if (data && data.length > 0 && !active) setActive(data[0])
  }

  useEffect(() => {
    if (active) fetchEntries(active.id)
  }, [active])

  async function fetchEntries(sprintId: string) {
    const { data } = await supabase.from('sprint_entries').select('*, agents(full_name)').eq('sprint_id', sprintId)
    const map: Record<string, any> = {}
    data?.forEach(e => { map[e.agent_id] = e })
    setEntries(map)
  }

  async function saveEntry(field: string, value: number) {
    if (!agent || !active) return
    setSaving(true)
    const existing = entries[agent.id]
    const payload = {
      sprint_id: active.id, agent_id: agent.id,
      calls: existing?.calls || 0, leads: existing?.leads || 0, appointments: existing?.appointments || 0,
      [field]: value, updated_at: new Date().toISOString()
    }
    await supabase.from('sprint_entries').upsert(payload, { onConflict: 'sprint_id,agent_id' })
    setEntries(prev => ({ ...prev, [agent.id]: { ...prev[agent.id], [field]: value } }))
    setSaving(false)
  }

  async function createSprint() {
    if (!newLabel.trim() || !agent) return
    setCreating(true)
    const { data } = await supabase.from('sprint_sessions').insert({ label: newLabel, date: new Date().toISOString().split('T')[0], created_by: agent.id }).select().single()
    if (data) { setSprints(prev => [data, ...prev]); setActive(data) }
    setNewLabel(''); setCreating(false)
  }

  const myEntry = agent ? entries[agent.id] : null
  const allAgents = Object.values(entries).sort((a: any, b: any) => (b.calls + b.leads + b.appointments) - (a.calls + a.leads + a.appointments))

  return (
    <Shell>
      <div style={{ padding: '2rem', maxWidth: 1000 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 500, color: '#1a1a1a', margin: 0 }}>Sprint Calls</h1>
            <p style={{ color: '#888', fontSize: 14, margin: '4px 0 0' }}>3 sprints / εβδομαδα - live leaderboard</p>
          </div>
          {isCeo && (
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={newLabel} onChange={e => setNewLabel(e.target.value)}
                placeholder="Τιτλος sprint..." style={{ padding: '8px 12px', border: '0.5px solid #ddd', borderRadius: 8, fontSize: 13, width: 200 }} />
              <button onClick={createSprint} disabled={creating || !newLabel.trim()}
                style={{ padding: '8px 16px', background: '#CC2229', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                + Νεο Sprint
              </button>
            </div>
          )}
        </div>

        {toast && <div style={{ background: '#EAF3DE', color: '#3B6D11', padding: '10px 16px', borderRadius: 8, marginBottom: 16, fontSize: 14 }}>{toast}</div>}

        <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
          {sprints.map(s => (
            <button key={s.id} onClick={() => setActive(s)}
              style={{ padding: '6px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
                background: active?.id === s.id ? '#1a1a1a' : '#fff',
                color: active?.id === s.id ? '#fff' : '#666',
                border: active?.id === s.id ? 'none' : '0.5px solid #e8e8e8' }}>
              {s.label} <span style={{ fontSize: 11, opacity: 0.6 }}>{s.date}</span>
            </button>
          ))}
          {sprints.length === 0 && <p style={{ color: '#bbb', fontSize: 14 }}>Δεν υπαρχουν sprints ακομα. {isCeo ? 'Δημιουργησε ενα παραπανω.' : 'Περιμενε τον coach.'}</p>}
        </div>

        {active && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {!isCeo && agent && (
              <div style={{ background: '#fff', border: '0.5px solid #e8e8e8', borderRadius: 12, padding: '1.25rem' }}>
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 16 }}>Τα νουμερα μου</div>
                {[
                  { key: 'calls', label: 'Calls' },
                  { key: 'leads', label: 'Leads' },
                  { key: 'appointments', label: 'Ραντεβου' }
                ].map(f => (
                  <div key={f.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '0.5px solid #f5f5f5' }}>
                    <span style={{ fontSize: 14 }}>{f.label}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <button onClick={() => saveEntry(f.key, Math.max(0, (myEntry?.[f.key] || 0) - 1))}
                        style={{ width: 32, height: 32, borderRadius: 8, border: '0.5px solid #ddd', background: '#f5f5f5', fontSize: 18, cursor: 'pointer' }}>-</button>
                      <span style={{ fontSize: 22, fontWeight: 500, minWidth: 40, textAlign: 'center' }}>{myEntry?.[f.key] || 0}</span>
                      <button onClick={() => saveEntry(f.key, (myEntry?.[f.key] || 0) + 1)}
                        style={{ width: 32, height: 32, borderRadius: 8, border: '0.5px solid #CC2229', background: '#fff5f5', color: '#CC2229', fontSize: 18, cursor: 'pointer' }}>+</button>
                    </div>
                  </div>
                ))}
                {saving && <div style={{ fontSize: 12, color: '#888', marginTop: 8 }}>Αποθηκευση...</div>}
              </div>
            )}

            <div style={{ background: '#fff', border: '0.5px solid #e8e8e8', borderRadius: 12, padding: '1.25rem', gridColumn: isCeo ? '1 / -1' : 'auto' }}>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 16 }}>Leaderboard</div>
              {allAgents.length === 0 ? (
                <p style={{ color: '#bbb', fontSize: 14 }}>Δεν υπαρχουν καταχωρησεις ακομα.</p>
              ) : allAgents.map((e: any, i) => (
                <div key={e.agent_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '0.5px solid #f5f5f5' }}>
                  <span style={{ fontSize: 16, minWidth: 24, textAlign: 'center' }}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '#' + (i + 1)}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{e.agents?.full_name || 'Agent'}</div>
                    <div style={{ fontSize: 12, color: '#888' }}>Calls: {e.calls} | Leads: {e.leads} | Ραντ: {e.appointments}</div>
                  </div>
                  <span style={{ fontSize: 18, fontWeight: 600, color: '#CC2229' }}>{(e.calls || 0) + (e.leads || 0) + (e.appointments || 0)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Shell>
  )
}