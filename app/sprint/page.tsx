'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'

const C = {red:'#CC2229',redLight:'#FDF2F2',dark:'#1A1A1A',muted:'#6B7280',border:'#EBEBEB',subtle:'#F7F7F7',white:'#FFFFFF',green:'#16A34A',greenLight:'#F0FDF4',amber:'#D97706',blue:'#2563EB',purple:'#7C3AED'}

// Mock sprint sessions
const MOCK_SESSIONS = [
  {id:'s1',date:'2026-06-09',sprint_number:1,coach:'Ειρήνη Κ.',status:'completed',
   entries:[
    {agent:'Νίκος Κ.',initials:'ΝΚ',calls:45,leads:3,meet1:1,notes:''},
    {agent:'Κώστας Μ.',initials:'ΚΜ',calls:62,leads:5,meet1:2,notes:''},
    {agent:'Μαρία Π.',initials:'ΜΠ',calls:38,leads:2,meet1:1,notes:''},
    {agent:'Γιώργος Σ.',initials:'ΓΣ',calls:51,leads:4,meet1:1,notes:''},
    {agent:'Ελένη Δ.',initials:'ΕΔ',calls:28,leads:1,meet1:0,notes:''},
  ]},
  {id:'s2',date:'2026-06-11',sprint_number:2,coach:'Ειρήνη Κ.',status:'completed',
   entries:[
    {agent:'Νίκος Κ.',initials:'ΝΚ',calls:52,leads:4,meet1:2,notes:''},
    {agent:'Κώστας Μ.',initials:'ΚΜ',calls:71,leads:6,meet1:2,notes:''},
    {agent:'Μαρία Π.',initials:'ΜΠ',calls:44,leads:3,meet1:1,notes:''},
    {agent:'Γιώργος Σ.',initials:'ΓΣ',calls:48,leads:3,meet1:1,notes:''},
    {agent:'Ελένη Δ.',initials:'ΕΔ',calls:33,leads:2,meet1:0,notes:''},
  ]},
]

const AVCOLORS=['#CC2229','#2563EB','#16A34A','#D97706','#7C3AED','#0891B2']
function Av({initials,size=32,idx=0}){return <div style={{width:size,height:size,borderRadius:'50%',background:AVCOLORS[idx%AVCOLORS.length]+'20',display:'flex',alignItems:'center',justifyContent:'center',fontSize:size*.3,fontWeight:700,color:AVCOLORS[idx%AVCOLORS.length],flexShrink:0}}>{initials}</div>}

function MiniBar({value,max,color}){const p=Math.min(100,Math.round(value/max*100));return <div style={{background:'#EBEBEB',borderRadius:99,height:4,overflow:'hidden',width:60}}><div style={{width:p+'%',height:4,background:color,borderRadius:99}}/></div>}

