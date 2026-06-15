"use client";
import{useState,useCallback}from"react";
import*as XLSX from"xlsx";
const SB="https://yihnycafoaemoambrdfd.supabase.co";
const AK="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpaG55Y2Fmb2FlbW9hbWJyZGZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4NDU2NTQsImV4cCI6MjA5NjQyMTY1NH0.hZVtBbnPEwd_aInDrMiXrLTHSIWlWNimPRfAOC9O66A";
const RED="#CC2229";
function pDate(v){if(!v)return null;if(v instanceof Date)return v.toISOString().split("T")[0];if(typeof v==="number")return new Date(Math.round((v-25569)*86400*1000)).toISOString().split("T")[0];return String(v).split(" ")[0]||null;}
function iUrl(id){return id?"https://app.i-list.gr/appFol/appDetails/estateDetails/estateDetails.aspx?id="+id:null;}
function mUrl(a,ar){return"https://www.google.com/maps/search/?api=1&query="+encodeURIComponent([a,ar].filter(Boolean).join(", ")+", Greece");}
function pRow(row){const flag=String(row[0]??row[1]??"").trim();const id=String(row[2]??"").trim();if(!id||id==="ID"||id==="undefined")return null;const addr=row[11]&&row[11]!=="***"?String(row[11]).trim():null;const rating=parseInt((flag.match(/(\d)/)||[])[1]||"0");return{ilist_id:id,ilist_url:iUrl(id),thumbnail_url:String(row[4]??"").includes("no-photo")?null:"https://app.i-list.gr"+String(row[4]??""),maps_url:mUrl(addr,String(row[8]??"")),approval_flag:flag||null,meeting_rating:rating||null,add_to_meeting:rating>=4,transaction_type:String(row[5]??"").startsWith("Ενοικίαση")?"rental":"sale",property_type:String(row[7]??"").trim()||null,status:String(row[25]??"available").trim(),area:String(row[8]??"").trim()||null,sub_area:String(row[9]??"").trim()||null,postal_code:String(row[10]??"").trim()||null,address:addr,price:parseFloat(row[14])||null,price_per_sqm:parseFloat(row[16])||null,sqm:parseFloat(row[15])||null,bedrooms:parseInt(row[17])||null,floor:String(row[18]??"").trim()||null,year_built:parseInt(row[19])||null,mandate_start:pDate(row[20]),mandate_end:pDate(row[21]),source:String(row[22]??"").trim()||null,agent_name:String(row[23]??"").trim()||null,updated_at:new Date().toISOString()};}
async function ups(rows){const r=await fetch(SB+"/rest/v1/properties",{method:"POST",headers:{apikey:AK,Authorization:"Bearer "+AK,"Content-Type":"application/json",Prefer:"resolution=merge-duplicates"},body:JSON.stringify(rows)});if(!r.ok)throw new Error(await r.text());}
export default function ImportPage(){
const[file,setFile]=useState(null);const[rows,setRows]=useState([]);const[stats,setStats]=useState(null);const[step,setStep]=useState("idle");const[err,setErr]=useState(null);const[pct,setPct]=useState(0);const[fil,setFil]=useState("all");
const load=useCallback((f)=>{if(!f)return;setFile(f);setStep("loading");const rd=new FileReader();rd.onload=(e)=>{try{const wb=XLSX.read(e.target.result,{type:"array"});const data=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,defval:""});const p=data.slice(1).map(pRow).filter(Boolean);setRows(p);setStats({total:p.length,meeting:p.filter(r=>r.add_to_meeting).length,sale:p.filter(r=>r.transaction_type==="sale").length,rental:p.filter(r=>r.transaction_type==="rental").length});setStep("preview");}catch(e){setErr(e.message);setStep("error");}};rd.readAsArrayBuffer(f);},[]);
const doImp=async()=>{setStep("importing");setPct(0);try{for(let i=0;i<rows.length;i+=50){await ups(rows.slice(i,i+50));setPct(Math.round(((i+Math.min(50,rows.length-i))/rows.length)*100));}setStep("done");}catch(e){setErr(e.message);setStep("error");}};
const reset=()=>{setFile(null);setRows([]);setStats(null);setStep("idle");setErr(null);setPct(0);setFil("all");};
const vis=fil==="meeting"?rows.filter(r=>r.add_to_meeting):fil==="sale"?rows.filter(r=>r.transaction_type==="sale"):fil==="rental"?rows.filter(r=>r.transaction_type==="rental"):rows;
const fmt=n=>Math.round(n||0).toLocaleString("el-GR");

