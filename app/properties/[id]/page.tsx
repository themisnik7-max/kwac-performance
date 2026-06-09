'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'

const C = {red:'#CC2229',dark:'#1A1A1A',muted:'#6B7280',border:'#EBEBEB',subtle:'#F7F7F7',white:'#FFFFFF',green:'#16A34A',greenLight:'#F0FDF4',amber:'#D97706',blue:'#2563EB'}
const PHASES = [{id:'listing',label:'Ανάθεση',icon:'📋'},{id:'marketing',label:'Εμπορία',icon:'📣'},{id:'closing',label:'Κλείσιμο',icon:'✅'}]

function Field({label,value,onChange,type='text',placeholder='',required=false}){
  return (
    <div style={{marginBottom:12}}>
      <label style={{fontSize:11,fontWeight:600,color:C.muted,display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:.4}}>{label}{required&&<span style={{color:C.red}}>*</span>}</label>
      <input type={type} value={value||''} onChange={e=>onChange&&onChange(e.target.value)} placeholder={placeholder}
        style={{width:'100%',padding:'9px 12px',borderRadius:8,border:'1px solid '+C.border,fontSize:13,background:'#FAFAFA',color:C.dark,boxSizing:'border-box',outline:'none'}}/>
    </div>
  )
}
function Sel({label,value,onChange,options}){
  return (
    <div style={{marginBottom:12}}>
      <label style={{fontSize:11,fontWeight:600,color:C.muted,display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:.4}}>{label}</label>
      <select value={value||''} onChange={e=>onChange&&onChange(e.target.value)} style={{width:'100%',padding:'9px 12px',borderRadius:8,border:'1px solid '+C.border,fontSize:13,background:'#FAFAFA',color:C.dark,boxSizing:'border-box'}}>
        <option value="">— Επιλογή —</option>
        {options.map(o=><option key={o.value||o} value={o.value||o}>{o.label||o}</option>)}
      </select>
    </div>
  )
}
function Txt({label,value,onChange,rows=3}){
  return (
    <div style={{marginBottom:12}}>
      <label style={{fontSize:11,fontWeight:600,color:C.muted,display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:.4}}>{label}</label>
      <textarea value={value||''} onChange={e=>onChange&&onChange(e.target.value)} rows={rows}
        style={{width:'100%',padding:'9px 12px',borderRadius:8,border:'1px solid '+C.border,fontSize:13,background:'#FAFAFA',color:C.dark,boxSizing:'border-box',resize:'vertical'}}/>
    </div>
  )
}
function Sec({children}){return <div style={{fontSize:11,fontWeight:700,color:C.muted,letterSpacing:.8,textTransform:'uppercase',margin:'20px 0 12px',paddingBottom:8,borderBottom:'1px solid '+C.border}}>{children}</div>}
function PersonBlock({title,data,onChange}){
  const d=data||{}
  const u=(k,v)=>onChange&&onChange({...d,[k]:v})
  return (
    <div style={{background:C.subtle,borderRadius:12,padding:'14px 16px',marginBottom:14}}>
      <div style={{fontSize:12,fontWeight:700,color:C.dark,marginBottom:10}}>{title}</div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
        <Field label="Επώνυμο" value={d.last_name} onChange={v=>u('last_name',v)} required/>
        <Field label="Όνομα" value={d.first_name} onChange={v=>u('first_name',v)}/>
        <Field label="Τηλέφωνο" value={d.phone} onChange={v=>u('phone',v)} type="tel"/>
        <Field label="Email" value={d.email} onChange={v=>u('email',v)} type="email"/>
        <Field label="ΑΔΤ" value={d.id_number} onChange={v=>u('id_number',v)}/>
        <Field label="ΑΦΜ" value={d.afm} onChange={v=>u('afm',v)}/>
        <div style={{gridColumn:'1/-1'}}><Field label="Διεύθυνση" value={d.address} onChange={v=>u('address',v)}/></div>
        <div style={{gridColumn:'1/-1'}}><Txt label="Σημειώσεις" value={d.notes} onChange={v=>u('notes',v)} rows={2}/></div>
      </div>
    </div>
  )
}

