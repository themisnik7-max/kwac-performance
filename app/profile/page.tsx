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
const STATUS_COLOR = {sold:C.green,rented:'#2563EB',active:C.amber,withdrawn:C.muted}
const STATUS_LABEL = {sold:'Πωλήθηκε',rented:'Ενοικιάστηκε',active:'Ενεργό',withdrawn:'Αποσύρθηκε'}

function Bar({value,max,color,h=4}){
  const p=Math.min(100,Math.round(value/max*100))
  return <div style={{background:'#E9E9E9',borderRadius:99,height:h,overflow:'hidden'}}><div style={{width:p+'%',height:h,background:color,borderRadius:99}}/></div>
}

function LeafletMap({properties, onSelect, selected}) {
  const mapRef = useRef(null)
  const mapInstance = useRef(null)
  const markersRef = useRef([])
  const leafletLoaded = useRef(false)

  useEffect(() => {
    // Inject CSS
    if(!document.getElementById('leaflet-css')) {
      const link = document.createElement('link')
      link.id = 'leaflet-css'
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
    }

    function initMap() {
      if(!mapRef.current || mapInstance.current) return
      const L = window.L
      const map = L.map(mapRef.current, {zoomControl:true, scrollWheelZoom:true})
      map.setView([37.9400, 23.7500], 11)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution:'© OpenStreetMap contributors', maxZoom:19
      }).addTo(map)
      mapInstance.current = map

      // Add markers
      properties.forEach(p => {
        if(!p.lat || !p.lng) return
        const isSale = p.deal_type === 'sale'
        const isActive = p.status === 'active'
        const bgColor = isActive ? C.amber : isSale ? C.red : '#2563EB'
        const icon = L.divIcon({
          className: '',
          html: '<div style="width:36px;height:36px;border-radius:50%;background:' + bgColor + ';border:3px solid white;box-shadow:0 3px 10px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;font-size:16px;cursor:pointer;">' + (isSale ? '🏠' : '🔑') + '</div>',
          iconSize: [36,36],
          iconAnchor: [18,18],
        })
        const marker = L.marker([p.lat, p.lng], {icon})
        marker.on('click', () => onSelect(p))
        marker.addTo(map)
        markersRef.current.push(marker)
      })

      // Force resize after mount
      setTimeout(() => map.invalidateSize(), 300)
    }

    if(window.L) {
      initMap()
    } else if(!leafletLoaded.current) {
      leafletLoaded.current = true
      const script = document.createElement('script')
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
      script.onload = initMap
      document.head.appendChild(script)
    }

    return () => {
      if(mapInstance.current) {
        mapInstance.current.remove()
        mapInstance.current = null
      }
    }
  }, [])

  return (
    <div style={{position:'relative',height:'100%',minHeight:420}}>
      <div ref={mapRef} style={{width:'100%',height:'100%',minHeight:420,borderRadius:'0 0 16px 16px'}}/>
    </div>
  )
}

