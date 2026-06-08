'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'

const C = {red:'#CC2229',redLight:'#FDF2F2',dark:'#1A1A1A',muted:'#6B7280',border:'#EBEBEB',subtle:'#F7F7F7',white:'#FFFFFF',green:'#16A34A',greenLight:'#F0FDF4',amber:'#D97706',blue:'#2563EB'}

const MOCK_COMPARABLES = [
  {address:'Λεωφ. Βουλιαγμένης 142',area:'Γλυφάδα',sqm:95,floor:3,year_built:1998,condition:'good',price_final:270000,sold_at:'2024-11-15',price_sqm:2842},
  {address:'Φιλελλήνων 28',area:'Γλυφάδα',sqm:88,floor:2,year_built:2002,condition:'good',price_final:255000,sold_at:'2024-10-01',price_sqm:2898},
  {address:'Ποσειδώνος 15',area:'Γλυφάδα',sqm:102,floor:4,year_built:1995,condition:'fair',price_final:268000,sold_at:'2024-09-15',price_sqm:2627},
  {address:'Ερμού 33',area:'Κολωνάκι',sqm:110,floor:5,year_built:2001,condition:'excellent',price_final:430000,sold_at:'2024-10-20',price_sqm:3909},
  {address:'Κηφισίας 210',area:'Χαλάνδρι',sqm:78,floor:2,year_built:2005,condition:'excellent',price_final:225000,sold_at:'2025-01-20',price_sqm:2885},
]

const CONDITIONS = [
  {value:'excellent',label:'Άριστη'},
  {value:'good',label:'Καλή'},
  {value:'fair',label:'Μέτρια'},
  {value:'needs_renovation',label:'Χρειάζεται ανακαίνιση'},
]

const PROPERTY_TYPES = ['Διαμέρισμα','Μονοκατοικία','Μεζονέτα','Γραφείο','Κατάστημα','Αποθήκη']

function Bar({value,max,color=C.red,h=4}){
  const p=Math.min(100,Math.round(value/max*100))
  return <div style={{background:'#E9E9E9',borderRadius:99,height:h,overflow:'hidden'}}><div style={{width:p+'%',height:h,background:color,borderRadius:99,transition:'width .6s'}}/></div>
}

