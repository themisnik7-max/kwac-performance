"use client";
import{useState,useEffect}from"react";
const SB="https://yihnycafoaemoambrdfd.supabase.co";
const AK="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpaG55Y2Fmb2FlbW9hbWJyZGZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4NDU2NTQsImV4cCI6MjA5NjQyMTY1NH0.hZVtBbnPEwd_aInDrMiXrLTHSIWlWNimPRfAOC9O66A";
const RED="#CC2229";

function MetricCard({label,value,sub,accent}){
return(<div style={{background:"#111",border:"1px solid #1e1e1e",borderRadius:12,padding:"20px 24px",borderLeft:accent?"3px solid "+RED:undefined}}>
  <div style={{fontSize:11,color:"#555",textTransform:"uppercase",letterSpacing:".1em",marginBottom:8}}>{label}</div>
  <div style={{fontSize:28,fontWeight:600,color:accent?RED:"#f0f0f0",letterSpacing:"-0.02em"}}>{value}</div>
  {sub&&<div style={{fontSize:12,color:"#444",marginTop:4}}>{sub}</div>}
</div>);}

function StatRow({label,value,total,color}){
const pct=total?Math.round((value/total)*100):0;
return(<div style={{marginBottom:14}}>
  <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:6}}>
    <span style={{color:"#888"}}>{label}</span>
    <span style={{color:"#f0f0f0",fontWeight:500}}>{value}</span>
  </div>
  <div style={{height:4,background:"#1e1e1e",borderRadius:999}}>
    <div style={{height:"100%",background:color||RED,borderRadius:999,width:pct+"%",transition:"width .6s ease"}}/>
  </div>
</div>);}

