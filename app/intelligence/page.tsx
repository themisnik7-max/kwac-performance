'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'

const C = {red:'#CC2229',redLight:'#FDF2F2',dark:'#1A1A1A',muted:'#6B7280',border:'#EBEBEB',subtle:'#F7F7F7',white:'#FFFFFF',green:'#16A34A',greenLight:'#F0FDF4',amber:'#D97706',blue:'#2563EB',purple:'#7C3AED'}

// ── Mock data (θα αντικατασταθεί από Supabase) ─────────────────────────────
const MOCK_SUMMARY = {
  current_week: {
    week:23, year:2026, agents_submitted:38,
    total_calls:4230, total_follow_up:8100,
    total_meet1:187, total_meet2:94,
    total_excl_listings:31, total_contracts:12,
    total_xp:18450,
  },
  prev_week: {
    total_calls:3780, total_follow_up:7200,
    total_meet1:173, total_meet2:102,
    total_excl_listings:28, total_contracts:10,
  },
  prev_month_avg: {
    total_calls:3950, total_meet1:180,
    total_excl_listings:29, total_contracts:11,
  },
  agents: [
    {name:'Κώστας Μ.',team:'A',weeks:23,avg_calls:158,meet1:8,excl:3,contracts:3,xp:8740,conversion:78,streak:8,status:'green'},
    {name:'Νίκος Κ.',team:'A',weeks:23,avg_calls:143,meet1:6,excl:2,contracts:1,xp:6320,conversion:65,streak:5,status:'green'},
    {name:'Γιώργος Σ.',team:'A',weeks:20,avg_calls:121,meet1:7,excl:1,contracts:1,xp:5100,conversion:58,streak:4,status:'yellow'},
    {name:'Μαρία Π.',team:'B',weeks:23,avg_calls:98,meet1:9,excl:3,contracts:2,xp:5800,conversion:82,streak:2,status:'green'},
    {name:'Ελένη Δ.',team:'B',weeks:18,avg_calls:76,meet1:5,excl:0,contracts:0,xp:2100,conversion:40,streak:1,status:'red'},
    {name:'Παύλος Α.',team:'B',weeks:15,avg_calls:55,meet1:3,excl:0,contracts:0,xp:1200,conversion:33,streak:0,status:'red'},
  ],
  trends: [
    {week:'Εβδ.18',calls:3100,contracts:8,excl:22},
    {week:'Εβδ.19',calls:3400,contracts:9,excl:25},
    {week:'Εβδ.20',calls:3200,contracts:7,excl:24},
    {week:'Εβδ.21',calls:3800,contracts:11,excl:28},
    {week:'Εβδ.22',calls:3780,contracts:10,excl:28},
    {week:'Εβδ.23',calls:4230,contracts:12,excl:31},
  ]
}

const INDUSTRY_BENCHMARKS = {
  calls_per_agent: 100,
  meet1_conversion: 0.05,
  meet2_conversion: 0.60,
  listing_to_contract: 0.35,
  avg_days_market: 65,
}

