'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'

const C = {red:'#CC2229',redLight:'#FDF2F2',dark:'#1A1A1A',muted:'#6B7280',border:'#EBEBEB',subtle:'#F7F7F7',white:'#FFFFFF',green:'#16A34A',greenLight:'#F0FDF4',amber:'#D97706',blue:'#2563EB',purple:'#7C3AED'}

// Mock data — θα αντικατασταθεί από Supabase
const MOCK_OPEN_HOUSES = [
  {id:1,agent_name:'Κώστας Μ.',agent_initials:'ΚΜ',property_address:'Λεωφ. Βουλιαγμένης 142',area:'Γλυφάδα',ilist_code:'1554776',property_type:'Διαμέρισμα',sqm:95,price:270000,date:'2026-06-14',time_start:'11:00',time_end:'14:00',notes:'Ανακαινισμένο, θέα θάλασσα. Parking.',created_at:'2026-06-09'},
  {id:2,agent_name:'Μαρία Π.',agent_initials:'ΜΠ',property_address:'Κηφισίας 210',area:'Χαλάνδρι',ilist_code:'1554800',property_type:'Διαμέρισμα',sqm:78,price:225000,date:'2026-06-14',time_start:'12:00',time_end:'15:00',notes:'Άριστη κατάσταση, 2 υπνοδωμάτια.',created_at:'2026-06-09'},
  {id:3,agent_name:'Νίκος Κ.',agent_initials:'ΝΚ',property_address:'Ερμού 33',area:'Κολωνάκι',ilist_code:'1554820',property_type:'Γραφείο',sqm:110,price:430000,date:'2026-06-21',time_start:'10:00',time_end:'13:00',notes:'5ος όροφος, πλήρως εξοπλισμένο.',created_at:'2026-06-09'},
  {id:4,agent_name:'Γιώργος Σ.',agent_initials:'ΓΣ',property_address:'Φιλελλήνων 28',area:'Γλυφάδα',ilist_code:'1554835',property_type:'Μονοκατοικία',sqm:180,price:520000,date:'2026-06-21',time_start:'11:00',time_end:'14:00',notes:'Κήπος 200τμ, πισίνα.',created_at:'2026-06-09'},
]

const MOCK_ANNOUNCEMENTS = [
  {id:1,agent_name:'Κώστας Μ.',agent_initials:'ΚΜ',type:'listing',title:'Νέα Αποκλειστική Ανάθεση',body:'Ανέλαβα αποκλειστική ανάθεση μεζονέτας 200τμ στη Βούλα. Τιμή €650.000. Αν έχετε αγοραστή επικοινωνήστε μαζί μου.',created_at:'2026-06-09T10:00:00Z'},
  {id:2,agent_name:'Μαρία Π.',agent_initials:'ΜΠ',type:'buyer',title:'Ψάχνω για πελάτη',body:'Πελάτης μου ψάχνει διαμέρισμα 80-100τμ στο Παγκράτι ή Νέο Κόσμο. Budget €200.000. Σχεδόν αποκλειστικά αγορά.',created_at:'2026-06-08T15:00:00Z'},
  {id:3,agent_name:'Γιώργος Σ.',agent_initials:'ΓΣ',type:'collab',title:'Συνεργασία σε ακίνητο',body:'Έχω αποκλειστική ανάθεση καταστήματος 150τμ στο Μαρούσι. Αν έχετε εκμισθωτή ή αγοραστή μοιραζόμαστε προμήθεια.',created_at:'2026-06-07T09:00:00Z'},
]

const AVCOLORS = ['#CC2229','#2563EB','#16A34A','#D97706','#7C3AED','#0891B2']

function Av({initials,size=36,idx=0}){
  return <div style={{width:size,height:size,borderRadius:'50%',background:AVCOLORS[idx%AVCOLORS.length]+'22',display:'flex',alignItems:'center',justifyContent:'center',fontSize:size*.3,fontWeight:700,color:AVCOLORS[idx%AVCOLORS.length],flexShrink:0}}>{initials}</div>
}

function timeAgo(iso){
  const d=new Date(iso),now=new Date()
  const diff=Math.round((now-d)/60000)
  if(diff<60) return diff+'λ. πριν'
  if(diff<1440) return Math.round(diff/60)+'ω. πριν'
  return Math.round(diff/1440)+'μ. πριν'
}

