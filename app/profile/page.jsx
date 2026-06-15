"use client";
import{useState,useEffect,useRef}from"react";
const SB="https://yihnycafoaemoambrdfd.supabase.co";
const AK="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpaG55Y2Fmb2FlbW9hbWJyZGZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4NDU2NTQsImV4cCI6MjA5NjQyMTY1NH0.hZVtBbnPEwd_aInDrMiXrLTHSIWlWNimPRfAOC9O66A";
const RED="#CC2229";

function Map({properties}){
  const ref=useRef(null);
  const mapRef=useRef(null);
  useEffect(()=>{
    if(!ref.current||mapRef.current)return;
    // Dynamic import Leaflet only on client
    import("leaflet").then(L=>{
      // Fix default icon
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({iconRetinaUrl:"https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",iconUrl:"https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",shadowUrl:"https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png"});
      const map=L.map(ref.current).setView([37.97,23.73],11);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:"© OpenStreetMap"}).addTo(map);
      mapRef.current=map;
      const redIcon=L.divIcon({html:'<div style="width:12px;height:12px;background:#CC2229;border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3)"></div>',iconSize:[12,12],iconAnchor:[6,6],className:""});
      const blueIcon=L.divIcon({html:'<div style="width:12px;height:12px;background:#3b82f6;border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3)"></div>',iconSize:[12,12],iconAnchor:[6,6],className:""});
      properties.forEach(p=>{
        if(!p.lat||!p.lng)return;
        const icon=p.transaction_type==="sale"?redIcon:blueIcon;
        L.marker([parseFloat(p.lat),parseFloat(p.lng)],{icon}).addTo(map)
          .bindPopup("<b>"+p.property_type+"</b><br>"+p.area+(p.sqm?" · "+p.sqm+"τμ":"")+(p.price?"<br>€"+parseInt(p.price).toLocaleString("el-GR"):""));
      });
      setTimeout(()=>map.invalidateSize(),200);
    });
    return()=>{if(mapRef.current){mapRef.current.remove();mapRef.current=null;}};
  },[properties]);

  return(<>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"/>
    <div ref={ref} style={{width:"100%",height:"100%",borderRadius:12}}/>
  </>);
}