export default function Dashboard(){
const[stats,setStats]=useState({agents:0,contacts:0,properties:0,submissions:0});
const[loading,setLoading]=useState(true);
const now=new Date();
const hour=now.getHours();
const greeting=hour<12?"Καλημέρα":hour<18?"Καλησπέρα":"Καλησπέρα";

useEffect(()=>{
  Promise.all([
    fetch(SB+"/rest/v1/agents?select=id",{headers:{apikey:AK,Authorization:"Bearer "+AK,Prefer:"count=exact",Range:"0-0"}}).then(r=>parseInt(r.headers.get("content-range")?.split("/")[1]||"0")),
    fetch(SB+"/rest/v1/contacts?select=id",{headers:{apikey:AK,Authorization:"Bearer "+AK,Prefer:"count=exact",Range:"0-0"}}).then(r=>parseInt(r.headers.get("content-range")?.split("/")[1]||"0")),
    fetch(SB+"/rest/v1/properties?select=id",{headers:{apikey:AK,Authorization:"Bearer "+AK,Prefer:"count=exact",Range:"0-0"}}).then(r=>parseInt(r.headers.get("content-range")?.split("/")[1]||"0")),
    fetch(SB+"/rest/v1/weekly_submissions?select=id",{headers:{apikey:AK,Authorization:"Bearer "+AK,Prefer:"count=exact",Range:"0-0"}}).then(r=>parseInt(r.headers.get("content-range")?.split("/")[1]||"0")),
  ]).then(([agents,contacts,properties,submissions])=>{
    setStats({agents,contacts,properties,submissions});
    setLoading(false);
  }).catch(()=>setLoading(false));
},[]);

return(<div style={{padding:"32px 40px",minHeight:"100vh"}}>
  {/* Header */}
  <div style={{marginBottom:32,display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
    <div>
      <div style={{fontSize:11,color:"#555",textTransform:"uppercase",letterSpacing:".12em",marginBottom:6}}>KWAC · ZadesHome</div>
      <h1 style={{fontSize:28,fontWeight:600,color:"#f0f0f0",letterSpacing:"-0.02em",margin:0}}>{greeting}</h1>
      <div style={{fontSize:13,color:"#555",marginTop:4}}>{now.toLocaleDateString("el-GR",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</div>
    </div>
    <div style={{display:"flex",gap:8}}>
      <a href="/submit" style={{padding:"9px 18px",borderRadius:8,background:RED,color:"white",fontSize:13,fontWeight:500,border:"none",cursor:"pointer"}}>+ Μετρησιμότητα</a>
      <a href="/import" style={{padding:"9px 18px",borderRadius:8,background:"#1a1a1a",color:"#888",fontSize:13,border:"1px solid #2a2a2a",cursor:"pointer"}}>iList Import</a>
    </div>
  </div>

  {/* KPI Grid */}
  <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16,marginBottom:32}}>
    <MetricCard label="Μεσίτες" value={loading?"—":stats.agents} sub="Ενεργά μέλη" accent/>
    <MetricCard label="Επαφές" value={loading?"—":stats.contacts.toLocaleString()} sub="Στη βάση δεδομένων"/>
    <MetricCard label="Ακίνητα" value={loading?"—":stats.properties.toLocaleString()} sub="Καταχωρημένα"/>
    <MetricCard label="Εβδ. καταχωρήσεις" value={loading?"—":stats.submissions} sub="Σύνολο"/>
  </div>

  {/* Main grid */}
  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:20}}>

    {/* Quick actions */}
    <div style={{background:"#111",border:"1px solid #1e1e1e",borderRadius:12,padding:"24px"}}>
      <div style={{fontSize:11,color:"#555",textTransform:"uppercase",letterSpacing:".1em",marginBottom:16}}>Γρήγορες ενέργειες</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        {[
          {href:"/meeting",label:"Meeting ακινήτων",icon:"⬡",desc:"Αξιολόγηση + εκτίμηση"},
          {href:"/submit",label:"Εβδ. ενέργειες",icon:"✎",desc:"Καταχώρηση εβδομάδας"},
          {href:"/sprint",label:"Sprint Calls",icon:"▶",desc:"Καταχώρηση sprint"},
          {href:"/board",label:"Ανακοινώσεις",icon:"◈",desc:"Open Houses & events"},
          {href:"/intelligence",label:"AI Insights",icon:"✦",desc:"Ανάλυση δεδομένων"},
          {href:"/gps",label:"GPS Goals",icon:"◉",desc:"Οικονομικοί στόχοι"},
        ].map(a=>(<a key={a.href} href={a.href} style={{display:"flex",flexDirection:"column",gap:4,padding:"14px",borderRadius:8,background:"#151515",border:"1px solid #1e1e1e",textDecoration:"none",transition:"all .15s"}} onMouseOver={e=>{e.currentTarget.style.borderColor="#CC2229";e.currentTarget.style.background="#1a1a1a";}} onMouseOut={e=>{e.currentTarget.style.borderColor="#1e1e1e";e.currentTarget.style.background="#151515";}}>
          <div style={{fontSize:18,marginBottom:2}}>{a.icon}</div>
          <div style={{fontSize:13,fontWeight:500,color:"#f0f0f0"}}>{a.label}</div>
          <div style={{fontSize:11,color:"#555"}}>{a.desc}</div>
        </a>))}
      </div>
    </div>

    {/* Activity */}
    <div style={{background:"#111",border:"1px solid #1e1e1e",borderRadius:12,padding:"24px"}}>
      <div style={{fontSize:11,color:"#555",textTransform:"uppercase",letterSpacing:".1em",marginBottom:16}}>Πυλώνες συστήματος</div>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {[
          {label:"Βάση επαφών",val:stats.contacts,max:500,color:RED},
          {label:"Ακίνητα",val:stats.properties,max:200,color:"#3b82f6"},
          {label:"Μεσίτες",val:stats.agents,max:60,color:"#22c55e"},
          {label:"Εκτιμήσεις (valuations)",val:0,max:100,color:"#f59e0b"},
        ].map(s=>(<StatRow key={s.label} label={s.label} value={loading?0:s.val} total={s.max} color={s.color}/>))}
      </div>
      <div style={{marginTop:16,paddingTop:16,borderTop:"1px solid #1e1e1e"}}>
        <div style={{fontSize:11,color:"#555",marginBottom:10,textTransform:"uppercase",letterSpacing:".08em"}}>Σύνδεσμοι εισαγωγής</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {[{href:"/import",l:"iList Excel"},{href:"/export",l:"Export CSV"}].map(l=>(<a key={l.href} href={l.href} style={{padding:"6px 12px",borderRadius:6,background:"#1a1a1a",border:"1px solid #2a2a2a",fontSize:12,color:"#888",textDecoration:"none"}} onMouseOver={e=>{e.currentTarget.style.color="#f0f0f0";}} onMouseOut={e=>{e.currentTarget.style.color="#888";}}>{l.l}</a>))}
        </div>
      </div>
    </div>
  </div>

  {/* Status bar */}
  <div style={{background:"#111",border:"1px solid #1e1e1e",borderRadius:12,padding:"16px 24px",display:"flex",gap:24,alignItems:"center",flexWrap:"wrap"}}>
    {[
      {l:"Vercel",v:"Production",c:"#22c55e"},
      {l:"Supabase",v:"Connected",c:"#22c55e"},
      {l:"Make.com",v:"Active",c:"#22c55e"},
      {l:"ML Model",v:"R²=0.93",c:"#f59e0b"},
      {l:"Geocoding",v:"Nominatim",c:"#3b82f6"},
    ].map(s=>(<div key={s.l} style={{display:"flex",alignItems:"center",gap:6}}>
      <div style={{width:6,height:6,borderRadius:"50%",background:s.c,flexShrink:0}}/>
      <span style={{fontSize:12,color:"#555"}}>{s.l}:</span>
      <span style={{fontSize:12,color:"#888",fontWeight:500}}>{s.v}</span>
    </div>))}
  </div>
</div>);}