export default function ProfilePage() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    supabase.auth.getUser().then(({data}) => {
      if(!data.user) { window.location.href = '/login'; return }
      setUser(data.user)
      setLoading(false)
    })
  }, [])

  const filtered = filter === 'all' ? MOCK_PROPERTIES
    : filter === 'active' ? MOCK_PROPERTIES.filter(p => p.status === 'active')
    : MOCK_PROPERTIES.filter(p => p.deal_type === filter)

  const sold = MOCK_PROPERTIES.filter(p => p.status === 'sold')
  const rented = MOCK_PROPERTIES.filter(p => p.status === 'rented')
  const active = MOCK_PROPERTIES.filter(p => p.status === 'active')

  const avgSalePrice = sold.length
    ? Math.round(sold.reduce((s,p) => s+(p.price_final||0), 0) / sold.length)
    : 0

  const avgDaysArr = sold
    .filter(p => p.sold_at && p.listed_at)
    .map(p => Math.round((new Date(p.sold_at) - new Date(p.listed_at)) / (1000*60*60*24)))
  const avgDays = avgDaysArr.length ? Math.round(avgDaysArr.reduce((a,b) => a+b, 0) / avgDaysArr.length) : 0

  if(loading) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'#F4F4F4'}}>
      <div style={{fontSize:13,color:C.muted}}>Φόρτωση...</div>
    </div>
  )

  return (
    <div style={{display:'flex',minHeight:'100vh',background:'#F4F4F4',fontFamily:"-apple-system,BlinkMacSystemFont,'Inter',sans-serif",color:C.dark}}>

      {/* Sidebar */}
      <div style={{width:64,background:'#111',display:'flex',flexDirection:'column',alignItems:'center',paddingTop:16,paddingBottom:16,gap:4,position:'fixed',top:0,left:0,height:'100vh',zIndex:100}}>
        <div style={{color:'#fff',fontWeight:800,fontSize:12,marginBottom:18,letterSpacing:1,textAlign:'center',lineHeight:1.2}}>KW<br/><span style={{color:C.red}}>AC</span></div>
        {[
          {icon:'⊞',label:'Dashboard',href:'/dashboard'},
          {icon:'📍',label:'Προφίλ',href:'/profile',active:true},
          {icon:'💎',label:'Εκτίμηση',href:'/valuation'},
        ].map((it,i) => (
          <a key={i} href={it.href} style={{width:48,height:48,borderRadius:10,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:2,background:it.active?'rgba(255,255,255,.12)':'transparent',color:it.active?'#fff':'rgba(255,255,255,.35)',fontSize:16,textDecoration:'none'}}>
            <span>{it.icon}</span><span style={{fontSize:7,fontWeight:600}}>{it.label}</span>
          </a>
        ))}
      </div>

      {/* Main */}
      <div style={{marginLeft:64,flex:1,padding:'28px 32px',overflowY:'auto'}}>

        {/* Hero */}
        <div style={{background:C.dark,borderRadius:20,padding:'24px 28px',color:'#fff',display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24}}>
          <div>
            <p style={{fontSize:11,fontWeight:600,color:'rgba(255,255,255,.4)',letterSpacing:.8,textTransform:'uppercase',margin:'0 0 6px'}}>Προφίλ Agent</p>
            <h1 style={{fontSize:22,fontWeight:700,margin:'0 0 4px',letterSpacing:-.5}}>Νίκος Καραμανλής</h1>
            <p style={{fontSize:13,color:'rgba(255,255,255,.5)',margin:0}}>{user?.email} · Level 7 · Sales Warrior</p>
          </div>
          <div style={{display:'flex',gap:10}}>
            <div style={{background:'rgba(255,255,255,.08)',borderRadius:12,padding:'10px 18px',textAlign:'center'}}>
              <div style={{fontSize:22,fontWeight:800}}>{MOCK_PROPERTIES.length}</div>
              <div style={{fontSize:10,color:'rgba(255,255,255,.4)',fontWeight:600,marginTop:2}}>ΣΥΝΑΛΛΑΓΕΣ</div>
            </div>
            <div style={{background:C.red,borderRadius:12,padding:'10px 18px',textAlign:'center'}}>
              <div style={{fontSize:22,fontWeight:800}}>{sold.length+rented.length}</div>
              <div style={{fontSize:10,color:'rgba(255,255,255,.7)',fontWeight:600,marginTop:2}}>ΚΛΕΙΣΙΜΟ</div>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:24}}>
          {[
            {label:'Πωλήσεις',value:sold.length,sub:'ολοκληρωμένες',color:C.red},
            {label:'Μισθώσεις',value:rented.length,sub:'ολοκληρωμένες',color:'#2563EB'},
            {label:'Μέση τιμή πώλησης',value:'€'+avgSalePrice.toLocaleString(),sub:'τελική τιμή',color:C.dark},
            {label:'Μέσος χρόνος',value:avgDays+' μέρες',sub:'από listing ώς κλείσιμο',color:C.dark},
          ].map((s,i) => (
            <div key={i} style={{background:C.white,borderRadius:14,padding:'16px 18px',border:'1px solid '+C.border,boxShadow:'0 1px 4px rgba(0,0,0,.04)'}}>
              <div style={{fontSize:11,fontWeight:600,color:C.muted,marginBottom:6}}>{s.label}</div>
              <div style={{fontSize:22,fontWeight:800,color:s.color,letterSpacing:-.5}}>{s.value}</div>
              <div style={{fontSize:11,color:C.muted,marginTop:4}}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Map + List side by side */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 360px',gap:16,marginBottom:selected?16:0}}>

          {/* Map card */}
          <div style={{background:C.white,borderRadius:16,border:'1px solid '+C.border,overflow:'hidden',boxShadow:'0 1px 4px rgba(0,0,0,.04)',minHeight:480}}>
            <div style={{padding:'14px 20px',borderBottom:'1px solid '+C.border,background:C.subtle,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <p style={{fontSize:11,fontWeight:700,color:C.muted,letterSpacing:.8,textTransform:'uppercase',margin:0}}>Χάρτης ακινήτων</p>
              <div style={{display:'flex',gap:14,fontSize:11,color:C.muted,alignItems:'center'}}>
                <span style={{display:'flex',alignItems:'center',gap:4}}><span style={{width:10,height:10,borderRadius:'50%',background:C.red,display:'inline-block'}}/> Πώληση</span>
                <span style={{display:'flex',alignItems:'center',gap:4}}><span style={{width:10,height:10,borderRadius:'50%',background:'#2563EB',display:'inline-block'}}/> Μίσθωση</span>
                <span style={{display:'flex',alignItems:'center',gap:4}}><span style={{width:10,height:10,borderRadius:'50%',background:C.amber,display:'inline-block'}}/> Ενεργό</span>
              </div>
            </div>
            <LeafletMap properties={MOCK_PROPERTIES} onSelect={setSelected} selected={selected}/>
          </div>

          {/* List card */}
          <div style={{background:C.white,borderRadius:16,border:'1px solid '+C.border,overflow:'hidden',boxShadow:'0 1px 4px rgba(0,0,0,.04)',display:'flex',flexDirection:'column'}}>
            <div style={{padding:'14px 16px',borderBottom:'1px solid '+C.border,background:C.subtle,flexShrink:0}}>
              <p style={{fontSize:11,fontWeight:700,color:C.muted,letterSpacing:.8,textTransform:'uppercase',margin:'0 0 10px'}}>Ακίνητα ({filtered.length})</p>
              <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
                {[{id:'all',label:'Όλα'},{id:'sale',label:'Πωλήσεις'},{id:'rental',label:'Μισθώσεις'},{id:'active',label:'Ενεργά'}].map(f => (
                  <button key={f.id} onClick={()=>setFilter(f.id)} style={{padding:'4px 10px',borderRadius:99,border:'1px solid '+(filter===f.id?C.red:C.border),background:filter===f.id?C.red:'transparent',color:filter===f.id?'#fff':C.muted,fontSize:11,fontWeight:600,cursor:'pointer',transition:'all .15s'}}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{overflowY:'auto',flex:1}}>
              {filtered.map(p => (
                <div key={p.id} onClick={()=>setSelected(selected?.id===p.id?null:p)}
                  style={{padding:'12px 16px',borderBottom:'1px solid #F5F5F5',cursor:'pointer',background:selected?.id===p.id?C.redLight:'#fff',transition:'background .15s'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:5}}>
                    <div style={{fontSize:12,fontWeight:600,color:C.dark,flex:1,paddingRight:8,lineHeight:1.4}}>{p.address}</div>
                    <span style={{fontSize:10,fontWeight:700,color:STATUS_COLOR[p.status],background:STATUS_COLOR[p.status]+'18',padding:'2px 7px',borderRadius:99,flexShrink:0,whiteSpace:'nowrap'}}>
                      {STATUS_LABEL[p.status]}
                    </span>
                  </div>
                  <div style={{display:'flex',gap:10,fontSize:11,color:C.muted,alignItems:'center'}}>
                    <span>{p.sqm} τ.μ.</span>
                    <span>·</span>
                    <span>{p.floor}ος όρ.</span>
                    <span>·</span>
                    <span style={{fontWeight:700,color:C.dark}}>€{(p.price_final||p.price_asking||0).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Selected detail */}
        {selected && (
          <div style={{background:C.white,borderRadius:16,border:'1px solid '+C.border,padding:'20px 24px',boxShadow:'0 1px 4px rgba(0,0,0,.04)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16}}>
              <div>
                <h2 style={{fontSize:16,fontWeight:700,margin:'0 0 4px'}}>{selected.address}</h2>
                <p style={{fontSize:13,color:C.muted,margin:0}}>{selected.area} · {selected.deal_type==='sale'?'Πώληση':'Μίσθωση'} · {CONDITION_LABEL[selected.condition]||selected.condition}</p>
              </div>
              <button onClick={()=>setSelected(null)} style={{background:C.subtle,border:'none',borderRadius:8,padding:'6px 14px',cursor:'pointer',fontSize:12,color:C.muted,fontWeight:600}}>✕ Κλείσιμο</button>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:12,marginBottom:selected.price_final?12:0}}>
              {[
                {label:'Εμβαδόν',value:selected.sqm+' τ.μ.'},
                {label:'Όροφος',value:selected.floor+'ος'},
                {label:'Έτος κατ.',value:selected.year_built},
                {label:'Τιμή ζήτησης',value:'€'+(selected.price_asking||0).toLocaleString()},
                {label:'Τιμή/τ.μ.',value:selected.price_final?'€'+Math.round(selected.price_final/selected.sqm).toLocaleString():'—'},
              ].map((s,i) => (
                <div key={i} style={{background:C.subtle,borderRadius:10,padding:'10px 14px'}}>
                  <div style={{fontSize:10,color:C.muted,fontWeight:600,marginBottom:4,textTransform:'uppercase',letterSpacing:.4}}>{s.label}</div>
                  <div style={{fontSize:15,fontWeight:700}}>{s.value}</div>
                </div>
              ))}
            </div>
            {selected.price_final && (
              <div style={{padding:'14px 18px',borderRadius:12,background:C.greenLight,display:'flex',gap:24,alignItems:'center'}}>
                <div><div style={{fontSize:10,color:C.muted,fontWeight:600,marginBottom:3,textTransform:'uppercase',letterSpacing:.4}}>Τελική τιμή</div><div style={{fontSize:22,fontWeight:800,color:C.green}}>€{selected.price_final.toLocaleString()}</div></div>
                {selected.sold_at && selected.listed_at && (
                  <div><div style={{fontSize:10,color:C.muted,fontWeight:600,marginBottom:3,textTransform:'uppercase',letterSpacing:.4}}>Ημέρες στην αγορά</div><div style={{fontSize:22,fontWeight:800,color:C.green}}>{Math.round((new Date(selected.sold_at)-new Date(selected.listed_at))/(1000*60*60*24))}</div></div>
                )}
                <div><div style={{fontSize:10,color:C.muted,fontWeight:600,marginBottom:3,textTransform:'uppercase',letterSpacing:.4}}>Διαπραγμάτευση</div><div style={{fontSize:22,fontWeight:800,color:C.green}}>{Math.round((1-selected.price_final/selected.price_asking)*100)}%</div></div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}