'use client'
import { useState, useEffect } from 'react'
import Shell from '@/components/Shell'
import { createClient } from '@/lib/supabase'

export default function BoardPage() {
  const [agent, setAgent] = useState<any>(null)
  const [openHouses, setOpenHouses] = useState<any[]>([])
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [tab, setTab] = useState<'openhouses'|'announcements'>('openhouses')
  const [volunteers, setVolunteers] = useState<Record<string, any[]>>({})
  const [toast, setToast] = useState('')
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { window.location.href = '/login'; return }
      supabase.from('agents').select('*').eq('email', data.user.email).single()
        .then(({ data: a }) => { setAgent(a); fetchData() })
    })
  }, [])

  async function fetchData() {
    const today = new Date().toISOString().split('T')[0]
    const { data: oh } = await supabase.from('open_houses')
      .select('*').gte('date', today).order('date')
    setOpenHouses(oh || [])

    const { data: ann } = await supabase.from('board_announcements')
      .select('*, agents(full_name)').order('created_at', { ascending: false })
    setAnnouncements(ann || [])

    // Fetch volunteers for each open house
    if (oh && oh.length > 0) {
      const volMap: Record<string, any[]> = {}
      for (const o of oh) {
        const { data: vols } = await supabase.from('open_house_volunteers')
          .select('*, agents(full_name)').eq('open_house_id', o.id)
        volMap[o.id] = vols || []
      }
      setVolunteers(volMap)
    }
  }

  async function toggleVolunteer(ohId: string) {
    if (!agent) return
    const myVols = volunteers[ohId] || []
    const iAmIn = myVols.some(v => v.agent_id === agent.id)

    if (iAmIn) {
      await fetch('/api/open-house-volunteers', {
        method: 'DELETE', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ open_house_id: ohId, agent_id: agent.id })
      })
      setToast('ÎÏÎ±Î¹ÏÎ­Î¸Î·ÎºÎµÏ Î±ÏÏ ÏÎ¿ÏÏ ÎµÎ¸ÎµÎ»Î¿Î½ÏÎ­Ï')
    } else {
      if (myVols.length >= 2) { setToast('ÎÎ¹ 2 Î¸Î­ÏÎµÎ¹Ï Î­ÏÎ¿ÏÎ½ ÏÏÎ¼ÏÎ»Î·ÏÏÎ¸ÎµÎ¯'); setTimeout(() => setToast(''), 3000); return }
      const res = await fetch('/api/open-house-volunteers', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ open_house_id: ohId, agent_id: agent.id })
      })
      const d = await res.json()
      if (!res.ok) { setToast(d.error || 'Î£ÏÎ¬Î»Î¼Î±'); setTimeout(() => setToast(''), 3000); return }
      setToast('â ÎÎ·Î»ÏÎ¸Î·ÎºÎµÏ ÎµÎ¸ÎµÎ»Î¿Î½ÏÎ®Ï!')
    }
    await fetchData()
    setTimeout(() => setToast(''), 3000)
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('el-GR', { weekday: 'short', day: 'numeric', month: 'short' })
  }

  return (
    <Shell><div style={{padding:"2rem",maxWidth:1100}}>
        <div style={{marginBottom:'1.5rem'}}>
          <h1 style={{fontSize:22,fontWeight:500,color:'#1a1a1a',margin:0}}>Î Î¯Î½Î±ÎºÎ±Ï ÎÎ½Î±ÎºÎ¿Î¹Î½ÏÏÎµÏÎ½</h1>
        </div>

        {toast && <div style={{background: toast.includes('â')?'#EAF3DE':'#FCEBEB', color: toast.includes('â')?'#3B6D11':'#A32D2D', padding:'10px 16px',borderRadius:8,marginBottom:16,fontSize:14}}>{toast}</div>}

        <div style={{display:'flex',gap:8,marginBottom:20}}>
          {(['openhouses','announcements'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{padding:'7px 16px',borderRadius:8,fontSize:13,cursor:'pointer',fontWeight:500,
                background: tab===t ? '#CC2229' : '#fff', color: tab===t ? '#fff' : '#666',
                border: `0.5px solid ${tab===t ? '#CC2229' : '#ddd'}`}}>
              {t === 'openhouses' ? 'ð  Open Houses' : 'ð¢ ÎÎ½Î±ÎºÎ¿Î¹Î½ÏÏÎµÎ¹Ï'}
            </button>
          ))}
        </div>

        {tab === 'openhouses' && (
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            {openHouses.length === 0 && <div style={{color:'#bbb',fontSize:14,padding:'2rem',textAlign:'center'}}>ÎÎµÎ½ ÏÏÎ¬ÏÏÎ¿ÏÎ½ ÏÏÎ¿Î³ÏÎ±Î¼Î¼Î±ÏÎ¹ÏÎ¼Î­Î½Î± Open Houses</div>}
            {openHouses.map(oh => {
              const vols = volunteers[oh.id] || []
              const iAmIn = vols.some(v => v.agent_id === agent?.id)
              const isFull = vols.length >= 2
              return (
                <div key={oh.id} style={{background:'#fff',border:'0.5px solid #e8e8e8',borderRadius:12,padding:'1.25rem'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12}}>
                    <div style={{flex:1}}>
                      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                        <span style={{fontSize:15,fontWeight:500}}>{oh.address}</span>
                        {oh.ilist_code && <span style={{fontSize:11,color:'#888',background:'#f5f5f5',padding:'2px 6px',borderRadius:4}}>#{oh.ilist_code}</span>}
                      </div>
                      <div style={{fontSize:13,color:'#666'}}>
                        ð {formatDate(oh.date)} &nbsp;â° {oh.time_start} â {oh.time_end}
                        {oh.property_type && <>&nbsp;&nbsp;ð  {oh.property_type}</>}
                        {oh.price && <>&nbsp;&nbsp;ð¶ {Number(oh.price).toLocaleString('el-GR')}â¬</>}
                      </div>
                      {oh.notes && <div style={{fontSize:12,color:'#888',marginTop:4}}>{oh.notes}</div>}
                    </div>
                    <button onClick={() => toggleVolunteer(oh.id)}
                      style={{padding:'7px 14px',borderRadius:8,fontSize:12,fontWeight:500,cursor:'pointer',whiteSpace:'nowrap',
                        background: iAmIn ? '#EAF3DE' : isFull ? '#f5f5f5' : '#fff5f5',
                        color: iAmIn ? '#3B6D11' : isFull ? '#aaa' : '#CC2229',
                        border: `0.5px solid ${iAmIn ? '#C0DD97' : isFull ? '#ddd' : '#f0c0c0'}`}}>
                      {iAmIn ? 'â Î£ÏÎ¼Î¼ÎµÏÎ­ÏÏ' : isFull ? 'Î Î»Î®ÏÎµÏ' : '+ ÎÎ¸ÎµÎ»Î¿Î½ÏÎ®Ï'}
                    </button>
                  </div>

                  {/* Volunteers section */}
                  <div style={{marginTop:10,paddingTop:10,borderTop:'0.5px solid #f5f5f5',display:'flex',alignItems:'center',gap:8}}>
                    <span style={{fontSize:12,color:'#888'}}>ÎÎ¸ÎµÎ»Î¿Î½ÏÎ­Ï ({vols.length}/2):</span>
                    {vols.length === 0 && <span style={{fontSize:12,color:'#bbb'}}>ÎÎ±Î½ÎµÎ¯Ï Î±ÎºÏÎ¼Î±</span>}
                    {vols.map(v => (
                      <span key={v.id} style={{fontSize:12,background:'#E6F1FB',color:'#185FA5',padding:'2px 8px',borderRadius:20,fontWeight:500}}>
                        {v.agents?.full_name || 'Agent'}
                      </span>
                    ))}
                    {[...Array(Math.max(0, 2 - vols.length))].map((_, i) => (
                      <span key={i} style={{fontSize:12,background:'#f5f5f5',color:'#bbb',padding:'2px 8px',borderRadius:20}}>
                        ÎÎµÎ½Î® Î¸Î­ÏÎ·
                      </span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {tab === 'announcements' && (
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {announcements.length === 0 && <div style={{color:'#bbb',fontSize:14,padding:'2rem',textAlign:'center'}}>ÎÎµÎ½ ÏÏÎ¬ÏÏÎ¿ÏÎ½ Î±Î½Î±ÎºÎ¿Î¹Î½ÏÏÎµÎ¹Ï</div>}
            {announcements.map(a => (
              <div key={a.id} style={{background:'#fff',border:'0.5px solid #e8e8e8',borderRadius:12,padding:'1rem 1.25rem'}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                  <span style={{fontSize:13,fontWeight:500}}>{a.title}</span>
                  <span style={{fontSize:11,color:'#888'}}>{a.agents?.full_name}</span>
                </div>
                <div style={{fontSize:13,color:'#666'}}>{a.content}</div>
              </div>
            ))}
          </div>
        )}
      </div></Shell>
  )
}