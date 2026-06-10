'use client'
import { useState, useEffect } from 'react'
import Shell from '@/components/Shell'
import { createClient } from '@/lib/supabase'

export default function SprintPage() {
  const [agent, setAgent] = useState<any>(null)
  const [sprints, setSprints] = useState<any[]>([])
  const [entries, setEntries] = useState<any[]>([])
  const [activeSprint, setActiveSprint] = useState<any>(null)
  const [myEntry, setMyEntry] = useState({ calls: 0, leads: 0, appointments: 0 })
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { window.location.href = '/login'; return }
      supabase.from('agents').select('*').eq('email', data.user.email).single()
        .then(({ data: a }) => { setAgent(a); if (a) fetchData(a) })
    })
  }, [])

  async function fetchData(a: any) {
    const weekStart = new Date()
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1)
    const { data: sd } = await supabase.from('sprint_sessions').select('*')
      .gte('date', weekStart.toISOString().split('T')[0]).order('date', { ascending: false })
    setSprints(sd || [])
    if (sd && sd.length > 0) {
      const latest = sd[0]
      setActiveSprint(latest)
      const { data: ed } = await supabase.from('sprint_entries').select('*, agents(full_name)')
        .eq('sprint_id', latest.id).order('calls', { ascending: false })
      setEntries(ed || [])
      const mine = ed?.find(e => e.agent_id === a.id)
      if (mine) setMyEntry({ calls: mine.calls, leads: mine.leads, appointments: mine.appointments })
    }
  }

  async function saveEntry() {
    if (!activeSprint || !agent) return
    setSaving(true)
    await supabase.from('sprint_entries').upsert({
      sprint_id: activeSprint.id, agent_id: agent.id, ...myEntry,
      updated_at: new Date().toISOString()
    }, { onConflict: 'sprint_id,agent_id' })
    setToast('ÎÏÎ¿Î¸Î·ÎºÎµÏÏÎ·ÎºÎµ!')
    await fetchData(agent)
    setSaving(false)
    setTimeout(() => setToast(''), 2000)
  }

  const isCoach = agent?.role === 'ceo' || agent?.role === 'coach' || agent?.role === 'admin'

  async function createSprint() {
    const label = prompt('ÎÎ½Î¿Î¼Î± sprint:')
    if (!label) return
    const { data } = await supabase.from('sprint_sessions').insert({
      label, date: new Date().toISOString().split('T')[0], created_by: agent.id
    }).select().single()
    if (data) { setActiveSprint(data); setSprints([data, ...sprints]); setEntries([]) }
  }

  const totalCalls = entries.reduce((s, e) => s + (e.calls || 0), 0)
  const totalLeads = entries.reduce((s, e) => s + (e.leads || 0), 0)
  const totalAppts = entries.reduce((s, e) => s + (e.appointments || 0), 0)

  return (
    <Shell><div style={{padding:"2rem",maxWidth:1100}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'1.5rem'}}>
          <div>
            <h1 style={{fontSize:22,fontWeight:500,color:'#1a1a1a',margin:0}}>Sprint Calls</h1>
            <p style={{color:'#888',fontSize:14,margin:'4px 0 0'}}>3 sprints ÎµÎ²Î´Î¿Î¼Î±Î´Î¹Î±Î¹ÏÏ</p>
          </div>
          {isCoach && <button onClick={createSprint} style={{padding:'8px 16px',background:'#CC2229',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:500,cursor:'pointer'}}>+ ÎÎµÎ¿ Sprint</button>}
        </div>
        {toast && <div style={{background:'#EAF3DE',color:'#3B6D11',padding:'10px 16px',borderRadius:8,marginBottom:16,fontSize:14}}>{toast}</div>}
        {sprints.length > 0 && (
          <div style={{display:'flex',gap:8,marginBottom:20,flexWrap:'wrap'}}>
            {sprints.map(s => (
              <button key={s.id} onClick={() => { setActiveSprint(s); fetchData(agent) }}
                style={{padding:'6px 14px',borderRadius:8,fontSize:13,cursor:'pointer',background:activeSprint?.id===s.id?'#CC2229':'#fff',color:activeSprint?.id===s.id?'#fff':'#666',border:'0.5px solid ' + (activeSprint?.id===s.id?'#CC2229':'#ddd')}}>
                {s.label}
              </button>
            ))}
          </div>
        )}
        {activeSprint ? (
          <div style={{display:'grid',gridTemplateColumns:'300px 1fr',gap:16}}>
            <div style={{background:'#fff',border:'0.5px solid #e8e8e8',borderRadius:12,padding:'1.25rem'}}>
              <div style={{fontSize:14,fontWeight:500,marginBottom:16}}>{activeSprint.label}</div>
              {([['calls','Calls','ð'],['leads','Leads','ð¯'],['appointments','Î¡Î±Î½ÏÎµÎ²Î¿Ï','ð']] as [string,string,string][]).map(([key,label,icon]) => (
                <div key={key} style={{marginBottom:14}}>
                  <div style={{fontSize:12,color:'#888',marginBottom:6}}>{icon} {label}</div>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <button onClick={() => setMyEntry(p => ({...p,[key]:Math.max(0,(p as any)[key]-1)}))} style={{width:32,height:32,borderRadius:8,border:'0.5px solid #ddd',background:'#f5f5f5',fontSize:16,cursor:'pointer'}}>-</button>
                    <span style={{fontSize:22,fontWeight:500,minWidth:40,textAlign:'center'}}>{(myEntry as any)[key]}</span>
                    <button onClick={() => setMyEntry(p => ({...p,[key]:(p as any)[key]+1}))} style={{width:32,height:32,borderRadius:8,border:'0.5px solid #CC2229',background:'#fff5f5',color:'#CC2229',fontSize:16,cursor:'pointer'}}>+</button>
                  </div>
                </div>
              ))}
              <button onClick={saveEntry} disabled={saving} style={{width:'100%',padding:'10px',background:'#CC2229',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:500,cursor:'pointer',marginTop:8}}>
                {saving ? 'ÎÏÎ¿Î¸Î·ÎºÎµÏÏÎ·...' : 'ÎÏÎ¿Î¸Î·ÎºÎµÏÏÎ·'}
              </button>
            </div>
            <div style={{background:'#fff',border:'0.5px solid #e8e8e8',borderRadius:12,padding:'1.25rem'}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:20}}>
                {[{label:'Calls',val:totalCalls},{label:'Leads',val:totalLeads},{label:'Î¡Î±Î½ÏÎµÎ²Î¿Ï',val:totalAppts}].map(s => (
                  <div key={s.label} style={{background:'#f8f8f7',borderRadius:8,padding:'1rem',textAlign:'center'}}>
                    <div style={{fontSize:12,color:'#888',marginBottom:4}}>{s.label}</div>
                    <div style={{fontSize:26,fontWeight:500}}>{s.val}</div>
                  </div>
                ))}
              </div>
              <div style={{fontSize:13,fontWeight:500,color:'#888',marginBottom:10}}>Leaderboard</div>
              {entries.length === 0 && <div style={{color:'#bbb',fontSize:13}}>ÎÎ±Î¼Î¹Î± ÎºÎ±ÏÎ±ÏÏÏÎ·ÏÎ· Î±ÎºÎ¿Î¼Î±</div>}
              {entries.map((e,i) => (
                <div key={e.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 0',borderBottom:'0.5px solid #f0f0f0'}}>
                  <div style={{width:24,height:24,borderRadius:'50%',background:i===0?'#FAEEDA':'#f0f0f0',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:500}}>{i+1}</div>
                  <div style={{flex:1,fontSize:13,fontWeight:500}}>{e.agents?.full_name}</div>
                  <div style={{display:'flex',gap:16,fontSize:13}}>
                    <span>ð {e.calls}</span><span>ð¯ {e.leads}</span><span>ð {e.appointments}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{textAlign:'center',padding:'3rem',color:'#888',fontSize:14}}>
            {isCoach ? 'Î Î±ÏÎ± "+ ÎÎµÎ¿ Sprint" Î³Î¹Î± Î½Î± Î¾ÎµÎºÎ¹Î½Î·ÏÎµÎ¹Ï' : 'ÎÎµÎ½ ÏÏÎ±ÏÏÎµÎ¹ ÎµÎ½ÎµÏÎ³Î¿ sprint Î±ÏÏÎ· ÏÎ· ÏÏÎ¹Î³Î¼Î·'}
          </div>
        )}
      </div></Shell>
  )
}