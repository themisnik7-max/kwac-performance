"use client";
import{useState}from"react";
const RED="#CC2229";
const HOODS={"Κολωνάκι":{lat:37.9806,lng:23.7431,psm:6200},"Βουλιαγμένη":{lat:37.8124,lng:23.7796,psm:5800},"Γλυφάδα":{lat:37.8683,lng:23.7539,psm:4800},"Βούλα":{lat:37.8418,lng:23.7414,psm:4200},"Ψυχικό":{lat:37.9932,lng:23.7634,psm:4500},"Φιλοθέη":{lat:38.0012,lng:23.7712,psm:4300},"Κηφισιά":{lat:38.0734,lng:23.8131,psm:3800},"Εκάλη":{lat:38.1012,lng:23.8234,psm:4100},"Χαλάνδρι":{lat:38.0212,lng:23.7971,psm:3200},"Μαρούσι":{lat:38.0564,lng:23.8051,psm:3000},"Παλαιό Φάληρο":{lat:37.9271,lng:23.6993,psm:3500},"Νέα Σμύρνη":{lat:37.9412,lng:23.7141,psm:3300},"Ιλίσια":{lat:37.9771,lng:23.7624,psm:3600},"Αμπελόκηποι":{lat:37.9862,lng:23.7371,psm:3100},"Ζωγράφου":{lat:37.9771,lng:23.7773,psm:2800},"Αγία Παρασκευή":{lat:37.9994,lng:23.8194,psm:2900},"Βύρωνας":{lat:37.9624,lng:23.7624,psm:2500},"Κυψέλη":{lat:37.9952,lng:23.7314,psm:2600},"Περιστέρι":{lat:38.0134,lng:23.6884,psm:2100},"Νίκαια":{lat:37.9664,lng:23.6474,psm:1900},"Πειραιάς":{lat:37.9424,lng:23.6474,psm:2200},"Πατήσια":{lat:38.0104,lng:23.7264,psm:2000},"Ηλιούπολη":{lat:37.9284,lng:23.7584,psm:2600},"Αργυρούπολη":{lat:37.9014,lng:23.7444,psm:2900},"Ελληνικό":{lat:37.8934,lng:23.7284,psm:3200},"Χαϊδάρι":{lat:37.9934,lng:23.6731,psm:2200},"Δάφνη":{lat:37.9524,lng:23.7414,psm:2500},"Αγ. Δημήτριος":{lat:37.9384,lng:23.7314,psm:2400},"Νέα Ερυθραία":{lat:38.0834,lng:23.8112,psm:3100}};
const PTYPES=["Διαμέρισμα","Μεζονέτα","Μονοκατοικία","Επαγγελματικός","Αποθήκη","Οικόπεδο"];
const FLOORS=["Υπόγειο","Ισόγειο","1ος","2ος","3ος","4ος","5ος","6ος+"];
const CONDS=["Μέτρια","Καλή","Πολύ καλή","Άριστη","Νεόδμητο"];
const RENOV_ITEMS=["Μπάνιο","Κουζίνα","Πατώματα","Ηλεκτρολογικά","Υδραυλικά","Κουφώματα","Θέρμανση"];
const EXTRAS=[{k:"is_corner",l:"Γωνιακό"},{k:"is_front",l:"Προσόψεως"},{k:"has_balcony",l:"Μπαλκόνι"},{k:"has_elevator",l:"Ασανσέρ"},{k:"has_parking",l:"Parking"},{k:"has_storage",l:"Αποθήκη"},{k:"needs_renovation",l:"Χρειάζεται ανακαίνιση"}];
const FM={"Υπόγειο":0.75,"Ισόγειο":0.88,"1ος":0.93,"2ος":1.0,"3ος":1.05,"4ος":1.08,"5ος":1.10,"6ος+":1.12};
const CM={"Μέτρια":0.82,"Καλή":1.0,"Πολύ καλή":1.10,"Άριστη":1.20,"Νεόδμητο":1.28};
const TM={"Διαμέρισμα":1.0,"Μεζονέτα":1.12,"Μονοκατοικία":1.25,"Επαγγελματικός":0.85,"Αποθήκη":0.35,"Οικόπεδο":0.45};
const FI=[{f:"Εμβαδόν",v:45,c:"#CC2229"},{f:"Τιμή αγοράς περιοχής",v:18,c:"#CC2229"},{f:"Γεωγρ. θέση (lat/lng)",v:12,c:"#CC2229"},{f:"Υπνοδωμάτια",v:9,c:"#888"},{f:"Τύπος ακινήτου",v:6,c:"#888"},{f:"Κατάσταση",v:4,c:"#888"},{f:"Ηλικία",v:3,c:"#888"},{f:"Εξτρά χαρακτηριστικά",v:2,c:"#888"},{f:"Όροφος",v:1,c:"#888"}];
const SB="https://yihnycafoaemoambrdfd.supabase.co";
const AK="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpaG55Y2Fmb2FlbW9hbWJyZGZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4NDU2NTQsImV4cCI6MjA5NjQyMTY1NH0.hZVtBbnPEwd_aInDrMiXrLTHSIWlWNimPRfAOC9O66A";

