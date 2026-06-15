"use client";
import{useState}from"react";
const SB="https://yihnycafoaemoambrdfd.supabase.co";
const AK="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpaG55Y2Fmb2FlbW9hbWJyZGZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4NDU2NTQsImV4cCI6MjA5NjQyMTY1NH0.hZVtBbnPEwd_aInDrMiXrLTHSIWlWNimPRfAOC9O66A";
const RED="#CC2229";
export default function Login(){
const[email,setEmail]=useState("");const[pw,setPw]=useState("");const[err,setErr]=useState("");const[loading,setLoading]=useState(false);
const submit=async(e)=>{e.preventDefault();setLoading(true);setErr("");
try{const r=await fetch(SB+"/auth/v1/token?grant_type=password",{method:"POST",headers:{apikey:AK,"Content-Type":"application/json"},body:JSON.stringify({email,password:pw})});
const d=await r.json();if(d.error)setErr(d.error_description||d.error);else{localStorage.setItem("kwac_token",d.access_token);window.location.href="/dashboard";}}
catch(e){setErr("Σφάλμα σύνδεσης");}finally{setLoading(false);}};
return(<div style={{minHeight:"100vh",background:"#0a0a0a",display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
  <div style={{width:"100%",maxWidth:380}}>
    {/* Logo */}
    <div style={{textAlign:"center",marginBottom:40}}>
      <div style={{width:48,height:48,borderRadius:12,background:RED,display:"inline-flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:20,color:"white",marginBottom:16}}>KW</div>
      <div style={{fontSize:20,fontWeight:600,color:"#f0f0f0",letterSpacing:"-0.01em"}}>KWAC Performance OS</div>
      <div style={{fontSize:13,color:"#555",marginTop:4}}>ZadesHome · Real Estate Intelligence</div>
    </div>
    {/* Form */}
    <form onSubmit={submit} style={{display:"flex",flexDirection:"column",gap:12}}>
      <div>
        <label style={{fontSize:11,color:"#555",textTransform:"uppercase",letterSpacing:".08em",display:"block",marginBottom:6}}>Email</label>
        <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@kwgreece.gr" required/>
      </div>
      <div>
        <label style={{fontSize:11,color:"#555",textTransform:"uppercase",letterSpacing:".08em",display:"block",marginBottom:6}}>Κωδικός</label>
        <input type="password" value={pw} onChange={e=>setPw(e.target.value)} placeholder="••••••••" required/>
      </div>
      {err&&<div style={{padding:"10px 14px",borderRadius:8,background:"rgba(204,34,41,0.1)",border:"1px solid rgba(204,34,41,0.2)",fontSize:13,color:"#f87171"}}>{err}</div>}
      <button type="submit" disabled={loading} style={{marginTop:4,padding:"11px",borderRadius:8,background:loading?"#1a1a1a":RED,color:loading?"#555":"white",border:"none",fontSize:14,fontWeight:500,cursor:loading?"wait":"pointer",transition:"all .15s"}}>
        {loading?"Σύνδεση...":"Σύνδεση →"}
      </button>
    </form>
    <div style={{textAlign:"center",marginTop:24,fontSize:12,color:"#333"}}>KWAC AC · Confidential</div>
  </div>
</div>);}
