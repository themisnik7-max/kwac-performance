'use client'
import { useState, useEffect, useCallback } from 'react'
import Shell from '@/components/Shell'
import { useApp } from '@/lib/AppContext'
import { authedFetch } from '@/lib/authedFetch'

function Badge({ ok, label }) {
  return <span style={{ display:'inline-block', padding:'2px 10px', borderRadius:100, fontSize:11, fontWeight:500, background: ok?'#EAF3DE':'#FFF5F5', color: ok?'#3B6D11':'#CC2229' }}>{ok?'✓':'✗'} {label}</span>
}
function relativeDate(d) {
  if (!d) return '—'
  const diff = Math.floor((Date.now()-new Date(d).getTime())/86400000)
  if (diff===0) return 'Σήμερα'; if (diff===1) return 'Χθες'
  if (diff<7) return diff+'μ πριν'; if (diff<30) return Math.floor(diff/7)+'εβδ πριν'
  return Math.floor(diff/30)+'μήν πριν'
}
const ROUTE_LABELS = { '/intelligence':'Intelligence','/dashboard':'Dashboard','/submit':'Μετρησιμότητα','/meeting':'Meeting','/import':'iList Import','/profile':'Χάρτης','/sprint':'Sprint Calls','/board':'Ανακοινώσεις','/gps':'GPS Goals','/export':'Export','/monitor':'Monitor' }
function pct(a,b){return b>0?Math.round((a/b)*100):0}
function KPICard({label,value,sub=null,color=null}){return(<div style={{background:'#fff',border:'0.5px solid #e8e8e8',borderRadius:12,padding:'1rem 1.25rem'}}><div style={{fontSize:11,color:'#888',marginBottom:4}}>{label}</div><div style={{fontSize:22,fontWeight:600,color:color||'#1a1a1a'}}>{value}</div>{sub&&<div style={{fontSize:11,color:'#aaa',marginTop:2}}>{sub}</div>}</div>)}

