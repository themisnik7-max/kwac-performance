'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import MarketingKitPanel from '@/components/MarketingKitPanel'
import { PropertyPhotoUpload } from '@/components/PropertyPhotoUpload'
import { PropertyDocUpload } from '@/components/PropertyDocUpload'
import { contactName } from '@/lib/contacts'

const C = {red:'#CC2229',dark:'#1A1A1A',muted:'#6B7280',border:'#EBEBEB',subtle:'#F7F7F7',white:'#FFFFFF',green:'#16A34A',greenLight:'#F0FDF4',blue:'#2563EB'}

function Field({label,value,onChange,type='text',placeholder='',required=false}: any){
  return (
    <div style={{marginBottom:12}}>
      <label style={{fontSize:11,fontWeight:600,color:C.muted,display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:.4}}>{label}{required&&<span style={{color:C.red}}>*</span>}</label>
      <input type={type} value={value??''} onChange={e=>onChange&&onChange(type==='checkbox'?e.target.checked:e.target.value)} placeholder={placeholder}
        checked={type==='checkbox'?!!value:undefined}
        style={type==='checkbox'?{}:{width:'100%',padding:'9px 12px',borderRadius:8,border:'1px solid '+C.border,fontSize:13,background:'#FAFAFA',color:C.dark,boxSizing:'border-box',outline:'none'}}/>
    </div>
  )
}
function Sel({label,value,onChange,options}: any){
  return (
    <div style={{marginBottom:12}}>
      <label style={{fontSize:11,fontWeight:600,color:C.muted,display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:.4}}>{label}</label>
      <select value={value||''} onChange={e=>onChange&&onChange(e.target.value)} style={{width:'100%',padding:'9px 12px',borderRadius:8,border:'1px solid '+C.border,fontSize:13,background:'#FAFAFA',color:C.dark,boxSizing:'border-box'}}>
        <option value="">— Επιλογή —</option>
        {options.map((o: any)=><option key={o.value||o} value={o.value||o}>{o.label||o}</option>)}
      </select>
    </div>
  )
}
function Txt({label,value,onChange,rows=3}: any){
  return (
    <div style={{marginBottom:12}}>
      <label style={{fontSize:11,fontWeight:600,color:C.muted,display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:.4}}>{label}</label>
      <textarea value={value||''} onChange={e=>onChange&&onChange(e.target.value)} rows={rows}
        style={{width:'100%',padding:'9px 12px',borderRadius:8,border:'1px solid '+C.border,fontSize:13,background:'#FAFAFA',color:C.dark,boxSizing:'border-box',resize:'vertical'}}/>
    </div>
  )
}
function Sec({children}: any){return <div style={{fontSize:11,fontWeight:700,color:C.muted,letterSpacing:.8,textTransform:'uppercase',margin:'20px 0 12px',paddingBottom:8,borderBottom:'1px solid '+C.border}}>{children}</div>}

// Real meeting_properties columns only — no invented buyer/lawyer/notary/
// showings/offers/closing fields with nothing behind them (that was the
// previous version of this page: a fully-built UI that never loaded or
// saved real data at all).
const EMPTY: Record<string, any> = {
  address:'', area:'', property_type:'Διαμέρισμα', transaction_type:'sale', status:'pending',
  sqm:'', floor:'', rooms:'', year_built:'', year_renovated:'', condition:'good',
  balcony:false, parking:false, security_door:false,
  asking_price:'', description:'', ai_summary:'', seller_motivation:'',
  owner_name:'', owner_phone:'', owner_email:'',
}

type HistoryEntry = { kind: 'voice_note' | 'comment' | 'valuation'; date: string; text: string; meta?: string }

