'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'

const C = {
  red:'#CC2229',redLight:'#FDF2F2',dark:'#1A1A1A',
  muted:'#6B7280',border:'#EBEBEB',subtle:'#F7F7F7',white:'#FFFFFF',
  green:'#16A34A',greenLight:'#F0FDF4',amber:'#D97706',
}

const MOCK_PROPERTIES = [
  {id:1,address:'Λεωφ. Βουλιαγμένης 142, Γλυφάδα',area:'Γλυφάδα',deal_type:'sale',status:'sold',sqm:95,floor:3,year_built:1998,condition:'good',price_asking:285000,price_final:270000,listed_at:'2024-09-01',sold_at:'2024-11-15',lat:37.8638,lng:23.7536},
  {id:2,address:'Κηφισίας 210, Χαλάνδρι',area:'Χαλάνδρι',deal_type:'sale',status:'sold',sqm:78,floor:2,year_built:2005,condition:'excellent',price_asking:230000,price_final:225000,listed_at:'2024-10-01',sold_at:'2025-01-20',lat:38.0186,lng:23.8001},
  {id:3,address:'Πανεπιστημίου 45, Κέντρο',area:'Κέντρο',deal_type:'rental',status:'rented',sqm:120,floor:4,year_built:1980,condition:'good',price_asking:2200,price_final:2000,listed_at:'2024-11-01',sold_at:'2024-12-01',lat:37.9755,lng:23.7348},
  {id:4,address:'Αχαρνών 88, Κυψέλη',area:'Κυψέλη',deal_type:'sale',status:'active',sqm:65,floor:1,year_built:1975,condition:'needs_renovation',price_asking:140000,price_final:null,listed_at:'2025-01-15',sold_at:null,lat:37.9952,lng:23.7391},
  {id:5,address:'Φιλελλήνων 12, Γλυφάδα',area:'Γλυφάδα',deal_type:'rental',status:'rented',sqm:85,floor:2,year_built:2010,condition:'excellent',price_asking:1400,price_final:1350,listed_at:'2024-12-01',sold_at:'2025-01-05',lat:37.8700,lng:23.7520},
  {id:6,address:'Ερμού 33, Κολωνάκι',area:'Κολωνάκι',deal_type:'sale',status:'sold',sqm:110,floor:5,year_built:2001,condition:'excellent',price_asking:450000,price_final:430000,listed_at:'2024-07-01',sold_at:'2024-10-20',lat:37.9795,lng:23.7378},
]

const CONDITION_LABEL = {excellent:'Άριστη',good:'Καλή',fair:'Μέτρια',needs_renovation:'Χρειάζεται ανακαίνιση'}
const STATUS_COLOR = {sold:C.green,rented:C.green,active:C.amber,withdrawn:C.muted}
const STATUS_LABEL = {sold:'Πωλήθηκε',rented:'Ενοικιάστηκε',active:'Ενεργό',withdrawn:'Αποσύρθηκε'}

function Bar({value,max,color,h=4}){const p=Math.min(100,Math.round(value/max*100));return <div style={{background:'#E9E9E9',borderRadius:99,height:h,overflow:'hidden'}}><div style={{width:p+'%',height:h,background:color,borderRadius:99}}/></div>}

function StatCard({label,value,sub,color=C.dark}){
  return (
    <div style={{background:C.white,borderRadius:14,padding:'16px 18px',border:'1px solid '+C.border}}>
      <div style={{fontSize:11,fontWeight:600,color:C.muted,marginBottom:6}}>{label}</div>
      <div style={{fontSize:24,fontWeight:800,color,letterSpacing:-1}}>{value}</div>
      {sub&&<div style={{fontSize:11,color:C.muted,marginTop:4}}>{sub}</div>}
    </div>
  )
}

