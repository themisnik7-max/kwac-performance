'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'

const C = {
  red:'#CC2229', redLight:'#FDF2F2', dark:'#1A1A1A',
  muted:'#6B7280', border:'#EBEBEB', subtle:'#F7F7F7', white:'#FFFFFF', bg:'#F4F4F4',
  green:'#16A34A', greenLight:'#F0FDF4', amber:'#D97706',
}

const TARGETS = {cold_calls:120,follow_up:200,meet1_seller_live:4,meet1_seller_phone:2,meet1_buyer_live:2,meet2_seller:4,excl_listing_sale:2,contract_seller:1}
const XP_MAP = {cold_calls:1,follow_up:1,leads_cold:3,leads_cultivation:3,leads_mail:3,leads_social:3,leads_database:3,meet1_seller_live:15,meet1_seller_phone:10,meet2_seller:25,meet1_buyer_live:15,meet1_buyer_phone:10,meet1_tenant_live:10,meet1_tenant_phone:7,excl_listing_sale:80,simple_listing_sale:40,excl_rental_high:60,excl_rental_low:40,simple_rental:20,contract_seller:150,contract_buyer:150,collab_internal:30,collab_external:30,offer_buyer:10,offer_tenant:10,photo_professional:5,open_house:20,matterport:15,new_partner:25,referral_sent:10,referral_received:10,training_meeting:5,admin_1on1:5}

const FORM_SECTIONS = [
  {label:'Lead Generation',accent:C.red,fields:[
    {key:'cold_calls',label:'Cold Calls (1ης επικοινωνίας)',min:120,suffix:'calls'},
    {key:'leads_cold',label:'Leads από Cold Calls',suffix:'leads'},
    {key:'follow_up',label:'Τηλεφωνικό Follow Up',min:200,suffix:'calls'},
    {key:'leads_cultivation',label:'Leads από Καλλιέργεια Περιοχής',suffix:'leads'},
    {key:'leads_mail',label:'Leads από Mail / Viber / SMS',suffix:'leads'},
    {key:'leads_social',label:'Leads από Social Media',suffix:'leads'},
    {key:'leads_database',label:'Leads από Βάση Δεδομένων',suffix:'leads'},
  ]},
  {label:'Ραντεβού',accent:'#2563EB',fields:[
    {key:'meet1_seller_live',label:'1ο Ραντεβού Πωλητή — ζωντανά',min:4,suffix:'ραντ.'},
    {key:'meet1_seller_phone',label:'1ο Ραντεβού Πωλητή — τηλεφωνικά',suffix:'ραντ.'},
    {key:'meet2_seller',label:'2ο Ραντεβού Πωλητή (Παρουσίαση)',min:4,suffix:'ραντ.'},
    {key:'meet1_buyer_live',label:'1ο Ραντεβού Αγοραστή — ζωντανά',suffix:'ραντ.'},
    {key:'meet1_buyer_phone',label:'1ο Ραντεβού Αγοραστή — τηλεφωνικά',suffix:'ραντ.'},
    {key:'meet1_tenant_live',label:'1ο Ραντεβού Μισθωτή — ζωντανά',suffix:'ραντ.'},
    {key:'meet1_tenant_phone',label:'1ο Ραντεβού Μισθωτή — τηλεφωνικά',suffix:'ραντ.'},
  ]},
  {label:'Αναθέσεις',accent:'#D97706',fields:[
    {key:'excl_listing_sale',label:'Αποκλειστική Ανάθεση Πώλησης',min:2,suffix:'εντολές'},
    {key:'simple_listing_sale',label:'Απλή Ανάθεση Πώλησης',suffix:'εντολές'},
    {key:'excl_rental_high',label:'Αποκλ. Εκμίσθωσης (>1.000€)',suffix:'εντολές'},
    {key:'excl_rental_low',label:'Αποκλ. Εκμίσθωσης (≤1.000€)',suffix:'εντολές'},
    {key:'simple_rental',label:'Απλή Εντολή Εκμίσθωσης',suffix:'εντολές'},
  ]},
  {label:'Συμβόλαια',accent:C.green,fields:[
    {key:'contract_seller',label:'Πράξη Συμβολαίου Πωλητή',min:1,suffix:'συμβόλ.'},
    {key:'contract_buyer',label:'Πράξη Συμβολαίου Αγοραστή',suffix:'συμβόλ.'},
    {key:'offer_buyer',label:'Προσφορά Αγοραστή (υπογ.)',suffix:''},
    {key:'offer_tenant',label:'Προσφορά Μισθωτή (υπογ.)',suffix:''},
    {key:'collab_internal',label:'Συνεργασία εντός KW',suffix:''},
    {key:'collab_external',label:'Συνεργασία εκτός KW',suffix:''},
  ]},
  {label:'Marketing',accent:'#7C3AED',fields:[
    {key:'photo_professional',label:'Επαγγελματική Φωτογράφιση',suffix:'ακίν.'},
    {key:'open_house',label:'Open House',suffix:'events'},
    {key:'matterport',label:'Matterport 3D Tour',suffix:'tours'},
  ]},
  {label:'Networking & Training',accent:C.muted,fields:[
    {key:'new_partner',label:'Πρόταση Νέου Συνεργάτη',suffix:''},
    {key:'referral_sent',label:'Αποστολή Σύστασης',suffix:''},
    {key:'referral_received',label:'Αποδοχή Σύστασης',suffix:''},
    {key:'training_meeting',label:'Meeting Εκπαίδευσης',suffix:''},
    {key:'admin_1on1',label:'Admin 1:1',suffix:''},
  ]},
]