export default function ProfilePage(){
  const[props,setProps]=useState([]);const[loading,setLoading]=useState(true);const[filter,setFilter]=useState("all");const[search,setSearch]=useState("");
  useEffect(()=>{
    fetch(SB+"/rest/v1/properties?select=*&order=created_at.desc&limit=200",{headers:{apikey:AK,Authorization:"Bearer "+AK}})
      .then(r=>r.json()).then(d=>{setProps(Array.isArray(d)?d:[]);setLoading(false);}).catch(()=>setLoading(false));
  },[]);

  const filtered=props.filter(p=>{
    if(filter==="sale"&&p.transaction_type!=="sale")return false;
    if(filter==="rental"&&p.transaction_type!=="rental")return false;
    if(filter==="active"&&p.status!=="Διαθέσιμο")return false;
    if(search&&!((p.area||"").toLowerCase().includes(search.toLowerCase())||(p.address||"").toLowerCase().includes(search.toLowerCase())))return false;
    return true;
  });

  const fmt=n=>Math.round(n||0).toLocaleString("el-GR");

  return(<div style={{fontFamily:"system-ui",color:"#1a1a1a"}}>
    <div style={{padding:"24px 40px 16px",borderBottom:"1px solid #e5e5e5",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
      <div>
        <div style={{fontSize:11,fontWeight:600,letterSpacing:".12em",color:RED,textTransform:"uppercase",marginBottom:4}}>Ακίνητα</div>
        <h1 style={{margin:0,fontSize:20,fontWeight:700,color:"#1a1a1a"}}>Χάρτης ακινήτων</h1>
      </div>
      <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Αναζήτηση περιοχής..." style={{padding:"8px 14px",borderRadius:8,border:"1.5px solid #e5e5e5",fontSize:13,outline:"none",width:200}}/>
        {[["all","Όλα",props.length],["sale","Πωλήσεις",props.filter(p=>p.transaction_type==="sale").length],["rental","Ενοικιάσεις",props.filter(p=>p.transaction_type==="rental").length],["active","Διαθέσιμα",props.filter(p=>p.status==="Διαθέσιμο").length]].map(([k,l,c])=>(
          <button key={k} onClick={()=>setFilter(k)} style={{padding:"7px 14px",borderRadius:20,border:"1.5px solid",borderColor:filter===k?RED:"#e5e5e5",background:filter===k?RED:"white",color:filter===k?"white":"#666",cursor:"pointer",fontSize:12,fontWeight:500}}>
            {l} <span style={{opacity:.7}}>({c})</span>
          </button>
        ))}
        <a href="/import" style={{padding:"8px 16px",borderRadius:8,background:RED,color:"white",textDecoration:"none",fontSize:12,fontWeight:600}}>+ Import</a>
      </div>
    </div>

    <div style={{display:"grid",gridTemplateColumns:"340px 1fr",height:"calc(100vh - 120px)"}}>
      {/* List */}
      <div style={{borderRight:"1px solid #e5e5e5",overflowY:"auto",background:"#fafafa"}}>
        {loading&&<div style={{padding:24,textAlign:"center",color:"#999",fontSize:13}}>Φόρτωση...</div>}
        {!loading&&filtered.length===0&&<div style={{padding:24,textAlign:"center",color:"#999",fontSize:13}}>Δεν βρέθηκαν ακίνητα</div>}
        {filtered.map((p,i)=>(<div key={p.id||i} style={{padding:"14px 16px",borderBottom:"1px solid #efefef",cursor:"pointer",background:"white",transition:"background .1s"}} onMouseEnter={e=>e.currentTarget.style.background="#fef2f2"} onMouseLeave={e=>e.currentTarget.style.background="white"}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:4}}>
            <div style={{fontWeight:500,fontSize:13,color:"#1a1a1a"}}>{p.property_type||"—"} · {p.sqm?""+p.sqm+"τμ":"—"}</div>
            <span style={{fontSize:10,padding:"2px 8px",borderRadius:20,background:p.transaction_type==="sale"?"rgba(204,34,41,0.08)":"rgba(59,130,246,0.08)",color:p.transaction_type==="sale"?RED:"#3b82f6",fontWeight:500,flexShrink:0}}>{p.transaction_type==="sale"?"Πώληση":"Ενοικίαση"}</span>
          </div>
          <div style={{fontSize:12,color:"#999"}}>{p.area||"—"}{p.address?(" · "+p.address.substring(0,30)):""}  </div>
          {p.price&&<div style={{fontSize:13,fontWeight:600,color:RED,marginTop:4}}>€{fmt(p.price)}</div>}
          <div style={{display:"flex",gap:6,marginTop:6}}>
            {p.ilist_url&&<a href={p.ilist_url} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} style={{fontSize:10,color:RED,border:"1px solid #fecaca",borderRadius:4,padding:"2px 6px",textDecoration:"none"}}>iList ↗</a>}
            {p.maps_url&&<a href={p.maps_url} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} style={{fontSize:10,color:"#666",border:"1px solid #e5e5e5",borderRadius:4,padding:"2px 6px",textDecoration:"none"}}>Maps ↗</a>}
          </div>
        </div>))}
      </div>

      {/* Map */}
      <div style={{position:"relative",background:"#f0f0f0"}}>
        {!loading&&<Map properties={filtered}/>}
        {loading&&<div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100%",color:"#999",fontSize:13}}>Φόρτωση χάρτη...</div>}
        {/* Legend */}
        <div style={{position:"absolute",bottom:16,right:16,background:"white",borderRadius:8,padding:"10px 14px",border:"1px solid #e5e5e5",fontSize:12,zIndex:1000}}>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
            <div style={{width:10,height:10,borderRadius:"50%",background:RED,flexShrink:0}}/>
            <span style={{color:"#666"}}>Πώληση</span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <div style={{width:10,height:10,borderRadius:"50%",background:"#3b82f6",flexShrink:0}}/>
            <span style={{color:"#666"}}>Ενοικίαση</span>
          </div>
        </div>
        {/* Stats */}
        <div style={{position:"absolute",top:16,right:16,background:"white",borderRadius:8,padding:"10px 16px",border:"1px solid #e5e5e5",fontSize:12,zIndex:1000}}>
          <div style={{color:"#999",marginBottom:2}}>Εμφανίζονται</div>
          <div style={{fontSize:18,fontWeight:700,color:"#1a1a1a"}}>{filtered.length}</div>
          <div style={{color:"#999",fontSize:11}}>ακίνητα</div>
        </div>
      </div>
    </div>
  </div>);}
