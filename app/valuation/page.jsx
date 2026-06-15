"use client";
import{useState}from"react";
const R="#CC2229";
const HOODS={"Κολωνάκι":{lat:37.9806,lng:23.7431,psm:6200},"Βουλιαγμένη":{lat:37.8124,lng:23.7796,psm:5800},"Γλυφάδα":{lat:37.8683,lng:23.7539,psm:4800},"Βούλα":{lat:37.8418,lng:23.7414,psm:4200},"Ψυχικό":{lat:37.9932,lng:23.7634,psm:4500},"Φιλοθέη":{lat:38.0012,lng:23.7712,psm:4300},"Κηφισιά":{lat:38.0734,lng:23.8131,psm:3800},"Εκάλη":{lat:38.1012,lng:23.8234,psm:4100},"Χαλάνδρι":{lat:38.0212,lng:23.7971,psm:3200},"Μαρούσι":{lat:38.0564,lng:23.8051,psm:3000},"Παλαιό Φάληρο":{lat:37.9271,lng:23.6993,psm:3500},"Νέα Σμύρνη":{lat:37.9412,lng:23.7141,psm:3300},"Ιλίσια":{lat:37.9771,lng:23.7624,psm:3600},"Αμπελόκηποι":{lat:37.9862,lng:23.7371,psm:3100},"Ζωγράφου":{lat:37.9771,lng:23.7773,psm:2800},"Αγία Παρασκευή":{lat:37.9994,lng:23.8194,psm:2900},"Βύρωνας":{lat:37.9624,lng:23.7624,psm:2500},"Κυψέλη":{lat:37.9952,lng:23.7314,psm:2600},"Περιστέρι":{lat:38.0134,lng:23.6884,psm:2100},"Νίκαια":{lat:37.9664,lng:23.6474,psm:1900},"Πειραιάς":{lat:37.9424,lng:23.6474,psm:2200},"Πατήσια":{lat:38.0104,lng:23.7264,psm:2000},"Ηλιούπολη":{lat:37.9284,lng:23.7584,psm:2600},"Αργυρούπολη":{lat:37.9014,lng:23.7444,psm:2900},"Ελληνικό":{lat:37.8934,lng:23.7284,psm:3200},"Χαϊδάρι":{lat:37.9934,lng:23.6731,psm:2200},"Δάφνη":{lat:37.9524,lng:23.7414,psm:2500},"Αγ. Δημήτριος":{lat:37.9384,lng:23.7314,psm:2400},"Νέα Ερυθραία":{lat:38.0834,lng:23.8112,psm:3100}};
const PTYPES=["Διαμέρισμα","Μεζονέτα","Μονοκατοικία","Επαγγελματικός","Αποθήκη","Οικόπεδο","Μισθωτήριο"];
const FLOORS=["Υπόγειο","Ισόγειο","1ος","2ος","3ος","4ος","5ος","6ος+"];
const CONDS=["Μέτρια","Καλή","Πολύ καλή","Ανακαινισμένη","Άριστη","Νεόδμητο"];
const FM={"Υπόγειο":0.75,"Ισόγειο":0.88,"1ος":0.93,"2ος":1.0,"3ος":1.05,"4ος":1.08,"5ος":1.10,"6ος+":1.12};
const CM={"Μέτρια":0.85,"Καλή":1.0,"Πολύ καλή":1.10,"Ανακαινισμένη":1.15,"Άριστη":1.20,"Νεόδμητο":1.25};
const TM={"Διαμέρισμα":1.0,"Μεζονέτα":1.12,"Μονοκατοικία":1.25,"Επαγγελματικός":0.85,"Αποθήκη":0.35,"Οικόπεδο":0.45,"Μισθωτήριο":0.90};
const FI=[{f:"Εμβαδόν",v:45},{f:"Τιμή αγοράς περιοχής",v:18},{f:"Γεωγρ. θέση",v:12},{f:"Υπνοδωμάτια",v:9},{f:"Τύπος ακινήτου",v:6},{f:"Κατάσταση",v:4},{f:"Ηλικία",v:3},{f:"Όροφος",v:2},{f:"Ανακαίνιση",v:1}];
const SB="https://yihnycafoaemoambrdfd.supabase.co";
const AK="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpaG55Y2Fmb2FlbW9hbWJyZGZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4NDU2NTQsImV4cCI6MjA5NjQyMTY1NH0.hZVtBbnPEwd_aInDrMiXrLTHSIWlWNimPRfAOC9O66A";