export default function ValuationPage(){
  const [user,setUser]=useState(null)
  const [loading,setLoading]=useState(true)
  const [form,setForm]=useState({
    address:'', area:'', deal_type:'sale', property_type:'Διαμέρισμα',
    sqm:'', floor:'', year_built:'', year_renovated:'', condition:'good', notes:''
  })
  const [msgs,setMsgs]=useState([{role:'ai',text:'Γεια! Είμαι ο AI εκτιμητής ακινήτων της KWAC. Συγκρίνω με πραγματικές πωλήσεις του γραφείου για να δώσω ακριβή εκτίμηση. Συμπλήρωσε τα στοιχεία αριστερά και θα αναλύσω το ακίνητό σου.'}])
  const [chatInp,setChatInp]=useState('')
  const [estimating,setEstimating]=useState(false)
  const [estimation,setEstimation]=useState(null)
  const [chatLoading,setChatLoading]=useState(false)
  const [feedback,setFeedback]=useState({show:false,actualPrice:'',notes:''})
  const chatRef=useRef()

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

  function setF(k,v){setForm(p=>({...p,[k]:v}))}

  function buildValuationContext(){
    const comps = MOCK_COMPARABLES
      .filter(c => form.area ? c.area===form.area : true)
      .slice(0,5)
    const avgPsm = comps.length ? Math.round(comps.reduce((s,c)=>s+c.price_sqm,0)/comps.length) : 2800

    return `Είσαι AI εκτιμητής ακινήτων για τη μεσιτική KWAC. Χρησιμοποιείς ΜΟΝΟ πραγματικά δεδομένα πωλήσεων του γραφείου.

=== ΑΚΙΝΗΤΟ ΠΡΟΣ ΕΚΤΙΜΗΣΗ ===
Διεύθυνση: ${form.address||'Δεν δόθηκε'}
Περιοχή: ${form.area||'Δεν δόθηκε'}
Τύπος: ${form.property_type} · ${form.deal_type==='sale'?'Πώληση':'Μίσθωση'}
Εμβαδόν: ${form.sqm} τ.μ.
Όροφος: ${form.floor}ος
Έτος κατασκευής: ${form.year_built}
Έτος ανακαίνισης: ${form.year_renovated||'Καμία'}
Κατάσταση: ${CONDITIONS.find(c=>c.value===form.condition)?.label}
Σημειώσεις: ${form.notes||'Καμία'}

=== ΣΥΓΚΡΙΣΙΜΑ ΑΚΙΝΗΤΑ (από βάση KWAC) ===
${comps.map((c,i)=>`${i+1}. ${c.address}, ${c.area} | ${c.sqm}τ.μ. | ${c.floor}ος | ${c.year_built} | ${CONDITIONS.find(x=>x.value===c.condition)?.label||c.condition} | €${c.price_final.toLocaleString()} (€${c.price_sqm}/τ.μ.) | Πωλήθηκε ${c.sold_at}`).join('\n')}

Μέση τιμή/τ.μ. περιοχής: €${avgPsm}

=== ΟΔΗΓΙΕΣ ===
- Βγάλε εκτίμηση ΜΟΝΟ βάσει των παραπάνω συγκρίσιμων
- Δώσε εύρος τιμής (min-max) και πιθανότερη τιμή
- Εξήγησε τους παράγοντες που επηρεάζουν την τιμή (θετικοί/αρνητικοί)
- Δώσε confidence level (Υψηλό/Μέτριο/Χαμηλό) με αιτιολόγηση
- Αν η περιοχή δεν έχει αρκετά comparables, πες το ξεκάθαρα
- Απάντα στα ελληνικά, επαγγελματικά`
  }

  async function runEstimation(){
    if(!form.sqm || !form.area) {
      setMsgs(m=>[...m,{role:'ai',text:'Παρακαλώ συμπλήρωσε τουλάχιστον την περιοχή και το εμβαδόν για να κάνω εκτίμηση.'}])
      return
    }
    setEstimating(true)
    setMsgs(m=>[...m,{role:'user',text:`Εκτίμηση για ${form.property_type.toLowerCase()} ${form.sqm}τ.μ. στη ${form.area}, ${form.floor}ος όροφος, ${form.year_built}, κατάσταση: ${CONDITIONS.find(c=>c.value===form.condition)?.label}`}])

    try {
      const r = await fetch('https://api.anthropic.com/v1/messages',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          model:'claude-sonnet-4-20250514',max_tokens:1200,
          system: buildValuationContext(),
          messages:[{role:'user',content:'Κάνε εκτίμηση αυτού του ακινήτου βάσει των συγκρίσιμων που έχεις.'}]
        })
      })
      const d=await r.json()
      const text=d.content[0].text
      setMsgs(m=>[...m,{role:'ai',text}])
      setEstimation({text, timestamp:new Date().toISOString()})
      setFeedback(f=>({...f,show:true}))
    } catch(e){
      setMsgs(m=>[...m,{role:'ai',text:'Κάτι πήγε στραβά — δοκίμασε ξανά.'}])
    }
    setEstimating(false)
  }

  async function sendChat(){
    const q=chatInp.trim()
    if(!q||chatLoading) return
    setChatInp('')
    setMsgs(m=>[...m,{role:'user',text:q}])
    setChatLoading(true)
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          model:'claude-sonnet-4-20250514',max_tokens:800,
          system: buildValuationContext(),
          messages: msgs.map(m=>({role:m.role==='ai'?'assistant':'user',content:m.text})).concat({role:'user',content:q})
        })
      })
      const d=await r.json()
      setMsgs(m=>[...m,{role:'ai',text:d.content[0].text}])
    } catch(e){
      setMsgs(m=>[...m,{role:'ai',text:'Κάτι πήγε στραβά!'}])
    }
    setChatLoading(false)
  }

  async function saveFeedback(){
    if(!feedback.actualPrice) return
    await supabase.from('valuations').insert({
      address: form.address,
      area: form.area,
      sqm: parseFloat(form.sqm)||null,
      floor: parseInt(form.floor)||null,
      year_built: parseInt(form.year_built)||null,
      year_renovated: parseInt(form.year_renovated)||null,
      condition: form.condition,
      deal_type: form.deal_type,
      reasoning: estimation?.text,
      actual_price: parseFloat(feedback.actualPrice.replace(/[^0-9.]/g,'')),
      feedback_notes: feedback.notes,
      feedback_at: new Date().toISOString(),
    })
    setMsgs(m=>[...m,{role:'ai',text:`✅ Ευχαριστώ! Η τελική τιμή €${parseInt(feedback.actualPrice).toLocaleString()} καταχωρήθηκε. Αυτό βοηθάει το σύστημα να βελτιώνει τις επόμενες εκτιμήσεις.`}])
    setFeedback({show:false,actualPrice:'',notes:''})
  }

  if(loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'#F4F4F4'}}><div style={{fontSize:13,color:C.muted}}>Φόρτωση...</div></div>

  return (
    <div style={{display:'flex',minHeight:'100vh',background:'#F4F4F4',fontFamily:"-apple-system,BlinkMacSystemFont,'Inter',sans-serif",color:C.dark}}>
      <Sidebar/>
      <div style={{marginLeft:64,flex:1,display:'grid',gridTemplateColumns:'380px 1fr',height:'100vh',overflow:'hidden'}}>

        {/* LEFT — Form */}
        <div style={{background:C.white,borderRight:'1px solid '+C.border,overflowY:'auto',padding:'24px 20px'}}>
          <div style={{marginBottom:20}}>
            <h1 style={{fontSize:18,fontWeight:700,letterSpacing:-.5,margin:'0 0 4px'}}>Εκτίμηση Ακινήτου</h1>
            <p style={{fontSize:12,color:C.muted,margin:0}}>AI εκτίμηση βάσει πραγματικών πωλήσεων KWAC</p>
          </div>

          {/* Deal type */}
          <div style={{display:'flex',gap:6,marginBottom:16}}>
            {[{v:'sale',l:'Πώληση'},{v:'rental',l:'Μίσθωση'}].map(t=>(
              <button key={t.v} onClick={()=>setF('deal_type',t.v)} style={{flex:1,padding:'8px 0',borderRadius:8,border:'1px solid '+(form.deal_type===t.v?C.red:C.border),background:form.deal_type===t.v?C.red:C.white,color:form.deal_type===t.v?'#fff':C.muted,fontSize:13,fontWeight:600,cursor:'pointer'}}>
                {t.l}
              </button>
            ))}
          </div>

          {/* Fields */}
          {[
            {key:'address',label:'Διεύθυνση',placeholder:'π.χ. Βουλιαγμένης 142',type:'text'},
            {key:'area',label:'Περιοχή *',placeholder:'π.χ. Γλυφάδα',type:'text'},
            {key:'sqm',label:'Εμβαδόν (τ.μ.) *',placeholder:'π.χ. 95',type:'number'},
            {key:'floor',label:'Όροφος',placeholder:'π.χ. 3',type:'number'},
            {key:'year_built',label:'Έτος κατασκευής',placeholder:'π.χ. 1998',type:'number'},
            {key:'year_renovated',label:'Έτος ανακαίνισης',placeholder:'αν υπάρχει',type:'number'},
          ].map(f=>(
            <div key={f.key} style={{marginBottom:12}}>
              <label style={{fontSize:11,fontWeight:600,color:C.muted,display:'block',marginBottom:5,textTransform:'uppercase',letterSpacing:.4}}>{f.label}</label>
              <input type={f.type} value={form[f.key]} onChange={e=>setF(f.key,e.target.value)} placeholder={f.placeholder}
                style={{width:'100%',padding:'9px 12px',borderRadius:8,border:'1px solid '+C.border,fontSize:13,background:'#FAFAFA',color:C.dark,boxSizing:'border-box'}}/>
            </div>
          ))}

          {/* Property type */}
          <div style={{marginBottom:12}}>
            <label style={{fontSize:11,fontWeight:600,color:C.muted,display:'block',marginBottom:5,textTransform:'uppercase',letterSpacing:.4}}>Τύπος ακινήτου</label>
            <select value={form.property_type} onChange={e=>setF('property_type',e.target.value)}
              style={{width:'100%',padding:'9px 12px',borderRadius:8,border:'1px solid '+C.border,fontSize:13,background:'#FAFAFA',color:C.dark}}>
              {PROPERTY_TYPES.map(t=><option key={t}>{t}</option>)}
            </select>
          </div>

          {/* Condition */}
          <div style={{marginBottom:12}}>
            <label style={{fontSize:11,fontWeight:600,color:C.muted,display:'block',marginBottom:5,textTransform:'uppercase',letterSpacing:.4}}>Κατάσταση</label>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
              {CONDITIONS.map(c=>(
                <button key={c.value} onClick={()=>setF('condition',c.value)} style={{padding:'7px 8px',borderRadius:8,border:'1px solid '+(form.condition===c.value?C.dark:C.border),background:form.condition===c.value?C.dark:'#fff',color:form.condition===c.value?'#fff':C.muted,fontSize:11,fontWeight:500,cursor:'pointer',transition:'all .15s'}}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div style={{marginBottom:20}}>
            <label style={{fontSize:11,fontWeight:600,color:C.muted,display:'block',marginBottom:5,textTransform:'uppercase',letterSpacing:.4}}>Σημειώσεις</label>
            <textarea value={form.notes} onChange={e=>setF('notes',e.target.value)} placeholder="π.χ. Βλέπει θάλασσα, parking, αποθήκη..."
              style={{width:'100%',padding:'9px 12px',borderRadius:8,border:'1px solid '+C.border,fontSize:13,background:'#FAFAFA',color:C.dark,height:72,resize:'none',boxSizing:'border-box'}}/>
          </div>

          <button onClick={runEstimation} disabled={estimating||!form.sqm||!form.area}
            style={{width:'100%',background:estimating||!form.sqm||!form.area?C.muted:C.red,color:'#fff',border:'none',borderRadius:10,padding:'13px 0',fontSize:14,fontWeight:700,cursor:estimating||!form.sqm||!form.area?'not-allowed':'pointer',transition:'background .2s'}}>
            {estimating?'Αναλύω...' : '✦ Εκτίμηση AI'}
          </button>

          {/* Feedback */}
          {feedback.show && (
            <div style={{marginTop:16,background:C.greenLight,borderRadius:12,padding:'14px 16px',border:'1px solid #BBF7D0'}}>
              <div style={{fontSize:12,fontWeight:700,color:C.green,marginBottom:10}}>📊 Feedback loop — βοήθησε το σύστημα</div>
              <label style={{fontSize:11,fontWeight:600,color:C.muted,display:'block',marginBottom:5}}>Τελική τιμή συμφωνίας (€)</label>
              <input type="number" value={feedback.actualPrice} onChange={e=>setFeedback(f=>({...f,actualPrice:e.target.value}))} placeholder="π.χ. 265000"
                style={{width:'100%',padding:'8px 12px',borderRadius:8,border:'1px solid '+C.border,fontSize:13,marginBottom:8,boxSizing:'border-box'}}/>
              <input type="text" value={feedback.notes} onChange={e=>setFeedback(f=>({...f,notes:e.target.value}))} placeholder="Τυχόν παρατηρήσεις (προαιρετικό)"
                style={{width:'100%',padding:'8px 12px',borderRadius:8,border:'1px solid '+C.border,fontSize:13,marginBottom:10,boxSizing:'border-box'}}/>
              <button onClick={saveFeedback} style={{width:'100%',background:C.green,color:'#fff',border:'none',borderRadius:8,padding:'9px 0',fontSize:13,fontWeight:600,cursor:'pointer'}}>
                ✓ Αποθήκευση feedback
              </button>
            </div>
          )}

          {/* Comparables */}
          <div style={{marginTop:20}}>
            <p style={{fontSize:11,fontWeight:700,color:C.muted,letterSpacing:.8,textTransform:'uppercase',margin:'0 0 10px'}}>Πρόσφατες πωλήσεις KWAC</p>
            {MOCK_COMPARABLES.filter(c=>form.area?c.area===form.area:true).slice(0,4).map((c,i)=>(
              <div key={i} style={{padding:'10px 12px',borderRadius:10,background:C.subtle,marginBottom:6}}>
                <div style={{fontSize:12,fontWeight:600,marginBottom:3}}>{c.address}, {c.area}</div>
                <div style={{display:'flex',gap:10,fontSize:11,color:C.muted}}>
                  <span>{c.sqm}τ.μ.</span><span>·</span>
                  <span style={{fontWeight:700,color:C.dark}}>€{c.price_final.toLocaleString()}</span>
                  <span>·</span>
                  <span style={{fontWeight:600,color:C.blue}}>€{c.price_sqm}/τ.μ.</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT — Chat */}
        <div style={{display:'flex',flexDirection:'column',height:'100vh',overflow:'hidden'}}>
          <div style={{padding:'16px 20px',borderBottom:'1px solid '+C.border,background:C.white,flexShrink:0}}>
            <h2 style={{fontSize:14,fontWeight:700,margin:'0 0 2px'}}>AI Εκτιμητής</h2>
            <p style={{fontSize:11,color:C.muted,margin:0}}>Βάσει {MOCK_COMPARABLES.length} πραγματικών πωλήσεων KWAC · Feedback loop ενεργό</p>
          </div>

          <div style={{flex:1,overflowY:'auto',padding:'20px',display:'flex',flexDirection:'column',gap:12,background:'#F9F9F9'}}>
            {msgs.map((m,i)=>(
              <div key={i} style={{display:'flex',justifyContent:m.role==='user'?'flex-end':'flex-start'}}>
                <div style={{maxWidth:'82%',padding:'12px 16px',borderRadius:16,fontSize:13,lineHeight:1.7,
                  background:m.role==='user'?C.dark:'#fff',
                  color:m.role==='user'?'#fff':C.dark,
                  border:m.role==='ai'?'1px solid '+C.border:'none',
                  borderBottomRightRadius:m.role==='user'?4:16,
                  borderBottomLeftRadius:m.role==='ai'?4:16,
                  boxShadow:m.role==='ai'?'0 1px 4px rgba(0,0,0,.04)':'none',
                  whiteSpace:'pre-wrap',
                }}>{m.text}</div>
              </div>
            ))}
            {(estimating||chatLoading)&&(
              <div style={{display:'flex',justifyContent:'flex-start'}}>
                <div style={{padding:'12px 16px',borderRadius:16,borderBottomLeftRadius:4,background:'#fff',border:'1px solid '+C.border,fontSize:13,color:C.muted,fontStyle:'italic'}}>
                  Αναλύω συγκρίσιμα ακίνητα...
                </div>
              </div>
            )}
            <div ref={chatRef}/>
          </div>

          <div style={{padding:'14px 20px',borderTop:'1px solid '+C.border,background:C.white,flexShrink:0,display:'flex',gap:10}}>
            <input value={chatInp} onChange={e=>setChatInp(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendChat()}
              placeholder="π.χ. Πώς επηρεάζει ο όροφος την τιμή σε αυτή την περιοχή;"
              style={{flex:1,padding:'12px 16px',borderRadius:10,border:'1px solid '+C.border,fontSize:13,outline:'none',background:'#FAFAFA'}}/>
            <button onClick={sendChat} style={{background:C.dark,color:'#fff',border:'none',borderRadius:10,padding:'12px 20px',fontSize:13,fontWeight:600,cursor:'pointer'}}>↗</button>
          </div>
        </div>
      </div>
    </div>
  )
}