function calcXP(d){return Object.keys(XP_MAP).reduce((s,k)=>s+(d[k]||0)*XP_MAP[k],0)}
function Bar({value,max,color,h=4}){const p=Math.min(100,Math.round(value/max*100));return <div style={{background:'#E9E9E9',borderRadius:99,height:h,overflow:'hidden'}}><div style={{width:p+'%',height:h,background:color,borderRadius:99,transition:'width .5s'}}/></div>}
function Av({initials,size=36,bg=C.subtle,color=C.muted}){return <div style={{width:size,height:size,borderRadius:'50%',background:bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:size*.3,fontWeight:700,color,flexShrink:0}}>{initials}</div>}

const MOCK_AGENT = {name:'Νίκος Καραμανλής',initials:'ΝΚ',level:7,levelName:'Sales Warrior',xpTotal:12840,xpNext:15000,streak:5}
const WEEK_NOW = {cold_calls:143,follow_up:210,meet1_seller_live:5,meet1_seller_phone:2,meet2_seller:4,meet1_buyer_live:2,meet1_buyer_phone:1,meet1_tenant_live:1,meet1_tenant_phone:0,excl_listing_sale:2,simple_listing_sale:1,excl_rental_high:0,excl_rental_low:1,simple_rental:0,contract_seller:1,contract_buyer:0,offer_buyer:2,offer_tenant:1,collab_internal:1,collab_external:0,leads_cold:8,leads_cultivation:3,leads_mail:2,leads_social:4,leads_database:1,photo_professional:2,open_house:1,matterport:0,new_partner:0,referral_sent:1,referral_received:0,training_meeting:1,admin_1on1:1}
const WEEK_PREV = {cold_calls:98,follow_up:165,meet1_seller_live:3,meet2_seller:2,excl_listing_sale:1,contract_seller:0}
const MONTH_PREV = {cold_calls:110,follow_up:190,meet1_seller_live:4,meet2_seller:3,excl_listing_sale:2,contract_seller:1}
const LB = [{name:'Κώστας Μ.',initials:'ΚΜ',xp:380,streak:8},{name:'Νίκος Κ.',initials:'ΝΚ',xp:340,streak:5},{name:'Γιώργος Σ.',initials:'ΓΣ',xp:290,streak:4},{name:'Μαρία Π.',initials:'ΜΠ',xp:210,streak:2},{name:'Ελένη Δ.',initials:'ΕΔ',xp:180,streak:1}]
const CEO_AGENTS = [{name:'Κώστας Μ.',initials:'ΚΜ',team:'A',calls:161,meet1:8,excl:3,contracts:3,xp:380,status:'green'},{name:'Νίκος Κ.',initials:'ΝΚ',team:'A',calls:143,meet1:6,excl:2,contracts:1,xp:340,status:'green'},{name:'Γιώργος Σ.',initials:'ΓΣ',team:'A',calls:120,meet1:7,excl:1,contracts:1,xp:290,status:'yellow'},{name:'Μαρία Π.',initials:'ΜΠ',team:'B',calls:98,meet1:9,excl:3,contracts:2,xp:210,status:'green'},{name:'Ελένη Δ.',initials:'ΕΔ',team:'B',calls:76,meet1:5,excl:0,contracts:0,xp:180,status:'red'},{name:'Παύλος Α.',initials:'ΠΑ',team:'B',calls:55,meet1:3,excl:0,contracts:0,xp:120,status:'red'}]