export default function PropertyFilePage({params}: {params: {id: string}}){
  const id = params?.id
  const [saving,setSaving]=useState(false)
  const [saved,setSaved]=useState(false)
  const [err,setErr]=useState<string|null>(null)
  const [loading,setLoading]=useState(true)
  const [user,setUser]=useState<any>(null)
  const [prop,setProp]=useState<Record<string, any>>({...EMPTY})
  const [ownerContact,setOwnerContact]=useState<{id:string; name:string}|null>(null)
  const [history,setHistory]=useState<HistoryEntry[]>([])
  const [showMarketing,setShowMarketing]=useState(false)

  useEffect(()=>{
    supabase.auth.getUser().then(({data:d})=>{
      if(!d.user){window.location.href='/login';return}
      setUser(d.user)
    })
  },[])

  useEffect(()=>{
    if(!user || !id) return
    ;(async () => {
      setLoading(true)
      const { data: row, error } = await supabase.from('meeting_properties').select('*').eq('id', id).single()
      if (error || !row) { setErr('Δεν βρέθηκε το ακίνητο.'); setLoading(false); return }
      setProp(row)

      if (row.owner_contact_id) {
        const { data: c } = await supabase.from('contacts').select('id,full_name,first_name,last_name').eq('id', row.owner_contact_id).single()
        if (c) setOwnerContact({ id: c.id, name: contactName(c) })
      }

      const entries: HistoryEntry[] = []
      if (row.voice_note_ids?.length) {
        const { data: notes } = await supabase.from('voice_notes').select('id,transcript,created_at').in('id', row.voice_note_ids)
        for (const n of notes || []) entries.push({ kind: 'voice_note', date: n.created_at, text: n.transcript })
      }
      const { data: comments } = await supabase.from('meeting_comments').select('comment,agent_name,agent_estimate,created_at').eq('property_id', id)
      for (const c of comments || []) entries.push({ kind: 'comment', date: c.created_at, text: c.comment, meta: `${c.agent_name}${c.agent_estimate ? ` — εκτίμηση €${Number(c.agent_estimate).toLocaleString('el-GR')}` : ''}` })
      const { data: val } = await supabase.from('meeting_valuations').select('ai_recommended,ai_reasoning,confidence_score,updated_at').eq('property_id', id).maybeSingle()
      if (val?.ai_reasoning) entries.push({ kind: 'valuation', date: val.updated_at, text: val.ai_reasoning, meta: val.ai_recommended ? `€${Number(val.ai_recommended).toLocaleString('el-GR')} · εμπιστοσύνη ${Math.round((val.confidence_score||0)*100)}%` : undefined })

      entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      setHistory(entries)
      setLoading(false)
    })()
  },[user, id])

  async function handleSave(){
    setSaving(true); setErr(null)
    const payload = { ...prop }
    delete payload.id; delete payload.created_at; delete payload.updated_at; delete payload.voice_note_ids
    delete payload.agency_id; delete payload.agent_id; delete payload.owner_contact_id; delete payload.first_registered_by
    const { error } = await supabase.from('meeting_properties').update(payload).eq('id', id)
    setSaving(false)
    if (error) { setErr(error.message); return }
    setSaved(true)
    setTimeout(()=>setSaved(false),3000)
  }

  const p=prop
  const sp=(k: string)=>(v: any)=>setProp((x: any)=>({...x,[k]:v}))

  if(!user || loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'#F4F4F4'}}><div style={{fontSize:13,color:C.muted}}>Φόρτωση...</div></div>
  if(err && !p.address) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'#F4F4F4'}}><div style={{fontSize:13,color:C.red}}>{err}</div></div>

  return (
    <div style={{display:'flex',minHeight:'100vh',background:'#F4F4F4',fontFamily:"-apple-system,BlinkMacSystemFont,'Inter',sans-serif",color:C.dark}}>
      <Sidebar/>
      <div style={{marginLeft:64,flex:1,display:'flex',flexDirection:'column',height:'100vh',overflow:'hidden'}}>
        <div style={{background:C.dark,padding:'16px 28px',display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0}}>
          <div>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <a href="/personal-admin" style={{color:'rgba(255,255,255,.5)',textDecoration:'none',fontSize:12,fontWeight:500}}>← Personal Admin</a>
              <span style={{color:'rgba(255,255,255,.2)'}}>|</span>
              <h1 style={{fontSize:15,fontWeight:700,color:'#fff',margin:0}}>{p.address||'Φάκελος Ακινήτου'}</h1>
            </div>
            {p.area&&<p style={{fontSize:11,color:'rgba(255,255,255,.4)',margin:'3px 0 0'}}>{p.area} · {p.transaction_type==='sale'?'Πώληση':'Ενοίκιο'}{p.ilist_id&&` · ${p.ilist_id}`}</p>}
          </div>
          <button onClick={handleSave} disabled={saving} style={{background:saved?C.green:C.red,color:'#fff',border:'none',borderRadius:10,padding:'10px 22px',fontSize:13,fontWeight:700,cursor:'pointer',transition:'background .3s'}}>
            {saving?'Αποθήκευση...':saved?'✓ Αποθηκεύτηκε':'Αποθήκευση'}
          </button>
        </div>

        <div style={{flex:1,overflowY:'auto',padding:'24px 28px'}}>
          {err && <div style={{marginBottom:16,padding:'10px 14px',background:'#FEE2E2',color:'#B91C1C',borderRadius:8,fontSize:13}}>{err}</div>}

          <button onClick={()=>setShowMarketing(s=>!s)} style={{marginBottom:16,padding:'8px 16px',borderRadius:8,border:'none',background:C.dark,color:'#fff',fontSize:12,fontWeight:600,cursor:'pointer'}}>
            {showMarketing?'✕ Κλείσιμο Marketing Kit':'📣 Marketing Kit'}
          </button>
          {showMarketing && <MarketingKitPanel prop={{...p, bedrooms: p.rooms, ilist_code: p.ilist_id, city: 'Αθήνα'}} user={{id: user.id, email: user.email}} />}

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:24}}>
            <div>
              <Sec>Στοιχεία Ακινήτου</Sec>
              <Field label="Διεύθυνση" value={p.address} onChange={sp('address')} required placeholder="π.χ. Λεωφ. Βουλιαγμένης 142"/>
              <Field label="Περιοχή" value={p.area} onChange={sp('area')} required/>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                <Sel label="Τύπος" value={p.property_type} onChange={sp('property_type')} options={['Διαμέρισμα','Μονοκατοικία','Μεζονέτα','Γραφείο','Κατάστημα','Αποθήκη','Οικόπεδο']}/>
                <Sel label="Συναλλαγή" value={p.transaction_type} onChange={sp('transaction_type')} options={[{value:'sale',label:'Πώληση'},{value:'rent',label:'Μίσθωση'}]}/>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
                <Field label="Τ.μ." value={p.sqm} onChange={sp('sqm')} type="number"/>
                <Field label="Όροφος" value={p.floor} onChange={sp('floor')} type="number"/>
                <Field label="Δωμάτια" value={p.rooms} onChange={sp('rooms')} type="number"/>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                <Field label="Έτος κατ." value={p.year_built} onChange={sp('year_built')} type="number"/>
                <Field label="Έτος ανακ." value={p.year_renovated} onChange={sp('year_renovated')} type="number"/>
              </div>
              <Sel label="Κατάσταση" value={p.condition} onChange={sp('condition')} options={[{value:'excellent',label:'Άριστη'},{value:'good',label:'Καλή'},{value:'fair',label:'Μέτρια'},{value:'needs_work',label:'Χρειάζεται εργασίες'}]}/>
              <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:12}}>
                {[{k:'parking',l:'Parking'},{k:'balcony',l:'Μπαλκόνι'},{k:'security_door',l:'Ασφ. Πόρτα'}].map(x=>(
                  <button key={x.k} onClick={()=>setProp((pr: any)=>({...pr,[x.k]:!pr[x.k]}))} style={{padding:'6px 12px',borderRadius:99,border:'1px solid '+(p[x.k]?C.green:C.border),background:p[x.k]?C.greenLight:C.white,color:p[x.k]?C.green:C.muted,fontSize:12,fontWeight:600,cursor:'pointer'}}>
                    {p[x.k]?'✓ ':''}{x.l}
                  </button>
                ))}
              </div>
              <Txt label="Περιγραφή" value={p.description} onChange={sp('description')} rows={4}/>
              <Txt label="AI Σύνοψη" value={p.ai_summary} onChange={sp('ai_summary')} rows={2}/>
            </div>

            <div>
              <Sec>Τιμολόγηση</Sec>
              <Field label="Τιμή ζήτησης (€)" value={p.asking_price} onChange={sp('asking_price')} type="number"/>

              <Sec>Ιδιοκτήτης</Sec>
              {ownerContact && (
                <div style={{marginBottom:10,padding:'10px 12px',background:C.subtle,borderRadius:8,fontSize:13}}>
                  Συνδεδεμένος με καρτέλα επαφής: <a href={`/contacts/${ownerContact.id}`} style={{color:C.blue,fontWeight:600,textDecoration:'none'}}>{ownerContact.name} →</a>
                </div>
              )}
              <div style={{background:C.subtle,borderRadius:12,padding:'14px 16px',marginBottom:14}}>
                <Field label="Ονοματεπώνυμο" value={p.owner_name} onChange={sp('owner_name')}/>
                <Field label="Τηλέφωνο" value={p.owner_phone} onChange={sp('owner_phone')} type="tel"/>
                <Field label="Email" value={p.owner_email} onChange={sp('owner_email')} type="email"/>
                <Field label="Κίνητρο πώλησης" value={p.seller_motivation} onChange={sp('seller_motivation')}/>
              </div>

              <Sec>Φωτογραφίες</Sec>
              <PropertyPhotoUpload propertyId={id}/>
              <Sec>Έγγραφα</Sec>
              <PropertyDocUpload propertyId={id}/>

              <Sec>Ιστορικό ({history.length})</Sec>
              {history.length===0 && <div style={{padding:20,textAlign:'center',color:C.muted,fontSize:13,background:C.subtle,borderRadius:12}}>Κανένα ιστορικό ακόμα.</div>}
              {history.map((h,i)=>(
                <div key={i} style={{background:C.white,border:'1px solid '+C.border,borderRadius:10,padding:'10px 14px',marginBottom:8}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                    <span style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:'uppercase'}}>
                      {h.kind==='voice_note'?'🎙 Φωνητική σημείωση':h.kind==='comment'?'💬 Σχόλιο':'🤖 AI Εκτίμηση'}
                    </span>
                    <span style={{fontSize:10,color:C.muted}}>{new Date(h.date).toLocaleDateString('el-GR')}</span>
                  </div>
                  <p style={{fontSize:13,margin:0,lineHeight:1.5}}>{h.text}</p>
                  {h.meta && <p style={{fontSize:11,color:C.muted,margin:'4px 0 0'}}>{h.meta}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