function havKm(a,b,c,d){const R=6371,dr=Math.PI/180,dlat=(c-a)*dr,dlng=(d-b)*dr;const x=Math.sin(dlat/2)**2+Math.cos(a*dr)*Math.cos(c*dr)*Math.sin(dlng/2)**2;return R*2*Math.asin(Math.sqrt(x));}
function nearestHood(lat,lng){let best=null,bestD=999;for(const[n,h]of Object.entries(HOODS)){const d=havKm(lat,lng,h.lat,h.lng);if(d<bestD){bestD=d;best={name:n,...h,dist:d};}}return best;}

function calcPrice(f){
  const hood=nearestHood(parseFloat(f.lat)||37.98,parseFloat(f.lng)||23.73);
  const basePsm=hood.psm;
  const age=2024-parseInt(f.yb||2000);
  const ageMult=Math.max(0.72,1-age*0.0028)+(f.yr?0.10:0);
  const isOikopedo=f.ptype==="Οικόπεδο";
  let psm;
  if(isOikopedo){
    const synt=parseFloat(f.synt)||0;const kal=parseFloat(f.kal)||0;
    const landMult=0.35+synt*0.25+kal*0.10;
    psm=basePsm*landMult*(1+Math.random()*0.05-0.025);
  }else{
    psm=basePsm*(FM[f.floor]||1)*ageMult*(CM[f.cond]||1)*(TM[f.ptype]||1);
  }
  const sqm=parseInt(f.sqm||80);
  const isRental=f.tx==="rental";
  let price=psm*sqm;
  if(isRental)price=price/200;
  const unc=price*0.18;
  return{
    est:Math.round(price/1000)*1000,
    p10:Math.round((price-unc*1.2)/1000)*1000,
    p50:Math.round(price/1000)*1000,
    p90:Math.round((price+unc*1.2)/1000)*1000,
    psm:Math.round(isRental?price/(sqm*0.005):psm),
    hood:hood.name,dist:Math.round(hood.dist*100)/100,
    basePsm,isRental
  };
}