function delta(now, prev) {
  if(!prev || prev===0) return null
  const d = Math.round((now-prev)/prev*100)
  return {val:d, up:d>=0}
}

function DeltaBadge({now, prev}) {
  const d = delta(now, prev)
  if(!d) return null
  return <span style={{fontSize:10,fontWeight:700,color:d.up?C.green:C.red,background:d.up?C.greenLight:C.redLight,padding:'2px 6px',borderRadius:99,marginLeft:6}}>{d.up?'+':''}{d.val}%</span>
}

function AgentDashboard(){
  const d = WEEK_NOW
  const xpWeek = calcXP(d)
  const meet1 = (d.meet1_seller_live||0)+(d.meet1_seller_phone||0)
  const kpis=[
    {label:'Cold Calls',val:d.cold_calls,prev:WEEK_PREV.cold_calls,prevMonth:MONTH_PREV.cold_calls,target:120,color:C.red},
    {label:'Follow Up',val:d.follow_up,prev:WEEK_PREV.follow_up,prevMonth:MONTH_PREV.follow_up,target:200,color:'#2563EB'},
    {label:'1ο Ραντεβού',val:meet1,prev:WEEK_PREV.meet1_seller_live,prevMonth:MONTH_PREV.meet1_seller_live,target:6,color:'#D97706'},
    {label:'2ο Ραντεβού',val:d.meet2_seller,prev:WEEK_PREV.meet2_seller,prevMonth:MONTH_PREV.meet2_seller,target:4,color:'#7C3AED'},
    {label:'Αποκλ. Ανάθεση',val:d.excl_listing_sale,prev:WEEK_PREV.excl_listing_sale,prevMonth:MONTH_PREV.excl_listing_sale,target:2,color:'#0891B2'},
    {label:'Συμβόλαιο',val:d.contract_seller,prev:WEEK_PREV.contract_seller,prevMonth:MONTH_PREV.contract_seller,target:1,color:C.green},
  ]
  return (
    <div style={{display:'flex',flexDirection:'column',gap:24}}>
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
  )
}