export default function SprintPage(){
  const [user,setUser]=useState(null)
  const [loading,setLoading]=useState(true)
  const [tab,setTab]=useState('live')
  const [sessions,setSessions]=useState(MOCK_SESSIONS)
  const [activeSession,setActiveSession]=useState(null)
  const [myEntry,setMyEntry]=useState({calls:'',leads:'',meet1:'',notes:''})
  const [saved,setSaved]=useState(false)
  const [saving,setSaving]=useState(false)
  const [showNew,setShowNew]=useState(false)
  const [newSession,setNewSession]=useState({date:new Date().toISOString().split('T')[0],sprint_number:3})

  useEffect(()=>{supabase.auth.getUser().then(({data:d})=>{if(!d.user){window.location.href='/login';return};setUser(d.user);setLoading(false)})},[])

  // Live session mock
  const liveSession = {
    id:'live1', date:'2026-06-09', sprint_number:3,
    coach:'Ειρήνη Κ.', status:'live',
    entries:[
      {agent:'Κώστας Μ.',initials:'ΚΜ',calls:58,leads:4,meet1:2,submitted:true},
      {agent:'Μαρία Π.',initials:'ΜΠ',calls:41,leads:3,meet1:1,submitted:true},
      {agent:'Γιώργος Σ.',initials:'ΓΣ',calls:0,leads:0,meet1:0,submitted:false},
      {agent:'Νίκος Κ.',initials:'ΝΚ',calls:0,leads:0,meet1:0,submitted:false},
      {agent:'Ελένη Δ.',initials:'ΕΔ',calls:0,leads:0,meet1:0,submitted:false},
    ]
  }

  async function submitEntry(){
    if(!myEntry.calls) return
    setSaving(true)
    await new Promise(r=>setTimeout(r,600))
    setSaved(true)
    setSaving(false)
    setTimeout(()=>setSaved(false),3000)
  }

  // Aggregate stats across all sessions
  const allEntries = sessions.flatMap(s=>s.entries)
  const byAgent = {}
  allEntries.forEach(e=>{
    if(!byAgent[e.agent]) byAgent[e.agent]={agent:e.agent,initials:e.initials,calls:0,leads:0,meet1:0,sessions:0}
    byAgent[e.agent].calls+=e.calls
    byAgent[e.agent].leads+=e.leads
    byAgent[e.agent].meet1+=e.meet1
    byAgent[e.agent].sessions++
  })
  const agentStats=Object.values(byAgent).sort((a,b)=>b.calls-a.calls)
  const totalCalls=allEntries.reduce((s,e)=>s+e.calls,0)
  const totalLeads=allEntries.reduce((s,e)=>s+e.leads,0)
  const totalMeet1=allEntries.reduce((s,e)=>s+e.meet1,0)

  if(loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'#F4F4F4'}}><span style={{fontSize:13,color:C.muted}}>Φόρτωση...</span></div>

  return (
    <div style={{display:'flex',minHeight:'100vh',background:'#F4F4F4',fontFamily:"-apple-system,BlinkMacSystemFont,'Inter',sans-serif",color:C.dark}}>
      <Sidebar/>
      <div style={{marginLeft:64,flex:1,padding:'28px 32px',overflowY:'auto'}}>

        {/* Hero */}
        <div style={{background:C.dark,borderRadius:20,padding:'24px 28px',color:'#fff',display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24}}>
          <div>
            <p style={{fontSize:11,fontWeight:600,color:'rgba(255,255,255,.4)',letterSpacing:.8,textTransform:'uppercase',margin:'0 0 6px'}}>KWAC</p>
            <h1 style={{fontSize:22,fontWeight:700,margin:'0 0 4px',letterSpacing:-.5}}>Sprint Calls</h1>
            <p style={{fontSize:13,color:'rgba(255,255,255,.5)',margin:0}}>3 sprints/εβδομάδα · Coach: Ειρήνη Κ.</p>
          </div>
          <div style={{display:'flex',gap:10}}>
            <div style={{background:'rgba(255,255,255,.08)',borderRadius:12,padding:'10px 18px',textAlign:'center'}}><div style={{fontSize:22,fontWeight:800}}>{totalCalls}</div><div style={{fontSize:10,color:'rgba(255,255,255,.4)',fontWeight:600,marginTop:2}}>CALLS</div></div>
            <div style={{background:C.red,borderRadius:12,padding:'10px 18px',textAlign:'center'}}><div style={{fontSize:22,fontWeight:800}}>{totalLeads}</div><div style={{fontSize:10,color:'rgba(255,255,255,.7)',fontWeight:600,marginTop:2}}>LEADS</div></div>
            <div style={{background:'rgba(255,255,255,.08)',borderRadius:12,padding:'10px 18px',textAlign:'center'}}><div style={{fontSize:22,fontWeight:800,color:C.amber+'cc'}}>{totalMeet1}</div><div style={{fontSize:10,color:'rgba(255,255,255,.4)',fontWeight:600,marginTop:2}}>ΡΑΝΤΕΒΟΥ</div></div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{display:'flex',gap:8,marginBottom:20}}>
          {[{id:'live',label:'🔴 Live Sprint'},{id:'leaderboard',label:'🏆 Leaderboard'},{id:'history',label:'📊 Ιστορικό'}].map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{padding:'10px 20px',borderRadius:10,border:'1px solid '+(tab===t.id?C.dark:C.border),background:tab===t.id?C.dark:C.white,color:tab===t.id?'#fff':C.muted,fontSize:13,fontWeight:600,cursor:'pointer',transition:'all .15s'}}>
              {t.label}
            </button>
          ))}
        </div>

        {/* LIVE TAB */}
        {tab==='live'&&(
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
            {/* Live leaderboard */}
            <div>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}>
                <div style={{width:8,height:8,borderRadius:'50%',background:C.red,animation:'pulse 1s infinite'}}/>
                <h2 style={{fontSize:14,fontWeight:700,margin:0}}>Sprint #3 — Live · {liveSession.date}</h2>
                <span style={{fontSize:11,color:C.muted,background:C.subtle,padding:'2px 8px',borderRadius:99}}>{liveSession.entries.filter(e=>e.submitted).length}/{liveSession.entries.length} υπέβαλαν</span>
              </div>
              <div style={{background:C.white,borderRadius:16,border:'1px solid '+C.border,overflow:'hidden',boxShadow:'0 1px 4px rgba(0,0,0,.04)'}}>
                <div style={{padding:'10px 16px',borderBottom:'1px solid '+C.border,background:C.subtle,display:'grid',gridTemplateColumns:'1fr 60px 60px 60px',gap:8}}>
                  <span style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:'uppercase',letterSpacing:.5}}>Agent</span>
                  <span style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:'uppercase',letterSpacing:.5,textAlign:'center'}}>Calls</span>
                  <span style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:'uppercase',letterSpacing:.5,textAlign:'center'}}>Leads</span>
                  <span style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:'uppercase',letterSpacing:.5,textAlign:'center'}}>Ραντ.</span>
                </div>
                {[...liveSession.entries].sort((a,b)=>b.calls-a.calls).map((e,i)=>(
                  <div key={e.agent} style={{display:'grid',gridTemplateColumns:'1fr 60px 60px 60px',gap:8,padding:'12px 16px',borderBottom:i<liveSession.entries.length-1?'1px solid #F5F5F5':'none',background:i===0&&e.submitted?C.redLight:'#fff',alignItems:'center'}}>
                    <div style={{display:'flex',alignItems:'center',gap:10}}>
                      <span style={{fontSize:14,width:20}}>{i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1+'.'}</span>
                      <Av initials={e.initials} size={28} idx={i}/>
                      <div>
                        <div style={{fontSize:13,fontWeight:600}}>{e.agent}</div>
                        <div style={{fontSize:10,color:e.submitted?C.green:C.amber,fontWeight:600}}>{e.submitted?'✓ Υπέβαλε':'⏳ Αναμονή'}</div>
                      </div>
                    </div>
                    <div style={{textAlign:'center',fontSize:16,fontWeight:800,color:e.submitted?C.dark:C.muted+'60'}}>{e.submitted?e.calls:'—'}</div>
                    <div style={{textAlign:'center',fontSize:16,fontWeight:800,color:e.submitted?C.green:C.muted+'60'}}>{e.submitted?e.leads:'—'}</div>
                    <div style={{textAlign:'center',fontSize:16,fontWeight:800,color:e.submitted?C.blue:C.muted+'60'}}>{e.submitted?e.meet1:'—'}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* My submission */}
            <div>
              <h2 style={{fontSize:14,fontWeight:700,margin:'0 0 16px'}}>Καταχώρηση νούμερων</h2>
              <div style={{background:C.white,borderRadius:16,border:'1px solid '+C.border,padding:'20px',boxShadow:'0 1px 4px rgba(0,0,0,.04)'}}>
                <div style={{fontSize:12,color:C.muted,marginBottom:16}}>Sprint #3 · {liveSession.date} · Coach: {liveSession.coach}</div>
                {[
                  {key:'calls',label:'Cold Calls',color:C.red,suffix:'calls',desc:'Πόσα calls έκανες στη διάρκεια του sprint;'},
                  {key:'leads',label:'Leads',color:C.green,suffix:'leads',desc:'Πόσα νέα leads προέκυψαν;'},
                  {key:'meet1',label:'1ο Ραντεβού',color:C.blue,suffix:'ραντ.',desc:'Πόσα 1ο ραντεβού κλείστηκαν;'},
                ].map(f=>(
                  <div key={f.key} style={{marginBottom:16}}>
                    <label style={{fontSize:11,fontWeight:700,color:C.muted,display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:.4}}>{f.label}</label>
                    <div style={{fontSize:11,color:C.muted,marginBottom:6}}>{f.desc}</div>
                    <div style={{display:'flex',alignItems:'center',gap:10}}>
                      <button onClick={()=>setMyEntry(e=>({...e,[f.key]:Math.max(0,(parseInt(e[f.key])||0)-1)}))} style={{width:36,height:36,borderRadius:8,border:'1px solid '+C.border,background:C.white,cursor:'pointer',fontSize:18,color:C.muted,fontWeight:300}}>−</button>
                      <input type="number" value={myEntry[f.key]} onChange={ev=>setMyEntry(e=>({...e,[f.key]:Math.max(0,parseInt(ev.target.value)||0)}))}
                        style={{width:80,textAlign:'center',padding:'8px',borderRadius:8,border:'2px solid '+(myEntry[f.key]>0?f.color:C.border),fontSize:20,fontWeight:800,color:myEntry[f.key]>0?f.color:C.dark,background:'#FAFAFA'}}/>
                      <button onClick={()=>setMyEntry(e=>({...e,[f.key]:(parseInt(e[f.key])||0)+1}))} style={{width:36,height:36,borderRadius:8,border:'1px solid '+C.border,background:C.white,cursor:'pointer',fontSize:18,color:f.color,fontWeight:700}}>+</button>
                      <span style={{fontSize:12,color:C.muted}}>{f.suffix}</span>
                    </div>
                  </div>
                ))}
                <div style={{marginBottom:16}}>
                  <label style={{fontSize:11,fontWeight:700,color:C.muted,display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:.4}}>Σημειώσεις</label>
                  <textarea value={myEntry.notes} onChange={e=>setMyEntry(x=>({...x,notes:e.target.value}))} rows={2} placeholder="Τι πήγε καλά; Τι δυσκολεύτηκες;"
                    style={{width:'100%',padding:'9px 12px',borderRadius:8,border:'1px solid '+C.border,fontSize:13,background:'#FAFAFA',color:C.dark,boxSizing:'border-box',resize:'none'}}/>
                </div>
                <button onClick={submitEntry} disabled={saving||!myEntry.calls}
                  style={{width:'100%',background:saved?C.green:!myEntry.calls?C.muted+'60':C.red,color:'#fff',border:'none',borderRadius:10,padding:'13px 0',fontSize:14,fontWeight:700,cursor:!myEntry.calls?'not-allowed':'pointer',transition:'background .3s'}}>
                  {saving?'Υποβολή...':saved?'✓ Υποβλήθηκε!':'Υποβολή νούμερων'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* LEADERBOARD TAB */}
        {tab==='leaderboard'&&(
          <div>
            <h2 style={{fontSize:15,fontWeight:700,margin:'0 0 16px'}}>Συγκεντρωτική Κατάταξη — Όλα τα Sprints</h2>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:20}}>
              {[{label:'Top Caller',stat:'calls',color:C.red},{label:'Top Lead Generator',stat:'leads',color:C.green},{label:'Top Meeting Booker',stat:'meet1',color:C.blue}].map(cat=>{
                const top=[...agentStats].sort((a,b)=>b[cat.stat]-a[cat.stat])[0]
                return top?(
                  <div key={cat.label} style={{background:C.white,borderRadius:14,border:'1px solid '+C.border,padding:'16px 18px',boxShadow:'0 1px 4px rgba(0,0,0,.04)'}}>
                    <div style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:'uppercase',letterSpacing:.5,marginBottom:10}}>{cat.label}</div>
                    <div style={{display:'flex',alignItems:'center',gap:10}}>
                      <Av initials={top.initials} size={40} idx={agentStats.indexOf(top)}/>
                      <div>
                        <div style={{fontSize:14,fontWeight:700}}>{top.agent}</div>
                        <div style={{fontSize:22,fontWeight:800,color:cat.color}}>{top[cat.stat]}</div>
                      </div>
                    </div>
                  </div>
                ):null
              })}
            </div>
            <div style={{background:C.white,borderRadius:16,border:'1px solid '+C.border,overflow:'hidden',boxShadow:'0 1px 4px rgba(0,0,0,.04)'}}>
              <div style={{padding:'12px 20px',borderBottom:'1px solid '+C.border,background:C.subtle,display:'grid',gridTemplateColumns:'40px 1fr 80px 80px 80px 80px',gap:8,alignItems:'center'}}>
                {['#','Agent','Calls','Leads','Ραντ.','Sessions'].map(h=><span key={h} style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:'uppercase',letterSpacing:.5}}>{h}</span>)}
              </div>
              {agentStats.map((a,i)=>(
                <div key={a.agent} style={{padding:'13px 20px',borderBottom:i<agentStats.length-1?'1px solid #F5F5F5':'none',display:'grid',gridTemplateColumns:'40px 1fr 80px 80px 80px 80px',gap:8,alignItems:'center',background:i===0?C.redLight:'#fff'}}>
                  <span style={{fontSize:14}}>{['🥇','🥈','🥉'][i]||i+1+'.'}</span>
                  <div style={{display:'flex',alignItems:'center',gap:10}}>
                    <Av initials={a.initials} size={30} idx={i}/>
                    <span style={{fontSize:13,fontWeight:600}}>{a.agent}</span>
                  </div>
                  <div>
                    <div style={{fontSize:15,fontWeight:800,color:C.red}}>{a.calls}</div>
                    <MiniBar value={a.calls} max={agentStats[0].calls} color={C.red}/>
                  </div>
                  <div>
                    <div style={{fontSize:15,fontWeight:800,color:C.green}}>{a.leads}</div>
                    <MiniBar value={a.leads} max={agentStats[0].leads} color={C.green}/>
                  </div>
                  <div>
                    <div style={{fontSize:15,fontWeight:800,color:C.blue}}>{a.meet1}</div>
                    <MiniBar value={a.meet1} max={Math.max(...agentStats.map(x=>x.meet1))||1} color={C.blue}/>
                  </div>
                  <div style={{fontSize:13,color:C.muted,fontWeight:500}}>{a.sessions} sessions</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* HISTORY TAB */}
        {tab==='history'&&(
          <div>
            <h2 style={{fontSize:15,fontWeight:700,margin:'0 0 16px'}}>Ιστορικό Sprint Sessions</h2>
            <div style={{display:'flex',flexDirection:'column',gap:16}}>
              {sessions.map(s=>{
                const totCalls=s.entries.reduce((x,e)=>x+e.calls,0)
                const totLeads=s.entries.reduce((x,e)=>x+e.leads,0)
                const totMeet=s.entries.reduce((x,e)=>x+e.meet1,0)
                const topAgent=[...s.entries].sort((a,b)=>b.calls-a.calls)[0]
                return (
                  <div key={s.id} style={{background:C.white,borderRadius:16,border:'1px solid '+C.border,overflow:'hidden',boxShadow:'0 1px 4px rgba(0,0,0,.04)'}}>
                    <div style={{padding:'14px 20px',borderBottom:'1px solid '+C.border,background:C.subtle,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <div style={{display:'flex',alignItems:'center',gap:12}}>
                        <div style={{background:C.red,color:'#fff',borderRadius:8,padding:'4px 10px',fontSize:11,fontWeight:700}}>Sprint #{s.sprint_number}</div>
                        <span style={{fontSize:13,fontWeight:600}}>{new Date(s.date+'T00:00:00').toLocaleDateString('el-GR',{weekday:'long',day:'numeric',month:'long'})}</span>
                        <span style={{fontSize:11,color:C.muted}}>Coach: {s.coach}</span>
                      </div>
                      <div style={{display:'flex',gap:16,fontSize:13}}>
                        <span style={{color:C.red,fontWeight:700}}>{totCalls} calls</span>
                        <span style={{color:C.green,fontWeight:700}}>{totLeads} leads</span>
                        <span style={{color:C.blue,fontWeight:700}}>{totMeet} ραντεβού</span>
                      </div>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:0}}>
                      {[...s.entries].sort((a,b)=>b.calls-a.calls).map((e,i)=>(
                        <div key={e.agent} style={{padding:'12px 16px',borderRight:i<s.entries.length-1?'1px solid #F5F5F5':'none',background:i===0?C.redLight+'80':'#fff'}}>
                          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                            <span style={{fontSize:12}}>{['🥇','🥈','🥉','4.','5.'][i]}</span>
                            <Av initials={e.initials} size={24} idx={i}/>
                            <span style={{fontSize:12,fontWeight:600}}>{e.agent.split(' ')[0]}</span>
                          </div>
                          <div style={{display:'flex',gap:8,fontSize:11}}>
                            <span style={{color:C.red,fontWeight:700}}>{e.calls}c</span>
                            <span style={{color:C.green,fontWeight:700}}>{e.leads}l</span>
                            <span style={{color:C.blue,fontWeight:700}}>{e.meet1}r</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}