export default function ProfilePage(){
  const [user,setUser]=useState(null)
  const [props,setProps]=useState(MOCK_PROPERTIES)
  const [selected,setSelected]=useState(null)
  const [filter,setFilter]=useState('all')
  const mapRef=useRef(null)
  const mapInstance=useRef(null)
  const markersRef=useRef([])

  useEffect(()=>{
    supabase.auth.getUser().then(({data})=>{
      if(!data.user){window.location.href='/login';return}
      setUser(data.user)
    })
  },[])

  // Load Leaflet dynamically
  useEffect(()=>{
    if(typeof window==='undefined') return
    const link=document.createElement('link')
    link.rel='stylesheet'
    link.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    document.head.appendChild(link)
    const script=document.createElement('script')
    script.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    script.onload=()=>initMap()
    document.head.appendChild(script)
    return()=>{
      if(mapInstance.current){mapInstance.current.remove();mapInstance.current=null}
    }
  },[])

  function initMap(){
    if(!mapRef.current||mapInstance.current) return
    const L=window.L
    const map=L.map(mapRef.current,{zoomControl:true}).setView([37.9755,23.7348],12)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap',maxZoom:19}).addTo(map)
    mapInstance.current=map
    addMarkers(map,MOCK_PROPERTIES)
  }

  function addMarkers(map,properties){
    const L=window.L
    markersRef.current.forEach(m=>m.remove())
    markersRef.current=[]
    properties.forEach(p=>{
      if(!p.lat||!p.lng) return
      const isSale=p.deal_type==='sale'
      const isActive=p.status==='active'
      const color=isActive?'#D97706':isSale?'#CC2229':'#2563EB'
      const icon=L.divIcon({
        className:'',
        html:`<div style="width:32px;height:32px;border-radius:50% 50% 50% 0;background:${color};border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.25);transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;">
          <div style="transform:rotate(45deg);color:white;font-size:14px;">${isSale?'🏠':'🔑'}</div>
        </div>`,
        iconSize:[32,32],iconAnchor:[16,32],popupAnchor:[0,-36]
      })
      const marker=L.marker([p.lat,p.lng],{icon})
      marker.on('click',()=>setSelected(p))
      marker.addTo(map)
      markersRef.current.push(marker)
    })
  }

  const filtered=filter==='all'?props:props.filter(p=>p.deal_type===filter||(filter==='active'&&p.status==='active'))
  const sold=props.filter(p=>p.status==='sold')
  const rented=props.filter(p=>p.status==='rented')
  const active=props.filter(p=>p.status==='active')
  const avgSalePrice=sold.length?Math.round(sold.reduce((s,p)=>s+(p.price_final||0),0)/sold.length):0
  const avgDays=sold.filter(p=>p.sold_at&&p.listed_at).map(p=>{
    const d1=new Date(p.listed_at),d2=new Date(p.sold_at)
    return Math.round((d2-d1)/(1000*60*60*24))
  })
  const avgDaysOnMarket=avgDays.length?Math.round(avgDays.reduce((a,b)=>a+b,0)/avgDays.length):0

  if(!user) return <div style={{padding:40,textAlign:'center',fontSize:14,color:'#999'}}>Φόρτωση...</div>

  return (
    <div style={{display:'flex',minHeight:'100vh',background:'#F4F4F4',fontFamily:"-apple-system,BlinkMacSystemFont,'Inter',sans-serif",color:C.dark}}>
      {/* Sidebar */}
      <div style={{width:64,background:'#111',display:'flex',flexDirection:'column',alignItems:'center',paddingTop:16,paddingBottom:16,gap:4,position:'fixed',top:0,left:0,height:'100vh',zIndex:10}}>
        <div style={{color:'#fff',fontWeight:800,fontSize:12,marginBottom:18,letterSpacing:1,textAlign:'center',lineHeight:1.2}}>KW<br/><span style={{color:C.red}}>AC</span></div>
        {[{icon:'⊞',label:'Dashboard',href:'/dashboard'},{icon:'📍',label:'Προφίλ',href:'/profile',active:true},{icon:'💎',label:'Εκτίμηση',href:'/valuation'}].map((it,i)=>(
          <a key={i} href={it.href} style={{width:48,height:48,borderRadius:10,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:2,background:it.active?'rgba(255,255,255,.12)':'transparent',color:it.active?'#fff':'rgba(255,255,255,.35)',fontSize:16,textDecoration:'none',transition:'all .15s'}}>
            <span>{it.icon}</span><span style={{fontSize:7,fontWeight:600}}>{it.label}</span>
          </a>
        ))}
      </div>

      <div style={{marginLeft:64,flex:1,padding:'28px 32px',overflowY:'auto'}}>
        {/* Header */}
        <div style={{background:C.dark,borderRadius:20,padding:'24px 28px',color:'#fff',display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24}}>
          <div>
            <p style={{fontSize:11,fontWeight:600,color:'rgba(255,255,255,.4)',letterSpacing:.8,textTransform:'uppercase',margin:'0 0 6px'}}>Προφίλ Agent</p>
            <h1 style={{fontSize:22,fontWeight:700,margin:'0 0 4px',letterSpacing:-.5}}>Νίκος Καραμανλής</h1>
            <p style={{fontSize:13,color:'rgba(255,255,255,.5)',margin:0}}>n.karamanlis@kwac.gr · Level 7 · Sales Warrior</p>
          </div>
          <div style={{display:'flex',gap:10}}>
            <div style={{background:'rgba(255,255,255,.08)',borderRadius:12,padding:'10px 18px',textAlign:'center'}}><div style={{fontSize:22,fontWeight:800}}>{props.length}</div><div style={{fontSize:10,color:'rgba(255,255,255,.4)',fontWeight:600,marginTop:2}}>ΣΥΝΑΛΛΑΓΕΣ</div></div>
            <div style={{background:C.red,borderRadius:12,padding:'10px 18px',textAlign:'center'}}><div style={{fontSize:22,fontWeight:800}}>{sold.length+rented.length}</div><div style={{fontSize:10,color:'rgba(255,255,255,.7)',fontWeight:600,marginTop:2}}>ΚΛΕΙΣΙΜΟ</div></div>
          </div>
        </div>

        {/* Stats */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:24}}>
          <StatCard label="Πωλήσεις" value={sold.length} sub="ολοκληρωμένες" color={C.red}/>
          <StatCard label="Μισθώσεις" value={rented.length} sub="ολοκληρωμένες" color='#2563EB'/>
          <StatCard label="Μέση τιμή πώλησης" value={'€'+avgSalePrice.toLocaleString()} sub="τελική τιμή"/>
          <StatCard label="Μέσος χρόνος" value={avgDaysOnMarket+' μέρες'} sub="από listing ώς πώληση"/>
        </div>

        {/* Map + List */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 380px',gap:16,marginBottom:24}}>
          {/* Map */}
          <div style={{background:C.white,borderRadius:16,border:'1px solid '+C.border,overflow:'hidden',boxShadow:'0 1px 4px rgba(0,0,0,.04)'}}>
            <div style={{padding:'14px 20px',borderBottom:'1px solid '+C.border,background:C.subtle,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <p style={{fontSize:11,fontWeight:700,color:C.muted,letterSpacing:.8,textTransform:'uppercase',margin:0}}>Χάρτης ακινήτων</p>
              <div style={{display:'flex',gap:16,fontSize:11,color:C.muted}}>
                <span>🏠 Πώληση</span><span>🔑 Μίσθωση</span>
                <span style={{color:C.red}}>● Πωλήθηκε/Ενοικιάστηκε</span>
                <span style={{color:C.amber}}>● Ενεργό</span>
              </div>
            </div>
            <div ref={mapRef} style={{height:420}}/>
          </div>

          {/* Property list */}
          <div style={{background:C.white,borderRadius:16,border:'1px solid '+C.border,overflow:'hidden',boxShadow:'0 1px 4px rgba(0,0,0,.04)'}}>
            <div style={{padding:'14px 18px',borderBottom:'1px solid '+C.border,background:C.subtle}}>
              <p style={{fontSize:11,fontWeight:700,color:C.muted,letterSpacing:.8,textTransform:'uppercase',margin:'0 0 10px'}}>Ακίνητα</p>
              <div style={{display:'flex',gap:6}}>
                {[{id:'all',label:'Όλα'},{id:'sale',label:'Πωλήσεις'},{id:'rental',label:'Μισθώσεις'},{id:'active',label:'Ενεργά'}].map(f=>(
                  <button key={f.id} onClick={()=>setFilter(f.id)} style={{padding:'4px 10px',borderRadius:99,border:'1px solid '+(filter===f.id?C.red:C.border),background:filter===f.id?C.red:'transparent',color:filter===f.id?'#fff':C.muted,fontSize:11,fontWeight:600,cursor:'pointer'}}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{overflowY:'auto',maxHeight:376}}>
              {filtered.map(p=>(
                <div key={p.id} onClick={()=>setSelected(p===selected?null:p)} style={{padding:'12px 16px',borderBottom:'1px solid #F5F5F5',cursor:'pointer',background:selected?.id===p.id?C.redLight:'#fff',transition:'background .15s'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:4}}>
                    <div style={{fontSize:12,fontWeight:600,color:C.dark,flex:1,paddingRight:8}}>{p.address}</div>
                    <span style={{fontSize:10,fontWeight:700,color:STATUS_COLOR[p.status],background:STATUS_COLOR[p.status]+'15',padding:'2px 8px',borderRadius:99,flexShrink:0}}>{STATUS_LABEL[p.status]}</span>
                  </div>
                  <div style={{display:'flex',gap:12,fontSize:11,color:C.muted}}>
                    <span>{p.sqm} τ.μ.</span>
                    <span>{p.floor}ος όροφος</span>
                    <span>{p.year_built}</span>
                    <span style={{fontWeight:600,color:C.dark}}>€{(p.price_final||p.price_asking).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Selected property detail */}
        {selected&&(
          <div style={{background:C.white,borderRadius:16,border:'1px solid '+C.border,padding:'20px 24px',boxShadow:'0 1px 4px rgba(0,0,0,.04)',marginBottom:16}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16}}>
              <div>
                <h2 style={{fontSize:16,fontWeight:700,margin:'0 0 4px'}}>{selected.address}</h2>
                <p style={{fontSize:13,color:C.muted,margin:0}}>{selected.area} · {selected.deal_type==='sale'?'Πώληση':'Μίσθωση'}</p>
              </div>
              <button onClick={()=>setSelected(null)} style={{background:C.subtle,border:'none',borderRadius:8,padding:'6px 12px',cursor:'pointer',fontSize:12,color:C.muted}}>✕ Κλείσιμο</button>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:12}}>
              {[
                {label:'Εμβαδόν',value:selected.sqm+' τ.μ.'},
                {label:'Όροφος',value:selected.floor+'ος'},
                {label:'Έτος κατ.',value:selected.year_built},
                {label:'Κατάσταση',value:CONDITION_LABEL[selected.condition]||selected.condition},
                {label:'Τιμή ζήτησης',value:'€'+(selected.price_asking||0).toLocaleString()},
              ].map((s,i)=>(
                <div key={i} style={{background:C.subtle,borderRadius:10,padding:'10px 14px'}}>
                  <div style={{fontSize:10,color:C.muted,fontWeight:600,marginBottom:4}}>{s.label}</div>
                  <div style={{fontSize:14,fontWeight:700}}>{s.value}</div>
                </div>
              ))}
            </div>
            {selected.price_final&&(
              <div style={{marginTop:12,padding:'12px 16px',borderRadius:10,background:C.greenLight,display:'flex',gap:20}}>
                <div><div style={{fontSize:10,color:C.muted,fontWeight:600,marginBottom:2}}>ΤΕΛΙΚΗ ΤΙΜΗ</div><div style={{fontSize:18,fontWeight:800,color:C.green}}>€{selected.price_final.toLocaleString()}</div></div>
                <div><div style={{fontSize:10,color:C.muted,fontWeight:600,marginBottom:2}}>ΤΙΜΗ/Τ.Μ.</div><div style={{fontSize:18,fontWeight:800,color:C.green}}>€{Math.round(selected.price_final/selected.sqm).toLocaleString()}</div></div>
                {selected.sold_at&&selected.listed_at&&<div><div style={{fontSize:10,color:C.muted,fontWeight:600,marginBottom:2}}>ΗΜΕΡΕΣ ΣΤΗ ΑΓΟΡΑ</div><div style={{fontSize:18,fontWeight:800,color:C.green}}>{Math.round((new Date(selected.sold_at)-new Date(selected.listed_at))/(1000*60*60*24))}</div></div>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}