function SubmitForm(){
  const [vals,setVals]=useState({})
  const [sec,setSec]=useState(0)
  const [saved,setSaved]=useState(false)
  function set(k,v){setVals(p=>({...p,[k]:Math.max(0,parseInt(v)||0)}))}
  const xp=calcXP(vals)
  const done=Object.entries(TARGETS).filter(([k,t])=>(vals[k]||0)>=t).length
  const total=Object.keys(TARGETS).length
  return (
    <div style={{display:'flex',flexDirection:'column',gap:20}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
        <div>
          <h1 style={{fontSize:22,fontWeight:700,letterSpacing:-.5,margin:'0 0 4px',color:C.dark}}>Καταχώρηση Εβδομάδας 23</h1>
          <p style={{fontSize:13,color:C.muted,margin:0}}>Deadline: Κυριακή 23:59</p>
        </div>
        <div style={{display:'flex',gap:12,alignItems:'center'}}>
          <div style={{background:C.dark,borderRadius:12,padding:'10px 16px',textAlign:'center'}}>
            <div style={{fontSize:20,fontWeight:800,color:C.red}}>+{xp}</div>
            <div style={{fontSize:10,color:'rgba(255,255,255,.5)',fontWeight:600}}>XP · {done}/{total} στόχοι</div>
          </div>
          <button onClick={()=>setSaved(true)} style={{background:saved?C.green:C.red,color:'#fff',border:'none',borderRadius:10,padding:'10px 22px',fontSize:13,fontWeight:700,cursor:'pointer',transition:'background .3s'}}>
            {saved?'✓ Αποθηκεύτηκε':'Αποθήκευση'}
          </button>
        </div>
      </div>
      <div style={{background:C.white,borderRadius:12,padding:'14px 18px',border:'1px solid '+C.border}}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}><span style={{fontSize:12,fontWeight:600}}>Πρόοδος στόχων</span><span style={{fontSize:12,color:C.muted}}>{done} / {total}</span></div>
        <Bar value={done} max={total} color={C.red} h={6}/>
      </div>
      <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
        {FORM_SECTIONS.map((s,i)=>(
          <button key={i} onClick={()=>setSec(i)} style={{padding:'7px 16px',borderRadius:99,border:'1px solid '+(sec===i?s.accent:C.border),background:sec===i?s.accent:C.white,color:sec===i?'#fff':C.muted,fontSize:12,fontWeight:600,cursor:'pointer',transition:'all .15s'}}>{s.label}</button>
        ))}
      </div>
      <div style={{background:C.white,borderRadius:16,border:'1px solid '+C.border,overflow:'hidden'}}>
        <div style={{padding:'14px 22px',borderBottom:'1px solid '+C.border,display:'flex',alignItems:'center',gap:10,background:C.subtle}}>
          <div style={{width:8,height:8,borderRadius:'50%',background:FORM_SECTIONS[sec].accent}}/>
          <span style={{fontSize:13,fontWeight:700}}>{FORM_SECTIONS[sec].label}</span>
        </div>
        {FORM_SECTIONS[sec].fields.map((f,fi)=>{
          const val=vals[f.key]||0
          const isT=f.min!==undefined
          const ok=isT&&val>=f.min
          return (
            <div key={f.key} style={{display:'flex',alignItems:'center',padding:'13px 22px',borderBottom:fi<FORM_SECTIONS[sec].fields.length-1?'1px solid #F5F5F5':'none',gap:16,background:ok?'#F0FFF4':'#fff'}}>
              <div style={{flex:1}}>
                <div style={{fontSize:13,color:isT?C.dark:C.muted,fontWeight:isT?500:400}}>{f.label}</div>
                {isT&&<div style={{fontSize:11,color:C.muted,marginTop:2}}>Στόχος: {f.min} {f.suffix}</div>}
              </div>
              {ok&&<span style={{fontSize:13,color:C.green,fontWeight:700}}>✓</span>}
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <button onClick={()=>set(f.key,val-1)} style={{width:30,height:30,borderRadius:8,border:'1px solid '+C.border,background:C.white,cursor:'pointer',fontSize:16,color:C.muted}}>−</button>
                <input type="number" value={val} min={0} onChange={e=>set(f.key,e.target.value)} style={{width:60,textAlign:'center',padding:'5px 0',borderRadius:8,border:'1px solid '+(isT&&!ok&&val>0?'#FCA5A5':C.border),fontSize:15,fontWeight:700,color:ok?C.green:C.dark,background:'#FAFAFA'}}/>
                <button onClick={()=>set(f.key,val+1)} style={{width:30,height:30,borderRadius:8,border:'1px solid '+C.border,background:C.white,cursor:'pointer',fontSize:16,color:C.red,fontWeight:700}}>+</button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CEODashboard(){
  const kpis=[{label:'Cold Calls',val:'4.230',delta:'+12%',up:true},{label:'1ο Ραντεβού',val:'187',delta:'+8%',up:true},{label:'2ο Ραντεβού',val:'94',delta:'-3%',up:false},{label:'Αναθέσεις',val:'31',delta:'+5%',up:true},{label:'Συμβόλαια',val:'12',delta:'+20%',up:true}]
  const stCol={green:C.green,yellow:C.amber,red:C.red}
  const stLbl={green:'On Track',yellow:'At Risk',red:'Off Track'}
  return (
    <div style={{display:'flex',flexDirection:'column',gap:24}}>
      <div style={{background:C.dark,borderRadius:20,padding:'24px 28px',color:'#fff',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div>
          <p style={{fontSize:11,fontWeight:600,color:'rgba(255,255,255,.4)',letterSpacing:.8,textTransform:'uppercase',margin:'0 0 6px'}}>CEO Overview</p>
          <h1 style={{fontSize:22,fontWeight:700,margin:'0 0 4px',letterSpacing:-.5}}>KWAC Performance OS</h1>
          <p style={{fontSize:13,color:'rgba(255,255,255,.5)',margin:0}}>Εβδομάδα 23 · 50 μεσίτες · σύγκριση με περ. εβδ.</p>
        </div>
        <div style={{display:'flex',gap:10}}>
          <div style={{background:'rgba(255,255,255,.08)',borderRadius:12,padding:'10px 18px',textAlign:'center'}}><div style={{fontSize:22,fontWeight:800}}>50</div><div style={{fontSize:10,color:'rgba(255,255,255,.4)',fontWeight:600,marginTop:2}}>AGENTS</div></div>
          <div style={{background:C.red,borderRadius:12,padding:'10px 18px',textAlign:'center'}}><div style={{fontSize:22,fontWeight:800}}>12</div><div style={{fontSize:10,color:'rgba(255,255,255,.7)',fontWeight:600,marginTop:2}}>ΣΥΜΒΟΛΑΙΑ</div></div>
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:12}}>
        {kpis.map(k=>(
          <div key={k.label} style={{background:C.white,borderRadius:14,padding:'16px 18px',border:'1px solid '+C.border,boxShadow:'0 1px 4px rgba(0,0,0,.04)'}}>
            <div style={{fontSize:11,fontWeight:600,color:C.muted,marginBottom:8}}>{k.label}</div>
            <div style={{fontSize:26,fontWeight:800,color:C.dark,letterSpacing:-1}}>{k.val}</div>
            <div style={{fontSize:12,marginTop:6,color:k.up?C.green:C.red,fontWeight:700}}>{k.delta} <span style={{color:C.muted,fontWeight:400}}>vs περ. εβδ.</span></div>
          </div>
        ))}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'3fr 2fr',gap:16}}>
        <div style={{background:C.white,borderRadius:16,border:'1px solid '+C.border,overflow:'hidden',boxShadow:'0 1px 4px rgba(0,0,0,.04)'}}>
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
                  <td style={{padding:'11px 14px'}}><span style={{display:'inline-flex',alignItems:'center',gap:5,fontSize:11,fontWeight:500,color:stCol[a.status]}}><span style={{width:6,height:6,borderRadius:'50%',background:stCol[a.status],display:'inline-block'}}/>{stLbl[a.status]}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <div style={{background:C.white,borderRadius:16,padding:'18px 20px',border:'1px solid '+C.border,boxShadow:'0 1px 4px rgba(0,0,0,.04)'}}>
            <p style={{fontSize:11,fontWeight:700,color:C.muted,letterSpacing:.8,textTransform:'uppercase',margin:'0 0 14px'}}>Funnel ομάδας</p>
            {[{label:'Cold Calls',val:4230,color:C.red},{label:'1ο Ραντεβού',val:187,color:'#2563EB'},{label:'2ο Ραντεβού',val:94,color:C.amber},{label:'Αναθέσεις',val:31,color:'#7C3AED'},{label:'Συμβόλαια',val:12,color:C.green}].map((f,i,arr)=>(
              <div key={i} style={{marginBottom:10}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}><span style={{fontSize:12,color:C.muted}}>{f.label}</span><span style={{fontSize:12,fontWeight:700}}>{f.val.toLocaleString()}</span></div>
                <Bar value={f.val} max={arr[0].val} color={f.color} h={5}/>
              </div>
            ))}
          </div>
          <div style={{background:C.white,borderRadius:16,padding:'18px 20px',border:'1px solid '+C.border,boxShadow:'0 1px 4px rgba(0,0,0,.04)'}}>
            <p style={{fontSize:11,fontWeight:700,color:C.muted,letterSpacing:.8,textTransform:'uppercase',margin:'0 0 14px'}}>AI Insights</p>
            {[{icon:'⚠️',text:'6 agents κάτω από στόχο σε calls',bg:'#FFFBEB'},{icon:'⚠️',text:'Ελένη Δ. & Παύλος Α. — 0 αναθέσεις',bg:'#FEF2F2'},{icon:'📈',text:'Κώστας Μ. — top performer +40%',bg:'#F0FDF4'},{icon:'💡',text:'1ο→2ο ραντεβού: 50% (στόχος 60%)',bg:'#F5F3FF'}].map((f,i)=>(
              <div key={i} style={{display:'flex',gap:8,alignItems:'flex-start',padding:'8px 10px',borderRadius:8,background:f.bg,marginBottom:6}}>
                <span style={{fontSize:14,flexShrink:0}}>{f.icon}</span>
                <span style={{fontSize:11,lineHeight:1.5,color:C.dark}}>{f.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function ChatPanel({isCEO}){
  const [msgs,setMsgs]=useState([{role:'ai',text:isCEO?'Καλημέρα! Τα συμβόλαια +20% vs περ. εβδομάδα. Ποια ομάδα θέλεις να εξετάσουμε;':'Γεια! Τα calls σου +46% vs περ. εβδομάδα 💪 Που θέλεις να εστιάσουμε;'}])
  const [inp,setInp]=useState('')
  const [loading,setLoading]=useState(false)
  const ref=useRef()
  useEffect(()=>{ref.current?.scrollIntoView({behavior:'smooth'})},[msgs])
  async function send(){
    const q=inp.trim();if(!q||loading)return
    setInp('');setMsgs(m=>[...m,{role:'user',text:q}]);setLoading(true)
    try{
      const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:600,system:isCEO?'Είσαι AI σύμβουλος CEO μεσιτικής KWAC. Συγκρίνεις με ΠΕΡΑΣΜΕΝΗ ΕΒΔΟΜΑΔΑ και ΠΕΡΑΣΜΕΝΟ ΜΗΝΑ (όχι περσινό έτος). KPIs εβδομάδας: Calls 4.230 (+12% vs περ.εβδ), 1ο ραντεβού 187 (+8%), 2ο ραντεβού 94 (-3%), Αναθέσεις 31 (+5%), Συμβόλαια 12 (+20%). Απάντα ελληνικά, στρατηγικά, 3-4 φράσεις.':'Είσαι AI coach μεσίτη KWAC. Συγκρίνεις ΠΑΝΤΑ με περασμένη εβδομάδα και περασμένο μήνα. Calls τώρα:143 (περ.εβδ:98, +46%), Follow up:210 (περ.εβδ:165, +27%), Αναθέσεις:2 (περ.εβδ:1, +100%), Συμβόλαια:1 (περ.εβδ:0). Streak 5 εβδομάδες. Απάντα ελληνικά, με ενθουσιασμό, 2-3 φράσεις.',messages:msgs.map(m=>({role:m.role==='ai'?'assistant':'user',content:m.text})).concat({role:'user',content:q})})})
      const d=await r.json()
      setMsgs(m=>[...m,{role:'ai',text:d.content[0].text}])
    }catch(e){setMsgs(m=>[...m,{role:'ai',text:'Κάτι πήγε στραβά — δοκίμασε ξανά!'}])}
    setLoading(false)
  }
  return (
    <div style={{display:'flex',flexDirection:'column',height:'calc(100vh - 130px)'}}>
      <div style={{marginBottom:20}}>
        <h1 style={{fontSize:22,fontWeight:700,letterSpacing:-.5,margin:'0 0 4px',color:C.dark}}>{isCEO?'CEO AI Advisor':'AI Coach'}</h1>
        <p style={{fontSize:13,color:C.muted,margin:0}}>{isCEO?'Στρατηγική ανάλυση · σύγκριση με περ. εβδομάδα & μήνα':'Προσωπικός coach · σύγκριση με περ. εβδομάδα & μήνα'}</p>
      </div>
      <div style={{flex:1,overflowY:'auto',display:'flex',flexDirection:'column',gap:12,marginBottom:16}}>
        {msgs.map((m,i)=>(
          <div key={i} style={{display:'flex',justifyContent:m.role==='user'?'flex-end':'flex-start'}}>
            <div style={{maxWidth:'76%',padding:'12px 16px',borderRadius:16,fontSize:13,lineHeight:1.65,background:m.role==='user'?C.dark:'#fff',color:m.role==='user'?'#fff':C.dark,border:m.role==='ai'?'1px solid '+C.border:'none',borderBottomRightRadius:m.role==='user'?4:16,borderBottomLeftRadius:m.role==='ai'?4:16,boxShadow:m.role==='ai'?'0 1px 4px rgba(0,0,0,.04)':'none'}}>{m.text}</div>
          </div>
        ))}
        {loading&&<div style={{display:'flex',justifyContent:'flex-start'}}><div style={{padding:'12px 16px',borderRadius:16,borderBottomLeftRadius:4,background:'#fff',border:'1px solid '+C.border,fontSize:13,color:C.muted,fontStyle:'italic'}}>Σκέφτομαι...</div></div>}
        <div ref={ref}/>
      </div>
      <div style={{display:'flex',gap:10}}>
        <input value={inp} onChange={e=>setInp(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()} placeholder={isCEO?'π.χ. Ποιους agents πρέπει να καλέσω;':'π.χ. Πώς να βελτιώσω το conversion μου;'} style={{flex:1,padding:'13px 18px',borderRadius:12,border:'1px solid '+C.border,fontSize:13,background:'#fff',outline:'none'}}/>
        <button onClick={send} style={{background:C.dark,color:'#fff',border:'none',borderRadius:12,padding:'13px 22px',fontSize:13,fontWeight:600,cursor:'pointer'}}>↗</button>
      </div>
    </div>
  )
}

export default function Dashboard(){
  const [user,setUser]=useState(null)
  const [page,setPage]=useState('dashboard')
  const [isCEO,setIsCEO]=useState(false)
  useEffect(()=>{
    supabase.auth.getUser().then(({data})=>{
      if(!data.user){window.location.href='/login';return}
      setUser(data.user)
    })
  },[])
  async function logout(){await supabase.auth.signOut();window.location.href='/login'}
  if(!user) return <div style={{padding:40,textAlign:'center',fontSize:14,color:'#999'}}>Φόρτωση...</div>
  const agentNav=[{id:'dashboard',icon:'⊞',label:'Dashboard'},{id:'submit',icon:'✏',label:'Καταχώρηση'},{id:'chat',icon:'◎',label:'AI Coach'}]
  const ceoNav=[{id:'dashboard',icon:'⊞',label:'Overview'},{id:'chat',icon:'◎',label:'AI Advisor'}]
  const nav=isCEO?ceoNav:agentNav
  return (
    <div style={{display:'flex',minHeight:'100vh',background:'#F4F4F4',fontFamily:"-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',sans-serif",color:C.dark}}>
      <div style={{width:64,background:'#111',display:'flex',flexDirection:'column',alignItems:'center',paddingTop:16,paddingBottom:16,gap:4,position:'fixed',top:0,left:0,height:'100vh',zIndex:10}}>
        <div style={{color:'#fff',fontWeight:800,fontSize:12,marginBottom:18,letterSpacing:1,textAlign:'center',lineHeight:1.2}}>KW<br/><span style={{color:C.red}}>AC</span></div>
        {nav.map(it=>(
          <button key={it.id} onClick={()=>setPage(it.id)} style={{width:48,height:48,borderRadius:10,border:'none',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:2,background:page===it.id?'rgba(255,255,255,.12)':'transparent',color:page===it.id?'#fff':'rgba(255,255,255,.35)',fontSize:16,transition:'all .15s'}}>
            <span>{it.icon}</span><span style={{fontSize:7,fontWeight:600,letterSpacing:.3}}>{it.label}</span>
          </button>
        ))}
        <div style={{flex:1}}/>
        <button onClick={()=>{setIsCEO(!isCEO);setPage('dashboard')}} style={{width:44,height:44,borderRadius:10,border:isCEO?'1px solid '+C.red:'1px solid rgba(255,255,255,.1)',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:2,background:isCEO?C.red+'33':'transparent',color:isCEO?C.red:'rgba(255,255,255,.35)',fontSize:13,transition:'all .15s'}}>
          <span>👔</span><span style={{fontSize:7,fontWeight:600}}>CEO</span>
        </button>
        <button onClick={logout} style={{width:44,height:44,borderRadius:10,border:'1px solid rgba(255,255,255,.08)',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:2,background:'transparent',color:'rgba(255,255,255,.3)',fontSize:13,marginTop:4}}>
          <span>🚪</span><span style={{fontSize:7,fontWeight:600}}>Έξοδος</span>
        </button>
      </div>
      <div style={{marginLeft:64,flex:1,overflowY:'auto',padding:'28px 32px'}}>
        {!isCEO&&page==='dashboard'&&<AgentDashboard/>}
        {!isCEO&&page==='submit'&&<SubmitForm/>}
        {!isCEO&&page==='chat'&&<ChatPanel isCEO={false}/>}
        {isCEO&&page==='dashboard'&&<CEODashboard/>}
        {isCEO&&page==='chat'&&<ChatPanel isCEO={true}/>}
      </div>
    </div>
  )
}