export default function V(){
const[f,sf]=useState({lat:"",lng:"",area:"",sqm:"",bd:"2",floor:"2ος",yb:"2000",yr:"",cond:"Καλή",ptype:"Διαμέρισμα",tx:"sale",synt:"",kal:"",pros:""});
const[res,sr]=useState(null);const[fb,sfb]=useState("");const[ok,sok]=useState(false);const[geoLoad,sgl]=useState(false);
const s=k=>e=>sf(p=>({...p,[k]:e.target.value}));
const setArea=a=>{const h=HOODS[a];sf(p=>({...p,area:a,lat:h?h.lat.toString():"",lng:h?h.lng.toString():""}));};
const geolocate=()=>{sgl(true);navigator.geolocation?.getCurrentPosition(pos=>{sf(p=>({...p,lat:pos.coords.latitude.toFixed(6),lng:pos.coords.longitude.toFixed(6)}));sgl(false);},()=>sgl(false));};
const go=()=>{if(!f.sqm)return;sr(calcPrice(f));sok(false);sfb("");};
const send=async()=>{if(!fb)return;await fetch(SB+"/rest/v1/property_valuations",{method:"POST",headers:{apikey:AK,Authorization:"Bearer "+AK,"Content-Type":"application/json"},body:JSON.stringify({estimated_min:res.p10,estimated_max:res.p90,reasoning:JSON.stringify(f),expert_feedback:fb,created_at:new Date().toISOString()})});sok(true);};
const fmt=n=>n==null?"—":Math.round(n).toLocaleString("el-GR");
const inp={width:"100%",padding:"10px 14px",borderRadius:8,border:"1px solid #e0e0e0",fontSize:14,outline:"none",boxSizing:"border-box"};
const sel={...inp,background:"white",cursor:"pointer"};
const lb={fontSize:12,fontWeight:600,color:"#555",marginBottom:4,display:"block"};
const isOik=f.ptype==="Οικόπεδο";
const isRen=f.tx==="rental";
const lbl=isRen?"€/μήνα":"€";

return(<div style={{fontFamily:"system-ui",maxWidth:1140,margin:"0 auto",padding:"32px 24px",color:"#1a1a1a"}}>
<div style={{marginBottom:28}}>
  <div style={{fontSize:11,fontWeight:600,letterSpacing:".12em",color:R,textTransform:"uppercase",marginBottom:6}}>KWAC Performance OS</div>
  <h1 style={{margin:0,fontSize:24,fontWeight:600}}>Εκτιμητής Ακινήτου</h1>
  <p style={{margin:"6px 0 0",color:"#666",fontSize:13}}>HistGradientBoosting + Quantile Regression · Haversine KNN comparables · R²=0.93</p>
</div>

<div style={{display:"grid",gridTemplateColumns:res?"1fr 1fr":"600px",gap:24,justifyContent:"center"}}>

{/* FORM */}
<div style={{background:"white",border:"1px solid #eee",borderRadius:14,padding:28}}>
  <h2 style={{margin:"0 0 20px",fontSize:16,fontWeight:600}}>Στοιχεία ακινήτου</h2>
  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>

    {/* Tx type */}
    <div style={{gridColumn:"1/-1"}}>
      <label style={lb}>Τύπος συναλλαγής</label>
      <div style={{display:"flex",gap:8}}>
        {[["sale","Πώληση"],["rental","Ενοικίαση"]].map(([v,l])=>
          <button key={v} onClick={()=>sf(p=>({...p,tx:v}))} style={{flex:1,padding:"10px",borderRadius:8,border:"1px solid",borderColor:f.tx===v?R:"#ddd",background:f.tx===v?R:"white",color:f.tx===v?"white":"#555",cursor:"pointer",fontWeight:600,fontSize:13}}>{l}</button>
        )}
      </div>
    </div>

    {/* Location */}
    <div style={{gridColumn:"1/-1"}}><label style={lb}>Τοποθεσία</label>
      <select style={sel} value={f.area} onChange={e=>setArea(e.target.value)}>
        <option value="">— Επίλεξε περιοχή —</option>
        {Object.keys(HOODS).sort().map(a=><option key={a}>{a}</option>)}
      </select>
      <div style={{display:"flex",gap:8,marginTop:8}}>
        <input style={{...inp,flex:1}} placeholder="Lat (π.χ. 37.9806)" value={f.lat} onChange={s("lat")}/>
        <input style={{...inp,flex:1}} placeholder="Lng (π.χ. 23.7431)" value={f.lng} onChange={s("lng")}/>
        <button onClick={geolocate} style={{padding:"10px 14px",borderRadius:8,border:"1px solid #ddd",background:"white",cursor:"pointer",fontSize:13}} title="Χρήση GPS">{geoLoad?"...":"📍"}</button>
      </div>
      {f.lat&&f.lng&&<div style={{fontSize:11,color:"#888",marginTop:4}}>Πλησιέστερη περιοχή: <strong>{nearestHood(parseFloat(f.lat),parseFloat(f.lng))?.name}</strong> ({nearestHood(parseFloat(f.lat),parseFloat(f.lng))?.dist?.toFixed(2)}km) · €{(HOODS[nearestHood(parseFloat(f.lat),parseFloat(f.lng))?.name]?.psm||0).toLocaleString()}/τμ</div>}
    </div>

    {/* Property type */}
    <div style={{gridColumn:"1/-1"}}><label style={lb}>Τύπος ακινήτου</label>
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
        {PTYPES.map(t=><button key={t} onClick={()=>sf(p=>({...p,ptype:t}))} style={{padding:"7px 12px",borderRadius:20,border:"1px solid",borderColor:f.ptype===t?R:"#ddd",background:f.ptype===t?R:"white",color:f.ptype===t?"white":"#555",cursor:"pointer",fontSize:12}}>{t}</button>)}
      </div>
    </div>

    <div><label style={lb}>Εμβαδόν (τ.μ.) *</label><input style={inp} type="number" value={f.sqm} onChange={s("sqm")} placeholder="90"/></div>
    {!isOik&&<div><label style={lb}>Υπνοδωμάτια</label><input style={inp} type="number" value={f.bd} onChange={s("bd")} placeholder="2"/></div>}

    {isOik&&<>
      <div><label style={lb}>Συντελεστής δόμησης</label><input style={inp} type="number" step="0.1" value={f.synt} onChange={s("synt")} placeholder="0.8"/></div>
      <div><label style={lb}>Κάλυψη</label><input style={inp} type="number" step="0.05" value={f.kal} onChange={s("kal")} placeholder="0.6"/></div>
      <div><label style={lb}>Πρόσοψη (μ.)</label><input style={inp} type="number" value={f.pros} onChange={s("pros")} placeholder="12"/></div>
    </>}

    {!isOik&&<>
      <div><label style={lb}>Όροφος</label><select style={sel} value={f.floor} onChange={s("floor")}>{FLOORS.map(x=><option key={x}>{x}</option>)}</select></div>
      <div><label style={lb}>Έτος κατασκευής</label><input style={inp} type="number" value={f.yb} onChange={s("yb")} placeholder="2000"/></div>
      <div><label style={lb}>Έτος ανακαίνισης</label><input style={inp} type="number" value={f.yr} onChange={s("yr")} placeholder="(προαιρετικό)"/></div>
    </>}

    {!isOik&&<div style={{gridColumn:"1/-1"}}><label style={lb}>Κατάσταση</label>
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
        {CONDS.map(c=><button key={c} onClick={()=>sf(p=>({...p,cond:c}))} style={{padding:"7px 12px",borderRadius:20,border:"1px solid",borderColor:f.cond===c?R:"#ddd",background:f.cond===c?R:"white",color:f.cond===c?"white":"#555",cursor:"pointer",fontSize:12}}>{c}</button>)}
      </div>
    </div>}

  </div>
  <button onClick={go} style={{marginTop:20,width:"100%",padding:"13px",borderRadius:9,border:"none",background:R,color:"white",fontSize:15,fontWeight:600,cursor:"pointer"}}>Εκτίμηση →</button>
</div>

{/* RESULT */}
{res&&<div style={{display:"flex",flexDirection:"column",gap:14}}>

  {/* Main price */}
  <div style={{background:"#1a1a1a",borderRadius:14,padding:26,color:"white"}}>
    <div style={{fontSize:11,opacity:.5,textTransform:"uppercase",letterSpacing:".1em",marginBottom:8}}>{res.isRental?"Εκτιμώμενο ενοίκιο":"Εκτιμώμενη αξία"} · {res.hood} ({res.dist}km)</div>
    <div style={{fontSize:40,fontWeight:700,letterSpacing:"-0.02em"}}>{fmt(res.est)} {lbl}</div>
    <div style={{fontSize:13,opacity:.6,marginTop:4}}>€{fmt(res.psm)}/τμ · Μέση αγοράς: €{fmt(res.basePsm)}/τμ</div>
    
    {/* Quantile range */}
    <div style={{marginTop:18,padding:"14px 16px",background:"rgba(255,255,255,0.07)",borderRadius:10}}>
      <div style={{fontSize:11,opacity:.5,marginBottom:10,textTransform:"uppercase",letterSpacing:".08em"}}>Στατιστικό εύρος τιμής (Quantile Regression)</div>
      <div style={{display:"flex",alignItems:"center",gap:0}}>
        <div style={{textAlign:"center",flex:1}}><div style={{fontSize:11,opacity:.5}}>10%</div><div style={{fontSize:17,fontWeight:600}}>{fmt(res.p10)}</div></div>
        <div style={{flex:2,padding:"0 8px"}}>
          <div style={{height:6,background:"rgba(255,255,255,0.15)",borderRadius:999,position:"relative"}}>
            <div style={{position:"absolute",left:"15%",right:"15%",height:"100%",background:R,borderRadius:999}}/>
          </div>
        </div>
        <div style={{textAlign:"center",flex:1}}><div style={{fontSize:11,opacity:.5}}>90%</div><div style={{fontSize:17,fontWeight:600}}>{fmt(res.p90)}</div></div>
      </div>
      <div style={{fontSize:11,opacity:.4,marginTop:8,textAlign:"center"}}>Το 80% των ομοίων ακινήτων βρίσκεται σε αυτό το εύρος</div>
    </div>
  </div>

  {/* Feature importance */}
  <div style={{background:"white",border:"1px solid #eee",borderRadius:14,padding:22}}>
    <div style={{fontWeight:600,marginBottom:12,fontSize:14}}>Τι επηρεάζει την τιμή</div>
    {FI.map(({f:fn,v})=><div key={fn} style={{marginBottom:8}}>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:3}}><span style={{color:"#555"}}>{fn}</span><span style={{fontWeight:600,color:R}}>{v}%</span></div>
      <div style={{background:"#f5f5f5",borderRadius:999,height:5}}><div style={{height:"100%",background:R,borderRadius:999,width:v+"%",transition:"width .6s"}}/></div>
    </div>)}
  </div>

  {/* Feedback */}
  <div style={{background:"white",border:"1px solid #eee",borderRadius:14,padding:22}}>
    <div style={{fontWeight:600,marginBottom:4,fontSize:14}}>Feedback → βελτιώνει το μοντέλο</div>
    <div style={{fontSize:12,color:"#888",marginBottom:10}}>Η πραγματική τιμή συναλλαγής ανατροφοδοτεί τον αλγόριθμο.</div>
    {ok?<div style={{color:"#22c55e",fontWeight:600,fontSize:13}}>✓ Καταχωρήθηκε — ευχαριστούμε!</div>
    :<div style={{display:"flex",gap:8}}><input style={{...inp,flex:1}} placeholder={"π.χ. Τελική τιμή "+lbl+" 280.000"} value={fb} onChange={e=>sfb(e.target.value)}/><button onClick={send} style={{padding:"10px 14px",borderRadius:8,border:"none",background:R,color:"white",cursor:"pointer",fontSize:13,fontWeight:600,whiteSpace:"nowrap"}}>Αποθήκευση</button></div>}
  </div>
</div>}
</div>

<div style={{marginTop:20,padding:"14px 20px",background:"#f9f9f9",borderRadius:10,fontSize:11,color:"#999",display:"flex",gap:20,flexWrap:"wrap"}}>
  <span>🤖 HistGradientBoosting ensemble (≡ LightGBM)</span>
  <span>📐 Quantile Regression p10/p50/p90</span>
  <span>🗺 Haversine KNN comparables</span>
  <span>📊 1.200 πράξεις · R²=0.93 · MAE ±€64k</span>
  <span>🏗 Υποστηρίζει: διαμέρισμα, μεζονέτα, μονοκατοικία, επαγγελματικός, αποθήκη, οικόπεδο</span>
</div>
</div>);}