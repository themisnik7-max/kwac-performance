'use client'
import { useState, useEffect, useRef } from 'react'
import Shell from '@/components/Shell'
import { supabase } from '@/lib/supabase'

const C = {red:'#CC2229',redLight:'#FDF2F2',dark:'#1A1A1A',muted:'#6B7280',border:'#EBEBEB',subtle:'#F7F7F7',white:'#FFFFFF',green:'#16A34A',greenLight:'#F0FDF4',amber:'#D97706',blue:'#2563EB'}

const MOCK_COMPARABLES = [
  {address:'ÎÎµÏÏ. ÎÎ¿ÏÎ»Î¹Î±Î³Î¼Î­Î½Î·Ï 142',area:'ÎÎ»ÏÏÎ¬Î´Î±',sqm:95,floor:3,year_built:1998,condition:'good',price_final:270000,sold_at:'2024-11-15',price_sqm:2842},
  {address:'Î¦Î¹Î»ÎµÎ»Î»Î®Î½ÏÎ½ 28',area:'ÎÎ»ÏÏÎ¬Î´Î±',sqm:88,floor:2,year_built:2002,condition:'good',price_final:255000,sold_at:'2024-10-01',price_sqm:2898},
  {address:'Î Î¿ÏÎµÎ¹Î´ÏÎ½Î¿Ï 15',area:'ÎÎ»ÏÏÎ¬Î´Î±',sqm:102,floor:4,year_built:1995,condition:'fair',price_final:268000,sold_at:'2024-09-15',price_sqm:2627},
  {address:'ÎÏÎ¼Î¿Ï 33',area:'ÎÎ¿Î»ÏÎ½Î¬ÎºÎ¹',sqm:110,floor:5,year_built:2001,condition:'excellent',price_final:430000,sold_at:'2024-10-20',price_sqm:3909},
  {address:'ÎÎ·ÏÎ¹ÏÎ¯Î±Ï 210',area:'Î§Î±Î»Î¬Î½Î´ÏÎ¹',sqm:78,floor:2,year_built:2005,condition:'excellent',price_final:225000,sold_at:'2025-01-20',price_sqm:2885},
]

const CONDITIONS = [
  {value:'excellent',label:'ÎÏÎ¹ÏÏÎ·'},
  {value:'good',label:'ÎÎ±Î»Î®'},
  {value:'fair',label:'ÎÎ­ÏÏÎ¹Î±'},
  {value:'needs_renovation',label:'Î§ÏÎµÎ¹Î¬Î¶ÎµÏÎ±Î¹ Î±Î½Î±ÎºÎ±Î¯Î½Î¹ÏÎ·'},
]

const PROPERTY_TYPES = ['ÎÎ¹Î±Î¼Î­ÏÎ¹ÏÎ¼Î±','ÎÎ¿Î½Î¿ÎºÎ±ÏÎ¿Î¹ÎºÎ¯Î±','ÎÎµÎ¶Î¿Î½Î­ÏÎ±','ÎÏÎ±ÏÎµÎ¯Î¿','ÎÎ±ÏÎ¬ÏÏÎ·Î¼Î±','ÎÏÎ¿Î¸Î®ÎºÎ·']

function Bar({value,max,color=C.red,h=4}){
  const p=Math.min(100,Math.round(value/max*100))
  return <div style={{background:'#E9E9E9',borderRadius:99,height:h,overflow:'hidden'}}><div style={{width:p+'%',height:h,background:color,borderRadius:99,transition:'width .6s'}}/></div>
}

