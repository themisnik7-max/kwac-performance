"use client";
import{useState}from"react";
const SB="https://yihnycafoaemoambrdfd.supabase.co";
const AK="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpaG55Y2Fmb2FlbW9hbWJyZGZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4NDU2NTQsImV4cCI6MjA5NjQyMTY1NH0.hZVtBbnPEwd_aInDrMiXrLTHSIWlWNimPRfAOC9O66A";
const RED="#CC2229";

const SECTIONS=[
  {key:"lead",label:"Lead Generation",color:"#3b82f6",fields:[{k:"cold_calls",l:"Cold Calls"},{k:"social_media_leads",l:"Social Media"},{k:"mail_campaigns",l:"Mail"},{k:"door_knocking",l:"Door Knocking"}]},
  {key:"followup",label:"Follow Up",color:"#f59e0b",fields:[{k:"follow_up_calls",l:"Follow Up Calls"}]},
  {key:"meetings",label:"Ραντεβού",color:"#22c55e",fields:[{k:"first_meetings_seller",l:"1ο Ραντεβού (Πωλητής)"},{k:"first_meetings_buyer",l:"1ο Ραντεβού (Αγοραστής)"},{k:"second_meetings",l:"2ο Ραντεβού"}]},
  {key:"mandates",label:"Αναθέσεις",color:RED,fields:[{k:"exclusive_mandates",l:"Αποκλειστική"},{k:"simple_mandates",l:"Απλή"}]},
  {key:"contracts",label:"Συμβόλαια",color:"#a855f7",fields:[{k:"sale_contracts",l:"Πώλησης"},{k:"rental_contracts",l:"Ενοικίου"},{k:"pre_contracts",l:"Προσύμφωνο"}]},
  {key:"marketing",label:"Marketing",color:"#06b6d4",fields:[{k:"photo_shoots",l:"Φωτογράφιση"},{k:"open_houses",l:"Open House"},{k:"matterport",l:"Matterport"}]},
  {key:"network",label:"Networking",color:"#84cc16",fields:[{k:"new_partners",l:"Νέος Συνεργάτης"},{k:"referrals_given",l:"Παραπομπή"}]},
  {key:"training",label:"Training",color:"#f97316",fields:[{k:"trainings_attended",l:"Εκπαίδευση"},{k:"team_meetings",l:"Team Meeting"},{k:"conferences",l:"Συνέδριο"}]},
];

const XP_MAP={cold_calls:1,follow_up_calls:2,first_meetings_seller:10,first_meetings_buyer:5,second_meetings:8,exclusive_mandates:50,simple_mandates:20,sale_contracts:100,rental_contracts:60,open_houses:15,referrals_given:10};

function Counter({value,onChange}){
return(<div style={{display:"flex",alignItems:"center",gap:0,background:"#151515",border:"1px solid #2a2a2a",borderRadius:8,overflow:"hidden"}}>
  <button onClick={()=>onChange(Math.max(0,(value||0)-1))} style={{width:32,height:36,background:"transparent",border:"none",color:"#555",fontSize:18,cursor:"pointer",flexShrink:0,transition:"color .1s"}} onMouseOver={e=>e.currentTarget.style.color="#f0f0f0"} onMouseOut={e=>e.currentTarget.style.color="#555"}>−</button>
  <div style={{width:40,textAlign:"center",fontSize:14,fontWeight:600,color:"#f0f0f0"}}>{value||0}</div>
  <button onClick={()=>onChange((value||0)+1)} style={{width:32,height:36,background:"transparent",border:"none",color:"#555",fontSize:18,cursor:"pointer",flexShrink:0,transition:"color .1s"}} onMouseOver={e=>e.currentTarget.style.color=RED} onMouseOut={e=>e.currentTarget.style.color="#555"}>+</button>
</div>);}

export default function SubmitPage(){
const init=SECTIONS.reduce((acc,s)=>{s.fields.forEach(f=>acc[f.k]=0);return acc;},{});
const[vals,setVals]=useState(init);const[saving,setSaving]=useState(false);const[saved,setSaved]=useState(false);
const set=(k,v)=>setVals(p=>({...p,[k]:v}));
const totalXP=Object.entries(vals).reduce((sum,[k,v])=>sum+(XP_MAP[k]||0)*(v||0),0);
const weekStart=new Date();weekStart.setDate(weekStart.getDate()-weekStart.getDay()+1);
const save=async()=>{setSaving(true);
try{await fetch(SB+"/rest/v1/weekly_submissions",{method:"POST",headers:{apikey:AK,Authorization:"Bearer "+AK,"Content-Type":"application/json",Prefer:"resolution=merge-duplicates"},body:JSON.stringify({...vals,week_start:weekStart.toISOString().split("T")[0],total_xp:totalXP,submitted_at:new Date().toISOString()})});setSaved(true);}
catch(e){}finally{setSaving(false);}};

return(<div style={{padding:"32px 40px",minHeight:"100vh"}}>
  {/* Header */}
  <div style={{marginBottom:32,display:"flex",justifyContent:"space-between",alignItems:"flex-end"}}>
    <div>
      <div style={{fontSize:11,color:"#555",textTransform:"uppercase",letterSpacing:".12em",marginBottom:6}}>Μετρησιμότητα</div>
      <h1 style={{fontSize:24,fontWeight:600,color:"#f0f0f0",margin:0}}>Εβδομαδιαίες ενέργειες</h1>
      <div style={{fontSize:13,color:"#555",marginTop:4}}>Εβδομάδα {weekStart.toLocaleDateString("el-GR")} · Deadline Κυριακή 23:59</div>
    </div>
    {/* XP Counter */}
    <div style={{textAlign:"right"}}>
      <div style={{fontSize:11,color:"#555",textTransform:"uppercase",letterSpacing:".1em",marginBottom:4}}>XP εβδομάδας</div>
      <div style={{fontSize:36,fontWeight:700,color:RED,letterSpacing:"-0.02em"}}>{totalXP}</div>
    </div>
  </div>

  {/* Sections */}
  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:24}}>
    {SECTIONS.map(sec=>(<div key={sec.key} style={{background:"#111",border:"1px solid #1e1e1e",borderRadius:12,padding:"20px",borderTop:"2px solid "+sec.color}}>
      <div style={{fontSize:11,fontWeight:600,color:sec.color,textTransform:"uppercase",letterSpacing:".1em",marginBottom:16}}>{sec.label}</div>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        {sec.fields.map(f=>(<div key={f.k} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}>
          <span style={{fontSize:13,color:"#888",flex:1}}>{f.l}</span>
          <Counter value={vals[f.k]} onChange={v=>set(f.k,v)}/>
        </div>))}
      </div>
    </div>))}
  </div>

  {/* Save */}
  {saved
    ?<div style={{padding:"16px 24px",background:"rgba(34,197,94,0.08)",border:"1px solid rgba(34,197,94,0.2)",borderRadius:12,color:"#22c55e",fontWeight:500,fontSize:14}}>✓ Αποθηκεύτηκε — καλή εβδομάδα!</div>
    :<button onClick={save} disabled={saving} style={{width:"100%",padding:"14px",borderRadius:12,border:"none",background:saving?"#1a1a1a":RED,color:saving?"#555":"white",fontSize:15,fontWeight:600,cursor:saving?"wait":"pointer"}}>
      {saving?"Αποθήκευση...":"Αποθήκευση εβδομάδας →"}
    </button>
  }
</div>);}