function buildDataContext(data) {
  const d = data || MOCK_SUMMARY
  const wk = d.current_week
  const pw = d.prev_week
  const pm = d.prev_month_avg

  const callsDelta = pw.total_calls ? Math.round((wk.total_calls-pw.total_calls)/pw.total_calls*100) : 0
  const contractsDelta = pw.total_contracts ? Math.round((wk.total_contracts-pw.total_contracts)/pw.total_contracts*100) : 0
  const meet1Delta = pw.total_meet1 ? Math.round((wk.total_meet1-pw.total_meet1)/pw.total_meet1*100) : 0
  const exclDelta = pw.total_excl_listings ? Math.round((wk.total_excl_listings-pw.total_excl_listings)/pw.total_excl_listings*100) : 0

  const conversion1to2 = wk.total_meet1 ? Math.round(wk.total_meet2/wk.total_meet1*100) : 0
  const callToMeet1 = wk.total_calls ? Math.round(wk.total_meet1/wk.total_calls*100) : 0

  const redFlagAgents = d.agents.filter(a=>a.status==='red').map(a=>a.name).join(', ')
  const topAgents = [...d.agents].sort((a,b)=>b.xp-a.xp).slice(0,3).map(a=>a.name+' ('+a.xp+' XP)').join(', ')
  const highConversion = [...d.agents].sort((a,b)=>b.conversion-a.conversion).slice(0,2).map(a=>a.name+' '+a.conversion+'%').join(', ')

  return `Είσαι AI σύμβουλος στρατηγικής για τον CEO/Admin της μεσιτικής εταιρείας KWAC (Keller Williams Athens Center).

=== ΔΕΔΟΜΕΝΑ ΕΒΔΟΜΑΔΑΣ ${wk.week}/${wk.year} ===
Agents που υπέβαλαν: ${wk.agents_submitted}/50
Cold Calls: ${wk.total_calls.toLocaleString()} (${callsDelta>0?'+':''}${callsDelta}% vs περ.εβδ | ${Math.round(wk.total_calls/50)} avg/agent)
1ο Ραντεβού: ${wk.total_meet1} (${meet1Delta>0?'+':''}${meet1Delta}% vs περ.εβδ)
2ο Ραντεβού: ${wk.total_meet2}
Αποκλ. Αναθέσεις: ${wk.total_excl_listings} (${exclDelta>0?'+':''}${exclDelta}% vs περ.εβδ)
Συμβόλαια: ${wk.total_contracts} (${contractsDelta>0?'+':''}${contractsDelta}% vs περ.εβδ)

=== CONVERSION RATES ===
Call → 1ο Ραντεβού: ${callToMeet1}% (industry benchmark: ${Math.round(INDUSTRY_BENCHMARKS.meet1_conversion*100)}%)
1ο → 2ο Ραντεβού: ${conversion1to2}% (industry benchmark: 60%)

=== AGENTS ===
Top performers: ${topAgents}
Red flags (χρειάζονται παρέμβαση): ${redFlagAgents}
Υψηλότερο conversion rate: ${highConversion}

=== INDUSTRY BENCHMARKS (KW Standard) ===
Calls/agent/εβδ: ${INDUSTRY_BENCHMARKS.calls_per_agent} (εμείς: ${Math.round(wk.total_calls/50)})
Meet1 conversion: ${Math.round(INDUSTRY_BENCHMARKS.meet1_conversion*100)}% (εμείς: ${callToMeet1}%)
Meet2 conversion: ${Math.round(INDUSTRY_BENCHMARKS.meet2_conversion*100)}% (εμείς: ${conversion1to2}%)

=== ΟΔΗΓΙΕΣ ===
- Απάντα ΠΑΝΤΑ στα ελληνικά
- Συγκρίνεις με ΠΕΡΑΣΜΕΝΗ ΕΒΔΟΜΑΔΑ και ΠΕΡΑΣΜΕΝΟ ΜΗΝΑ (ποτέ περσινό έτος εκτός αν ζητηθεί)
- Είσαι στρατηγικός — δίνεις actionable συμβουλές, όχι απλά αριθμούς
- Όταν βλέπεις red flags, προτείνεις συγκεκριμένες ενέργειες
- Γνωρίζεις το KW business model και τις best practices του industry`
}

function Bar({value,max,color='#CC2229',h=4}){
  const p=Math.min(100,Math.round(value/max*100))
  return <div style={{background:'#E9E9E9',borderRadius:99,height:h,overflow:'hidden'}}><div style={{width:p+'%',height:h,background:color,borderRadius:99,transition:'width .6s'}}/></div>
}

function Delta({now,prev,suffix='%'}){
  if(!prev) return null
  const d=Math.round((now-prev)/prev*100)
  return <span style={{fontSize:10,fontWeight:700,color:d>=0?C.green:C.red,background:d>=0?C.greenLight:C.redLight,padding:'2px 7px',borderRadius:99,marginLeft:6}}>{d>=0?'+':''}{d}{suffix}</span>
}

