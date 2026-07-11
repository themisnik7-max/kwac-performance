'use client'
import { useState, useEffect } from 'react'
import Shell from '@/components/Shell'
import { useApp } from '@/lib/AppContext'
import { createClient } from '@/lib/supabase'
import { authedFetch } from '@/lib/authedFetch'

export default function BoardPage() {
  const { agent } = useApp()
  const [openHouses, setOpenHouses] = useState<any[]>([])
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [volunteers, setVolunteers] = useState<Record<string, any[]>>({}) // open_house_id -> volunteer rows
  const [tab, setTab] = useState<'openhouses'|'announcements'>('openhouses')
  const [joining, setJoining] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const supabase = createClient()

  useEffect(() => {
    supabase.from('open_houses').select('*, agents(full_name)').order('date', { ascending: true }).limit(200).then(({ data }) => setOpenHouses(data || []))
    supabase.from('announcements').select('*, agents(full_name)').order('created_at', { ascending: false }).limit(20).then(({ data }) => {
      setAnnouncements(data || [])
      const ohIds = (data || []).map(a => a.open_house_id).filter(Boolean)
      if (ohIds.length) {
        supabase.from('open_house_volunteers').select('open_house_id, agent_id, agents(full_name)').in('open_house_id', ohIds).then(({ data: vols }) => {
          const byOh: Record<string, any[]> = {}
          for (const v of vols || []) (byOh[v.open_house_id] ||= []).push(v)
          setVolunteers(byOh)
        })
      }
    })
  }, [])

  function fmt(d: string) {
    return new Date(d).toLocaleDateString('el-GR', { weekday: 'short', day: 'numeric', month: 'short' })
  }
  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  async function joinOpenHouse(openHouseId: string) {
    if (!agent) return
    setJoining(openHouseId)
    const res = await authedFetch('/api/open-house-volunteers', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ open_house_id: openHouseId, agent_id: agent.id }),
    })
    const data = await res.json()
    setJoining(null)
    if (!res.ok) { showToast('❌ ' + (data.error || 'Σφάλμα')); return }
    showToast('✅ Δήλωσες συμμετοχή!')
    setVolunteers(prev => ({ ...prev, [openHouseId]: [...(prev[openHouseId] || []), { open_house_id: openHouseId, agent_id: agent.id, agents: { full_name: agent.full_name } }] }))
  }

  async function leaveOpenHouse(openHouseId: string) {
    if (!agent) return
    setJoining(openHouseId)
    const res = await authedFetch('/api/open-house-volunteers', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ open_house_id: openHouseId, agent_id: agent.id }),
    })
    setJoining(null)
    if (!res.ok) { const d = await res.json(); showToast('❌ ' + (d.error || 'Σφάλμα')); return }
    showToast('↩ Απόσυρες τη συμμετοχή')
    setVolunteers(prev => ({ ...prev, [openHouseId]: (prev[openHouseId] || []).filter(v => v.agent_id !== agent.id) }))
  }

  return (
    <Shell>
      <div style={{ padding: '2rem', maxWidth: 900 }}>
        <h1 style={{ fontSize: 22, fontWeight: 500, color: '#1a1a1a', margin: '0 0 4px' }}>Πινακας Ανακοινωσεων</h1>
        <p style={{ color: '#6B7280', fontSize: 14, margin: '0 0 1.5rem' }}>Open Houses & ανακοινωσεις της εβδομαδας</p>

        {toast && (
          <div style={{ background: toast.startsWith('❌') ? '#FCEBEB' : '#EAF3DE', color: toast.startsWith('❌') ? '#A32D2D' : '#3B6D11', padding: '10px 16px', borderRadius: 8, marginBottom: 14, fontSize: 13 }}>
            {toast}
          </div>
        )}

        <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '0.5px solid #e8e8e8' }}>
          {[{k:'openhouses',l:'Open Houses'},{k:'announcements',l:'Ανακοινωσεις'}].map(t=>(
            <button key={t.k} onClick={()=>setTab(t.k as any)}
              style={{ padding:'8px 18px', border:'none', background:'none', fontSize:13, cursor:'pointer',
                color:tab===t.k?'#CC2229':'#6B7280', fontWeight:tab===t.k?500:400,
                borderBottom:tab===t.k?'2px solid #CC2229':'2px solid transparent', marginBottom:-1 }}>
              {t.l}
            </button>
          ))}
        </div>

        {tab==='openhouses' && (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {openHouses.length === 0 && <p style={{ color:'#6B7280', fontSize:14 }}>Δεν υπαρχουν open houses προγραμματισμενα.</p>}
            {openHouses.map(oh=>(
              <div key={oh.id} style={{ background:'#fff', border:'0.5px solid #e8e8e8', borderRadius:12, padding:'1rem 1.25rem', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div style={{ fontSize:14, fontWeight:500 }}>{oh.address || 'Ακινητο'}</div>
                  <div style={{ fontSize:12, color:'#6B7280', marginTop:3 }}>
                    {fmt(oh.date)} · {oh.start_time}–{oh.end_time} · {oh.agents?.full_name}
                  </div>
                  {oh.ilist_code && <div style={{ fontSize:11, color:'#6B7280', marginTop:2 }}>Κωδ. {oh.ilist_code}</div>}
                </div>
                <div style={{ textAlign:'right' }}>
                  {oh.price && <div style={{ fontSize:15, fontWeight:600, color:'#CC2229' }}>€{oh.price.toLocaleString('el-GR')}</div>}
                  <div style={{ fontSize:12, color:'#6B7280' }}>{oh.sqm} τμ</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab==='announcements' && (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {announcements.length === 0 && <p style={{ color:'#6B7280', fontSize:14 }}>Δεν υπαρχουν ανακοινωσεις.</p>}
            {announcements.map(a=>{
              const vols = a.open_house_id ? (volunteers[a.open_house_id] || []) : []
              const iAmIn = agent && vols.some(v => v.agent_id === agent.id)
              const full = vols.length >= 2
              return (
                <div key={a.id} style={{ background:'#fff', border:'0.5px solid #e8e8e8', borderRadius:12, padding:'1rem 1.25rem' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
                    <span style={{ fontSize:14, fontWeight:500 }}>{a.title || 'Ανακοινωση'}</span>
                    <span style={{ fontSize:11, color:'#6B7280' }}>{new Date(a.created_at).toLocaleDateString('el-GR')}</span>
                  </div>
                  <p style={{ fontSize:13, color:'#666', margin:0, lineHeight:1.6 }}>{a.content}</p>
                  <div style={{ fontSize:12, color:'#6B7280', marginTop:6 }}>{a.agents?.full_name}</div>

                  {/* Open-house volunteer signup — up to 2 agents, click to join/leave */}
                  {a.open_house_id && (
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                      <div style={{ fontSize: 12, color: '#6B7280' }}>
                        {vols.length === 0 ? 'Κανείς εθελοντής ακόμα' : `🙋 ${vols.map(v => v.agents?.full_name).filter(Boolean).join(', ')}`}
                        {' '}({vols.length}/2)
                      </div>
                      <button
                        onClick={() => iAmIn ? leaveOpenHouse(a.open_house_id) : joinOpenHouse(a.open_house_id)}
                        disabled={joining === a.open_house_id || (!iAmIn && full)}
                        style={{
                          padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500, border: 'none', cursor: (!iAmIn && full) ? 'default' : 'pointer',
                          background: iAmIn ? '#FCEBEB' : full ? '#F3F4F6' : '#EAF3DE',
                          color: iAmIn ? '#A32D2D' : full ? '#6B7280' : '#3B6D11',
                          opacity: joining === a.open_house_id ? 0.6 : 1,
                        }}>
                        {joining === a.open_house_id ? '...' : iAmIn ? '↩ Απόσυρση' : full ? 'Συμπληρώθηκαν οι θέσεις' : '🙋 Θα βοηθήσω'}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Shell>
  )
}
