"use client";
import{useState}from"react";
import{supabase}from"@/lib/supabase";
const RED="#CC2229";
const EXPORTS=[{key:"contacts",label:"Επαφές",icon:"◎",desc:"Επαφές με τηλέφωνο, email, πηγή",table:"contacts",order:"created_at"},{key:"properties",label:"Ακίνητα",icon:"⬡",desc:"Ακίνητα από iList",table:"properties",order:"created_at"},{key:"weekly_submissions",label:"Μετρησιμότητα",icon:"✎",desc:"Εβδομαδιαίες καταχωρήσεις",table:"weekly_submissions",order:"week_start"},{key:"email_leads",label:"Email Leads",icon:"✉",desc:"Leads από email",table:"email_leads",order:"created_at"},{key:"sprint_entries",label:"Sprint Calls",icon:"▶",desc:"Καταχωρήσεις sprint",table:"sprint_entries",order:"created_at"}];
function toCSV(d){if(!d.length)return"";const h=Object.keys(d[0]);const rows=d.map(row=>h.map(k=>{const v=row[k];if(v===null||v===undefined)return"";const s=Array.isArray(v)?v.join(";"):String(v);return s.includes(",")||s.includes('"')||s.includes("\n")?'"'+s.replace(/"/g,'""')+'"':s;}).join(","));return[h.join(","),...rows].join("\n");}
function dl(csv,name){const b=new Blob(["﻿"+csv],{type:"text/csv;charset=utf-8;"});const u=URL.createObjectURL(b);const a=document.createElement("a");a.href=u;a.download=name;a.click();URL.revokeObjectURL(u);}
export default function ExportPage(){
const[loading,setLoading]=useState({});const[done,setDone]=useState({});
// Uses the shared, session-aware Supabase client — exports respect RLS, so
// an agent can only ever export their own agency's rows.
const doExp=async(exp)=>{setLoading(l=>({...l,[exp.key]:true}));try{const{data,error}=await supabase.from(exp.table).select("*").order(exp.order,{ascending:false}).limit(10000);if(error)throw error;dl(toCSV(data||[]),"kwac_"+exp.key+"_"+new Date().toISOString().split("T")[0]+".csv");setDone(d=>({...d,[exp.key]:(data||[]).length}));}catch(e){alert(e.message);}setLoading(l=>({...l,[exp.key]:false}));};
const doAll=async()=>{for(const e of EXPORTS)await doExp(e);};
return(<div style={{padding:"32px 40px",minHeight:"100vh"}}>
  <div style={{marginBottom:32,display:"flex",justifyContent:"space-between",alignItems:"flex-end"}}>
    <div>
      <div style={{fontSize:11,color:"#555",textTransform:"uppercase",letterSpacing:".12em",marginBottom:6}}>Export</div>
      <h1 style={{fontSize:24,fontWeight:600,color:"#f0f0f0",margin:0}}>Export δεδομένων</h1>
      <p style={{fontSize:13,color:"#555",marginTop:4}}>CSV με UTF-8 για σωστή εμφάνιση ελληνικών</p>
    </div>
    <button onClick={doAll} style={{padding:"10px 20px",borderRadius:8,border:"none",background:RED,color:"white",cursor:"pointer",fontSize:13,fontWeight:500}}>↓ Export Όλα</button>
  </div>
  <div style={{display:"flex",flexDirection:"column",gap:10}}>
    {EXPORTS.map(exp=>(<div key={exp.key} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"18px 24px",background:"#111",border:"1px solid #1e1e1e",borderRadius:12,gap:16}}>
      <div style={{display:"flex",alignItems:"center",gap:16}}>
        <div style={{fontSize:22,color:"#333",width:24,textAlign:"center"}}>{exp.icon}</div>
        <div>
          <div style={{fontWeight:500,fontSize:14,color:"#f0f0f0",marginBottom:2}}>{exp.label}</div>
          <div style={{fontSize:12,color:"#555"}}>{exp.desc}</div>
          {done[exp.key]&&<div style={{fontSize:11,color:"#22c55e",marginTop:3}}>✓ {done[exp.key]} εγγραφές</div>}
        </div>
      </div>
      <button onClick={()=>doExp(exp)} disabled={loading[exp.key]} style={{padding:"8px 18px",borderRadius:8,border:"1px solid #2a2a2a",background:loading[exp.key]?"#151515":"transparent",cursor:loading[exp.key]?"wait":"pointer",fontSize:12,fontWeight:500,color:loading[exp.key]?"#333":"#888",flexShrink:0}}>
        {loading[exp.key]?"...":"↓ CSV"}
      </button>
    </div>))}
  </div>
</div>);}