return(<div style={{padding:"32px 40px",minHeight:"100vh"}}>
  <div style={{marginBottom:32}}>
    <div style={{fontSize:11,color:"#555",textTransform:"uppercase",letterSpacing:".12em",marginBottom:6}}>iList Import</div>
    <h1 style={{fontSize:24,fontWeight:600,color:"#f0f0f0",margin:0}}>Εισαγωγή ακινήτων</h1>
    <p style={{fontSize:13,color:"#555",marginTop:4}}>Ακίνητα με αξιολόγηση ≥4★ μπαίνουν αυτόματα στο Meeting Dashboard</p>
  </div>

  {(step==="idle"||step==="loading")&&<div onDrop={e=>{e.preventDefault();load(e.dataTransfer.files[0]);}} onDragOver={e=>e.preventDefault()} onClick={()=>document.getElementById("fi").click()} style={{border:"2px dashed #2a2a2a",borderRadius:12,padding:"80px 40px",textAlign:"center",cursor:"pointer",background:"#111",transition:"border-color .2s"}} onMouseOver={e=>e.currentTarget.style.borderColor=RED} onMouseOut={e=>e.currentTarget.style.borderColor="#2a2a2a"}>
    <div style={{fontSize:40,marginBottom:16,opacity:.4}}>↑</div>
    <div style={{fontWeight:500,fontSize:16,color:"#888",marginBottom:6}}>{step==="loading"?"Φόρτωση...":"Σύρε το GridExport.xlsx ή κάνε κλικ"}</div>
    <div style={{fontSize:12,color:"#333"}}>iList Excel export</div>
    <input id="fi" type="file" accept=".xlsx,.xls" style={{display:"none"}} onChange={e=>load(e.target.files[0])}/>
  </div>}

  {step==="preview"&&stats&&<div>
    <div style={{display:"flex",gap:12,marginBottom:24}}>
      {[["Σύνολο",stats.total,"all"],["Meeting ≥4★",stats.meeting,"meeting"],["Πωλήσεις",stats.sale,"sale"],["Ενοικιάσεις",stats.rental,"rental"]].map(([l,v,k])=>(
        <div key={k} onClick={()=>setFil(k)} style={{flex:1,padding:"16px 20px",borderRadius:12,cursor:"pointer",background:fil===k?"#1a1a1a":"#111",border:"1px solid",borderColor:fil===k?RED:"#1e1e1e",transition:"all .15s"}}>
          <div style={{fontSize:26,fontWeight:700,color:fil===k?RED:"#f0f0f0"}}>{v}</div>
          <div style={{fontSize:11,color:"#555",marginTop:4}}>{l}</div>
        </div>
      ))}
    </div>
    <div style={{border:"1px solid #1e1e1e",borderRadius:12,overflow:"hidden",marginBottom:20}}>
      <div style={{overflowX:"auto",maxHeight:360,overflowY:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead><tr style={{background:"#151515",position:"sticky",top:0}}>
            {["iList","Τύπος","Περιοχή","Τμ","Τιμή","Agent","★","Status"].map(h=><th key={h} style={{padding:"10px 14px",textAlign:"left",fontWeight:500,fontSize:10,textTransform:"uppercase",letterSpacing:".08em",color:"#555",borderBottom:"1px solid #1e1e1e"}}>{h}</th>)}
          </tr></thead>
          <tbody>{vis.slice(0,100).map((r,i)=>(
            <tr key={i} style={{borderBottom:"1px solid #151515",background:r.add_to_meeting?"rgba(204,34,41,0.04)":"transparent"}}>
              <td style={{padding:"9px 14px"}}><a href={r.ilist_url} target="_blank" rel="noreferrer" style={{color:RED,fontFamily:"monospace",fontSize:11}}>{r.ilist_id}</a></td>
              <td style={{padding:"9px 14px",color:"#888"}}>{r.property_type}</td>
              <td style={{padding:"9px 14px"}}><a href={r.maps_url} target="_blank" rel="noreferrer" style={{color:"#3b82f6",fontSize:12}}>{r.area}</a></td>
              <td style={{padding:"9px 14px",color:"#888"}}>{r.sqm?r.sqm+"τμ":"—"}</td>
              <td style={{padding:"9px 14px",fontWeight:500,color:"#f0f0f0"}}>{r.price?"€"+fmt(r.price):"—"}</td>
              <td style={{padding:"9px 14px",color:"#555",fontSize:11}}>{r.agent_name||"—"}</td>
              <td style={{padding:"9px 14px",textAlign:"center",color:r.add_to_meeting?"#f59e0b":"#333"}}>{r.add_to_meeting?"★★★★":"—"}</td>
              <td style={{padding:"9px 14px"}}><span style={{fontSize:10,padding:"2px 8px",borderRadius:20,background:r.status==="Διαθέσιμο"?"rgba(34,197,94,0.1)":"#1a1a1a",color:r.status==="Διαθέσιμο"?"#22c55e":"#555"}}>{r.status}</span></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
    <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
      <button onClick={reset} style={{padding:"11px 22px",borderRadius:8,border:"1px solid #2a2a2a",background:"transparent",cursor:"pointer",fontSize:13,color:"#555"}}>Ακύρωση</button>
      <button onClick={doImp} style={{padding:"11px 28px",borderRadius:8,border:"none",background:RED,color:"white",cursor:"pointer",fontSize:13,fontWeight:600}}>Εισαγωγή {stats.total} ακινήτων →</button>
    </div>
  </div>}

  {step==="importing"&&<div style={{textAlign:"center",padding:"80px 40px"}}>
    <div style={{fontWeight:500,color:"#f0f0f0",marginBottom:20,fontSize:16}}>Εισαγωγή... {pct}%</div>
    <div style={{background:"#1a1a1a",borderRadius:999,height:4,maxWidth:400,margin:"0 auto"}}>
      <div style={{height:"100%",background:RED,borderRadius:999,width:pct+"%",transition:"width .3s"}}/>
    </div>
    <div style={{marginTop:12,color:"#555",fontSize:13}}>{Math.round(pct*rows.length/100)} / {rows.length}</div>
  </div>}

  {step==="done"&&<div style={{textAlign:"center",padding:"80px 40px"}}>
    <div style={{fontSize:48,marginBottom:16,color:"#22c55e"}}>✓</div>
    <div style={{fontSize:20,fontWeight:600,color:"#f0f0f0",marginBottom:8}}>Ολοκληρώθηκε</div>
    <div style={{color:"#555",marginBottom:6}}><strong style={{color:"#f0f0f0"}}>{stats?.total}</strong> ακίνητα εισήχθησαν</div>
    <div style={{color:RED,fontWeight:600,marginBottom:32}}>{stats?.meeting} ακίνητα ≥4★ → Meeting Dashboard</div>
    <div style={{display:"flex",gap:10,justifyContent:"center"}}>
      <button onClick={reset} style={{padding:"11px 22px",borderRadius:8,border:"1px solid #2a2a2a",background:"transparent",cursor:"pointer",fontSize:13,color:"#555"}}>Νέα εισαγωγή</button>
      <a href="/meeting" style={{padding:"11px 22px",borderRadius:8,background:RED,color:"white",textDecoration:"none",fontSize:13,fontWeight:600}}>Meeting Dashboard →</a>
    </div>
  </div>}

  {step==="error"&&<div style={{textAlign:"center",padding:"80px 40px"}}>
    <div style={{fontSize:36,marginBottom:16,color:RED}}>!</div>
    <div style={{fontSize:16,fontWeight:600,color:"#f0f0f0",marginBottom:8}}>Σφάλμα</div>
    <div style={{color:"#555",fontFamily:"monospace",fontSize:12,marginBottom:24}}>{err}</div>
    <button onClick={reset} style={{padding:"11px 22px",borderRadius:8,border:"1px solid #2a2a2a",background:"transparent",cursor:"pointer",fontSize:13,color:"#555"}}>Δοκίμασε ξανά</button>
  </div>}
</div>);}
