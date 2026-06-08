'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'

const C = {red:'#CC2229',redLight:'#FDF2F2',dark:'#1A1A1A',muted:'#6B7280',border:'#EBEBEB',subtle:'#F7F7F7',white:'#FFFFFF',green:'#16A34A',greenLight:'#F0FDF4',amber:'#D97706'}

const XP_MAP = {cold_calls:1,follow_up:1,leads_cold:3,leads_cultivation:3,leads_mail:3,leads_social:3,leads_database:3,meet1_seller_live:15,meet1_seller_phone:10,meet2_seller:25,meet1_buyer_live:15,meet1_buyer_phone:10,meet1_tenant_live:10,meet1_tenant_phone:7,excl_listing_sale:80,simple_listing_sale:40,excl_rental_high:60,excl_rental_low:40,simple_rental:20,contract_seller:150,contract_buyer:150,collab_internal:30,collab_external:30,offer_buyer:10,offer_tenant:10,photo_professional:5,open_house:20,matterport:15,new_partner:25,referral_sent:10,referral_received:10,training_meeting:5,admin_1on1:5}
function calcXP(d){return Object.keys(XP_MAP).reduce((s,k)=>s+(d[k]||0)*XP_MAP[k],0)}

function Bar({value,max,color,h=4}){const p=Math.min(100,Math.round(value/max*100));return <div style={{background:'#E9E9E9',borderRadius:99,height:h,overflow:'hidden'}}><div style={{width:p+'%',height:h,background:color,borderRadius:99,transition:'width .5s'}}/></div>}
function Av({initials,size=36,bg='#F4F4F5',color='#6B7280'}){return <div style={{width:size,height:size,borderRadius:'50%',background:bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:size*.3,fontWeight:700,color,flexShrink:0}}>{initials}</div>}

function DeltaBadge({now,prev}){
  if(!prev||prev===0) return null
  const d=Math.round((now-prev)/prev*100)
  return <span style={{fontSize:10,fontWeight:700,color:d>=0?C.green:C.red,background:d>=0?C.greenLight:C.redLight,padding:'2px 6px',borderRadius:99,marginLeft:6}}>{d>=0?'+':''}{d}%</span>
}

const MOCK_AGENT = {name:'Νίκος Καραμανλής',initials:'ΝΚ',level:7,levelName:'Sales Warrior',xpTotal:12840,xpNext:15000,streak:5}
const WEEK_NOW = {cold_calls:143,follow_up:210,meet1_seller_live:5,meet1_seller_phone:2,meet2_seller:4,meet1_buyer_live:2,excl_listing_sale:2,contract_seller:1}
const WEEK_PREV = {cold_calls:98,follow_up:165,meet1_seller_live:3,meet2_seller:2,excl_listing_sale:1,contract_seller:0}
const LB = [{name:'Κώστας Μ.',initials:'ΚΜ',xp:380,streak:8},{name:'Νίκος Κ.',initials:'ΝΚ',xp:340,streak:5},{name:'Γιώργος Σ.',initials:'ΓΣ',xp:290,streak:4},{name:'Μαρία Π.',initials:'ΜΠ',xp:210,streak:2},{name:'Ελένη Δ.',initials:'ΕΔ',xp:180,streak:1}]
const CEO_AGENTS = [{name:'Κώστας Μ.',initials:'ΚΜ',team:'A',calls:161,meet1:8,excl:3,contracts:3,xp:380,status:'green'},{name:'Νίκος Κ.',initials:'ΝΚ',team:'A',calls:143,meet1:6,excl:2,contracts:1,xp:340,status:'green'},{name:'Γιώργος Σ.',initials:'ΓΣ',team:'A',calls:120,meet1:7,excl:1,contracts:1,xp:290,status:'yellow'},{name:'Μαρία Π.',initials:'ΜΠ',team:'B',calls:98,meet1:9,excl:3,contracts:2,xp:210,status:'green'},{name:'Ελένη Δ.',initials:'ΕΔ',team:'B',calls:76,meet1:5,excl:0,contracts:0,xp:180,status:'red'},{name:'Παύλος Α.',initials:'ΠΑ',team:'B',calls:55,meet1:3,excl:0,contracts:0,xp:120,status:'red'}]