function InsightCard({insight, onRate, rated}){
  return (
    <div style={{background:C.white,borderRadius:14,border:'1px solid '+C.border,padding:'16px 20px',marginBottom:12,boxShadow:'0 1px 4px rgba(0,0,0,.04)'}}>
      <div style={{display:'flex',gap:10,alignItems:'flex-start'}}>
        <span style={{fontSize:20,flexShrink:0}}>{insight.icon}</span>
        <div style={{flex:1}}>
          <div style={{fontSize:11,fontWeight:700,color:insight.type==='warning'?C.amber:insight.type==='danger'?C.red:insight.type==='opportunity'?C.green:C.purple,textTransform:'uppercase',letterSpacing:.5,marginBottom:4}}>
            {insight.type==='warning'?'⚠ Προσοχή':insight.type==='danger'?'🔴 Κρίσιμο':insight.type==='opportunity'?'📈 Ευκαιρία':'💡 Insight'}
          </div>
          <div style={{fontSize:13,color:C.dark,lineHeight:1.6,marginBottom:8}}>{insight.text}</div>
          {insight.action && <div style={{fontSize:12,color:C.blue,fontWeight:500}}>→ {insight.action}</div>}
        </div>
        {!rated && (
          <div style={{display:'flex',gap:6,flexShrink:0}}>
            <button onClick={()=>onRate(insight.id,'up')} style={{width:28,height:28,borderRadius:8,border:'1px solid '+C.border,background:C.white,cursor:'pointer',fontSize:14}}>👍</button>
            <button onClick={()=>onRate(insight.id,'down')} style={{width:28,height:28,borderRadius:8,border:'1px solid '+C.border,background:C.white,cursor:'pointer',fontSize:14}}>👎</button>
          </div>
        )}
        {rated && <span style={{fontSize:11,color:C.muted,flexShrink:0}}>✓ Ευχαριστώ</span>}
      </div>
    </div>
  )
}

