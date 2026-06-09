'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import Link from 'next/link'
import OpenHouseModal from '@/components/OpenHouseModal'

const C = {red:'#CC2229',redLight:'#FDF2F2',dark:'#1A1A1A',muted:'#6B7280',border:'#EBEBEB',subtle:'#F7F7F7',white:'#FFFFFF',green:'#16A34A',greenLight:'#F0FDF4',amber:'#D97706',blue:'#2563EB'}

const ALL_PROPS = [
  {id:'p1',address:'Λεωφ. Βουλιαγμένης 142, Γλυφάδα',area:'Γλυφάδα',deal_type:'sale',status:'sold',property_type:'Διαμέρισμα',sqm:95,floor:3,year_built:1998,condition:'good',price_asking:285000,price_final:270000,ilist_code:'1554776',listed_at:'2024-09-01',sold_at:'2024-11-15',lat:37.8638,lng:23.7536},
  {id:'p2',address:'Κηφισίας 210, Χαλάνδρι',area:'Χαλάνδρι',deal_type:'sale',status:'sold',property_type:'Διαμέρισμα',sqm:78,floor:2,year_built:2005,condition:'excellent',price_asking:230000,price_final:225000,ilist_code:'1554800',listed_at:'2024-10-01',sold_at:'2025-01-20',lat:38.0186,lng:23.8001},
  {id:'p3',address:'Πανεπιστημίου 45, Κέντρο',area:'Κέντρο',deal_type:'rental',status:'rented',property_type:'Γραφείο',sqm:120,floor:4,year_built:1980,condition:'good',price_asking:2200,price_final:2000,ilist_code:'1554810',listed_at:'2024-11-01',sold_at:'2024-12-01',lat:37.9755,lng:23.7348},
  {id:'p4',address:'Αχαρνών 88, Κυψέλη',area:'Κυψέλη',deal_type:'sale',status:'active',property_type:'Διαμέρισμα',sqm:65,floor:1,year_built:1975,condition:'needs_renovation',price_asking:140000,price_final:null,ilist_code:'1554820',listed_at:'2025-01-15',sold_at:null,lat:37.9952,lng:23.7391},
  {id:'p5',address:'Φιλελλήνων 12, Γλυφάδα',area:'Γλυφάδα',deal_type:'rental',status:'rented',property_type:'Διαμέρισμα',sqm:85,floor:2,year_built:2010,condition:'excellent',price_asking:1400,price_final:1350,ilist_code:'1554830',listed_at:'2024-12-01',sold_at:'2025-01-05',lat:37.8700,lng:23.7520},
  {id:'p6',address:'Ερμού 33, Κολωνάκι',area:'Κολωνάκι',deal_type:'sale',status:'sold',property_type:'Μεζονέτα',sqm:110,floor:5,year_built:2001,condition:'excellent',price_asking:450000,price_final:430000,ilist_code:'1554840',listed_at:'2024-07-01',sold_at:'2024-10-20',lat:37.9795,lng:23.7378},
  {id:'p7',address:'Αγίου Δημητρίου 55, Άγιος Δημήτριος',area:'Άγιος Δημήτριος',deal_type:'sale',status:'active',property_type:'Διαμέρισμα',sqm:92,floor:3,year_built:2008,condition:'good',price_asking:195000,price_final:null,ilist_code:'1554850',listed_at:'2025-02-01',sold_at:null,lat:37.9302,lng:23.7356},
  {id:'p8',address:'Θησέως 18, Καλλιθέα',area:'Καλλιθέα',deal_type:'rental',status:'active',property_type:'Διαμέρισμα',sqm:58,floor:1,year_built:1990,condition:'fair',price_asking:680,price_final:null,ilist_code:'1554860',listed_at:'2025-03-01',sold_at:null,lat:37.9559,lng:23.7014},
]
const COND={excellent:'Άριστη',good:'Καλή',fair:'Μέτρια',needs_renovation:'Ανακαίνιση'}
const ST_COLOR={sold:C.green,rented:C.blue,active:C.amber}
const ST_LABEL={sold:'Πωλήθηκε',rented:'Ενοικιάστηκε',active:'Ενεργό'}
const MAP_FILTERS=[
  {id:'all',label:'Όλα',fn:()=>true},
  {id:'sale_done',label:'Πωλήσεις',fn:p=>p.deal_type==='sale'&&p.status==='sold'},
  {id:'rental_done',label:'Ενοικιάσεις',fn:p=>p.deal_type==='rental'&&p.status==='rented'},
  {id:'active',label:'Διαθέσιμα',fn:p=>p.status==='active'},
]