export default function ValuationPage(){
  const [user,setUser]=useState(null)
  const [loading,setLoading]=useState(true)
  const [form,setForm]=useState({
    address:'', area:'', deal_type:'sale', property_type:'ÎÎ¹Î±Î¼Î­ÏÎ¹ÏÎ¼Î±',
    sqm:'', floor:'', year_built:'', year_renovated:'', condition:'good', notes:''
  })
  const [msgs,setMsgs]=useState([{role:'ai',text:'ÎÎµÎ¹Î±! ÎÎ¯Î¼Î±Î¹ Î¿ AI ÎµÎºÏÎ¹Î¼Î·ÏÎ®Ï Î±ÎºÎ¹Î½Î®ÏÏÎ½ ÏÎ·Ï KWAC. Î£ÏÎ³ÎºÏÎ¯Î½Ï Î¼Îµ ÏÏÎ±Î³Î¼Î±ÏÎ¹ÎºÎ­Ï ÏÏÎ»Î®ÏÎµÎ¹Ï ÏÎ¿Ï Î³ÏÎ±ÏÎµÎ¯Î¿Ï Î³Î¹Î± Î½Î± Î´ÏÏÏ Î±ÎºÏÎ¹Î²Î® ÎµÎºÏÎ¯Î¼Î·ÏÎ·. Î£ÏÎ¼ÏÎ»Î®ÏÏÏÎµ ÏÎ± ÏÏÎ¿Î¹ÏÎµÎ¯Î± Î±ÏÎ¹ÏÏÎµÏÎ¬ ÎºÎ±Î¹ Î¸Î± Î±Î½Î±Î»ÏÏÏ ÏÎ¿ Î±ÎºÎ¯Î½Î·ÏÏ ÏÎ¿Ï.'}])
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

    return `ÎÎ¯ÏÎ±Î¹ AI ÎµÎºÏÎ¹Î¼Î·ÏÎ®Ï Î±ÎºÎ¹Î½Î®ÏÏÎ½ Î³Î¹Î± ÏÎ· Î¼ÎµÏÎ¹ÏÎ¹ÎºÎ® KWAC. Î§ÏÎ·ÏÎ¹Î¼Î¿ÏÎ¿Î¹ÎµÎ¯Ï ÎÎÎÎ ÏÏÎ±Î³Î¼Î±ÏÎ¹ÎºÎ¬ Î´ÎµÎ´Î¿Î¼Î­Î½Î± ÏÏÎ»Î®ÏÎµÏÎ½ ÏÎ¿Ï Î³ÏÎ±ÏÎµÎ¯Î¿Ï.

=== ÎÎÎÎÎÎ¤Î Î Î¡ÎÎ£ ÎÎÎ¤ÎÎÎÎ£Î ===
ÎÎ¹ÎµÏÎ¸ÏÎ½ÏÎ·: ${form.address||'ÎÎµÎ½ Î´ÏÎ¸Î·ÎºÎµ'}
Î ÎµÏÎ¹Î¿ÏÎ®: ${form.area||'ÎÎµÎ½ Î´ÏÎ¸Î·ÎºÎµ'}
Î¤ÏÏÎ¿Ï: ${form.property_type} Â· ${form.deal_type==='sale'?'Î ÏÎ»Î·ÏÎ·':'ÎÎ¯ÏÎ¸ÏÏÎ·'}
ÎÎ¼Î²Î±Î´ÏÎ½: ${form.sqm} Ï.Î¼.
ÎÏÎ¿ÏÎ¿Ï: ${form.floor}Î¿Ï
ÎÏÎ¿Ï ÎºÎ±ÏÎ±ÏÎºÎµÏÎ®Ï: ${form.year_built}
ÎÏÎ¿Ï Î±Î½Î±ÎºÎ±Î¯Î½Î¹ÏÎ·Ï: ${form.year_renovated||'ÎÎ±Î¼Î¯Î±'}
ÎÎ±ÏÎ¬ÏÏÎ±ÏÎ·: ${CONDITIONS.find(c=>c.value===form.condition)?.label}
Î£Î·Î¼ÎµÎ¹ÏÏÎµÎ¹Ï: ${form.notes||'ÎÎ±Î¼Î¯Î±'}

=== Î£Î¥ÎÎÎ¡ÎÎ£ÎÎÎ ÎÎÎÎÎÎ¤Î (Î±ÏÏ Î²Î¬ÏÎ· KWAC) ===
${comps.map((c,i)=>`${i+1}. ${c.address}, ${c.area} | ${c.sqm}Ï.Î¼. | ${c.floor}Î¿Ï | ${c.year_built} | ${CONDITIONS.find(x=>x.value===c.condition)?.label||c.condition} | â¬${c.price_final.toLocaleString()} (â¬${c.price_sqm}/Ï.Î¼.) | Î ÏÎ»Î®Î¸Î·ÎºÎµ ${c.sold_at}`).join('\n')}

ÎÎ­ÏÎ· ÏÎ¹Î¼Î®/Ï.Î¼. ÏÎµÏÎ¹Î¿ÏÎ®Ï: â¬${avgPsm}

=== ÎÎÎÎÎÎÎ£ ===
- ÎÎ³Î¬Î»Îµ ÎµÎºÏÎ¯Î¼Î·ÏÎ· ÎÎÎÎ Î²Î¬ÏÎµÎ¹ ÏÏÎ½ ÏÎ±ÏÎ±ÏÎ¬Î½Ï ÏÏÎ³ÎºÏÎ¯ÏÎ¹Î¼ÏÎ½
- ÎÏÏÎµ ÎµÏÏÎ¿Ï ÏÎ¹Î¼Î®Ï (min-max) ÎºÎ±Î¹ ÏÎ¹Î¸Î±Î½ÏÏÎµÏÎ· ÏÎ¹Î¼Î®
- ÎÎ¾Î®Î³Î·ÏÎµ ÏÎ¿ÏÏ ÏÎ±ÏÎ¬Î³Î¿Î½ÏÎµÏ ÏÎ¿Ï ÎµÏÎ·ÏÎµÎ¬Î¶Î¿ÏÎ½ ÏÎ·Î½ ÏÎ¹Î¼Î® (Î¸ÎµÏÎ¹ÎºÎ¿Î¯/Î±ÏÎ½Î·ÏÎ¹ÎºÎ¿Î¯)
- ÎÏÏÎµ confidence level (Î¥ÏÎ·Î»Ï/ÎÎ­ÏÏÎ¹Î¿/Î§Î±Î¼Î·Î»Ï) Î¼Îµ Î±Î¹ÏÎ¹Î¿Î»ÏÎ³Î·ÏÎ·
- ÎÎ½ Î· ÏÎµÏÎ¹Î¿ÏÎ® Î´ÎµÎ½ Î­ÏÎµÎ¹ Î±ÏÎºÎµÏÎ¬ comparables, ÏÎµÏ ÏÎ¿ Î¾ÎµÎºÎ¬Î¸Î±ÏÎ±
- ÎÏÎ¬Î½ÏÎ± ÏÏÎ± ÎµÎ»Î»Î·Î½Î¹ÎºÎ¬, ÎµÏÎ±Î³Î³ÎµÎ»Î¼Î±ÏÎ¹ÎºÎ¬`
  }

  async function runEstimation(){
    if(!form.sqm || !form.area) {
      setMsgs(m=>[...m,{role:'ai',text:'Î Î±ÏÎ±ÎºÎ±Î»Ï ÏÏÎ¼ÏÎ»Î®ÏÏÏÎµ ÏÎ¿ÏÎ»Î¬ÏÎ¹ÏÏÎ¿Î½ ÏÎ·Î½ ÏÎµÏÎ¹Î¿ÏÎ® ÎºÎ±Î¹ ÏÎ¿ ÎµÎ¼Î²Î±Î´ÏÎ½ Î³Î¹Î± Î½Î± ÎºÎ¬Î½Ï ÎµÎºÏÎ¯Î¼Î·ÏÎ·.'}])
      return
    }
    setEstimating(true)
    setMsgs(m=>[...m,{role:'user',text:`ÎÎºÏÎ¯Î¼Î·ÏÎ· Î³Î¹Î± ${form.property_type.toLowerCase()} ${form.sqm}Ï.Î¼. ÏÏÎ· ${form.area}, ${form.floor}Î¿Ï ÏÏÎ¿ÏÎ¿Ï, ${form.year_built}, ÎºÎ±ÏÎ¬ÏÏÎ±ÏÎ·: ${CONDITIONS.find(c=>c.value===form.condition)?.label}`}])

    try {
      const r = await fetch('https://api.anthropic.com/v1/messages',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          model:'claude-sonnet-4-20250514',max_tokens:1200,
          system: buildValuationContext(),
          messages:[{role:'user',content:'ÎÎ¬Î½Îµ ÎµÎºÏÎ¯Î¼Î·ÏÎ· Î±ÏÏÎ¿Ï ÏÎ¿Ï Î±ÎºÎ¹Î½Î®ÏÎ¿Ï Î²Î¬ÏÎµÎ¹ ÏÏÎ½ ÏÏÎ³ÎºÏÎ¯ÏÎ¹Î¼ÏÎ½ ÏÎ¿Ï Î­ÏÎµÎ¹Ï.'}]
        })
      })
      const d=await r.json()
      const text=d.content[0].text
      setMsgs(m=>[...m,{role:'ai',text}])
      setEstimation({text, timestamp:new Date().toISOString()})
      setFeedback(f=>({...f,show:true}))
    } catch(e){
      setMsgs(m=>[...m,{role:'ai',text:'ÎÎ¬ÏÎ¹ ÏÎ®Î³Îµ ÏÏÏÎ±Î²Î¬ â Î´Î¿ÎºÎ¯Î¼Î±ÏÎµ Î¾Î±Î½Î¬.'}])
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
      setMsgs(m=>[...m,{role:'ai',text:'ÎÎ¬ÏÎ¹ ÏÎ®Î³Îµ ÏÏÏÎ±Î²Î¬!'}])
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
    setMsgs(m=>[...m,{role:'ai',text:`â ÎÏÏÎ±ÏÎ¹ÏÏÏ! Î ÏÎµÎ»Î¹ÎºÎ® ÏÎ¹Î¼Î® â¬${parseInt(feedback.actualPrice).toLocaleString()} ÎºÎ±ÏÎ±ÏÏÏÎ®Î¸Î·ÎºÎµ. ÎÏÏÏ Î²Î¿Î·Î¸Î¬ÎµÎ¹ ÏÎ¿ ÏÏÏÏÎ·Î¼Î± Î½Î± Î²ÎµÎ»ÏÎ¹ÏÎ½ÎµÎ¹ ÏÎ¹Ï ÎµÏÏÎ¼ÎµÎ½ÎµÏ ÎµÎºÏÎ¹Î¼Î®ÏÎµÎ¹Ï.`}])
    setFeedback({show:false,actualPrice:'',notes:''})
  }

  if(loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'#F4F4F4'}}><div style={{fontSize:13,color:C.muted}}>Î¦ÏÏÏÏÏÎ·...</div></div>

  return (
    <div style={{display:'flex',minHeight:'100vh',background:'#F4F4F4',fontFamily:"-apple-system,BlinkMacSystemFont,'Inter',sans-serif",color:C.dark}}>
      <Sidebar/>
      <div style={{marginLeft:64,flex:1,display:'grid',gridTemplateColumns:'380px 1fr',height:'100vh',overflow:'hidden'}}>

        {/* LEFT â Form */}
        <div style={{background:C.white,borderRight:'1px solid '+C.border,overflowY:'auto',padding:'24px 20px'}}>
          <div style={{marginBottom:20}}>
            <h1 style={{fontSize:18,fontWeight:700,letterSpacing:-.5,margin:'0 0 4px'}}>ÎÎºÏÎ¯Î¼Î·ÏÎ· ÎÎºÎ¹Î½Î®ÏÎ¿Ï</h1>
            <p style={{fontSize:12,color:C.muted,margin:0}}>AI ÎµÎºÏÎ¯Î¼Î·ÏÎ· Î²Î¬ÏÎµÎ¹ ÏÏÎ±Î³Î¼Î±ÏÎ¹ÎºÏÎ½ ÏÏÎ»Î®ÏÎµÏÎ½ KWAC</p>
          </div>

          {/* Deal type */}
          <div style={{display:'flex',gap:6,marginBottom:16}}>
            {[{v:'sale',l:'Î ÏÎ»Î·ÏÎ·'},{v:'rental',l:'ÎÎ¯ÏÎ¸ÏÏÎ·'}].map(t=>(
              <button key={t.v} onClick={()=>setF('deal_type',t.v)} style={{flex:1,padding:'8px 0',borderRadius:8,border:'1px solid '+(form.deal_type===t.v?C.red:C.border),background:form.deal_type===t.v?C.red:C.white,color:form.deal_type===t.v?'#fff':C.muted,fontSize:13,fontWeight:600,cursor:'pointer'}}>
                {t.l}
              </button>
            ))}
          </div>

          {/* Fields */}
          {[
            {key:'address',label:'ÎÎ¹ÎµÏÎ¸ÏÎ½ÏÎ·',placeholder:'Ï.Ï. ÎÎ¿ÏÎ»Î¹Î±Î³Î¼Î­Î½Î·Ï 142',type:'text'},
            {key:'area',label:'Î ÎµÏÎ¹Î¿ÏÎ® *',placeholder:'Ï.Ï. ÎÎ»ÏÏÎ¬Î´Î±',type:'text'},
            {key:'sqm',label:'ÎÎ¼Î²Î±Î´ÏÎ½ (Ï.Î¼.) *',placeholder:'Ï.Ï. 95',type:'number'},
            {key:'floor',label:'ÎÏÎ¿ÏÎ¿Ï',placeholder:'Ï.Ï. 3',type:'number'},
            {key:'year_built',label:'ÎÏÎ¿Ï ÎºÎ±ÏÎ±ÏÎºÎµÏÎ®Ï',placeholder:'Ï.Ï. 1998',type:'number'},
            {key:'year_renovated',label:'ÎÏÎ¿Ï Î±Î½Î±ÎºÎ±Î¯Î½Î¹ÏÎ·Ï',placeholder:'Î±Î½ ÏÏÎ¬ÏÏÎµÎ¹',type:'number'},
          ].map(f=>(
            <div key={f.key} style={{marginBottom:12}}>
              <label style={{fontSize:11,fontWeight:600,color:C.muted,display:'block',marginBottom:5,textTransform:'uppercase',letterSpacing:.4}}>{f.label}</label>
              <input type={f.type} value={form[f.key]} onChange={e=>setF(f.key,e.target.value)} placeholder={f.placeholder}
                style={{width:'100%',padding:'9px 12px',borderRadius:8,border:'1px solid '+C.border,fontSize:13,background:'#FAFAFA',color:C.dark,boxSizing:'border-box'}}/>
            </div>
          ))}

          {/* Property type */}
          <div style={{marginBottom:12}}>
            <label style={{fontSize:11,fontWeight:600,color:C.muted,display:'block',marginBottom:5,textTransform:'uppercase',letterSpacing:.4}}>Î¤ÏÏÎ¿Ï Î±ÎºÎ¹Î½Î®ÏÎ¿Ï</label>
            <select value={form.property_type} onChange={e=>setF('property_type',e.target.value)}
              style={{width:'100%',padding:'9px 12px',borderRadius:8,border:'1px solid '+C.border,fontSize:13,background:'#FAFAFA',color:C.dark}}>
              {PROPERTY_TYPES.map(t=><option key={t}>{t}</option>)}
            </select>
          </div>

          {/* Condition */}
          <div style={{marginBottom:12}}>
            <label style={{fontSize:11,fontWeight:600,color:C.muted,display:'block',marginBottom:5,textTransform:'uppercase',letterSpacing:.4}}>ÎÎ±ÏÎ¬ÏÏÎ±ÏÎ·</label>
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
            <label style={{fontSize:11,fontWeight:600,color:C.muted,display:'block',marginBottom:5,textTransform:'uppercase',letterSpacing:.4}}>Î£Î·Î¼ÎµÎ¹ÏÏÎµÎ¹Ï</label>
            <textarea value={form.notes} onChange={e=>setF('notes',e.target.value)} placeholder="Ï.Ï. ÎÎ»Î­ÏÎµÎ¹ Î¸Î¬Î»Î±ÏÏÎ±, parking, Î±ÏÎ¿Î¸Î®ÎºÎ·..."
              style={{width:'100%',padding:'9px 12px',borderRadius:8,border:'1px solid '+C.border,fontSize:13,background:'#FAFAFA',color:C.dark,height:72,resize:'none',boxSizing:'border-box'}}/>
          </div>

          <button onClick={runEstimation} disabled={estimating||!form.sqm||!form.area}
            style={{width:'100%',background:estimating||!form.sqm||!form.area?C.muted:C.red,color:'#fff',border:'none',borderRadius:10,padding:'13px 0',fontSize:14,fontWeight:700,cursor:estimating||!form.sqm||!form.area?'not-allowed':'pointer',transition:'background .2s'}}>
            {estimating?'ÎÎ½Î±Î»ÏÏ...' : 'â¦ ÎÎºÏÎ¯Î¼Î·ÏÎ· AI'}
          </button>

          {/* Feedback */}
          {feedback.show && (
            <div style={{marginTop:16,background:C.greenLight,borderRadius:12,padding:'14px 16px',border:'1px solid #BBF7D0'}}>
              <div style={{fontSize:12,fontWeight:700,color:C.green,marginBottom:10}}>ð Feedback loop â Î²Î¿Î®Î¸Î·ÏÎµ ÏÎ¿ ÏÏÏÏÎ·Î¼Î±</div>
              <label style={{fontSize:11,fontWeight:600,color:C.muted,display:'block',marginBottom:5}}>Î¤ÎµÎ»Î¹ÎºÎ® ÏÎ¹Î¼Î® ÏÏÎ¼ÏÏÎ½Î¯Î±Ï (â¬)</label>
              <input type="number" value={feedback.actualPrice} onChange={e=>setFeedback(f=>({...f,actualPrice:e.target.value}))} placeholder="Ï.Ï. 265000"
                style={{width:'100%',padding:'8px 12px',borderRadius:8,border:'1px solid '+C.border,fontSize:13,marginBottom:8,boxSizing:'border-box'}}/>
              <input type="text" value={feedback.notes} onChange={e=>setFeedback(f=>({...f,notes:e.target.value}))} placeholder="Î¤ÏÏÏÎ½ ÏÎ±ÏÎ±ÏÎ·ÏÎ®ÏÎµÎ¹Ï (ÏÏÎ¿Î±Î¹ÏÎµÏÎ¹ÎºÏ)"
                style={{width:'100%',padding:'8px 12px',borderRadius:8,border:'1px solid '+C.border,fontSize:13,marginBottom:10,boxSizing:'border-box'}}/>
              <button onClick={saveFeedback} style={{width:'100%',background:C.green,color:'#fff',border:'none',borderRadius:8,padding:'9px 0',fontSize:13,fontWeight:600,cursor:'pointer'}}>
                â ÎÏÎ¿Î¸Î®ÎºÎµÏÏÎ· feedback
              </button>
            </div>
          )}

          {/* Comparables */}
          <div style={{marginTop:20}}>
            <p style={{fontSize:11,fontWeight:700,color:C.muted,letterSpacing:.8,textTransform:'uppercase',margin:'0 0 10px'}}>Î ÏÏÏÏÎ±ÏÎµÏ ÏÏÎ»Î®ÏÎµÎ¹Ï KWAC</p>
            {MOCK_COMPARABLES.filter(c=>form.area?c.area===form.area:true).slice(0,4).map((c,i)=>(
              <div key={i} style={{padding:'10px 12px',borderRadius:10,background:C.subtle,marginBottom:6}}>
                <div style={{fontSize:12,fontWeight:600,marginBottom:3}}>{c.address}, {c.area}</div>
                <div style={{display:'flex',gap:10,fontSize:11,color:C.muted}}>
                  <span>{c.sqm}Ï.Î¼.</span><span>Â·</span>
                  <span style={{fontWeight:700,color:C.dark}}>â¬{c.price_final.toLocaleString()}</span>
                  <span>Â·</span>
                  <span style={{fontWeight:600,color:C.blue}}>â¬{c.price_sqm}/Ï.Î¼.</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT â Chat */}
        <div style={{display:'flex',flexDirection:'column',height:'100vh',overflow:'hidden'}}>
          <div style={{padding:'16px 20px',borderBottom:'1px solid '+C.border,background:C.white,flexShrink:0}}>
            <h2 style={{fontSize:14,fontWeight:700,margin:'0 0 2px'}}>AI ÎÎºÏÎ¹Î¼Î·ÏÎ®Ï</h2>
            <p style={{fontSize:11,color:C.muted,margin:0}}>ÎÎ¬ÏÎµÎ¹ {MOCK_COMPARABLES.length} ÏÏÎ±Î³Î¼Î±ÏÎ¹ÎºÏÎ½ ÏÏÎ»Î®ÏÎµÏÎ½ KWAC Â· Feedback loop ÎµÎ½ÎµÏÎ³Ï</p>
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
                  ÎÎ½Î±Î»ÏÏ ÏÏÎ³ÎºÏÎ¯ÏÎ¹Î¼Î± Î±ÎºÎ¯Î½Î·ÏÎ±...
                </div>
              </div>
            )}
            <div ref={chatRef}/>
          </div>

          <div style={{padding:'14px 20px',borderTop:'1px solid '+C.border,background:C.white,flexShrink:0,display:'flex',gap:10}}>
            <input value={chatInp} onChange={e=>setChatInp(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendChat()}
              placeholder="Ï.Ï. Î ÏÏ ÎµÏÎ·ÏÎµÎ¬Î¶ÎµÎ¹ Î¿ ÏÏÎ¿ÏÎ¿Ï ÏÎ·Î½ ÏÎ¹Î¼Î® ÏÎµ Î±ÏÏÎ® ÏÎ·Î½ ÏÎµÏÎ¹Î¿ÏÎ®;"
              style={{flex:1,padding:'12px 16px',borderRadius:10,border:'1px solid '+C.border,fontSize:13,outline:'none',background:'#FAFAFA'}}/>
            <button onClick={sendChat} style={{background:C.dark,color:'#fff',border:'none',borderRadius:10,padding:'12px 20px',fontSize:13,fontWeight:600,cursor:'pointer'}}>â</button>
          </div>
        </div>
      </div>
    </div>
  )
}