function formatDate(dateStr){
  const d=new Date(dateStr+'T00:00:00')
  return d.toLocaleDateString('el-GR',{weekday:'long',day:'numeric',month:'long'})
}

const TYPE_COLOR = {listing:C.red,buyer:C.blue,collab:C.green,other:C.muted}
const TYPE_LABEL = {listing:'Ανάθεση',buyer:'Ζήτηση',collab:'Συνεργασία',other:'Άλλο'}

export default function BoardPage(){
  const [user,setUser]=useState(null)
  const [loading,setLoading]=useState(true)
  const [tab,setTab]=useState('openhouse')
  const [openHouses,setOpenHouses]=useState(MOCK_OPEN_HOUSES)
  const [announcements,setAnnouncements]=useState(MOCK_ANNOUNCEMENTS)
  const [showNewOH,setShowNewOH]=useState(false)
  const [showNewAnn,setShowNewAnn]=useState(false)
  const [saving,setSaving]=useState(false)
  const [saved,setSaved]=useState(false)

  const [newOH,setNewOH]=useState({property_address:'',area:'',ilist_code:'',property_type:'Διαμέρισμα',sqm:'',price:'',date:'',time_start:'',time_end:'',notes:''})
  const [newAnn,setNewAnn]=useState({type:'listing',title:'',body:''})

  useEffect(()=>{supabase.auth.getUser().then(({data:d})=>{if(!d.user){window.location.href='/login';return};setUser(d.user);setLoading(false)})},[])

  function Field({label,value,onChange,type='text',placeholder=''}){
    return (
      <div style={{marginBottom:10}}>
        <label style={{fontSize:10,fontWeight:600,color:C.muted,display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:.4}}>{label}</label>
        <input type={type} value={value||''} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
          style={{width:'100%',padding:'8px 10px',borderRadius:8,border:'1px solid '+C.border,fontSize:13,background:'#FAFAFA',color:C.dark,boxSizing:'border-box'}}/>
      </div>
    )
  }

  async function saveOH(){
    setSaving(true)
    const entry = {
      ...newOH, id:Date.now(),
      agent_name:'Νίκος Κ.', agent_initials:'ΝΚ',
      created_at:new Date().toISOString().split('T')[0]
    }
    // TODO: supabase.from('open_houses').insert(entry)
    setOpenHouses(h=>[entry,...h])
    setNewOH({property_address:'',area:'',ilist_code:'',property_type:'Διαμέρισμα',sqm:'',price:'',date:'',time_start:'',time_end:'',notes:''})
    setSaving(false); setSaved(true); setShowNewOH(false)
    setTimeout(()=>setSaved(false),3000)
  }

  async function saveAnn(){
    setSaving(true)
    const entry = {
      ...newAnn, id:Date.now(),
      agent_name:'Νίκος Κ.', agent_initials:'ΝΚ',
      created_at:new Date().toISOString()
    }
    setAnnouncements(a=>[entry,...a])
    setNewAnn({type:'listing',title:'',body:''})
    setSaving(false); setShowNewOH(false); setShowNewAnn(false)
  }

  // Group open houses by date
  const ohByDate = openHouses.reduce((acc,oh)=>{
    if(!acc[oh.date]) acc[oh.date]=[]
    acc[oh.date].push(oh)
    return acc
  },{})

  if(loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'#F4F4F4'}}><span style={{fontSize:13,color:C.muted}}>Φόρτωση...</span></div>

  return (
    <div style={{display:'flex',minHeight:'100vh',background:'#F4F4F4',fontFamily:"-apple-system,BlinkMacSystemFont,'Inter',sans-serif",color:C.dark}}>
      <Sidebar/>
      <div style={{marginLeft:64,flex:1,padding:'28px 32px',overflowY:'auto'}}>

        {/* Hero */}
        <div style={{background:C.dark,borderRadius:20,padding:'24px 28px',color:'#fff',display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24}}>
          <div>
            <p style={{fontSize:11,fontWeight:600,color:'rgba(255,255,255,.4)',letterSpacing:.8,textTransform:'uppercase',margin:'0 0 6px'}}>KWAC</p>
            <h1 style={{fontSize:22,fontWeight:700,margin:'0 0 4px',letterSpacing:-.5}}>Πίνακας Ανακοινώσεων</h1>
            <p style={{fontSize:13,color:'rgba(255,255,255,.5)',margin:0}}>Open Houses · Αναθέσεις · Ζητήσεις · Συνεργασίες</p>
          </div>
          <div style={{display:'flex',gap:10}}>
            <div style={{background:'rgba(255,255,255,.08)',borderRadius:12,padding:'10px 18px',textAlign:'center'}}>
              <div style={{fontSize:22,fontWeight:800,color:C.amber}}>{openHouses.length}</div>
              <div style={{fontSize:10,color:'rgba(255,255,255,.4)',fontWeight:600,marginTop:2}}>OPEN HOUSES</div>
            </div>
            <div style={{background:C.red,borderRadius:12,padding:'10px 18px',textAlign:'center'}}>
              <div style={{fontSize:22,fontWeight:800}}>{announcements.length}</div>
              <div style={{fontSize:10,color:'rgba(255,255,255,.7)',fontWeight:600,marginTop:2}}>ΑΝΑΚΟΙΝΩΣΕΙΣ</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{display:'flex',gap:8,marginBottom:20}}>
          {[{id:'openhouse',label:'🏠 Open Houses'},{id:'announcements',label:'📢 Ανακοινώσεις'}].map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{padding:'10px 20px',borderRadius:10,border:'1px solid '+(tab===t.id?C.dark:C.border),background:tab===t.id?C.dark:C.white,color:tab===t.id?'#fff':C.muted,fontSize:13,fontWeight:600,cursor:'pointer',transition:'all .15s'}}>
              {t.label}
            </button>
          ))}
        </div>

        {/* OPEN HOUSES TAB */}
        {tab==='openhouse'&&(
          <div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <div>
                <h2 style={{fontSize:15,fontWeight:700,margin:'0 0 4px'}}>Προγραμματισμένα Open Houses</h2>
                <p style={{fontSize:12,color:C.muted,margin:0}}>Καταχώρησε το Open House σου — φαίνεται σε όλη την ομάδα</p>
              </div>
              <button onClick={()=>setShowNewOH(!showNewOH)} style={{background:C.red,color:'#fff',border:'none',borderRadius:10,padding:'10px 20px',fontSize:13,fontWeight:600,cursor:'pointer'}}>
                {showNewOH?'✕ Ακύρωση':'+ Νέο Open House'}
              </button>
            </div>

            {/* New OH Form */}
            {showNewOH&&(
              <div style={{background:C.white,borderRadius:16,border:'1px solid '+C.border,padding:'20px 24px',marginBottom:20,boxShadow:'0 2px 12px rgba(0,0,0,.06)'}}>
                <h3 style={{fontSize:14,fontWeight:700,margin:'0 0 16px',color:C.dark}}>Νέο Open House</h3>
                <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr',gap:12,marginBottom:8}}>
                  <Field label="Διεύθυνση ακινήτου *" value={newOH.property_address} onChange={v=>setNewOH(x=>({...x,property_address:v}))} placeholder="π.χ. Βουλιαγμένης 142, Γλυφάδα"/>
                  <Field label="Κωδικός i-list" value={newOH.ilist_code} onChange={v=>setNewOH(x=>({...x,ilist_code:v}))} placeholder="π.χ. 1554776"/>
                  <Field label="Περιοχή" value={newOH.area} onChange={v=>setNewOH(x=>({...x,area:v}))} placeholder="π.χ. Γλυφάδα"/>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:12,marginBottom:8}}>
                  <Field label="Ημερομηνία *" value={newOH.date} onChange={v=>setNewOH(x=>({...x,date:v}))} type="date"/>
                  <Field label="Ώρα έναρξης *" value={newOH.time_start} onChange={v=>setNewOH(x=>({...x,time_start:v}))} type="time"/>
                  <Field label="Ώρα λήξης *" value={newOH.time_end} onChange={v=>setNewOH(x=>({...x,time_end:v}))} type="time"/>
                  <Field label="Τ.μ." value={newOH.sqm} onChange={v=>setNewOH(x=>({...x,sqm:v}))} type="number" placeholder="π.χ. 95"/>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:16}}>
                  <Field label="Τιμή (€)" value={newOH.price} onChange={v=>setNewOH(x=>({...x,price:v}))} type="number" placeholder="π.χ. 270000"/>
                  <Field label="Σημειώσεις" value={newOH.notes} onChange={v=>setNewOH(x=>({...x,notes:v}))} placeholder="Ανακαινισμένο, parking, θέα..."/>
                </div>
                <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
                  <button onClick={()=>setShowNewOH(false)} style={{padding:'10px 18px',borderRadius:8,border:'1px solid '+C.border,background:C.white,fontSize:13,fontWeight:500,cursor:'pointer',color:C.muted}}>Ακύρωση</button>
                  <button onClick={saveOH} disabled={!newOH.property_address||!newOH.date||!newOH.time_start} style={{padding:'10px 22px',borderRadius:8,border:'none',background:newOH.property_address&&newOH.date&&newOH.time_start?C.red:C.muted,color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer'}}>
                    {saving?'Αποθήκευση...':'Δημοσίευση'}
                  </button>
                </div>
              </div>
            )}

            {/* OH by date */}
            {Object.entries(ohByDate).sort(([a],[b])=>a>b?1:-1).map(([date,items])=>(
              <div key={date} style={{marginBottom:20}}>
                <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
                  <div style={{width:8,height:8,borderRadius:'50%',background:C.red,flexShrink:0}}/>
                  <h3 style={{fontSize:13,fontWeight:700,color:C.dark,margin:0,textTransform:'capitalize'}}>{formatDate(date)}</h3>
                  <span style={{fontSize:11,color:C.muted,background:C.subtle,padding:'2px 8px',borderRadius:99}}>{items.length} open house</span>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:12}}>
                  {items.map((oh,i)=>(
                    <div key={oh.id} style={{background:C.white,borderRadius:16,border:'1px solid '+C.border,padding:'16px 18px',boxShadow:'0 1px 4px rgba(0,0,0,.04)',position:'relative',overflow:'hidden'}}>
                      <div style={{position:'absolute',top:0,left:0,width:4,height:'100%',background:C.red,borderRadius:'4px 0 0 4px'}}/>
                      <div style={{paddingLeft:8}}>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
                          <div style={{flex:1}}>
                            <div style={{fontSize:14,fontWeight:700,color:C.dark,marginBottom:2}}>{oh.property_address}</div>
                            <div style={{fontSize:12,color:C.muted}}>{oh.area} · {oh.property_type}</div>
                          </div>
                          <div style={{background:C.redLight,borderRadius:8,padding:'6px 10px',textAlign:'center',flexShrink:0,marginLeft:10}}>
                            <div style={{fontSize:13,fontWeight:800,color:C.red}}>{oh.time_start}</div>
                            <div style={{fontSize:10,color:C.red,fontWeight:500}}>— {oh.time_end}</div>
                          </div>
                        </div>
                        <div style={{display:'flex',gap:10,marginBottom:10}}>
                          {oh.ilist_code&&<span style={{fontSize:11,background:C.subtle,padding:'3px 8px',borderRadius:6,color:C.muted,fontWeight:500}}>i-list: {oh.ilist_code}</span>}
                          {oh.sqm&&<span style={{fontSize:11,background:C.subtle,padding:'3px 8px',borderRadius:6,color:C.muted,fontWeight:500}}>{oh.sqm}τ.μ.</span>}
                          {oh.price&&<span style={{fontSize:11,background:C.greenLight,padding:'3px 8px',borderRadius:6,color:C.green,fontWeight:700}}>€{parseInt(oh.price).toLocaleString()}</span>}
                        </div>
                        {oh.notes&&<div style={{fontSize:12,color:C.muted,marginBottom:12,lineHeight:1.5}}>{oh.notes}</div>}
                        <div style={{display:'flex',alignItems:'center',gap:8,paddingTop:8,borderTop:'1px solid '+C.border}}>
                          <Av initials={oh.agent_initials} size={24} idx={i}/>
                          <span style={{fontSize:12,fontWeight:500,color:C.dark}}>{oh.agent_name}</span>
                          <span style={{fontSize:11,color:C.muted,marginLeft:'auto'}}>{oh.created_at}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ANNOUNCEMENTS TAB */}
        {tab==='announcements'&&(
          <div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <div>
                <h2 style={{fontSize:15,fontWeight:700,margin:'0 0 4px'}}>Ανακοινώσεις Ομάδας</h2>
                <p style={{fontSize:12,color:C.muted,margin:0}}>Αναθέσεις, ζητήσεις, συνεργασίες — αντί για Viber</p>
              </div>
              <button onClick={()=>setShowNewAnn(!showNewAnn)} style={{background:C.dark,color:'#fff',border:'none',borderRadius:10,padding:'10px 20px',fontSize:13,fontWeight:600,cursor:'pointer'}}>
                {showNewAnn?'✕ Ακύρωση':'+ Νέα Ανακοίνωση'}
              </button>
            </div>

            {/* New Ann Form */}
            {showNewAnn&&(
              <div style={{background:C.white,borderRadius:16,border:'1px solid '+C.border,padding:'20px 24px',marginBottom:20,boxShadow:'0 2px 12px rgba(0,0,0,.06)'}}>
                <h3 style={{fontSize:14,fontWeight:700,margin:'0 0 16px'}}>Νέα Ανακοίνωση</h3>
                <div style={{display:'flex',gap:8,marginBottom:12}}>
                  {Object.entries(TYPE_LABEL).map(([v,l])=>(
                    <button key={v} onClick={()=>setNewAnn(x=>({...x,type:v}))} style={{padding:'7px 14px',borderRadius:99,border:'1px solid '+(newAnn.type===v?TYPE_COLOR[v]:C.border),background:newAnn.type===v?TYPE_COLOR[v]+'15':C.white,color:newAnn.type===v?TYPE_COLOR[v]:C.muted,fontSize:12,fontWeight:600,cursor:'pointer'}}>
                      {l}
                    </button>
                  ))}
                </div>
                <Field label="Τίτλος *" value={newAnn.title} onChange={v=>setNewAnn(x=>({...x,title:v}))} placeholder="π.χ. Νέα αποκλειστική ανάθεση στη Γλυφάδα"/>
                <div style={{marginBottom:12}}>
                  <label style={{fontSize:10,fontWeight:600,color:C.muted,display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:.4}}>Μήνυμα *</label>
                  <textarea value={newAnn.body||''} onChange={e=>setNewAnn(x=>({...x,body:e.target.value}))} rows={4}
                    placeholder="Περιέγραψε την ανακοίνωση..."
                    style={{width:'100%',padding:'9px 12px',borderRadius:8,border:'1px solid '+C.border,fontSize:13,background:'#FAFAFA',color:C.dark,boxSizing:'border-box',resize:'vertical'}}/>
                </div>
                <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
                  <button onClick={()=>setShowNewAnn(false)} style={{padding:'10px 18px',borderRadius:8,border:'1px solid '+C.border,background:C.white,fontSize:13,cursor:'pointer',color:C.muted}}>Ακύρωση</button>
                  <button onClick={saveAnn} disabled={!newAnn.title||!newAnn.body} style={{padding:'10px 22px',borderRadius:8,border:'none',background:newAnn.title&&newAnn.body?C.dark:C.muted,color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer'}}>
                    Δημοσίευση
                  </button>
                </div>
              </div>
            )}

            {/* Announcements list */}
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              {announcements.map((ann,i)=>(
                <div key={ann.id} style={{background:C.white,borderRadius:16,border:'1px solid '+C.border,padding:'16px 20px',boxShadow:'0 1px 4px rgba(0,0,0,.04)',position:'relative',overflow:'hidden'}}>
                  <div style={{position:'absolute',top:0,left:0,width:4,height:'100%',background:TYPE_COLOR[ann.type]||C.muted,borderRadius:'4px 0 0 4px'}}/>
                  <div style={{paddingLeft:10}}>
                    <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
                      <Av initials={ann.agent_initials} size={32} idx={i}/>
                      <div style={{flex:1}}>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <span style={{fontSize:13,fontWeight:600,color:C.dark}}>{ann.agent_name}</span>
                          <span style={{fontSize:10,fontWeight:700,color:TYPE_COLOR[ann.type],background:TYPE_COLOR[ann.type]+'15',padding:'2px 8px',borderRadius:99}}>{TYPE_LABEL[ann.type]}</span>
                        </div>
                        <span style={{fontSize:11,color:C.muted}}>{timeAgo(ann.created_at)}</span>
                      </div>
                    </div>
                    <div style={{fontSize:14,fontWeight:700,color:C.dark,marginBottom:6}}>{ann.title}</div>
                    <div style={{fontSize:13,color:C.muted,lineHeight:1.6}}>{ann.body}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}