export default function ProfilePage(){
  const [user,setUser]=useState(null)
  const [loading,setLoading]=useState(true)
  const [selected,setSelected]=useState(null)
  const [mapFilter,setMapFilter]=useState('all')
  const [searchInput,setSearchInput]=useState('')
  const [search,setSearch]=useState('')
  const [ohProp,setOhProp]=useState(null) // property για το OpenHouse modal
  const mapRef=useRef(null)
  const mapInst=useRef(null)
  const markersRef=useRef([])
  const leafletLoaded=useRef(false)

  useEffect(()=>{supabase.auth.getUser().then(({data:d})=>{if(!d.user){window.location.href='/login';return};setUser(d.user);setLoading(false)})},[])

  const filterFn=MAP_FILTERS.find(f=>f.id===mapFilter)?.fn||(()=>true)
  const filtered=ALL_PROPS.filter(p=>{
    if(!filterFn(p)) return false
    if(!search) return true
    const q=search.toLowerCase()
    return p.address.toLowerCase().includes(q)||p.area.toLowerCase().includes(q)
  })

  function addMarkers(map,props){
    if(!window.L) return
    const L=window.L
    markersRef.current.forEach(m=>{try{m.remove()}catch(e){}})
    markersRef.current=[]
    props.forEach(p=>{
      if(!p.lat||!p.lng) return
      const col=p.status==='active'?C.amber:p.deal_type==='sale'?C.red:C.blue
      const em=p.deal_type==='sale'?'🏠':'🔑'
      const icon=L.divIcon({className:'',html:'<div style="width:36px;height:36px;border-radius:50%;background:'+col+';border:3px solid white;box-shadow:0 3px 10px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;font-size:17px;cursor:pointer;">'+em+'</div>',iconSize:[36,36],iconAnchor:[18,18]})
      const mk=L.marker([p.lat,p.lng],{icon})
      mk.on('click',()=>setSelected(prev=>prev?.id===p.id?null:p))
      mk.addTo(map)
      markersRef.current.push(mk)
    })
  }

  useEffect(()=>{
    if(!document.getElementById('leaflet-css')){const l=document.createElement('link');l.id='leaflet-css';l.rel='stylesheet';l.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';document.head.appendChild(l)}
    function init(){
      if(!mapRef.current||mapInst.current) return
      const L=window.L
      const map=L.map(mapRef.current)
      map.setView([37.940,23.750],11)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap',maxZoom:19}).addTo(map)
      mapInst.current=map
      addMarkers(map,ALL_PROPS)
      setTimeout(()=>map.invalidateSize(),400)
    }
    if(window.L) init()
    else if(!leafletLoaded.current){
      leafletLoaded.current=true
      const s=document.createElement('script');s.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';s.onload=init;document.head.appendChild(s)
    }
    return()=>{if(mapInst.current){mapInst.current.remove();mapInst.current=null}}
  },[])

  useEffect(()=>{if(mapInst.current) addMarkers(mapInst.current,filtered)},[filtered])

  function handleSearch(e){
    e.preventDefault()
    setSearch(searchInput)
    if(searchInput&&mapInst.current){
      fetch('https://nominatim.openstreetmap.org/search?q='+encodeURIComponent(searchInput+' Αθήνα')+'&format=json&limit=1')
        .then(r=>r.json()).then(data=>{
          if(data?.[0]&&mapInst.current) mapInst.current.setView([parseFloat(data[0].lat),parseFloat(data[0].lon)],14)
        }).catch(()=>{})
    }
  }

  const sold=ALL_PROPS.filter(p=>p.status==='sold')
  const rented=ALL_PROPS.filter(p=>p.status==='rented')
  const active=ALL_PROPS.filter(p=>p.status==='active')
  const avgPrice=sold.length?Math.round(sold.reduce((s,p)=>s+(p.price_final||0),0)/sold.length):0
  const avgDaysArr=sold.filter(p=>p.sold_at&&p.listed_at).map(p=>Math.round((new Date(p.sold_at)-new Date(p.listed_at))/864e5))
  const avgDays=avgDaysArr.length?Math.round(avgDaysArr.reduce((a,b)=>a+b,0)/avgDaysArr.length):0

  if(loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'#F4F4F4'}}><span style={{fontSize:13,color:C.muted}}>Φόρτωση...</span></div>

  return (
    <div style={{display:'flex',minHeight:'100vh',background:'#F4F4F4',fontFamily:"-apple-system,BlinkMacSystemFont,'Inter',sans-serif",color:C.dark}}>
      <Sidebar/>

      {/* OpenHouse Modal */}
      {ohProp&&<OpenHouseModal property={ohProp} onClose={()=>setOhProp(null)} onSaved={()=>setOhProp(null)}/>}

      <div style={{marginLeft:64,flex:1,padding:'28px 32px',overflowY:'auto'}}>

        {/* Hero */}
        <div style={{background:C.dark,borderRadius:20,padding:'24px 28px',color:'#fff',display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24}}>
          <div>
            <p style={{fontSize:11,fontWeight:600,color:'rgba(255,255,255,.4)',letterSpacing:.8,textTransform:'uppercase',margin:'0 0 6px'}}>Προφίλ Agent</p>
            <h1 style={{fontSize:22,fontWeight:700,margin:'0 0 4px',letterSpacing:-.5}}>Νίκος Καραμανλής</h1>
            <p style={{fontSize:13,color:'rgba(255,255,255,.5)',margin:0}}>{user?.email} · Level 7 · Sales Warrior</p>
          </div>
          <div style={{display:'flex',gap:10,alignItems:'center'}}>
            <div style={{background:'rgba(255,255,255,.08)',borderRadius:12,padding:'10px 18px',textAlign:'center'}}><div style={{fontSize:22,fontWeight:800}}>{ALL_PROPS.length}</div><div style={{fontSize:10,color:'rgba(255,255,255,.4)',fontWeight:600,marginTop:2}}>ΣΥΝΟΛΟ</div></div>
            <div style={{background:C.red,borderRadius:12,padding:'10px 18px',textAlign:'center'}}><div style={{fontSize:22,fontWeight:800}}>{sold.length+rented.length}</div><div style={{fontSize:10,color:'rgba(255,255,255,.7)',fontWeight:600,marginTop:2}}>ΚΛΕΙΣΙΜΟ</div></div>
            <div style={{background:'rgba(255,255,255,.08)',borderRadius:12,padding:'10px 18px',textAlign:'center'}}><div style={{fontSize:22,fontWeight:800,color:C.amber}}>{active.length}</div><div style={{fontSize:10,color:'rgba(255,255,255,.4)',fontWeight:600,marginTop:2}}>ΕΝΕΡΓΑ</div></div>
            <Link href="/properties/new" style={{background:C.red,borderRadius:12,padding:'10px 18px',textDecoration:'none',color:'#fff',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:2}}>
              <div style={{fontSize:18,fontWeight:800}}>+</div><div style={{fontSize:10,fontWeight:700}}>ΝΕΟ</div>
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:20}}>
          {[{label:'Πωλήσεις',value:sold.length,sub:'ολοκληρωμένες',color:C.red},{label:'Μισθώσεις',value:rented.length,sub:'ολοκληρωμένες',color:C.blue},{label:'Μέση τιμή',value:'€'+avgPrice.toLocaleString(),sub:'τελική τιμή πώλησης',color:C.dark},{label:'Μέσος χρόνος',value:avgDays+' ημ.',sub:'listing → κλείσιμο',color:C.dark}].map((s,i)=>(
            <div key={i} style={{background:C.white,borderRadius:14,padding:'16px 18px',border:'1px solid '+C.border,boxShadow:'0 1px 4px rgba(0,0,0,.04)'}}>
              <div style={{fontSize:11,fontWeight:600,color:C.muted,marginBottom:6}}>{s.label}</div>
              <div style={{fontSize:22,fontWeight:800,color:s.color,letterSpacing:-.5}}>{s.value}</div>
              <div style={{fontSize:11,color:C.muted,marginTop:4}}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Search + Filters */}
        <div style={{display:'flex',gap:10,marginBottom:12,alignItems:'center',flexWrap:'wrap'}}>
          <form onSubmit={handleSearch} style={{display:'flex',gap:8,flex:1,minWidth:260}}>
            <input value={searchInput} onChange={e=>setSearchInput(e.target.value)}
              placeholder="🔍 Αναζήτηση περιοχής ή διεύθυνσης..."
              style={{flex:1,padding:'10px 14px',borderRadius:10,border:'1px solid '+C.border,fontSize:13,background:C.white,outline:'none'}}/>
            <button type="submit" style={{background:C.dark,color:'#fff',border:'none',borderRadius:10,padding:'10px 18px',fontSize:13,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap'}}>Αναζήτηση</button>
            {search&&<button type="button" onClick={()=>{setSearch('');setSearchInput('')}} style={{background:C.subtle,border:'1px solid '+C.border,borderRadius:10,padding:'10px 12px',fontSize:12,cursor:'pointer',color:C.muted}}>✕</button>}
          </form>
          <div style={{display:'flex',gap:6}}>
            {MAP_FILTERS.map(f=>(
              <button key={f.id} onClick={()=>setMapFilter(f.id)} style={{padding:'8px 14px',borderRadius:99,border:'1px solid '+(mapFilter===f.id?C.red:C.border),background:mapFilter===f.id?C.red:C.white,color:mapFilter===f.id?'#fff':C.muted,fontSize:12,fontWeight:600,cursor:'pointer',transition:'all .15s',whiteSpace:'nowrap'}}>
                {f.label} <span style={{opacity:.7,fontSize:10}}>({ALL_PROPS.filter(f.fn).length})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Map + List */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 360px',gap:16,marginBottom:selected?16:0}}>
          <div style={{background:C.white,borderRadius:16,border:'1px solid '+C.border,overflow:'hidden',boxShadow:'0 1px 4px rgba(0,0,0,.04)',minHeight:480}}>
            <div style={{padding:'12px 20px',borderBottom:'1px solid '+C.border,background:C.subtle,display:'flex',gap:16,alignItems:'center'}}>
              <p style={{fontSize:11,fontWeight:700,color:C.muted,letterSpacing:.8,textTransform:'uppercase',margin:0,flex:1}}>Χάρτης · {filtered.length} ακίνητα{search?' · "'+search+'"':''}</p>
              {[{c:C.red,l:'Πώληση'},{c:C.blue,l:'Μίσθωση'},{c:C.amber,l:'Ενεργό'}].map(x=>(
                <span key={x.l} style={{display:'flex',alignItems:'center',gap:4,fontSize:11,color:C.muted}}>
                  <span style={{width:8,height:8,borderRadius:'50%',background:x.c,display:'inline-block'}}/>{x.l}
                </span>
              ))}
            </div>
            <div ref={mapRef} style={{height:430}}/>
          </div>

          <div style={{background:C.white,borderRadius:16,border:'1px solid '+C.border,overflow:'hidden',boxShadow:'0 1px 4px rgba(0,0,0,.04)',display:'flex',flexDirection:'column',maxHeight:480}}>
            <div style={{padding:'12px 16px',borderBottom:'1px solid '+C.border,background:C.subtle,flexShrink:0}}>
              <p style={{fontSize:11,fontWeight:700,color:C.muted,letterSpacing:.8,textTransform:'uppercase',margin:0}}>Λίστα ({filtered.length})</p>
            </div>
            <div style={{overflowY:'auto',flex:1}}>
              {filtered.length===0&&<div style={{padding:'32px 16px',textAlign:'center',color:C.muted,fontSize:13}}>Δεν βρέθηκαν ακίνητα</div>}
              {filtered.map(p=>(
                <div key={p.id} onClick={()=>setSelected(prev=>prev?.id===p.id?null:p)}
                  style={{padding:'12px 16px',borderBottom:'1px solid #F5F5F5',cursor:'pointer',background:selected?.id===p.id?C.redLight:'#fff',transition:'background .15s'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:5}}>
                    <div style={{fontSize:12,fontWeight:600,color:C.dark,flex:1,paddingRight:8,lineHeight:1.4}}>{p.address}</div>
                    <span style={{fontSize:10,fontWeight:700,color:ST_COLOR[p.status],background:ST_COLOR[p.status]+'18',padding:'2px 7px',borderRadius:99,flexShrink:0,whiteSpace:'nowrap'}}>{ST_LABEL[p.status]}</span>
                  </div>
                  <div style={{display:'flex',gap:8,fontSize:11,color:C.muted,alignItems:'center'}}>
                    <span>{p.sqm}τ.μ.</span><span>·</span><span>{p.floor}ος</span><span>·</span>
                    <span style={{fontWeight:700,color:C.dark}}>€{(p.price_final||p.price_asking||0).toLocaleString()}</span>
                    {p.status==='active'&&(
                      <button onClick={e=>{e.stopPropagation();setOhProp(p)}}
                        style={{marginLeft:'auto',background:C.amber,color:'#fff',border:'none',borderRadius:6,padding:'3px 8px',fontSize:10,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap'}}>
                        🏠 Open House
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Detail */}
        {selected&&(
          <div style={{background:C.white,borderRadius:16,border:'1px solid '+C.border,padding:'20px 24px',boxShadow:'0 1px 4px rgba(0,0,0,.04)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16}}>
              <div>
                <h2 style={{fontSize:16,fontWeight:700,margin:'0 0 4px'}}>{selected.address}</h2>
                <p style={{fontSize:13,color:C.muted,margin:0}}>{selected.area} · {selected.deal_type==='sale'?'Πώληση':'Μίσθωση'} · {COND[selected.condition]}{selected.ilist_code&&' · i-list: '+selected.ilist_code}</p>
              </div>
              <div style={{display:'flex',gap:8}}>
                {selected.status==='active'&&(
                  <button onClick={()=>setOhProp(selected)}
                    style={{background:C.amber,color:'#fff',border:'none',borderRadius:8,padding:'8px 16px',fontSize:12,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap'}}>
                    🏠 Open House
                  </button>
                )}
                <Link href={'/properties/'+selected.id} style={{background:C.red,color:'#fff',borderRadius:8,padding:'8px 16px',textDecoration:'none',fontSize:12,fontWeight:600,whiteSpace:'nowrap'}}>📋 Φάκελος</Link>
                <button onClick={()=>setSelected(null)} style={{background:C.subtle,border:'none',borderRadius:8,padding:'8px 14px',cursor:'pointer',fontSize:12,color:C.muted,fontWeight:600}}>✕</button>
              </div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:12,marginBottom:selected.price_final?12:0}}>
              {[{label:'Εμβαδόν',value:selected.sqm+'τ.μ.'},{label:'Όροφος',value:selected.floor+'ος'},{label:'Έτος κατ.',value:selected.year_built},{label:'Τιμή ζήτησης',value:'€'+(selected.price_asking||0).toLocaleString()},{label:'Τιμή/τ.μ.',value:selected.price_final?'€'+Math.round(selected.price_final/selected.sqm).toLocaleString():'—'}].map((s,i)=>(
                <div key={i} style={{background:C.subtle,borderRadius:10,padding:'10px 14px'}}>
                  <div style={{fontSize:10,color:C.muted,fontWeight:600,marginBottom:4,textTransform:'uppercase',letterSpacing:.4}}>{s.label}</div>
                  <div style={{fontSize:15,fontWeight:700}}>{s.value}</div>
                </div>
              ))}
            </div>
            {selected.price_final&&(
              <div style={{padding:'14px 18px',borderRadius:12,background:C.greenLight,display:'flex',gap:24}}>
                <div><div style={{fontSize:10,color:C.muted,fontWeight:600,marginBottom:3,textTransform:'uppercase',letterSpacing:.4}}>Τελική τιμή</div><div style={{fontSize:22,fontWeight:800,color:C.green}}>€{selected.price_final.toLocaleString()}</div></div>
                {selected.sold_at&&selected.listed_at&&<div><div style={{fontSize:10,color:C.muted,fontWeight:600,marginBottom:3,textTransform:'uppercase',letterSpacing:.4}}>Ημέρες αγοράς</div><div style={{fontSize:22,fontWeight:800,color:C.green}}>{Math.round((new Date(selected.sold_at)-new Date(selected.listed_at))/864e5)}</div></div>}
                <div><div style={{fontSize:10,color:C.muted,fontWeight:600,marginBottom:3,textTransform:'uppercase',letterSpacing:.4}}>Έκπτωση</div><div style={{fontSize:22,fontWeight:800,color:C.green}}>{Math.round((1-selected.price_final/selected.price_asking)*100)}%</div></div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}