export default function MonitorPage() {
  const { role } = useApp()
  const isCeo = role==='ceo'||role==='admin'
  const [agents,setAgents]=useState([])
  const [topRoutes,setTopRoutes]=useState([])
  const [kpis,setKpis]=useState(null)
  const [production,setProduction]=useState(null)
  const [loading,setLoading]=useState(true)
  const [tab,setTab]=useState('compliance')
  const [filter,setFilter]=useState('all')
  const [reminding,setReminding]=useState(false)
  const [toast,setToast]=useState('')

  const showToast=(msg)=>{setToast(msg);setTimeout(()=>setToast(''),4000)}
  const load=useCallback(()=>{
    if(!isCeo) return
    setLoading(true)
    authedFetch('/api/monitor').then(r=>r.json()).then(d=>{setAgents(d.agents||[]);setTopRoutes(d.topRoutes||[]);setKpis(d.systemKPIs||null);setLoading(false)}).catch(()=>setLoading(false))
    authedFetch('/api/monitor/production').then(r=>r.json()).then(d=>setProduction(d)).catch(()=>{})
  },[isCeo])
  useEffect(()=>{load()},[load])

  if(!isCeo) return <Shell><div style={{padding:'4rem',textAlign:'center'}}><div style={{fontSize:48,marginBottom:16}}>🔒</div><div style={{fontSize:16,color:'#888'}}>Διαθέσιμο μόνο σε CEO / Admin.</div></div></Shell>

  const total=agents.length, submitted=agents.filter(a=>a.submitted_this_week).length, hasGPS=agents.filter(a=>a.has_gps_goal).length, hasMeeting=agents.filter(a=>a.meeting_props_count>0).length
  const sprintLast7=agents.filter(a=>a.last_sprint_at&&new Date(a.last_sprint_at)>new Date(Date.now()-7*86400000)).length
  const score=(a)=>[a.submitted_this_week,a.has_gps_goal,a.meeting_props_count>0,!!a.last_sprint_at].filter(Boolean).length
  const visible=agents.filter(a=>filter==='missing'?score(a)<3:filter==='ok'?score(a)>=3:true).sort((a,b)=>score(b)-score(a))
  const byActivity=[...agents].sort((a,b)=>(b.page_views_7d||0)-(a.page_views_7d||0))
  const maxRouteCount=topRoutes[0]?.count||1

  async function sendReminder(){
    setReminding(true)
    try{const res=await authedFetch('/api/monitor-remind',{method:'POST'});const d=await res.json()
    showToast(d.ok?(d.allSubmitted?'✅ Όλοι υπέβαλαν — ανακοίνωση στάλθηκε.':`📢 Υπενθύμιση για ${d.pendingAgents.length} μεσίτη/ες.`):'Σφάλμα: '+(d.error||''))}catch{showToast('Σφάλμα αποστολής.')}
    setReminding(false)
  }

  return (
    <Shell>
      <div style={{padding:'2rem',maxWidth:1100}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'1.5rem'}}>
          <div>
            <h1 style={{fontSize:22,fontWeight:500,color:'#1a1a1a',margin:0}}>Monitor — Παρακολούθηση Ομάδας</h1>
            <p style={{color:'#888',fontSize:14,margin:'4px 0 0'}}>Compliance · Δραστηριότητα · System KPIs</p>
          </div>
          <button onClick={sendReminder} disabled={reminding} style={{padding:'9px 18px',background:reminding?'#ddd':'#CC2229',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:500,cursor:reminding?'not-allowed':'pointer'}}>{reminding?'Αποστολή...':'📢 Αποστολή Υπενθύμισης'}</button>
        </div>
        {toast&&<div style={{background:'#1a1a1a',color:'#f0f0f0',borderRadius:8,padding:'10px 16px',marginBottom:16,fontSize:13}}>{toast}</div>}
        <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:12,marginBottom:24}}>
          {[{l:'Σύνολο Μεσιτών',v:total,c:'#1a1a1a'},{l:'Μετρ. αυτή την εβδ',v:submitted+'/'+total,c:submitted===total?'#3B6D11':'#CC2229'},{l:'Έχουν GPS Στόχο',v:hasGPS+'/'+total,c:hasGPS===total?'#3B6D11':'#BA7517'},{l:'Ακίνητα σε Meeting',v:hasMeeting+'/'+total,c:'#378ADD'},{l:'Sprint τελ. 7μ.',v:sprintLast7+'/'+total,c:sprintLast7>=total*0.7?'#3B6D11':'#CC2229'}].map(k=>(
            <div key={k.l} style={{background:'#fff',border:'0.5px solid #e8e8e8',borderRadius:12,padding:'1rem 1.25rem'}}><div style={{fontSize:11,color:'#888',marginBottom:4}}>{k.l}</div><div style={{fontSize:22,fontWeight:600,color:k.c}}>{k.v}</div></div>
          ))}
        </div>
        {total>0&&<div style={{background:'#fff',border:'0.5px solid #e8e8e8',borderRadius:12,padding:'1rem 1.25rem',marginBottom:20}}><div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}><span style={{fontSize:13,fontWeight:500}}>Μετρησιμότητα αυτής της εβδομάδας</span><span style={{fontSize:13,color:'#888'}}>{submitted}/{total}</span></div><div style={{background:'#f0f0f0',borderRadius:100,height:10,overflow:'hidden'}}><div style={{height:'100%',borderRadius:100,background:submitted===total?'#3B6D11':submitted>=total*0.7?'#BA7517':'#CC2229',width:pct(submitted,total)+'%',transition:'width .5s ease'}} /></div></div>}
        <div style={{display:'flex',gap:6,marginBottom:16}}>
          {[{key:'compliance',label:'📋 Compliance'},{key:'activity',label:'🔥 Δραστηριότητα'},{key:'kpis',label:'📊 System KPIs'},{key:'production',label:'🏗️ Παραγωγή'}].map(t=>(
            <button key={t.key} onClick={()=>setTab(t.key)} style={{padding:'7px 16px',borderRadius:8,border:'none',fontSize:13,fontWeight:500,cursor:'pointer',background:tab===t.key?'#1a1a1a':'#fff',color:tab===t.key?'#fff':'#666',outline:tab===t.key?'none':'0.5px solid #e8e8e8'}}>{t.label}</button>
          ))}
        </div>

        {tab==='compliance'&&<>
          <div style={{display:'flex',gap:6,marginBottom:16}}>
            {[{key:'all',label:'Όλοι ('+total+')'},{key:'missing',label:'⚠️ Ελλιπείς ('+agents.filter(a=>score(a)<3).length+')'},{key:'ok',label:'✅ Πλήρεις ('+agents.filter(a=>score(a)>=3).length+')'}].map(f=>(
              <button key={f.key} onClick={()=>setFilter(f.key)} style={{padding:'6px 14px',borderRadius:8,border:'none',fontSize:13,fontWeight:500,cursor:'pointer',background:filter===f.key?'#1a1a1a':'#fff',color:filter===f.key?'#fff':'#666',outline:filter===f.key?'none':'0.5px solid #e8e8e8'}}>{f.label}</button>
            ))}
          </div>
          {loading?<div style={{padding:'3rem',textAlign:'center',color:'#bbb'}}>Φόρτωση...</div>:(
            <div style={{background:'#fff',border:'0.5px solid #e8e8e8',borderRadius:12,overflow:'hidden'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                <thead><tr style={{background:'#F8F8F7',borderBottom:'1px solid #F0F0F0'}}>{['Μεσίτης','Μετρ. εβδ.','GPS','Meeting','Τελ. Sprint','Τελ. Υποβολή','Score'].map(h=><th key={h} style={{textAlign:'left',padding:'10px 12px',fontWeight:500,color:'#888',fontSize:12}}>{h}</th>)}</tr></thead>
                <tbody>
                  {visible.length===0&&<tr><td colSpan={7} style={{padding:'2rem',textAlign:'center',color:'#bbb'}}>Δεν υπάρχουν αποτελέσματα.</td></tr>}
                  {visible.map(a=>{const sc=score(a);return(
                    <tr key={a.id} style={{borderBottom:'0.5px solid #F8F8F8'}}>
                      <td style={{padding:'12px'}}><div style={{fontWeight:500}}>{a.full_name||'—'}</div><div style={{fontSize:11,color:'#aaa'}}>{a.email}</div></td>
                      <td style={{padding:'12px'}}><Badge ok={a.submitted_this_week} label={a.submitted_this_week?'Υπεβλήθη':'Εκκρεμεί'} /></td>
                      <td style={{padding:'12px'}}><Badge ok={a.has_gps_goal} label={a.has_gps_goal?'Ορίστηκε':'Λείπει'} /></td>
                      <td style={{padding:'12px'}}>{a.meeting_props_count>0?<span style={{color:'#3B6D11',fontWeight:500}}>{a.meeting_props_count}</span>:<span style={{color:'#CC2229'}}>0</span>}</td>
                      <td style={{padding:'12px',color:'#888'}}>{relativeDate(a.last_sprint_at)}</td>
                      <td style={{padding:'12px',color:'#888'}}><div>{relativeDate(a.last_submission_at)}</div><div style={{fontSize:11,color:'#ccc'}}>{a.total_submissions} συνολ.</div></td>
                      <td style={{padding:'12px'}}><div style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:28,height:28,borderRadius:'50%',fontWeight:700,fontSize:13,background:sc===4?'#EAF3DE':sc>=2?'#FFF8E6':'#FFF5F5',color:sc===4?'#3B6D11':sc>=2?'#BA7517':'#CC2229'}}>{sc}</div></td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>
          )}
          <div style={{marginTop:12,fontSize:11,color:'#ccc'}}>Score = Μετρησιμότητα + GPS + Meeting + Sprint (max 4)</div>
        </>}

        {tab==='activity'&&(
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
            <div style={{background:'#fff',border:'0.5px solid #e8e8e8',borderRadius:12,overflow:'hidden'}}>
              <div style={{padding:'1rem 1.25rem',borderBottom:'0.5px solid #f0f0f0',fontSize:14,fontWeight:500}}>Δραστηριότητα Μεσιτών</div>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                <thead><tr style={{background:'#F8F8F7'}}>{['Μεσίτης','Τελ. Σύνδεση','Views 7μ.'].map(h=><th key={h} style={{textAlign:'left',padding:'8px 12px',fontWeight:500,color:'#888',fontSize:12}}>{h}</th>)}</tr></thead>
                <tbody>
                  {byActivity.map(a=>{const v=a.page_views_7d||0,isActive=v>0;return(
                    <tr key={a.id} style={{borderBottom:'0.5px solid #F8F8F8'}}>
                      <td style={{padding:'10px 12px'}}><div style={{fontWeight:500}}>{a.full_name||'—'}</div><div style={{fontSize:11,color:'#aaa'}}>{a.email}</div></td>
                      <td style={{padding:'10px 12px',color:isActive?'#1a1a1a':'#CC2229',fontSize:12}}>{relativeDate(a.last_seen)}</td>
                      <td style={{padding:'10px 12px'}}><div style={{display:'flex',alignItems:'center',gap:6}}><div style={{width:Math.max((v/Math.max(...byActivity.map(x=>x.page_views_7d||0),1))*60,v>0?4:0),height:6,background:isActive?'#3B6D11':'#f0f0f0',borderRadius:3}} /><span style={{fontSize:12,color:isActive?'#1a1a1a':'#ccc',fontWeight:isActive?500:400}}>{v}</span></div></td>
                    </tr>
                  )})}
                  {byActivity.length===0&&<tr><td colSpan={3} style={{padding:'2rem',textAlign:'center',color:'#bbb',fontSize:13}}>Τα page views ξεκινούν να συλλέγονται αυτόματα.</td></tr>}
                </tbody>
              </table>
            </div>
            <div style={{background:'#fff',border:'0.5px solid #e8e8e8',borderRadius:12,padding:'1.25rem'}}>
              <div style={{fontSize:14,fontWeight:500,marginBottom:16}}>Top Features (τελ. 30 μέρες)</div>
              {topRoutes.length===0?<p style={{color:'#bbb',fontSize:13}}>Δεν υπάρχουν δεδομένα ακόμα.</p>:topRoutes.slice(0,10).map(r=>(
                <div key={r.route} style={{marginBottom:10}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}><span style={{fontSize:13}}>{ROUTE_LABELS[r.route]||r.route}</span><span style={{fontSize:12,color:'#888',fontWeight:500}}>{r.count}</span></div>
                  <div style={{background:'#f0f0f0',borderRadius:100,height:6,overflow:'hidden'}}><div style={{height:'100%',borderRadius:100,background:'#378ADD',width:Math.round((r.count/maxRouteCount)*100)+'%'}} /></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab==='kpis'&&(
          <div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:20}}>
              <KPICard label="Compliance Rate" value={(kpis?.complianceRate??pct(submitted,total))+'%'} sub={submitted+' / '+total+' υπέβαλαν'} color={(kpis?.complianceRate??pct(submitted,total))>=80?'#3B6D11':'#CC2229'} />
              <KPICard label="Engagement Rate (7μ.)" value={(kpis?.engagementRate??0)+'%'} sub={(kpis?.weeklyActiveUsers??0)+' / '+total+' ενεργοί'} color={(kpis?.engagementRate??0)>=70?'#3B6D11':'#BA7517'} />
              <KPICard label="GPS Adoption Rate" value={(kpis?.gpsAdoptionRate??pct(hasGPS,total))+'%'} sub={hasGPS+' / '+total+' έχουν GPS'} color={(kpis?.gpsAdoptionRate??pct(hasGPS,total))>=80?'#3B6D11':'#BA7517'} />
              <KPICard label="Πιο Δημοφιλές Feature" value={ROUTE_LABELS['/'+( kpis?.topFeature||'')]||kpis?.topFeature||'—'} sub="τελ. 30 μέρες" color="#378ADD" />
              <KPICard label="Σύνολο Page Views (30μ.)" value={(kpis?.totalPageViews30d??0).toLocaleString('el-GR')} color="#1a1a1a" />
              <KPICard label="Meeting Adoption" value={pct(hasMeeting,total)+'%'} sub={hasMeeting+' / '+total+' με ακίνητα'} color={pct(hasMeeting,total)>=60?'#3B6D11':'#CC2229'} />
            </div>
            <div style={{background:'#fff',border:'0.5px solid #e8e8e8',borderRadius:12,padding:'1.25rem'}}>
              <div style={{fontSize:14,fontWeight:500,marginBottom:16}}>Platform Health Score</div>
              {(()=>{
                const cr=kpis?.complianceRate??pct(submitted,total), eng=kpis?.engagementRate??0, gps=kpis?.gpsAdoptionRate??pct(hasGPS,total)
                const health=Math.round((cr+eng+gps)/3), hc=health>=75?'#3B6D11':health>=50?'#BA7517':'#CC2229', hl=health>=75?'Υγιές':health>=50?'Μέτριο':'Χρειάζεται Βελτίωση'
                return(<div style={{display:'flex',alignItems:'center',gap:20}}><div style={{width:72,height:72,borderRadius:'50%',border:`4px solid ${hc}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,fontWeight:700,color:hc,flexShrink:0}}>{health}</div><div><div style={{fontSize:16,fontWeight:600,color:hc}}>{hl}</div><div style={{fontSize:12,color:'#888',marginTop:4}}>Compliance {cr}% · Engagement {eng}% · GPS {gps}%</div></div></div>)
              })()}
            </div>
          </div>
        )}
        {tab==='production'&&(()=>{
          if(!production) return <div style={{padding:'3rem',textAlign:'center',color:'#bbb'}}>Φόρτωση...</div>
          const METRIC_COLS=[
            {k:'calls',l:'Καταγραφές'},{k:'second_appointments',l:'2α Ραντεβού'},{k:'mandates',l:'Αναθέσεις'},
            {k:'demand',l:'Ζητήσεις'},{k:'showings',l:'Υποδείξεις'},{k:'offers',l:'Προσφορές'},
            {k:'deposits',l:'Προκαταβολές'},{k:'closings',l:'Κλεισίματα'},{k:'weeks_submitted',l:'Εβδ. Μετρ.'},
          ]
          const ProductionTable=({rows,title,totals=null})=>(
            <div style={{background:'#fff',border:'0.5px solid #e8e8e8',borderRadius:12,overflow:'hidden',marginBottom:16}}>
              <div style={{padding:'0.85rem 1.25rem',borderBottom:'0.5px solid #f0f0f0',fontSize:14,fontWeight:500,display:'flex',justifyContent:'space-between'}}>
                <span>{title}</span>
                {totals&&<span style={{fontSize:12,color:'#888',fontWeight:400}}>{rows.length} μεσίτες</span>}
              </div>
              <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:13,minWidth:760}}>
                <thead><tr style={{background:'#F8F8F7'}}>
                  <th style={{textAlign:'left',padding:'8px 12px',fontWeight:500,color:'#888',fontSize:11}}>Μεσίτης</th>
                  {METRIC_COLS.map(c=><th key={c.k} style={{textAlign:'right',padding:'8px 10px',fontWeight:500,color:'#888',fontSize:11}}>{c.l}</th>)}
                  <th style={{textAlign:'right',padding:'8px 12px',fontWeight:500,color:'#888',fontSize:11}}>XP</th>
                </tr></thead>
                <tbody>
                  {rows.map(a=>(
                    <tr key={a.agent_id} style={{borderBottom:'0.5px solid #F8F8F8'}}>
                      <td style={{padding:'10px 12px',fontWeight:500}}>{a.full_name}</td>
                      {METRIC_COLS.map(c=><td key={c.k} style={{padding:'10px',textAlign:'right',color:a[c.k]>0?'#1a1a1a':'#ccc'}}>{a[c.k]}</td>)}
                      <td style={{padding:'10px 12px',textAlign:'right',color:'#CC2229',fontWeight:600}}>{a.xp_total}</td>
                    </tr>
                  ))}
                  {totals&&(
                    <tr style={{background:'#F8F8F7',fontWeight:600}}>
                      <td style={{padding:'10px 12px'}}>Σύνολο</td>
                      {METRIC_COLS.map(c=><td key={c.k} style={{padding:'10px',textAlign:'right'}}>{totals[c.k]}</td>)}
                      <td style={{padding:'10px 12px',textAlign:'right',color:'#CC2229'}}>{totals.xp_total}</td>
                    </tr>
                  )}
                </tbody>
              </table>
              </div>
            </div>
          )
          const maxClosings=Math.max(...production.agents.map(a=>a.closings),1)
          return (
            <div>
              <div style={{fontSize:11,color:'#ccc',marginBottom:16,lineHeight:1.6}}>
                Συγκεντρωτικά δεδομένα από τις εβδομαδιαίες υποβολές (Μετρησιμότητα), τις ζητήσεις πελατών και τις υποδείξεις ακινήτων κάθε μεσίτη — το ίδιο view ανά μεσίτη υπάρχει στο Personal Admin του καθενός· εδώ φαίνονται όλοι μαζί. «Υποδείξεις» θα δείχνει 0 μέχρι να υπάρξει σημείο καταχώρησής τους στην εφαρμογή.
              </div>

              {production.teams.map((t)=>(
                <ProductionTable key={t.team} rows={t.agents} totals={t.totals} title={`👥 Ομάδα: ${t.team}`} />
              ))}
              {production.solo.length>0&&<ProductionTable rows={production.solo} title="🧍 Solo Μεσίτες" />}
              <ProductionTable rows={production.agents} totals={production.officeTotals} title="🏢 Σύνολο Γραφείου" />

              <div style={{background:'#fff',border:'0.5px solid #e8e8e8',borderRadius:12,padding:'1.25rem',marginTop:4}}>
                <div style={{fontSize:14,fontWeight:500,marginBottom:16}}>Κλεισίματα ανά μεσίτη</div>
                {production.agents.filter(a=>a.role==='agent').sort((a,b)=>b.closings-a.closings).map(a=>(
                  <div key={a.agent_id} style={{marginBottom:10}}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}><span style={{fontSize:13}}>{a.full_name}{a.team?<span style={{color:'#aaa'}}> · {a.team}</span>:''}</span><span style={{fontSize:12,color:'#888',fontWeight:500}}>{a.closings}</span></div>
                    <div style={{background:'#f0f0f0',borderRadius:100,height:6,overflow:'hidden'}}><div style={{height:'100%',borderRadius:100,background:'#CC2229',width:Math.max(Math.round((a.closings/maxClosings)*100),a.closings>0?4:0)+'%'}} /></div>
                  </div>
                ))}
              </div>
            </div>
          )
        })()}
      </div>
    </Shell>
  )
}