export default function Dashboard() {
  const [user,setUser]=useState(null)
  const [isCEO,setIsCEO]=useState(false)

  useEffect(()=>{
    supabase.auth.getUser().then(({data})=>{
      if(!data.user){window.location.href='/login';return}
      setUser(data.user)
    })
  },[])

  if(!user) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'#F4F4F4'}}><div style={{fontSize:13,color:C.muted}}>Φόρτωση...</div></div>

  const d = WEEK_NOW
  const xpWeek = calcXP(d)
  const kpis=[
    {label:'Cold Calls',val:d.cold_calls,prev:WEEK_PREV.cold_calls,target:120,color:C.red},
    {label:'Follow Up',val:d.follow_up,prev:WEEK_PREV.follow_up,target:200,color:'#2563EB'},
    {label:'1ο Ραντεβού',val:(d.meet1_seller_live||0)+(d.meet1_seller_phone||0),prev:WEEK_PREV.meet1_seller_live,target:6,color:'#D97706'},
    {label:'2ο Ραντεβού',val:d.meet2_seller,prev:WEEK_PREV.meet2_seller,target:4,color:'#7C3AED'},
    {label:'Αποκλ. Ανάθεση',val:d.excl_listing_sale,prev:WEEK_PREV.excl_listing_sale,target:2,color:'#0891B2'},
    {label:'Συμβόλαιο',val:d.contract_seller,prev:WEEK_PREV.contract_seller,target:1,color:C.green},
  ]
  const stC={green:C.green,yellow:C.amber,red:C.red}
  const stL={green:'On Track',yellow:'At Risk',red:'Off Track'}

  return (
    <div style={{display:'flex',minHeight:'100vh',background:'#F4F4F4',fontFamily:"-apple-system,BlinkMacSystemFont,'Inter',sans-serif",color:C.dark}}>
      <Sidebar isCEO={isCEO} onCEOToggle={()=>setIsCEO(!isCEO)}/>
      <div style={{marginLeft:64,flex:1,padding:'28px 32px',overflowY:'auto'}}>
        {!isCEO ? (
          <div style={{display:'flex',flexDirection:'column',gap:24}}>
            {/* Hero */}
            <div style={{background:C.dark,borderRadius:20,padding:'28px 32px',display:'flex',justifyContent:'space-between',alignItems:'center',color:'#fff'}}>
              <div>
                <p style={{fontSize:11,color:'rgba(255,255,255,.45)',margin:'0 0 6px',fontWeight:600,letterSpacing:.8,textTransform:'uppercase'}}>Καλημέρα</p>
                <h1 style={{fontSize:26,fontWeight:700,margin:'0 0 10px',letterSpacing:-.5}}>{MOCK_AGENT.name}</h1>
                <div style={{display:'flex',gap:12,alignItems:'center'}}>
                  <span style={{fontSize:13,color:'rgba(255,255,255,.55)'}}>Level {MOCK_AGENT.level} · {MOCK_AGENT.levelName}</span>
                  <span style={{background:C.red,color:'#fff',fontSize:11,fontWeight:600,padding:'3px 10px',borderRadius:99}}>🔥 {MOCK_AGENT.streak} εβδ. streak</span>
                </div>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{fontSize:44,fontWeight:800,color:C.red,letterSpacing:-2}}>{xpWeek}</div>
                <div style={{fontSize:11,color:'rgba(255,255,255,.45)',marginTop:2,fontWeight:500}}>XP ΑΥΤΗ ΤΗΝ ΕΒΔΟΜΑΔΑ</div>
                <div style={{marginTop:14,width:200}}>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'rgba(255,255,255,.35)',marginBottom:5}}>
                    <span>{MOCK_AGENT.xpTotal.toLocaleString()} XP</span><span>Lv{MOCK_AGENT.level+1} →</span>
                  </div>
                  <div style={{background:'rgba(255,255,255,.12)',borderRadius:99,height:5,overflow:'hidden'}}>
                    <div style={{width:Math.round(MOCK_AGENT.xpTotal/MOCK_AGENT.xpNext*100)+'%',height:5,background:C.red,borderRadius:99}}/>
                  </div>
                </div>
              </div>
            </div>

            {/* CTA */}
            <div style={{background:C.white,borderRadius:14,padding:'16px 20px',border:'1px solid '+C.border,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <div style={{fontSize:14,fontWeight:600}}>Εβδομάδα 23 — καταχώρηση ανοιχτή</div>
                <div style={{fontSize:12,color:C.muted,marginTop:2}}>Deadline: Κυριακή 23:59</div>
              </div>
              <a href="/submit" style={{background:C.red,color:'#fff',borderRadius:10,padding:'10px 20px',fontSize:13,fontWeight:700,textDecoration:'none'}}>
                ✏ Καταχώρηση →
              </a>
            </div>

            {/* KPIs */}
            <div>
              <p style={{fontSize:11,fontWeight:700,color:C.muted,letterSpacing:.8,textTransform:'uppercase',margin:'0 0 12px'}}>Στόχοι εβδομάδας · σύγκριση με περ. εβδ.</p>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12}}>
                {kpis.map(k=>{
                  const ok=k.val>=k.target
                  const pct=Math.min(100,Math.round(k.val/k.target*100))
                  return (
                    <div key={k.label} style={{background:C.white,borderRadius:16,padding:'18px 20px',border:'1px solid '+(ok?'#BBF7D0':C.border),boxShadow:'0 1px 4px rgba(0,0,0,.04)'}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                        <span style={{fontSize:12,fontWeight:500,color:C.muted}}>{k.label}</span>
                        {ok&&<span style={{fontSize:10,color:C.green,fontWeight:700,background:C.greenLight,padding:'2px 8px',borderRadius:99}}>✓ Στόχος</span>}
                      </div>
                      <div style={{display:'flex',alignItems:'baseline',gap:4,marginBottom:10}}>
                        <span style={{fontSize:32,fontWeight:800,color:ok?C.green:C.dark,letterSpacing:-1}}>{k.val}</span>
                        <DeltaBadge now={k.val} prev={k.prev}/>
                      </div>
                      <Bar value={k.val} max={k.target} color={ok?C.green:k.color} h={3}/>
                      <div style={{display:'flex',justifyContent:'space-between',marginTop:6}}>
                        <span style={{fontSize:11,color:C.muted}}>στόχος {k.target}</span>
                        <span style={{fontSize:11,color:C.muted}}>περ. εβδ: {k.prev}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Bottom */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
              <div style={{background:C.white,borderRadius:16,padding:'20px 22px',border:'1px solid '+C.border,boxShadow:'0 1px 4px rgba(0,0,0,.04)'}}>
                <p style={{fontSize:11,fontWeight:700,color:C.muted,letterSpacing:.8,textTransform:'uppercase',margin:'0 0 16px'}}>Leaderboard εβδομάδας</p>
                {LB.map((a,i)=>(
                  <div key={i} style={{display:'flex',alignItems:'center',gap:12,padding:'8px 0',borderBottom:i<LB.length-1?'1px solid '+C.border:'none'}}>
                    <span style={{fontSize:16,width:22}}>{['🥇','🥈','🥉','4','5'][i]}</span>
                    <Av initials={a.initials} size={30} bg={i===0?C.redLight:C.subtle} color={i===0?C.red:C.muted}/>
                    <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600}}>{a.name}</div><div style={{fontSize:11,color:C.muted}}>🔥 {a.streak} εβδ.</div></div>
                    <span style={{fontSize:15,fontWeight:800,color:i===0?C.red:C.dark}}>{a.xp}</span>
                  </div>
                ))}
              </div>
              <div style={{background:C.white,borderRadius:16,padding:'20px 22px',border:'1px solid '+C.border,boxShadow:'0 1px 4px rgba(0,0,0,.04)'}}>
                <p style={{fontSize:11,fontWeight:700,color:C.muted,letterSpacing:.8,textTransform:'uppercase',margin:'0 0 16px'}}>Weekly Winners</p>
                {[{icon:'📞',title:'King of Calls',name:'Νίκος Κ.',val:'187 calls'},{icon:'🏆',title:'Top Closer',name:'Κώστας Μ.',val:'3 συμβόλαια'},{icon:'🤝',title:'Meeting Machine',name:'Μαρία Π.',val:'9 ραντεβού'},{icon:'🔑',title:'Listing Legend',name:'Κώστας Μ.',val:'3 αναθέσεις'}].map((w,i)=>(
                  <div key={i} style={{display:'flex',alignItems:'center',gap:12,padding:'9px 12px',borderRadius:10,background:C.subtle,marginBottom:8}}>
                    <span style={{fontSize:20}}>{w.icon}</span>
                    <div><div style={{fontSize:10,color:C.muted,fontWeight:600,textTransform:'uppercase',letterSpacing:.5}}>{w.title}</div><div style={{fontSize:12,fontWeight:700,color:C.dark}}>{w.name} <span style={{color:C.muted,fontWeight:400}}>· {w.val}</span></div></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* CEO VIEW */
          <div style={{display:'flex',flexDirection:'column',gap:24}}>
            <div style={{background:C.dark,borderRadius:20,padding:'24px 28px',color:'#fff',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <p style={{fontSize:11,fontWeight:600,color:'rgba(255,255,255,.4)',letterSpacing:.8,textTransform:'uppercase',margin:'0 0 6px'}}>CEO Overview</p>
                <h1 style={{fontSize:22,fontWeight:700,margin:'0 0 4px',letterSpacing:-.5}}>KWAC Performance OS</h1>
                <p style={{fontSize:13,color:'rgba(255,255,255,.5)',margin:0}}>Εβδομάδα 23 · 50 μεσίτες</p>
              </div>
              <div style={{display:'flex',gap:10}}>
                <div style={{background:'rgba(255,255,255,.08)',borderRadius:12,padding:'10px 18px',textAlign:'center'}}><div style={{fontSize:22,fontWeight:800}}>50</div><div style={{fontSize:10,color:'rgba(255,255,255,.4)',fontWeight:600,marginTop:2}}>AGENTS</div></div>
                <div style={{background:C.red,borderRadius:12,padding:'10px 18px',textAlign:'center'}}><div style={{fontSize:22,fontWeight:800}}>12</div><div style={{fontSize:10,color:'rgba(255,255,255,.7)',fontWeight:600,marginTop:2}}>ΣΥΜΒΟΛΑΙΑ</div></div>
                <a href="/api/analytics?type=export" style={{background:'rgba(255,255,255,.1)',borderRadius:12,padding:'10px 18px',textAlign:'center',textDecoration:'none',color:'#fff',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
                  <div style={{fontSize:18}}>⬇</div><div style={{fontSize:10,fontWeight:600,marginTop:2}}>EXPORT CSV</div>
                </a>
              </div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:12}}>
              {[{label:'Cold Calls',val:'4.230',delta:'+12%',up:true},{label:'1ο Ραντεβού',val:'187',delta:'+8%',up:true},{label:'2ο Ραντεβού',val:'94',delta:'-3%',up:false},{label:'Αναθέσεις',val:'31',delta:'+5%',up:true},{label:'Συμβόλαια',val:'12',delta:'+20%',up:true}].map(k=>(
                <div key={k.label} style={{background:C.white,borderRadius:14,padding:'16px 18px',border:'1px solid '+C.border,boxShadow:'0 1px 4px rgba(0,0,0,.04)'}}>
                  <div style={{fontSize:11,fontWeight:600,color:C.muted,marginBottom:8}}>{k.label}</div>
                  <div style={{fontSize:26,fontWeight:800,color:C.dark,letterSpacing:-1}}>{k.val}</div>
                  <div style={{fontSize:12,marginTop:6,color:k.up?C.green:C.red,fontWeight:700}}>{k.delta} <span style={{color:C.muted,fontWeight:400}}>vs περ. εβδ.</span></div>
                </div>
              ))}
            </div>
            <div style={{background:C.white,borderRadius:16,border:'1px solid '+C.border,overflow:'hidden'}}>
              <div style={{padding:'14px 20px',borderBottom:'1px solid '+C.border,background:C.subtle}}>
                <p style={{fontSize:11,fontWeight:700,color:C.muted,letterSpacing:.8,textTransform:'uppercase',margin:0}}>Agents — Εβδομαδιαία Απόδοση</p>
              </div>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr style={{background:'#FAFAFA'}}>
                  {['Agent','Team','Calls','1ο Ραντ.','Αναθ.','Συμβόλ.','XP','Status'].map(h=>(
                    <th key={h} style={{padding:'9px 14px',textAlign:'left',fontSize:10,fontWeight:700,color:C.muted,letterSpacing:.5,borderBottom:'1px solid '+C.border}}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {CEO_AGENTS.map((a,i)=>(
                    <tr key={i} style={{borderBottom:i<CEO_AGENTS.length-1?'1px solid #F5F5F5':'none'}}>
                      <td style={{padding:'11px 14px'}}><div style={{display:'flex',alignItems:'center',gap:10}}><Av initials={a.initials} size={26}/><span style={{fontSize:13,fontWeight:600}}>{a.name}</span></div></td>
                      <td style={{padding:'11px 14px'}}><span style={{fontSize:11,fontWeight:600,color:C.muted,background:C.subtle,padding:'2px 8px',borderRadius:99}}>{a.team}</span></td>
                      <td style={{padding:'11px 14px',fontSize:13,fontWeight:700,color:a.calls>=120?C.green:a.calls>=80?C.amber:C.red}}>{a.calls}</td>
                      <td style={{padding:'11px 14px',fontSize:13}}>{a.meet1}</td>
                      <td style={{padding:'11px 14px',fontSize:13,fontWeight:a.excl>=2?700:400,color:a.excl>=2?C.green:C.dark}}>{a.excl}</td>
                      <td style={{padding:'11px 14px',fontSize:13,fontWeight:a.contracts>=1?700:400,color:a.contracts>=1?C.green:C.dark}}>{a.contracts}</td>
                      <td style={{padding:'11px 14px',fontSize:13,fontWeight:700}}>{a.xp}</td>
                      <td style={{padding:'11px 14px'}}><span style={{display:'inline-flex',alignItems:'center',gap:5,fontSize:11,fontWeight:500,color:stC[a.status]}}><span style={{width:6,height:6,borderRadius:'50%',background:stC[a.status],display:'inline-block'}}/>{stL[a.status]}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}