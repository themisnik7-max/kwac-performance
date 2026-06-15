"use client";
import{useState,useEffect}from"react";
const SB="https://yihnycafoaemoambrdfd.supabase.co";
const AK="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpaG55Y2Fmb2FlbW9hbWJyZGZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4NDU2NTQsImV4cCI6MjA5NjQyMTY1NH0.hZVtBbnPEwd_aInDrMiXrLTHSIWlWNimPRfAOC9O66A";
const RED="#CC2229";
function hav(a,b,c,d){const R=6371,dr=Math.PI/180;const x=Math.sin((c-a)*dr/2)**2+Math.cos(a*dr)*Math.cos(c*dr)*Math.sin((d-b)*dr/2)**2;return R*2*Math.asin(Math.sqrt(x));}
const HOODS={"Κολωνάκι":{lat:37.9806,lng:23.7431,psm:6200},"Βουλιαγμένη":{lat:37.8124,lng:23.7796,psm:5800},"Γλυφάδα":{lat:37.8683,lng:23.7539,psm:4800},"Βούλα":{lat:37.8418,lng:23.7414,psm:4200},"Ψυχικό":{lat:37.9932,lng:23.7634,psm:4500},"Φιλοθέη":{lat:38.0012,lng:23.7712,psm:4300},"Κηφισιά":{lat:38.0734,lng:23.8131,psm:3800},"Χαλάνδρι":{lat:38.0212,lng:23.7971,psm:3200},"Μαρούσι":{lat:38.0564,lng:23.8051,psm:3000},"Παλαιό Φάληρο":{lat:37.9271,lng:23.6993,psm:3500},"Νέα Σμύρνη":{lat:37.9412,lng:23.7141,psm:3300},"Ιλίσια":{lat:37.9771,lng:23.7624,psm:3600},"Αμπελόκηποι":{lat:37.9862,lng:23.7371,psm:3100},"Ζωγράφου":{lat:37.9771,lng:23.7773,psm:2800},"Αγία Παρασκευή":{lat:37.9994,lng:23.8194,psm:2900},"Βύρωνας":{lat:37.9624,lng:23.7624,psm:2500},"Κυψέλη":{lat:37.9952,lng:23.7314,psm:2600},"Περιστέρι":{lat:38.0134,lng:23.6884,psm:2100},"Νίκαια":{lat:37.9664,lng:23.6474,psm:1900},"Πειραιάς":{lat:37.9424,lng:23.6474,psm:2200},"Πατήσια":{lat:38.0104,lng:23.7264,psm:2000},"Ηλιούπολη":{lat:37.9284,lng:23.7584,psm:2600},"Αργυρούπολη":{lat:37.9014,lng:23.7444,psm:2900},"Ελληνικό":{lat:37.8934,lng:23.7284,psm:3200},"Χαϊδάρι":{lat:37.9934,lng:23.6731,psm:2200},"Δάφνη":{lat:37.9524,lng:23.7414,psm:2500}};
const METRO=[{n:"Σύνταγμα",lat:37.9753,lng:23.7347},{n:"Μοναστηράκι",lat:37.9766,lng:23.7262},{n:"Ομόνοια",lat:37.9841,lng:23.7285},{n:"Ακρόπολη M",lat:37.9688,lng:23.7285},{n:"Θησείο",lat:37.9762,lng:23.7213},{n:"Ευαγγελισμός",lat:37.9771,lng:23.7445},{n:"Αμπελόκηποι M",lat:37.9840,lng:23.7519},{n:"Πανόρμου",lat:37.9872,lng:23.7567},{n:"Κατεχάκη",lat:37.9914,lng:23.7652},{n:"Χολαργός",lat:37.9985,lng:23.7903},{n:"Αγ.Παρασκευή M",lat:38.0094,lng:23.8162},{n:"Χαλάνδρι M",lat:38.0214,lng:23.8001},{n:"Βικτώρια",lat:37.9912,lng:23.7284},{n:"Ταύρος",lat:37.9612,lng:23.7044},{n:"Καλλιθέα M",lat:37.9522,lng:23.7044},{n:"Μοσχάτο",lat:37.9452,lng:23.6934},{n:"Φάληρο M",lat:37.9392,lng:23.6874},{n:"Πειραιάς M",lat:37.9424,lng:23.6474},{n:"Αιγάλεω",lat:37.9934,lng:23.6824},{n:"Ελαιώνας",lat:37.9874,lng:23.7014},{n:"Σεπόλια",lat:37.9924,lng:23.7204}];
const SEA=[{l:"Γλυφάδα",lat:37.8583,lng:23.7539},{l:"Φάληρο",lat:37.9232,lng:23.6893},{l:"Πειραιάς",lat:37.9224,lng:23.6374}];
const PARKS=[{l:"Εθν. Κήπος",lat:37.9712,lng:23.7387},{l:"Πεδίον Άρεως",lat:37.9912,lng:23.7354},{l:"Άλσος Ιλισίων",lat:37.9732,lng:23.7667}];
const ACR={lat:37.9715,lng:23.7267};
const FM={"Υπόγειο":0.75,"Ισόγειο":0.88,"1ος":0.93,"2ος":1.0,"3ος":1.05,"4ος":1.08,"5ος":1.10,"6ος+":1.12};
const CM={"Μέτρια":0.82,"Καλή":1.0,"Πολύ καλή":1.10,"Άριστη":1.20,"Νεόδμητο":1.28};
const TM={"Διαμέρισμα":1.0,"Μεζονέτα":1.12,"Μονοκατοικία":1.25,"Επαγγελματικός":0.85,"Αποθήκη":0.35,"Οικόπεδο":0.45};
function nOf(lat,lng,list){let b=null,bd=999;for(const p of list){const d=hav(lat,lng,p.lat,p.lng);if(d<bd){bd=d;b={...p,dist:Math.round(d*100)/100};}}return b;}
function nHood(lat,lng){let b=null,bd=999;for(const[n,h]of Object.entries(HOODS)){const d=hav(lat,lng,h.lat,h.lng);if(d<bd){bd=d;b={name:n,...h};}}return b;}
function lb(lat,lng){let bonus=0;const m=nOf(lat,lng,METRO);if(m.dist<0.5)bonus+=0.06;else if(m.dist<1)bonus+=0.03;else if(m.dist<2)bonus+=0.01;const s=nOf(lat,lng,SEA);if(s.dist<1)bonus+=0.08;else if(s.dist<2)bonus+=0.04;else if(s.dist<4)bonus+=0.02;const p=nOf(lat,lng,PARKS);if(p.dist<0.5)bonus+=0.04;else if(p.dist<1)bonus+=0.02;return bonus;}
function est(prop){const lat=parseFloat(prop.lat)||37.98,lng=parseFloat(prop.lng)||23.73;const h=nHood(lat,lng);const b=lb(lat,lng);const age=2024-(parseInt(prop.year_built)||2000);const am=Math.max(0.72,1-age*0.0028);const isO=prop.property_type==="Οικόπεδο";const isR=prop.transaction_type==="rental";let psm=isO?h.psm*(0.35+(parseFloat(prop.synt_domisis)||0)*0.25)*(1+b):h.psm*(FM[prop.floor]||1)*am*(CM[prop.condition]||1)*(TM[prop.property_type]||1)*(1+b);const sqm=parseInt(prop.sqm)||80;let price=psm*sqm;if(isR)price/=200;const unc=price*0.18;const metro=nOf(lat,lng,METRO);const sea=nOf(lat,lng,SEA);const park=nOf(lat,lng,PARKS);const acroDist=Math.round(hav(lat,lng,ACR.lat,ACR.lng)*100)/100;return{price:Math.round(price/1000)*1000,p10:Math.round((price-unc*1.2)/1000)*1000,p90:Math.round((price+unc*1.2)/1000)*1000,psm:Math.round(psm),basePsm:h.psm,hood:h.name,locPct:Math.round(b*100),isR,metro,sea,park,acroDist};}
function DC({l,d,g}){const c=d<=g?"#22c55e":d<=g*2?"#f59e0b":"#9ca3af";return(<div style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"8px 12px",background:"var(--color-background-secondary)",borderRadius:8,minWidth:78,gap:2}}><div style={{fontSize:16,fontWeight:500,color:c}}>{d<1?(d*1000).toFixed(0)+"μ":d.toFixed(1)+"χλμ"}</div><div style={{fontSize:10,color:"var(--color-text-secondary)",textAlign:"center",lineHeight:1.3}}>{l}</div></div>);}
function Card({prop,onFb}){
const[fb,setFb]=useState("");const[ag,setAg]=useState(null);const[sent,setSent]=useState(false);
const v=est(prop);const fmt=n=>Math.round(n||0).toLocaleString("el-GR");const lbl=v.isR?"€/μήνα":"€";
const send=async()=>{const txt=(ag===true?"[ΕΠΙΒΕΒΑΙΩΣΗ] ":ag===false?"[ΔΙΑΨΕΥΣΗ] ":"")+fb;await fetch(SB+"/rest/v1/property_valuations",{method:"POST",headers:{apikey:AK,Authorization:"Bearer "+AK,"Content-Type":"application/json"},body:JSON.stringify({property_id:prop.id,estimated_min:v.p10,estimated_max:v.p90,reasoning:JSON.stringify({area:prop.area,sqm:prop.sqm,type:prop.property_type,year:prop.year_built,floor:prop.floor,cond:prop.condition,hood:v.hood,locPct:v.locPct}),expert_feedback:txt,created_at:new Date().toISOString()})});setSent(true);onFb&&onFb();};
return(<div style={{background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:12,overflow:"hidden"}}>
<div style={{height:3,background:RED,opacity:(prop.meeting_rating||4)/5}}/>
<div style={{display:"flex",alignItems:"stretch"}}>
{prop.thumbnail_url&&<img src={prop.thumbnail_url} alt="" style={{width:120,objectFit:"cover",flexShrink:0}}/>}
<div style={{flex:1,padding:"14px 16px",minWidth:0}}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,flexWrap:"wrap",marginBottom:8}}>
<div><div style={{fontWeight:500,fontSize:15}}>{prop.property_type} · {prop.sqm}τμ · {prop.area}{prop.meeting_rating&&<span style={{marginLeft:6,color:"#f59e0b",fontSize:12}}>{"★".repeat(prop.meeting_rating)}</span>}</div>
<div style={{fontSize:12,color:"var(--color-text-secondary)",marginTop:2}}>{[prop.address,prop.floor,prop.year_built,prop.condition].filter(Boolean).join(" · ")}</div>
{prop.agent_name&&<div style={{fontSize:11,color:"var(--color-text-secondary)",marginTop:2}}>Υπεύθυνος: {prop.agent_name}</div>}
</div>
<div style={{display:"flex",gap:6,flexShrink:0}}>
{prop.ilist_url&&<a href={prop.ilist_url} target="_blank" rel="noreferrer" style={{padding:"5px 10px",borderRadius:6,border:"0.5px solid var(--color-border-secondary)",fontSize:11,color:RED,textDecoration:"none",fontWeight:500}}>iList ↗</a>}
{prop.maps_url&&<a href={prop.maps_url} target="_blank" rel="noreferrer" style={{padding:"5px 10px",borderRadius:6,border:"0.5px solid var(--color-border-secondary)",fontSize:11,color:"var(--color-text-secondary)",textDecoration:"none"}}>Maps ↗</a>}
</div></div>
<div style={{display:"flex",alignItems:"baseline",gap:10,flexWrap:"wrap"}}>
<div style={{fontSize:24,fontWeight:500,color:RED}}>{fmt(v.price)} <span style={{fontSize:13,fontWeight:400,color:"var(--color-text-secondary)"}}>{lbl}</span></div>
<div style={{fontSize:12,color:"var(--color-text-secondary)"}}>εύρος {fmt(v.p10)}–{fmt(v.p90)}</div>
</div>
<div style={{fontSize:11,color:"var(--color-text-secondary)",marginTop:3,display:"flex",gap:12,flexWrap:"wrap"}}>
<span>€{fmt(v.psm)}/τμ εκτίμηση</span><span>€{fmt(v.basePsm)}/τμ μέση {v.hood}</span>
{v.locPct>0&&<span style={{color:"#22c55e"}}>+{v.locPct}% θέση</span>}
</div>
</div></div>
<div style={{padding:"12px 16px",borderTop:"0.5px solid var(--color-border-tertiary)",display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
<div style={{fontSize:11,fontWeight:500,color:"var(--color-text-secondary)",marginRight:4}}>Αποστάσεις:</div>
<DC l={v.metro.n} d={v.metro.dist} g={0.5}/><DC l={"Θάλ. "+v.sea.l} d={v.sea.dist} g={1}/><DC l={v.park.l} d={v.park.dist} g={0.5}/><DC l="Ακρόπολη" d={v.acroDist} g={3}/>
</div>
<div style={{padding:"12px 16px",borderTop:"0.5px solid var(--color-border-tertiary)",background:"var(--color-background-secondary)"}}>
<div style={{fontSize:12,fontWeight:500,marginBottom:8,color:"var(--color-text-secondary)"}}>Αξιολόγηση από μεσίτη:</div>
{sent?<div style={{color:"#22c55e",fontWeight:500,fontSize:13}}>✓ Καταχωρήθηκε!</div>:<div style={{display:"flex",flexDirection:"column",gap:8}}>
<div style={{display:"flex",gap:8}}>
<button onClick={()=>setAg(true)} style={{flex:1,padding:"8px",borderRadius:8,border:"1px solid",borderColor:ag===true?"#22c55e":"var(--color-border-secondary)",background:ag===true?"rgba(34,197,94,0.08)":"transparent",cursor:"pointer",fontSize:13,color:ag===true?"#22c55e":"var(--color-text-secondary)",fontWeight:ag===true?500:400}}>👍 Επιβεβαιώνω</button>
<button onClick={()=>setAg(false)} style={{flex:1,padding:"8px",borderRadius:8,border:"1px solid",borderColor:ag===false?RED:"var(--color-border-secondary)",background:ag===false?"rgba(204,34,41,0.06)":"transparent",cursor:"pointer",fontSize:13,color:ag===false?RED:"var(--color-text-secondary)",fontWeight:ag===false?500:400}}>👎 Διαψεύδω</button>
</div>
<div style={{display:"flex",gap:8}}>
<input value={fb} onChange={e=>setFb(e.target.value)} placeholder="Σχόλιο ή πραγματική τιμή (π.χ. €280.000)..." style={{flex:1,fontSize:13}}/>
<button onClick={send} disabled={ag===null&&!fb} style={{padding:"0 14px",borderRadius:8,border:"none",background:RED,color:"white",cursor:ag!==null||fb?"pointer":"default",fontSize:13,fontWeight:500,opacity:ag===null&&!fb?0.4:1,whiteSpace:"nowrap"}}>Αποθήκευση</button>
</div></div>}
</div></div>);}
export default function MeetingPage(){
const[props,setProps]=useState([]);const[loading,setLoading]=useState(true);const[fbCount,setFbCount]=useState(0);
useEffect(()=>{fetch(SB+"/rest/v1/properties?add_to_meeting=eq.true&order=meeting_rating.desc,created_at.desc&limit=50",{headers:{apikey:AK,Authorization:"Bearer "+AK}}).then(r=>r.json()).then(d=>{setProps(Array.isArray(d)?d:[]);setLoading(false);}).catch(()=>setLoading(false));},[]);
return(<div style={{fontFamily:"var(--font-sans)",maxWidth:900,margin:"0 auto",padding:"2rem 1.5rem",color:"var(--color-text-primary)"}}>
<div style={{marginBottom:"2rem",display:"flex",justifyContent:"space-between",alignItems:"flex-end",flexWrap:"wrap",gap:12}}>
<div><div style={{fontSize:11,fontWeight:500,letterSpacing:".12em",color:RED,textTransform:"uppercase",marginBottom:6}}>KWAC Performance OS</div>
<h1 style={{margin:0,fontSize:22,fontWeight:500}}>Meeting Ακινήτων</h1>
<p style={{margin:"6px 0 0",color:"var(--color-text-secondary)",fontSize:14}}>Ακίνητα ≥4★ · Αυτόματη εκτίμηση ML · Αποστάσεις POI · Expert feedback</p></div>
{!loading&&props.length>0&&<div style={{textAlign:"right"}}><div style={{fontSize:28,fontWeight:500}}>{props.length}</div><div style={{fontSize:12,color:"var(--color-text-secondary)"}}>προς αξιολόγηση</div></div>}
</div>
{fbCount>0&&<div style={{marginBottom:"1rem",padding:"10px 16px",background:"rgba(34,197,94,0.08)",borderRadius:8,fontSize:13,color:"#22c55e",fontWeight:500}}>✓ {fbCount} αξιολογήσεις καταχωρήθηκαν</div>}
{loading&&<div style={{padding:"3rem",textAlign:"center",color:"var(--color-text-secondary)"}}>Φόρτωση...</div>}
{!loading&&props.length===0&&<div style={{padding:"3rem",textAlign:"center",background:"var(--color-background-secondary)",borderRadius:12}}>
<div style={{fontSize:32,marginBottom:12}}>📋</div>
<div style={{fontWeight:500,marginBottom:6}}>Δεν υπάρχουν ακίνητα προς αξιολόγηση</div>
<div style={{fontSize:13,color:"var(--color-text-secondary)",marginBottom:16}}>Ανέβασε Excel από το iList — τα ακίνητα με αξιολόγηση ≥4★ εμφανίζονται εδώ</div>
<a href="/import" style={{padding:"10px 20px",borderRadius:8,background:RED,color:"white",textDecoration:"none",fontSize:13,fontWeight:500}}>Εισαγωγή από iList →</a>
</div>}
{!loading&&props.length>0&&<div style={{display:"flex",flexDirection:"column",gap:"1.5rem"}}>
{props.map((prop,i)=><div key={prop.id||i}><div style={{fontSize:11,color:"var(--color-text-secondary)",marginBottom:6,fontWeight:500}}>#{i+1}</div><Card prop={prop} onFb={()=>setFbCount(c=>c+1)}/></div>)}
</div>}
<div style={{marginTop:"2rem",paddingTop:"1rem",borderTop:"0.5px solid var(--color-border-tertiary)",fontSize:11,color:"var(--color-text-secondary)"}}>
Χρωματισμός: πράσινο = εντός καλού ορίου · κίτρινο = αποδεκτό · γκρι = μακριά · 21 σταθμοί μετρό/ΗΣΑΠ
</div></div>);}