export default function PropertyFilePage({params}){
  const isNew=!params?.id||params?.id==='new'
  const [phase,setPhase]=useState('listing')
  const [saving,setSaving]=useState(false)
  const [saved,setSaved]=useState(false)
  const [user,setUser]=useState(null)
  const [prop,setProp]=useState({address:'',area:'',city:'Αθήνα',property_type:'Διαμέρισμα',deal_type:'sale',status:'active',sqm:'',floor:'',total_floors:'',bedrooms:'',bathrooms:'',year_built:'',year_renovated:'',condition:'good',heating:'',parking:false,storage:false,elevator:false,garden:false,view:'',energy_class:'',description:'',price_asking:'',price_min:'',listing_type:'exclusive',listing_start:'',listing_end:'',commission_pct:'',ilist_code:'',title_status:'clear',mortgage_amount:'',legal_notes:''})
  const [owner,setOwner]=useState({})
  const [ownerLawyer,setOwnerLawyer]=useState({})
  const [buyer,setBuyer]=useState({})
  const [buyerLawyer,setBuyerLawyer]=useState({})
  const [notary,setNotary]=useState({})
  const [showings,setShowings]=useState([])
  const [calls,setCalls]=useState([])
  const [offers,setOffers]=useState([])
  const [closing,setClosing]=useState({pre_agreement_date:'',pre_agreement_amount:'',contract_date:'',price_final:'',commission_earned:''})

  useEffect(()=>{supabase.auth.getUser().then(({data:d})=>{if(!d.user){window.location.href='/login';return};setUser(d.user)})},[])

  const addShowing=()=>setShowings(s=>[...s,{id:Date.now(),buyer_name:'',buyer_phone:'',showing_date:'',result:'',notes:''}])
  const updShowing=(id,k,v)=>setShowings(s=>s.map(x=>x.id===id?{...x,[k]:v}:x))
  const addCall=()=>setCalls(c=>[...c,{id:Date.now(),caller_name:'',caller_phone:'',call_date:'',interest_level:'medium',notes:''}])
  const updCall=(id,k,v)=>setCalls(c=>c.map(x=>x.id===id?{...x,[k]:v}:x))
  const addOffer=()=>setOffers(o=>[...o,{id:Date.now(),buyer_name:'',buyer_phone:'',offer_date:'',offer_amount:'',status:'pending',counter_amount:'',notes:''}])
  const updOffer=(id,k,v)=>setOffers(o=>o.map(x=>x.id===id?{...x,[k]:v}:x))

  async function handleSave(){
    setSaving(true)
    await new Promise(r=>setTimeout(r,600))
    setSaved(true)
    setTimeout(()=>setSaved(false),3000)
    setSaving(false)
  }

  const p=prop
  const sp=k=>v=>setProp(x=>({...x,[k]:v}))
  const sc=k=>v=>setClosing(x=>({...x,[k]:v}))

  if(!user) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'#F4F4F4'}}><div style={{fontSize:13,color:C.muted}}>Φόρτωση...</div></div>

  return (
    <div style={{display:'flex',minHeight:'100vh',background:'#F4F4F4',fontFamily:"-apple-system,BlinkMacSystemFont,'Inter',sans-serif",color:C.dark}}>
      <Sidebar/>
      <div style={{marginLeft:64,flex:1,display:'flex',flexDirection:'column',height:'100vh',overflow:'hidden'}}>
        {/* Header */}
        <div style={{background:C.dark,padding:'16px 28px',display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0}}>
          <div>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <a href="/profile" style={{color:'rgba(255,255,255,.5)',textDecoration:'none',fontSize:12,fontWeight:500}}>← Προφίλ</a>
              <span style={{color:'rgba(255,255,255,.2)'}}>|</span>
              <h1 style={{fontSize:15,fontWeight:700,color:'#fff',margin:0}}>{isNew?'Νέο Ακίνητο':p.address||'Φάκελος Ακινήτου'}</h1>
            </div>
            {!isNew&&p.area&&<p style={{fontSize:11,color:'rgba(255,255,255,.4)',margin:'3px 0 0'}}>{p.area} · {p.deal_type==='sale'?'Πώληση':'Μίσθωση'} · {p.ilist_code&&'i-list: '+p.ilist_code}</p>}
          </div>
          <button onClick={handleSave} disabled={saving} style={{background:saved?C.green:C.red,color:'#fff',border:'none',borderRadius:10,padding:'10px 22px',fontSize:13,fontWeight:700,cursor:'pointer',transition:'background .3s'}}>
            {saving?'Αποθήκευση...':saved?'✓ Αποθηκεύτηκε':'Αποθήκευση'}
          </button>
        </div>

        {/* Phase tabs */}
        <div style={{background:C.white,borderBottom:'1px solid '+C.border,padding:'0 28px',display:'flex',gap:0,flexShrink:0}}>
          {PHASES.map(ph=>(
            <button key={ph.id} onClick={()=>setPhase(ph.id)} style={{padding:'14px 22px',border:'none',background:'transparent',cursor:'pointer',fontSize:13,fontWeight:600,color:phase===ph.id?C.red:C.muted,borderBottom:phase===ph.id?'2px solid '+C.red:'2px solid transparent',transition:'all .15s'}}>
              {ph.icon} {ph.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{flex:1,overflowY:'auto',padding:'24px 28px'}}>

          {phase==='listing'&&(
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:24}}>
              <div>
                <Sec>Στοιχεία Ακινήτου</Sec>
                <Field label="Διεύθυνση" value={p.address} onChange={sp('address')} required placeholder="π.χ. Λεωφ. Βουλιαγμένης 142"/>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}><Field label="Περιοχή" value={p.area} onChange={sp('area')} required/><Field label="Πόλη" value={p.city} onChange={sp('city')}/></div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                  <Sel label="Τύπος" value={p.property_type} onChange={sp('property_type')} options={['Διαμέρισμα','Μονοκατοικία','Μεζονέτα','Γραφείο','Κατάστημα','Αποθήκη','Οικόπεδο']}/>
                  <Sel label="Συναλλαγή" value={p.deal_type} onChange={sp('deal_type')} options={[{value:'sale',label:'Πώληση'},{value:'rental',label:'Μίσθωση'}]}/>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8}}>
                  <Field label="Τ.μ." value={p.sqm} onChange={sp('sqm')} type="number" required/>
                  <Field label="Όροφος" value={p.floor} onChange={sp('floor')} type="number"/>
                  <Field label="Υπνοδ." value={p.bedrooms} onChange={sp('bedrooms')} type="number"/>
                  <Field label="WC" value={p.bathrooms} onChange={sp('bathrooms')} type="number"/>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                  <Field label="Έτος κατ." value={p.year_built} onChange={sp('year_built')} type="number"/>
                  <Field label="Έτος ανακ." value={p.year_renovated} onChange={sp('year_renovated')} type="number"/>
                </div>
                <Sel label="Κατάσταση" value={p.condition} onChange={sp('condition')} options={[{value:'excellent',label:'Άριστη'},{value:'good',label:'Καλή'},{value:'fair',label:'Μέτρια'},{value:'needs_renovation',label:'Ανακαίνιση'}]}/>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                  <Field label="Θέρμανση" value={p.heating} onChange={sp('heating')} placeholder="Αυτόνομη"/>
                  <Sel label="Ενεργ. κλάση" value={p.energy_class} onChange={sp('energy_class')} options={['A+','A','B','C','D','E','Z','H']}/>
                </div>
                <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:12}}>
                  {[{k:'parking',l:'Parking'},{k:'elevator',l:'Ανελκ.'},{k:'storage',l:'Αποθήκη'},{k:'garden',l:'Κήπος'}].map(x=>(
                    <button key={x.k} onClick={()=>setProp(pr=>({...pr,[x.k]:!pr[x.k]}))} style={{padding:'6px 12px',borderRadius:99,border:'1px solid '+(p[x.k]?C.green:C.border),background:p[x.k]?C.greenLight:C.white,color:p[x.k]?C.green:C.muted,fontSize:12,fontWeight:600,cursor:'pointer'}}>
                      {p[x.k]?'✓ ':''}{x.l}
                    </button>
                  ))}
                </div>
                <Txt label="Περιγραφή" value={p.description} onChange={sp('description')} rows={4}/>
              </div>
              <div>
                <Sec>Τιμολόγηση & Ανάθεση</Sec>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                  <Field label="Τιμή ζήτησης (€)" value={p.price_asking} onChange={sp('price_asking')} type="number" required/>
                  <Field label="Κάτω όριο (€) — εσωτερικό" value={p.price_min} onChange={sp('price_min')} type="number"/>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                  <Sel label="Τύπος ανάθεσης" value={p.listing_type} onChange={sp('listing_type')} options={[{value:'exclusive',label:'Αποκλειστική'},{value:'simple',label:'Απλή'}]}/>
                  <Field label="Κωδικός i-list" value={p.ilist_code} onChange={sp('ilist_code')} placeholder="π.χ. 1554776"/>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                  <Field label="Έναρξη ανάθεσης" value={p.listing_start} onChange={sp('listing_start')} type="date"/>
                  <Field label="Λήξη ανάθεσης" value={p.listing_end} onChange={sp('listing_end')} type="date"/>
                </div>
                <Field label="Προμήθεια (%)" value={p.commission_pct} onChange={sp('commission_pct')} type="number" placeholder="π.χ. 2"/>
                <Sec>Νομική Κατάσταση</Sec>
                <Sel label="Κατάσταση τίτλων" value={p.title_status} onChange={sp('title_status')} options={[{value:'clear',label:'Καθαροί τίτλοι'},{value:'mortgage',label:'Υποθήκη'},{value:'inheritance',label:'Κληρονομικό'},{value:'dispute',label:'Αμφισβήτηση'}]}/>
                {p.title_status==='mortgage'&&<Field label="Ποσό υποθήκης (€)" value={p.mortgage_amount} onChange={sp('mortgage_amount')} type="number"/>}
                <Txt label="Νομικές σημειώσεις" value={p.legal_notes} onChange={sp('legal_notes')} rows={2}/>
                <Sec>Ιδιοκτήτης</Sec>
                <PersonBlock title="Στοιχεία Ιδιοκτήτη" data={owner} onChange={setOwner}/>
                <Sec>Δικηγόρος Ιδιοκτήτη</Sec>
                <PersonBlock title="Στοιχεία Δικηγόρου" data={ownerLawyer} onChange={setOwnerLawyer}/>
              </div>
            </div>
          )}

          {phase==='marketing'&&(
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:24}}>
              <div>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
                  <Sec>Υποδείξεις ({showings.length})</Sec>
                  <button onClick={addShowing} style={{background:C.dark,color:'#fff',border:'none',borderRadius:8,padding:'6px 14px',fontSize:12,fontWeight:600,cursor:'pointer',marginBottom:8}}>+ Νέα</button>
                </div>
                {showings.length===0&&<div style={{padding:'32px',textAlign:'center',color:C.muted,fontSize:13,background:C.subtle,borderRadius:12}}>Δεν υπάρχουν υποδείξεις ακόμα</div>}
                {showings.map((s,i)=>(
                  <div key={s.id} style={{background:C.white,borderRadius:12,border:'1px solid '+C.border,padding:'14px 16px',marginBottom:10}}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}><span style={{fontSize:12,fontWeight:700,color:C.muted}}>Υπόδειξη {i+1}</span><button onClick={()=>setShowings(x=>x.filter(y=>y.id!==s.id))} style={{background:'none',border:'none',color:C.red,cursor:'pointer',fontSize:12}}>✕</button></div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                      <Field label="Ενδιαφερόμενος" value={s.buyer_name} onChange={v=>updShowing(s.id,'buyer_name',v)}/>
                      <Field label="Τηλέφωνο" value={s.buyer_phone} onChange={v=>updShowing(s.id,'buyer_phone',v)} type="tel"/>
                      <Field label="Ημερομηνία" value={s.showing_date} onChange={v=>updShowing(s.id,'showing_date',v)} type="datetime-local"/>
                      <Sel label="Αποτέλεσμα" value={s.result} onChange={v=>updShowing(s.id,'result',v)} options={[{value:'interested',label:'Ενδιαφέρον'},{value:'considering',label:'Σκέφτεται'},{value:'not_interested',label:'Δεν ενδιαφέρεται'},{value:'offer',label:'Προσφορά'}]}/>
                    </div>
                    <Txt label="Σχόλια" value={s.notes} onChange={v=>updShowing(s.id,'notes',v)} rows={2}/>
                  </div>
                ))}
              </div>
              <div>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
                  <Sec>Τηλεφωνήματα ({calls.length})</Sec>
                  <button onClick={addCall} style={{background:C.dark,color:'#fff',border:'none',borderRadius:8,padding:'6px 14px',fontSize:12,fontWeight:600,cursor:'pointer',marginBottom:8}}>+ Νέο</button>
                </div>
                {calls.length===0&&<div style={{padding:'20px',textAlign:'center',color:C.muted,fontSize:13,background:C.subtle,borderRadius:12,marginBottom:16}}>Δεν υπάρχουν τηλεφωνήματα</div>}
                {calls.map((c,i)=>(
                  <div key={c.id} style={{background:C.white,borderRadius:12,border:'1px solid '+C.border,padding:'14px 16px',marginBottom:10}}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}><span style={{fontSize:12,fontWeight:700,color:C.muted}}>Κλήση {i+1}</span><button onClick={()=>setCalls(x=>x.filter(y=>y.id!==c.id))} style={{background:'none',border:'none',color:C.red,cursor:'pointer',fontSize:12}}>✕</button></div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                      <Field label="Καλών" value={c.caller_name} onChange={v=>updCall(c.id,'caller_name',v)}/>
                      <Field label="Τηλέφωνο" value={c.caller_phone} onChange={v=>updCall(c.id,'caller_phone',v)} type="tel"/>
                      <Field label="Ημερομηνία" value={c.call_date} onChange={v=>updCall(c.id,'call_date',v)} type="date"/>
                      <Sel label="Ενδιαφέρον" value={c.interest_level} onChange={v=>updCall(c.id,'interest_level',v)} options={[{value:'high',label:'Υψηλό'},{value:'medium',label:'Μέτριο'},{value:'low',label:'Χαμηλό'}]}/>
                    </div>
                    <Txt label="Σχόλια" value={c.notes} onChange={v=>updCall(c.id,'notes',v)} rows={2}/>
                  </div>
                ))}
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12,marginTop:4}}>
                  <Sec>Γραπτές Προσφορές ({offers.length})</Sec>
                  <button onClick={addOffer} style={{background:C.dark,color:'#fff',border:'none',borderRadius:8,padding:'6px 14px',fontSize:12,fontWeight:600,cursor:'pointer',marginBottom:8}}>+ Νέα</button>
                </div>
                {offers.length===0&&<div style={{padding:'20px',textAlign:'center',color:C.muted,fontSize:13,background:C.subtle,borderRadius:12}}>Δεν υπάρχουν προσφορές</div>}
                {offers.map((o,i)=>(
                  <div key={o.id} style={{background:o.status==='accepted'?C.greenLight:C.white,borderRadius:12,border:'1px solid '+(o.status==='accepted'?'#BBF7D0':C.border),padding:'14px 16px',marginBottom:10}}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}><span style={{fontSize:12,fontWeight:700,color:C.muted}}>Προσφορά {i+1}</span><button onClick={()=>setOffers(x=>x.filter(y=>y.id!==o.id))} style={{background:'none',border:'none',color:C.red,cursor:'pointer',fontSize:12}}>✕</button></div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                      <Field label="Αγοραστής" value={o.buyer_name} onChange={v=>updOffer(o.id,'buyer_name',v)}/>
                      <Field label="Τηλέφωνο" value={o.buyer_phone} onChange={v=>updOffer(o.id,'buyer_phone',v)} type="tel"/>
                      <Field label="Ημερ/νία" value={o.offer_date} onChange={v=>updOffer(o.id,'offer_date',v)} type="date"/>
                      <Field label="Ποσό (€)" value={o.offer_amount} onChange={v=>updOffer(o.id,'offer_amount',v)} type="number"/>
                      <Sel label="Κατάσταση" value={o.status} onChange={v=>updOffer(o.id,'status',v)} options={[{value:'pending',label:'Αναμονή'},{value:'accepted',label:'Αποδεκτή'},{value:'rejected',label:'Απορρίφθηκε'},{value:'countered',label:'Αντιπροσφορά'}]}/>
                      <Field label="Αντιπροσφορά (€)" value={o.counter_amount} onChange={v=>updOffer(o.id,'counter_amount',v)} type="number"/>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {phase==='closing'&&(
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:24}}>
              <div>
                <Sec>Αγοραστής</Sec>
                <PersonBlock title="Στοιχεία Αγοραστή" data={buyer} onChange={setBuyer}/>
                <Sec>Δικηγόρος Αγοραστή</Sec>
                <PersonBlock title="Στοιχεία Δικηγόρου" data={buyerLawyer} onChange={setBuyerLawyer}/>
                <Sec>Συμβολαιογράφος</Sec>
                <PersonBlock title="Στοιχεία Συμβολαιογράφου" data={notary} onChange={setNotary}/>
              </div>
              <div>
                <Sec>Προσύμφωνο</Sec>
                <div style={{background:C.white,borderRadius:12,border:'1px solid '+C.border,padding:'16px',marginBottom:16}}>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                    <Field label="Ημερομηνία" value={closing.pre_agreement_date} onChange={sc('pre_agreement_date')} type="date"/>
                    <Field label="Προκαταβολή (€)" value={closing.pre_agreement_amount} onChange={sc('pre_agreement_amount')} type="number"/>
                  </div>
                </div>
                <Sec>Τελικό Συμβόλαιο</Sec>
                <div style={{background:C.greenLight,borderRadius:12,border:'1px solid #BBF7D0',padding:'16px',marginBottom:16}}>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                    <Field label="Ημερομηνία" value={closing.contract_date} onChange={sc('contract_date')} type="date"/>
                    <Field label="Τελική τιμή (€)" value={closing.price_final} onChange={sc('price_final')} type="number"/>
                    <Field label="Αμοιβή γραφείου (€)" value={closing.commission_earned} onChange={sc('commission_earned')} type="number"/>
                  </div>
                  {closing.price_final&&closing.pre_agreement_amount&&(
                    <div style={{marginTop:10,padding:'10px 12px',borderRadius:8,background:'#fff'}}>
                      <div style={{fontSize:10,color:C.muted,marginBottom:2}}>Υπόλοιπο</div>
                      <div style={{fontSize:18,fontWeight:800,color:C.green}}>€{(parseFloat(closing.price_final||0)-parseFloat(closing.pre_agreement_amount||0)).toLocaleString()}</div>
                    </div>
                  )}
                </div>
                {closing.price_final&&(
                  <div style={{background:C.dark,borderRadius:12,padding:'16px 18px',color:'#fff'}}>
                    <div style={{fontSize:10,fontWeight:600,color:'rgba(255,255,255,.5)',textTransform:'uppercase',letterSpacing:.8,marginBottom:12}}>Σύνοψη Συναλλαγής</div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                      <div><div style={{fontSize:10,color:'rgba(255,255,255,.4)'}}>Τιμή ζήτησης</div><div style={{fontSize:16,fontWeight:700}}>€{parseFloat(p.price_asking||0).toLocaleString()}</div></div>
                      <div><div style={{fontSize:10,color:'rgba(255,255,255,.4)'}}>Τελική τιμή</div><div style={{fontSize:16,fontWeight:700,color:'#6EE7B7'}}>€{parseFloat(closing.price_final||0).toLocaleString()}</div></div>
                      <div><div style={{fontSize:10,color:'rgba(255,255,255,.4)'}}>Έκπτωση</div><div style={{fontSize:16,fontWeight:700,color:'#FCD34D'}}>{p.price_asking?Math.round((1-parseFloat(closing.price_final)/parseFloat(p.price_asking))*100)+'%':'—'}</div></div>
                      <div><div style={{fontSize:10,color:'rgba(255,255,255,.4)'}}>Αμοιβή</div><div style={{fontSize:16,fontWeight:700,color:'#6EE7B7'}}>€{parseFloat(closing.commission_earned||0).toLocaleString()}</div></div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}