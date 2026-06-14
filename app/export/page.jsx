"use client";
import { useState } from "react";
const SB="https://yihnycafoaemoambrdfd.supabase.co";
const AK="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpaG55Y2Fmb2FlbW9hbWJyZGZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4NDU2NTQsImV4cCI6MjA5NjQyMTY1NH0.hZVtBbnPEwd_aInDrMiXrLTHSIWlWNimPRfAOC9O66A";
const RED="#CC2229";
const EXPORTS=[{key:"contacts",label:"Επαφές",icon:"👥",desc:"Όλες οι επαφές με τηλέφωνο, email, πηγή",table:"contacts",order:"created_at"},{key:"properties",label:"Ακίνητα",icon:"🏠",desc:"Ακίνητα από iList",table:"properties",order:"created_at"},{key:"weekly_submissions",label:"Μετρησιμότητα",icon:"📊",desc:"Εβδομαδιαίες καταχωρήσεις agents",table:"weekly_submissions",order:"week_start"},{key:"email_leads",label:"Email Leads",icon:"📧",desc:"Leads από email",table:"email_leads",order:"created_at"},{key:"sprint_entries",label:"Sprint Calls",icon:"📞",desc:"Καταχωρήσεις sprint calls",table:"sprint_entries",order:"created_at"}];
function toCSV(data){if(!data.length)return"";const h=Object.keys(data[0]);const rows=data.map(row=>h.map(k=>{const v=row[k];if(v===null||v===undefined)return"";const s=Array.isArray(v)?v.join(";"):String(v);return s.includes(",")||s.includes('"')||s.includes("\n")?'"'+s.replace(/"/g,'""')+'"':s;}).join(","));return[h.join(","),...rows].join("\n");}
function dl(csv,name){const b=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});const u=URL.createObjectURL(b);const a=document.createElement("a");a.href=u;a.download=name;a.click();URL.revokeObjectURL(u);}
export default function ExportPage(){
const[loading,setLoading]=useState({});
const[done,setDone]=useState({});
const doExp=async(exp)=>{
setLoading(l=>({...l,[exp.key]:true}));
try{const r=await fetch(SB+"/rest/v1/"+exp.table+"?select=*&order="+exp.order+".desc&limit=10000",{headers:{apikey:AK,Authorization:"Bearer "+AK}});
const data=await r.json();
dl(toCSV(data),"kwac_"+exp.key+"_"+new Date().toISOString().split("T")[0]+".csv");
setDone(d=>({...d,[exp.key]:data.length}));}catch(e){alert("Σφάλμα: "+e.message);}
setLoading(l=>({...l,[exp.key]:false}));};
const doAll=async()=>{for(const e of EXPORTS)await doExp(e);};
return(<div style={{fontFamily:"system-ui",maxWidth:800,margin:"0 auto",padding:"32px 24px",color:"#1a1a1a"}}>
<div style={{marginBottom:32}}><div style={{fontSize:11,fontWeight:600,letterSpacing:".12em",color:RED,textTransform:"uppercase",marginBottom:6}}>KWAC Performance OS</div><h1 style={{margin:0,fontSize:24,fontWeight:600}}>Export Δεδομένων</h1><p style={{margin:"6px 0 0",color:"#666",fontSize:13}}>Κατέβασε οποιοδήποτε dataset ως CSV — για backup, ανάλυση ή newsletter.</p></div>
<div style={{display:"flex",justifyContent:"flex-end",marginBottom:20}}><button onClick={doAll} style={{padding:"10px 20px",borderRadius:8,border:"none",background:RED,color:"white",cursor:"pointer",fontSize:13,fontWeight:600}}>⬇ Export Όλα</button></div>
<div style={{display:"flex",flexDirection:"column",gap:12}}>
{EXPORTS.map(exp=><div key={exp.key} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"20px 24px",border:"1px solid #eee",borderRadius:12,background:"white"}}>
<div style={{display:"flex",alignItems:"center",gap:16}}>
<div style={{fontSize:28}}>{exp.icon}</div>
<div><div style={{fontWeight:600,fontSize:15,marginBottom:2}}>{exp.label}</div><div style={{fontSize:12,color:"#888"}}>{exp.desc}</div>
{done[exp.key]&&<div style={{fontSize:11,color:"#22c55e",marginTop:4}}>✓ {done[exp.key]} εγγραφές κατέβηκαν</div>}
</div></div>
<button onClick={()=>doExp(exp)} disabled={loading[exp.key]} style={{padding:"9px 20px",borderRadius:8,border:"1px solid #ddd",background:loading[exp.key]?"#f5f5f5":"white",cursor:loading[exp.key]?"wait":"pointer",fontSize:13,fontWeight:500,minWidth:100,color:"#333"}}>
{loading[exp.key]?"...":"⬇ CSV"}</button>
</div>)}
</div>
<div style={{marginTop:24,padding:"16px 20px",background:"#f9f9f9",borderRadius:10,fontSize:12,color:"#888"}}>💡 Τα CSV ανοίγουν με Excel. Περιέχουν UTF-8 BOM για σωστή εμφάνιση ελληνικών.</div>
</div>);}