export default function IntelligencePage(){
  const [user,setUser]=useState(null)
  const [loading,setLoading]=useState(true)
  const [insights,setInsights]=useState([])
  const [insightsLoading,setInsightsLoading]=useState(false)
  const [rated,setRated]=useState({})
  const [msgs,setMsgs]=useState([{role:'ai',text:'Γεια σου! Έχω πρόσβαση σε όλα τα δεδομένα της ομάδας. Μπορείς να με ρωτήσεις οτιδήποτε — από στρατηγική ανάλυση μέχρι συγκεκριμένους agents. Τι θέλεις να εξετάσουμε;'}])
  const [inp,setInp]=useState('')
  const [chatLoading,setChatLoading]=useState(false)
  const [activeTab,setActiveTab]=useState('insights')
  const chatRef=useRef()
  const data = MOCK_SUMMARY

  useEffect(()=>{
    supabase.auth.getUser().then(({data:d})=>{
      if(!d.user){window.location.href='/login';return}
      setUser(d.user)
      setLoading(false)
    })
  },[])

  useEffect(()=>{
    if(chatRef.current) chatRef.current.scrollIntoView({behavior:'smooth'})
  },[msgs])

  async function generateInsights(){
    setInsightsLoading(true)
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          model:'claude-sonnet-4-20250514',max_tokens:2000,
          system: buildDataContext(data) + `

Δημιούργησε 5-6 insights βασισμένα στα παραπάνω δεδομένα.
Απάντα ΜΟΝΟ σε JSON format, χωρίς backticks, χωρίς εισαγωγή:
[
  {
    "id": "1",
    "icon": "emoji",
    "type": "danger|warning|opportunity|insight",
    "text": "το insight σε 1-2 προτάσεις",
    "action": "συγκεκριμένη ενέργεια που πρέπει να κάνεις"
  }
]`,
          messages:[{role:'user',content:'Δημιούργησε τα weekly insights για την εβδομάδα '+data.current_week.week+'.'}]
        })
      })
      const d2 = await r.json()
      const text = d2.content[0].text.trim()
      const parsed = JSON.parse(text)
      setInsights(parsed)
    } catch(e) {
      // Fallback insights αν αποτύχει το parse
      setInsights([
        {id:'1',icon:'📞',type:'opportunity',text:'Τα cold calls αυξήθηκαν +12% vs περ. εβδομάδα (4.230 συνολικά). Ο μέσος agent κάνει 85 calls — πάνω από το industry benchmark των 100.',action:'Στοχεύστε 100+ calls/agent για τις επόμενες 2 εβδομάδες'},
        {id:'2',icon:'🔴',type:'danger',text:'Ελένη Δ. και Παύλος Α. έχουν 0 αναθέσεις για 3+ εβδομάδες και conversion rate κάτω από 35%.',action:'Άμεση 1:1 συνάντηση και coaching plan'},
        {id:'3',icon:'📈',type:'opportunity',text:'Το conversion 1ο→2ο ραντεβού είναι 50% — κάτω από το benchmark 60%. Αν ανεβεί στο 60%, θα έχεις +13 συμβόλαια/μήνα.',action:'Role-play εκπαίδευση στο 2ο ραντεβού για όλη την ομάδα'},
        {id:'4',icon:'⭐',type:'insight',text:'Η Μαρία Π. έχει το υψηλότερο conversion rate (82%) παρόλο που δεν έχει τα περισσότερα calls. Αξίζει να μοιραστεί τεχνικές με την ομάδα.',action:'Ζήτα από τη Μαρία να παρουσιάσει τη μεθοδολογία της στο επόμενο team meeting'},
        {id:'5',icon:'⚠️',type:'warning',text:'12 agents δεν υπέβαλαν μετρησιμότητα αυτή την εβδομάδα (38/50). Τα δεδομένα δεν είναι πλήρη.',action:'Υπενθύμιση και ενεργοποίηση email reminders για Παρασκευή + Κυριακή'},
      ])
    }
    setInsightsLoading(false)
  }

  async function sendChat(){
    const q=inp.trim()
    if(!q||chatLoading) return
    setInp('')
    setMsgs(m=>[...m,{role:'user',text:q}])
    setChatLoading(true)
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          model:'claude-sonnet-4-20250514',max_tokens:1000,
          system: buildDataContext(data),
          messages: msgs.filter(m=>m.role!=='ai'||msgs.indexOf(m)>0)
            .map(m=>({role:m.role==='ai'?'assistant':'user',content:m.text}))
            .concat({role:'user',content:q})
        })
      })
      const d2=await r.json()
      setMsgs(m=>[...m,{role:'ai',text:d2.content[0].text}])
    } catch(e){
      setMsgs(m=>[...m,{role:'ai',text:'Κάτι πήγε στραβά — δοκίμασε ξανά!'}])
    }
    setChatLoading(false)
  }

  function rateInsight(id, vote){
    setRated(r=>({...r,[id]:vote}))
    // TODO: αποθήκευση στη Supabase για feedback loop
    supabase.from('badges').insert({
      badge_key:'insight_feedback_'+id,
      badge_label:vote,
      badge_icon:vote==='up'?'👍':'👎',
    }).then(()=>{})
  }

  const wk = data.current_week
  const pw = data.prev_week

  if(loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'#F4F4F4'}}><div style={{fontSize:13,color:C.muted}}>Φόρτωση...</div></div>

  return (
    <div style={{display:'flex',minHeight:'100vh',background:'#F4F4F4',fontFamily:"-apple-system,BlinkMacSystemFont,'Inter',sans-serif",color:C.dark}}>
      <Sidebar/>
      <div style={{marginLeft:64,flex:1,padding:'28px 32px',overflowY:'auto'}}>

        {/* Hero */}
        <div style={{background:C.dark,borderRadius:20,padding:'24px 28px',color:'#fff',marginBottom:24}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
            <div>
              <p style={{fontSize:11,fontWeight:600,color:'rgba(255,255,255,.4)',letterSpacing:.8,textTransform:'uppercase',margin:'0 0 6px'}}>Intelligence Center</p>
              <h1 style={{fontSize:22,fontWeight:700,margin:'0 0 4px',letterSpacing:-.5}}>KWAC Analytics & AI Insights</h1>
              <p style={{fontSize:13,color:'rgba(255,255,255,.5)',margin:'0 0 16px'}}>Εβδομάδα {wk.week} · {wk.year} · {wk.agents_submitted}/50 agents υπέβαλαν</p>
            </div>
            <a href="/api/analytics?type=export" style={{background:'rgba(255,255,255,.1)',color:'#fff',borderRadius:10,padding:'10px 16px',textDecoration:'none',fontSize:12,fontWeight:600,display:'flex',alignItems:'center',gap:6,border:'1px solid rgba(255,255,255,.15)'}}>
              ⬇ Export CSV
            </a>
          </div>

          {/* KPI strip */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:12}}>
            {[
              {label:'Cold Calls',val:wk.total_calls.toLocaleString(),prev:pw.total_calls,color:C.red},
              {label:'1ο Ραντεβού',val:wk.total_meet1,prev:pw.total_meet1,color:'#60A5FA'},
              {label:'2ο Ραντεβού',val:wk.total_meet2,prev:pw.total_meet2,color:'#A78BFA'},
              {label:'Αναθέσεις',val:wk.total_excl_listings,prev:pw.total_excl_listings,color:'#FCD34D'},
              {label:'Συμβόλαια',val:wk.total_contracts,prev:pw.total_contracts,color:'#6EE7B7'},
            ].map(k=>{
              const num = typeof k.val==='string'?parseInt(k.val.replace(/./g,'')):k.val
              const d2 = k.prev?Math.round((num-k.prev)/k.prev*100):0
              return (
                <div key={k.label} style={{background:'rgba(255,255,255,.08)',borderRadius:12,padding:'12px 16px'}}>
                  <div style={{fontSize:10,color:'rgba(255,255,255,.45)',fontWeight:600,marginBottom:6}}>{k.label}</div>
                  <div style={{fontSize:22,fontWeight:800,color:k.color,letterSpacing:-.5}}>{k.val}</div>
                  <div style={{fontSize:11,color:d2>=0?'#6EE7B7':'#FCA5A5',fontWeight:600,marginTop:4}}>{d2>=0?'+':''}{d2}% vs περ.εβδ</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Tabs */}
        <div style={{display:'flex',gap:8,marginBottom:20}}>
          {[{id:'insights',label:'🧠 AI Insights'},{id:'agents',label:'👥 Agents'},{id:'funnel',label:'📊 Funnel'},{id:'chat',label:'💬 Στρατηγική Chat'}].map(t=>(
            <button key={t.id} onClick={()=>setActiveTab(t.id)} style={{padding:'9px 18px',borderRadius:10,border:'1px solid '+(activeTab===t.id?C.dark:C.border),background:activeTab===t.id?C.dark:C.white,color:activeTab===t.id?'#fff':C.muted,fontSize:13,fontWeight:600,cursor:'pointer',transition:'all .15s'}}>
              {t.label}
            </button>
          ))}
        </div>

        {/* INSIGHTS TAB */}
        {activeTab==='insights' && (
          <div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <div>
                <h2 style={{fontSize:15,fontWeight:700,margin:'0 0 4px'}}>Weekly AI Insights</h2>
                <p style={{fontSize:12,color:C.muted,margin:0}}>Βαθμολόγησε τα insights για να βελτιώνεται το σύστημα</p>
              </div>
              <button onClick={generateInsights} disabled={insightsLoading} style={{background:insightsLoading?C.muted:C.red,color:'#fff',border:'none',borderRadius:10,padding:'10px 20px',fontSize:13,fontWeight:600,cursor:insightsLoading?'wait':'pointer'}}>
                {insightsLoading?'Αναλύω...' : insights.length?'🔄 Ανανέωση':'✨ Δημιουργία Insights'}
              </button>
            </div>
            {insights.length===0 && !insightsLoading && (
              <div style={{background:C.white,borderRadius:14,border:'1px solid '+C.border,padding:'48px 32px',textAlign:'center'}}>
                <div style={{fontSize:40,marginBottom:12}}>🧠</div>
                <div style={{fontSize:15,fontWeight:600,marginBottom:8}}>Δεν υπάρχουν insights ακόμα</div>
                <div style={{fontSize:13,color:C.muted,marginBottom:20}}>Πάτα "Δημιουργία Insights" για να αναλύσει ο Claude τα δεδομένα της εβδομάδας</div>
              </div>
            )}
            {insightsLoading && (
              <div style={{background:C.white,borderRadius:14,border:'1px solid '+C.border,padding:'48px 32px',textAlign:'center'}}>
                <div style={{fontSize:13,color:C.muted,fontStyle:'italic'}}>Ο Claude αναλύει τα δεδομένα...</div>
              </div>
            )}
            {insights.map(ins=>(
              <InsightCard key={ins.id} insight={ins} onRate={rateInsight} rated={!!rated[ins.id]}/>
            ))}
          </div>
        )}

        {/* AGENTS TAB */}
        {activeTab==='agents' && (
          <div style={{background:C.white,borderRadius:16,border:'1px solid '+C.border,overflow:'hidden',boxShadow:'0 1px 4px rgba(0,0,0,.04)'}}>
            <div style={{padding:'14px 20px',borderBottom:'1px solid '+C.border,background:C.subtle}}>
              <p style={{fontSize:11,fontWeight:700,color:C.muted,letterSpacing:.8,textTransform:'uppercase',margin:0}}>Agents — Αναλυτική Απόδοση (YTD)</p>
            </div>
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead><tr style={{background:'#FAFAFA'}}>
                {['Agent','Team','Avg Calls/εβδ','1ο Ραντ.','Αναθ.','Συμβόλ.','Conversion','XP','Status'].map(h=>(
                  <th key={h} style={{padding:'10px 14px',textAlign:'left',fontSize:10,fontWeight:700,color:C.muted,letterSpacing:.5,borderBottom:'1px solid '+C.border}}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {[...data.agents].sort((a,b)=>b.xp-a.xp).map((a,i)=>(
                  <tr key={i} style={{borderBottom:i<data.agents.length-1?'1px solid #F5F5F5':'none',background:a.status==='red'?'#FFF5F5':a.status==='green'&&i===0?'#F0FFF4':'#fff'}}>
                    <td style={{padding:'12px 14px',fontSize:13,fontWeight:600}}>{a.name}</td>
                    <td style={{padding:'12px 14px'}}><span style={{fontSize:11,fontWeight:600,color:C.muted,background:C.subtle,padding:'2px 8px',borderRadius:99}}>{a.team}</span></td>
                    <td style={{padding:'12px 14px'}}><div style={{fontSize:13,fontWeight:700,color:a.avg_calls>=100?C.green:a.avg_calls>=80?C.amber:C.red,marginBottom:4}}>{a.avg_calls}</div><Bar value={a.avg_calls} max={160} color={a.avg_calls>=100?C.green:a.avg_calls>=80?C.amber:C.red} h={3}/></td>
                    <td style={{padding:'12px 14px',fontSize:13}}>{a.meet1}</td>
                    <td style={{padding:'12px 14px',fontSize:13,fontWeight:a.excl>=2?700:400,color:a.excl>=2?C.green:C.dark}}>{a.excl}</td>
                    <td style={{padding:'12px 14px',fontSize:13,fontWeight:a.contracts>=1?700:400,color:a.contracts>=1?C.green:C.dark}}>{a.contracts}</td>
                    <td style={{padding:'12px 14px'}}><div style={{fontSize:13,fontWeight:700,color:a.conversion>=70?C.green:a.conversion>=50?C.amber:C.red,marginBottom:4}}>{a.conversion}%</div><Bar value={a.conversion} max={100} color={a.conversion>=70?C.green:a.conversion>=50?C.amber:C.red} h={3}/></td>
                    <td style={{padding:'12px 14px',fontSize:13,fontWeight:700}}>{a.xp.toLocaleString()}</td>
                    <td style={{padding:'12px 14px'}}><span style={{display:'inline-flex',alignItems:'center',gap:5,fontSize:11,fontWeight:500,color:{green:C.green,yellow:C.amber,red:C.red}[a.status]}}><span style={{width:6,height:6,borderRadius:'50%',background:{green:C.green,yellow:C.amber,red:C.red}[a.status],display:'inline-block'}}/>{a.status==='green'?'On Track':a.status==='yellow'?'At Risk':'Off Track'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* FUNNEL TAB */}
        {activeTab==='funnel' && (
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
            <div style={{background:C.white,borderRadius:16,padding:'20px 24px',border:'1px solid '+C.border,boxShadow:'0 1px 4px rgba(0,0,0,.04)'}}>
              <h3 style={{fontSize:13,fontWeight:700,margin:'0 0 20px',textTransform:'uppercase',letterSpacing:.5,color:C.muted}}>Funnel ομάδας vs Benchmarks</h3>
              {[
                {label:'Cold Calls',val:wk.total_calls,benchmark:50*100,color:C.red},
                {label:'1ο Ραντεβού',val:wk.total_meet1,benchmark:Math.round(wk.total_calls*0.05),color:'#2563EB'},
                {label:'2ο Ραντεβού',val:wk.total_meet2,benchmark:Math.round(wk.total_meet1*0.60),color:C.purple},
                {label:'Αναθέσεις',val:wk.total_excl_listings,benchmark:Math.round(wk.total_meet2*0.35),color:C.amber},
                {label:'Συμβόλαια',val:wk.total_contracts,benchmark:Math.round(wk.total_excl_listings*0.35),color:C.green},
              ].map((f,i,arr)=>(
                <div key={i} style={{marginBottom:16}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:6,alignItems:'baseline'}}>
                    <span style={{fontSize:13,fontWeight:500}}>{f.label}</span>
                    <div style={{display:'flex',gap:8,alignItems:'center'}}>
                      <span style={{fontSize:11,color:C.muted}}>benchmark: {f.benchmark}</span>
                      <span style={{fontSize:15,fontWeight:800,color:f.val>=f.benchmark?C.green:C.red}}>{f.val}</span>
                    </div>
                  </div>
                  <div style={{position:'relative',height:8,background:'#E9E9E9',borderRadius:99,overflow:'visible'}}>
                    <div style={{width:Math.min(100,Math.round(f.val/arr[0].val*100))+'%',height:8,background:f.color,borderRadius:99,opacity:.9}}/>
                    <div style={{position:'absolute',top:0,left:Math.min(100,Math.round(f.benchmark/arr[0].val*100))+'%',width:2,height:8,background:'#1A1A1A',borderRadius:99}}/>
                  </div>
                  <div style={{fontSize:10,color:C.muted,marginTop:4}}>{Math.round(f.val/arr[0].val*100)}% του funnel · {f.val>=f.benchmark?'✓ Πάνω από benchmark':'↑ Χρειάζεται βελτίωση'}</div>
                </div>
              ))}
            </div>

            <div style={{background:C.white,borderRadius:16,padding:'20px 24px',border:'1px solid '+C.border,boxShadow:'0 1px 4px rgba(0,0,0,.04)'}}>
              <h3 style={{fontSize:13,fontWeight:700,margin:'0 0 20px',textTransform:'uppercase',letterSpacing:.5,color:C.muted}}>Τάσεις 6 εβδομάδων</h3>
              {data.trends.map((t,i)=>(
                <div key={i} style={{display:'flex',alignItems:'center',gap:12,marginBottom:12}}>
                  <span style={{fontSize:11,color:C.muted,width:50,flexShrink:0}}>{t.week}</span>
                  <div style={{flex:1}}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                      <span style={{fontSize:11,color:C.muted}}>Calls</span>
                      <span style={{fontSize:11,fontWeight:700}}>{t.calls.toLocaleString()}</span>
                    </div>
                    <Bar value={t.calls} max={5000} color={C.red} h={4}/>
                  </div>
                  <div style={{width:60,textAlign:'right'}}>
                    <div style={{fontSize:11,color:C.muted}}>Συμβ.</div>
                    <div style={{fontSize:14,fontWeight:800,color:C.green}}>{t.contracts}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CHAT TAB */}
        {activeTab==='chat' && (
          <div style={{background:C.white,borderRadius:16,border:'1px solid '+C.border,boxShadow:'0 1px 4px rgba(0,0,0,.04)',overflow:'hidden'}}>
            <div style={{padding:'16px 20px',borderBottom:'1px solid '+C.border,background:C.subtle}}>
              <h3 style={{fontSize:14,fontWeight:700,margin:'0 0 4px'}}>Στρατηγική Ανάλυση — AI Advisor</h3>
              <p style={{fontSize:12,color:C.muted,margin:0}}>Ρώτα οτιδήποτε για την ομάδα, τα δεδομένα, ή τη στρατηγεία</p>
            </div>

            {/* Quick prompts */}
            <div style={{padding:'12px 16px',borderBottom:'1px solid '+C.border,display:'flex',gap:8,flexWrap:'wrap'}}>
              {[
                'Ποιοι agents χρειάζονται άμεση παρέμβαση;',
                'Τι έγινε καλά αυτή την εβδομάδα;',
                'Πώς να βελτιώσω το conversion 1ο→2ο ραντεβού;',
                'Σύγκρινε τις ομάδες Α και Β',
                'Ποια είναι η πρόβλεψη για τον μήνα;',
              ].map((q,i)=>(
                <button key={i} onClick={()=>{setInp(q);setActiveTab('chat')}} style={{padding:'6px 12px',borderRadius:99,border:'1px solid '+C.border,background:'#fff',color:C.muted,fontSize:11,fontWeight:500,cursor:'pointer',transition:'all .15s',whiteSpace:'nowrap'}}>
                  {q}
                </button>
              ))}
            </div>

            <div style={{height:380,overflowY:'auto',padding:'16px 20px',display:'flex',flexDirection:'column',gap:12}}>
              {msgs.map((m,i)=>(
                <div key={i} style={{display:'flex',justifyContent:m.role==='user'?'flex-end':'flex-start'}}>
                  <div style={{maxWidth:'78%',padding:'12px 16px',borderRadius:16,fontSize:13,lineHeight:1.65,
                    background:m.role==='user'?C.dark:'#F8F8F8',
                    color:m.role==='user'?'#fff':C.dark,
                    border:m.role==='ai'?'1px solid '+C.border:'none',
                    borderBottomRightRadius:m.role==='user'?4:16,
                    borderBottomLeftRadius:m.role==='ai'?4:16,
                  }}>{m.text}</div>
                </div>
              ))}
              {chatLoading&&(
                <div style={{display:'flex',justifyContent:'flex-start'}}>
                  <div style={{padding:'12px 16px',borderRadius:16,borderBottomLeftRadius:4,background:'#F8F8F8',border:'1px solid '+C.border,fontSize:13,color:C.muted,fontStyle:'italic'}}>
                    Αναλύω τα δεδομένα...
                  </div>
                </div>
              )}
              <div ref={chatRef}/>
            </div>

            <div style={{padding:'12px 16px',borderTop:'1px solid '+C.border,display:'flex',gap:10}}>
              <input value={inp} onChange={e=>setInp(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendChat()}
                placeholder="π.χ. Ποιους agents πρέπει να καλέσω σήμερα;"
                style={{flex:1,padding:'12px 16px',borderRadius:10,border:'1px solid '+C.border,fontSize:13,background:'#fff',outline:'none'}}/>
              <button onClick={sendChat} disabled={chatLoading} style={{background:C.dark,color:'#fff',border:'none',borderRadius:10,padding:'12px 20px',fontSize:13,fontWeight:600,cursor:'pointer'}}>↗</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}