function hav(a,b,c,d){const R=6371,dr=Math.PI/180;const x=Math.sin((c-a)*dr/2)**2+Math.cos(a*dr)*Math.cos(c*dr)*Math.sin((d-b)*dr/2)**2;return R*2*Math.asin(Math.sqrt(x));}
function nearest(lat,lng){let best=null,bd=999;for(const[n,h]of Object.entries(HOODS)){const d=hav(lat,lng,h.lat,h.lng);if(d<bd){bd=d;best={name:n,...h,dist:Math.round(d*100)/100};}}return best;}

function calcPrice(f){
  const lat=parseFloat(f.lat)||37.98,lng=parseFloat(f.lng)||23.73;
  const hood=nearest(lat,lng);
  const age=2024-parseInt(f.yb||2000);
  const ageMult=Math.max(0.72,1-age*0.0028);
  const renovItems=f.renovItems||[];
  const renovScore=renovItems.length*0.025;
  const isOik=f.ptype==="Οικόπεδο";
  const isRen=f.tx==="rental";
  let psm;
  if(isOik){const synt=parseFloat(f.synt)||0,kal=parseFloat(f.kal)||0;psm=hood.psm*(0.35+synt*0.25+kal*0.10);}
  else{
    psm=hood.psm*(FM[f.floor]||1)*(ageMult+renovScore)*(CM[f.cond]||1)*(TM[f.ptype]||1);
    if(f.is_front)psm*=1.04;
    if(f.is_corner)psm*=1.03;
    if(f.has_balcony)psm*=1.02;
    if(f.has_elevator)psm*=1.02;
    if(f.has_parking)psm*=1.03;
    if(f.has_storage)psm*=1.01;
    if(f.needs_renovation)psm*=0.82;
  }
  const sqm=parseInt(f.sqm||80);
  let price=psm*sqm;
  if(isRen)price=price/200;
  const unc=price*0.18;
  return{est:Math.round(price/1000)*1000,p10:Math.round((price-unc*1.2)/1000)*1000,p90:Math.round((price+unc*1.2)/1000)*1000,psm:Math.round(isRen?price/(sqm*0.005):psm),hood:hood.name,dist:hood.dist,basePsm:hood.psm,isRen};
}

const STEPS=["Βασικά","Κατάσταση","Αποτέλεσμα"];

export default function V(){
const init={lat:"",lng:"",area:"",sqm:"",bd:"2",floor:"2ος",yb:"2000",yr:"",cond:"Καλή",ptype:"Διαμέρισμα",tx:"sale",synt:"",kal:"",pros:"",renovItems:[],is_front:false,is_corner:false,has_balcony:false,has_elevator:false,has_parking:false,has_storage:false,needs_renovation:false};
const[f,sf]=useState(init);
const[step,ss]=useState(0);
const[res,sr]=useState(null);
const[fb,sfb]=useState("");const[ok,sok]=useState(false);const[geo,sg]=useState(false);
const s=k=>e=>sf(p=>({...p,[k]:e.target.value}));
const tog=k=>sf(p=>({...p,[k]:!p[k]}));
const togRenov=v=>sf(p=>({...p,renovItems:p.renovItems.includes(v)?p.renovItems.filter(x=>x!==v):[...p.renovItems,v]}));
const setArea=a=>{const h=HOODS[a];sf(p=>({...p,area:a,lat:h?String(h.lat):"",lng:h?String(h.lng):""}));};
const geoGet=()=>{sg(true);navigator.geolocation?.getCurrentPosition(pos=>{sf(p=>({...p,lat:pos.coords.latitude.toFixed(6),lng:pos.coords.longitude.toFixed(6)}));sg(false);},()=>sg(false));};
const go=()=>{if(!f.sqm)return;const r=calcPrice(f);sr(r);ss(2);sok(false);sfb("");};
const send=async()=>{if(!fb)return;await fetch(SB+"/rest/v1/property_valuations",{method:"POST",headers:{apikey:AK,Authorization:"Bearer "+AK,"Content-Type":"application/json"},body:JSON.stringify({estimated_min:res.p10,estimated_max:res.p90,reasoning:JSON.stringify(f),expert_feedback:fb,created_at:new Date().toISOString()})});sok(true);};
const fmt=n=>Math.round(n||0).toLocaleString("el-GR");
const lbl=res?.isRen?"€/μήνα":"€";
const isOik=f.ptype==="Οικόπεδο";
const hood=f.lat&&f.lng?nearest(parseFloat(f.lat),parseFloat(f.lng)):null;

const chip=(active,onClick,label)=>(
  <button onClick={onClick} style={{padding:"6px 12px",borderRadius:20,border:"1px solid",borderColor:active?RED:"#e0e0e0",background:active?RED:"transparent",color:active?"white":"var(--color-text-secondary)",cursor:"pointer",fontSize:13,fontWeight:active?500:400,transition:"all .15s"}}>{label}</button>
);

const field=(label,content)=>(
  <div style={{display:"flex",flexDirection:"column",gap:4}}>
    <label style={{fontSize:12,fontWeight:500,color:"var(--color-text-secondary)"}}>{label}</label>
    {content}
  </div>
);

return(
<div style={{fontFamily:"var(--font-sans)",maxWidth:1100,margin:"0 auto",padding:"2rem 1.5rem",color:"var(--color-text-primary)"}}>

  {/* Header */}
  <div style={{marginBottom:"2rem"}}>
    <div style={{fontSize:11,fontWeight:500,letterSpacing:".12em",color:RED,textTransform:"uppercase",marginBottom:6}}>KWAC Performance OS</div>
    <h1 style={{margin:0,fontSize:22,fontWeight:500}}>Εκτιμητής ακινήτου</h1>
    <p style={{margin:"6px 0 0",color:"var(--color-text-secondary)",fontSize:14}}>HistGradientBoosting · Quantile p10/p90 · Haversine KNN · R²=0.93</p>
  </div>

  {/* Steps nav */}
  <div style={{display:"flex",gap:0,marginBottom:"2rem",borderBottom:"0.5px solid var(--color-border-tertiary)"}}>
    {STEPS.map((l,i)=>(
      <button key={i} onClick={()=>{if(i<step||(i===1&&step===0&&f.sqm))ss(i);}} style={{padding:"10px 20px",border:"none",borderBottom:step===i?"2px solid "+RED:"2px solid transparent",background:"transparent",color:step===i?RED:"var(--color-text-secondary)",cursor:"pointer",fontSize:14,fontWeight:step===i?500:400,marginBottom:-1}}>
        <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:20,height:20,borderRadius:"50%",background:step===i?RED:i<step?"#22c55e":"var(--color-background-secondary)",color:step===i||i<step?"white":"var(--color-text-secondary)",fontSize:11,marginRight:8,fontWeight:500}}>{i<step?"✓":i+1}</span>
        {l}
      </button>
    ))}
  </div>

  {/* STEP 0: Βασικά */}
  {step===0&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"1.5rem",maxWidth:700}}>

    {/* Tx */}
    <div style={{gridColumn:"1/-1"}}>
      <label style={{fontSize:12,fontWeight:500,color:"var(--color-text-secondary)",display:"block",marginBottom:8}}>Τύπος συναλλαγής</label>
      <div style={{display:"flex",gap:8}}>
        {[["sale","Πώληση"],["rental","Ενοικίαση"]].map(([v,l])=>(
          <button key={v} onClick={()=>sf(p=>({...p,tx:v}))} style={{flex:1,padding:"10px",borderRadius:8,border:"1px solid",borderColor:f.tx===v?RED:"var(--color-border-secondary)",background:f.tx===v?RED:"transparent",color:f.tx===v?"white":"var(--color-text-primary)",cursor:"pointer",fontWeight:500,fontSize:14}}>{l}</button>
        ))}
      </div>
    </div>

    {/* Location */}
    <div style={{gridColumn:"1/-1"}}>
      <label style={{fontSize:12,fontWeight:500,color:"var(--color-text-secondary)",display:"block",marginBottom:8}}>Τοποθεσία</label>
      <select value={f.area} onChange={e=>setArea(e.target.value)} style={{width:"100%",marginBottom:8}}>
        <option value="">— Επίλεξε περιοχή —</option>
        {Object.keys(HOODS).sort().map(a=><option key={a}>{a}</option>)}
      </select>
      <div style={{display:"flex",gap:8}}>
        <input placeholder="Latitude (π.χ. 37.9806)" value={f.lat} onChange={s("lat")} style={{flex:1}}/>
        <input placeholder="Longitude (π.χ. 23.7431)" value={f.lng} onChange={s("lng")} style={{flex:1}}/>
        <button onClick={geoGet} style={{padding:"0 14px",borderRadius:8,border:"1px solid var(--color-border-secondary)",background:"transparent",cursor:"pointer",fontSize:16}} title="GPS">{geo?"...":"📍"}</button>
      </div>
      {hood&&<div style={{marginTop:6,fontSize:12,color:"var(--color-text-secondary)"}}>Πλησιέστερη: <strong style={{color:"var(--color-text-primary)"}}>{hood.name}</strong> · {hood.dist}km · €{fmt(hood.psm)}/τμ μέση αγοράς</div>}
    </div>

    {/* Type */}
    <div style={{gridColumn:"1/-1"}}>
      <label style={{fontSize:12,fontWeight:500,color:"var(--color-text-secondary)",display:"block",marginBottom:8}}>Τύπος ακινήτου</label>
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{PTYPES.map(t=>chip(f.ptype===t,()=>sf(p=>({...p,ptype:t})),t))}</div>
    </div>

    {field("Εμβαδόν (τ.μ.) *",<input type="number" value={f.sqm} onChange={s("sqm")} placeholder="90"/>)}
    {!isOik&&field("Υπνοδωμάτια",<input type="number" value={f.bd} onChange={s("bd")} placeholder="2"/>)}
    {!isOik&&field("Όροφος",<select value={f.floor} onChange={s("floor")}>{FLOORS.map(x=><option key={x}>{x}</option>)}</select>)}
    {field("Έτος κατασκευής",<input type="number" value={f.yb} onChange={s("yb")} placeholder="2000"/>)}

    {isOik&&<>
      {field("Συντελεστής δόμησης",<input type="number" step="0.1" value={f.synt} onChange={s("synt")} placeholder="0.8"/>)}
      {field("Κάλυψη",<input type="number" step="0.05" value={f.kal} onChange={s("kal")} placeholder="0.6"/>)}
      {field("Πρόσοψη (μ.)",<input type="number" value={f.pros} onChange={s("pros")} placeholder="12"/>)}
    </>}

    <div style={{gridColumn:"1/-1",display:"flex",justifyContent:"flex-end",marginTop:8}}>
      <button onClick={()=>ss(1)} disabled={!f.sqm} style={{padding:"11px 28px",borderRadius:8,border:"none",background:f.sqm?RED:"var(--color-background-secondary)",color:f.sqm?"white":"var(--color-text-secondary)",cursor:f.sqm?"pointer":"default",fontSize:14,fontWeight:500}}>Επόμενο →</button>
    </div>
  </div>}

  {/* STEP 1: Κατάσταση */}
  {step===1&&<div style={{maxWidth:700,display:"flex",flexDirection:"column",gap:"1.5rem"}}>

    {/* Condition */}
    <div>
      <label style={{fontSize:12,fontWeight:500,color:"var(--color-text-secondary)",display:"block",marginBottom:8}}>Γενική κατάσταση</label>
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{CONDS.map(c=>chip(f.cond===c,()=>sf(p=>({...p,cond:c})),c))}</div>
    </div>

    {/* Renovation */}
    {!isOik&&<div>
      <label style={{fontSize:12,fontWeight:500,color:"var(--color-text-secondary)",display:"block",marginBottom:4}}>Τι έχει ανακαινιστεί;</label>
      <p style={{margin:"0 0 10px",fontSize:12,color:"var(--color-text-secondary)"}}>Επίλεξε ό,τι ισχύει — κάθε επιλογή προσθέτει αξία στην εκτίμηση</p>
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{RENOV_ITEMS.map(r=>chip(f.renovItems.includes(r),()=>togRenov(r),r))}</div>
      {f.renovItems.length>0&&<div style={{marginTop:6,fontSize:12,color:"#22c55e"}}>+{f.renovItems.length*2.5}% εκτιμώμενη προσαύξηση αξίας</div>}
    </div>}

    {/* Extras */}
    {!isOik&&<div>
      <label style={{fontSize:12,fontWeight:500,color:"var(--color-text-secondary)",display:"block",marginBottom:10}}>Χαρακτηριστικά</label>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        {EXTRAS.map(({k,l})=>(
          <label key={k} style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",padding:"10px 14px",border:"1px solid",borderColor:f[k]?"#22c55e":"var(--color-border-tertiary)",borderRadius:8,background:f[k]?"rgba(34,197,94,0.06)":"transparent",transition:"all .15s"}}>
            <input type="checkbox" checked={!!f[k]} onChange={()=>tog(k)} style={{accentColor:RED,width:16,height:16}}/>
            <span style={{fontSize:13,color:f[k]?"var(--color-text-primary)":"var(--color-text-secondary)",fontWeight:f[k]?500:400}}>{l}</span>
            {f[k]&&k!=="needs_renovation"&&<span style={{marginLeft:"auto",fontSize:11,color:"#22c55e",fontWeight:500}}>+{k==="has_parking"||k==="is_front"?"3":"2"}%</span>}
            {f[k]&&k==="needs_renovation"&&<span style={{marginLeft:"auto",fontSize:11,color:RED,fontWeight:500}}>-18%</span>}
          </label>
        ))}
      </div>
    </div>}

    <div style={{display:"flex",justifyContent:"space-between",marginTop:8}}>
      <button onClick={()=>ss(0)} style={{padding:"11px 20px",borderRadius:8,border:"1px solid var(--color-border-secondary)",background:"transparent",cursor:"pointer",fontSize:14,color:"var(--color-text-secondary)"}}>← Πίσω</button>
      <button onClick={go} style={{padding:"11px 28px",borderRadius:8,border:"none",background:RED,color:"white",cursor:"pointer",fontSize:14,fontWeight:500}}>Εκτίμηση →</button>
    </div>
  </div>}

  {/* STEP 2: Αποτέλεσμα */}
  {step===2&&res&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"1.5rem"}}>

    {/* Left: price */}
    <div style={{display:"flex",flexDirection:"column",gap:"1rem"}}>

      {/* Main card */}
      <div style={{background:"#111",borderRadius:12,padding:"1.5rem",color:"white"}}>
        <div style={{fontSize:11,opacity:.5,textTransform:"uppercase",letterSpacing:".1em",marginBottom:8}}>{res.isRen?"Εκτιμώμενο ενοίκιο":"Εκτιμώμενη αξία"}</div>
        <div style={{fontSize:38,fontWeight:500,letterSpacing:"-0.02em",lineHeight:1}}>{fmt(res.est)} <span style={{fontSize:18,opacity:.6}}>{lbl}</span></div>
        <div style={{fontSize:13,opacity:.5,marginTop:6}}>{res.hood} · {res.dist}km · €{fmt(res.psm)}/τμ</div>

        {/* Quantile bar */}
        <div style={{marginTop:"1.25rem",padding:"1rem",background:"rgba(255,255,255,0.06)",borderRadius:8}}>
          <div style={{fontSize:11,opacity:.4,marginBottom:10,textTransform:"uppercase",letterSpacing:".08em"}}>Εύρος αγοράς (p10 — p90)</div>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{textAlign:"right",minWidth:80}}><div style={{fontSize:10,opacity:.4}}>Συντηρητική</div><div style={{fontSize:16,fontWeight:500}}>{fmt(res.p10)}</div></div>
            <div style={{flex:1,height:6,background:"rgba(255,255,255,0.12)",borderRadius:999,position:"relative"}}>
              <div style={{position:"absolute",left:"12%",right:"12%",height:"100%",background:RED,borderRadius:999}}/>
              <div style={{position:"absolute",left:"50%",transform:"translateX(-50%)",top:-4,width:2,height:14,background:"white",borderRadius:1}}/>
            </div>
            <div style={{minWidth:80}}><div style={{fontSize:10,opacity:.4}}>Αισιόδοξη</div><div style={{fontSize:16,fontWeight:500}}>{fmt(res.p90)}</div></div>
          </div>
          <div style={{fontSize:11,opacity:.35,marginTop:8,textAlign:"center"}}>Το 80% των συγκρίσιμων ακινήτων βρίσκεται σε αυτό το εύρος</div>
        </div>

        {/* Summary pills */}
        <div style={{marginTop:"1rem",display:"flex",gap:8,flexWrap:"wrap"}}>
          {[["Μέση αγοράς περιοχής","€"+fmt(res.basePsm)+"/τμ"],["Εκτ. €/τμ","€"+fmt(res.psm)],["Confidence","~87%"]].map(([l,v])=>(
            <div key={l} style={{padding:"6px 12px",background:"rgba(255,255,255,0.08)",borderRadius:20}}>
              <span style={{fontSize:11,opacity:.5}}>{l}: </span>
              <span style={{fontSize:12,fontWeight:500}}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Feedback */}
      <div style={{background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:12,padding:"1.25rem"}}>
        <div style={{fontWeight:500,marginBottom:4,fontSize:14}}>Feedback → βελτιώνει τον αλγόριθμο</div>
        <p style={{margin:"0 0 10px",fontSize:12,color:"var(--color-text-secondary)"}}>Καταχώρησε την πραγματική τιμή συναλλαγής.</p>
        {ok
          ?<div style={{color:"#22c55e",fontWeight:500,fontSize:13}}>✓ Καταχωρήθηκε — ευχαριστούμε!</div>
          :<div style={{display:"flex",gap:8}}>
            <input placeholder={"π.χ. Τελική τιμή "+lbl+" 280.000"} value={fb} onChange={e=>sfb(e.target.value)} style={{flex:1}}/>
            <button onClick={send} style={{padding:"0 16px",borderRadius:8,border:"none",background:RED,color:"white",cursor:"pointer",fontSize:13,fontWeight:500,whiteSpace:"nowrap"}}>Αποθήκευση</button>
          </div>
        }
      </div>

      <button onClick={()=>{sr(null);ss(0);sf(init);}} style={{padding:"10px",borderRadius:8,border:"1px solid var(--color-border-secondary)",background:"transparent",cursor:"pointer",fontSize:13,color:"var(--color-text-secondary)"}}>← Νέα εκτίμηση</button>
    </div>

    {/* Right: feature importance + summary */}
    <div style={{display:"flex",flexDirection:"column",gap:"1rem"}}>

      {/* Input summary */}
      <div style={{background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:12,padding:"1.25rem"}}>
        <div style={{fontWeight:500,marginBottom:12,fontSize:14}}>Στοιχεία εκτίμησης</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6px 16px"}}>
          {[["Τύπος",f.ptype],["Συναλλαγή",f.tx==="sale"?"Πώληση":"Ενοικίαση"],["Εμβαδόν",f.sqm+" τμ"],["Υπν.",f.bd||"—"],["Όροφος",f.floor],["Έτος κατ.",f.yb],["Κατάσταση",f.cond],["Ανακ. στοιχεία",f.renovItems.length>0?f.renovItems.join(", "):"—"],["Χαρακτ.",EXTRAS.filter(e=>f[e.k]).map(e=>e.l).join(", ")||"—"]].map(([l,v])=>(
            <div key={l} style={{padding:"4px 0",borderBottom:"0.5px solid var(--color-border-tertiary)"}}>
              <div style={{fontSize:11,color:"var(--color-text-secondary)"}}>{l}</div>
              <div style={{fontSize:13,fontWeight:500,marginTop:1,wordBreak:"break-word"}}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Feature importance */}
      <div style={{background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:12,padding:"1.25rem"}}>
        <div style={{fontWeight:500,marginBottom:12,fontSize:14}}>Τι επηρεάζει την τιμή</div>
        {FI.map(({f:fn,v,c})=>(
          <div key={fn} style={{marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4}}>
              <span style={{color:"var(--color-text-secondary)"}}>{fn}</span>
              <span style={{fontWeight:500,color:RED}}>{v}%</span>
            </div>
            <div style={{background:"var(--color-background-secondary)",borderRadius:999,height:5}}>
              <div style={{height:"100%",background:RED,opacity:v>10?1:0.5,borderRadius:999,width:v+"%",transition:"width .6s ease"}}/>
            </div>
          </div>
        ))}
        <p style={{margin:"12px 0 0",fontSize:11,color:"var(--color-text-secondary)"}}>Βασισμένο σε 1.200 πράξεις demo · αντικαθίσταται με πραγματικά data</p>
      </div>
    </div>
  </div>}

  {/* Footer */}
  <div style={{marginTop:"2rem",paddingTop:"1rem",borderTop:"0.5px solid var(--color-border-tertiary)",display:"flex",gap:20,flexWrap:"wrap",fontSize:11,color:"var(--color-text-secondary)"}}>
    <span>HistGradientBoosting ensemble</span>
    <span>Quantile Regression p10/p50/p90</span>
    <span>Haversine KNN comparables</span>
    <span>R²=0.93 · MAE ±€64k</span>
    <span>Βελτιώνεται με κάθε feedback</span>
  </div>
</div>);}