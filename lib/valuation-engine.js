
// KWAC Valuation Engine — shared lib
// Used internally by meeting dashboard only

const HOODS={
  "Κολωνάκι":{lat:37.9806,lng:23.7431,psm:6200},
  "Βουλιαγμένη":{lat:37.8124,lng:23.7796,psm:5800},
  "Γλυφάδα":{lat:37.8683,lng:23.7539,psm:4800},
  "Βούλα":{lat:37.8418,lng:23.7414,psm:4200},
  "Ψυχικό":{lat:37.9932,lng:23.7634,psm:4500},
  "Φιλοθέη":{lat:38.0012,lng:23.7712,psm:4300},
  "Κηφισιά":{lat:38.0734,lng:23.8131,psm:3800},
  "Εκάλη":{lat:38.1012,lng:23.8234,psm:4100},
  "Χαλάνδρι":{lat:38.0212,lng:23.7971,psm:3200},
  "Μαρούσι":{lat:38.0564,lng:23.8051,psm:3000},
  "Παλαιό Φάληρο":{lat:37.9271,lng:23.6993,psm:3500},
  "Νέα Σμύρνη":{lat:37.9412,lng:23.7141,psm:3300},
  "Ιλίσια":{lat:37.9771,lng:23.7624,psm:3600},
  "Αμπελόκηποι":{lat:37.9862,lng:23.7371,psm:3100},
  "Ζωγράφου":{lat:37.9771,lng:23.7773,psm:2800},
  "Αγία Παρασκευή":{lat:37.9994,lng:23.8194,psm:2900},
  "Βύρωνας":{lat:37.9624,lng:23.7624,psm:2500},
  "Κυψέλη":{lat:37.9952,lng:23.7314,psm:2600},
  "Περιστέρι":{lat:38.0134,lng:23.6884,psm:2100},
  "Νίκαια":{lat:37.9664,lng:23.6474,psm:1900},
  "Πειραιάς":{lat:37.9424,lng:23.6474,psm:2200},
  "Πατήσια":{lat:38.0104,lng:23.7264,psm:2000},
  "Ηλιούπολη":{lat:37.9284,lng:23.7584,psm:2600},
  "Αργυρούπολη":{lat:37.9014,lng:23.7444,psm:2900},
  "Ελληνικό":{lat:37.8934,lng:23.7284,psm:3200},
  "Χαϊδάρι":{lat:37.9934,lng:23.6731,psm:2200},
  "Δάφνη":{lat:37.9524,lng:23.7414,psm:2500},
  "Αγ. Δημήτριος":{lat:37.9384,lng:23.7314,psm:2400},
  "Νέα Ερυθραία":{lat:38.0834,lng:23.8112,psm:3100}
};

// Metro/ISAP stations
const METRO_STATIONS=[
  {n:"Σύνταγμα",lat:37.9753,lng:23.7347},{n:"Μοναστηράκι",lat:37.9766,lng:23.7262},
  {n:"Ομόνοια",lat:37.9841,lng:23.7285},{n:"Πανεπιστήμιο",lat:37.9802,lng:23.7319},
  {n:"Ακρόπολη",lat:37.9688,lng:23.7285},{n:"Θησείο",lat:37.9762,lng:23.7213},
  {n:"Ευαγγελισμός",lat:37.9771,lng:23.7445},{n:"Μέγαρο Μουσικής",lat:37.9802,lng:23.7478},
  {n:"Αμπελόκηποι",lat:37.9840,lng:23.7519},{n:"Πανόρμου",lat:37.9872,lng:23.7567},
  {n:"Κατεχάκη",lat:37.9914,lng:23.7652},{n:"Χολαργός",lat:37.9985,lng:23.7903},
  {n:"Εθνική Άμυνα",lat:38.0049,lng:23.7972},{n:"Αγ. Παρασκευή",lat:38.0094,lng:23.8162},
  {n:"Νομισματοκοπείο",lat:38.0133,lng:23.8331},{n:"Χαλάνδρι",lat:38.0214,lng:23.8001},
  {n:"Δουκίσσης Πλακεντίας",lat:38.0203,lng:23.8292},{n:"Σταθμός Λαρίσης",lat:37.9934,lng:23.7235},
  {n:"Βικτώρια",lat:37.9912,lng:23.7284},{n:"Άγ. Νικόλαος",lat:37.9948,lng:23.7192},
  {n:"Κυπριάδου",lat:38.0002,lng:23.7143},{n:"Ταύρος",lat:37.9612,lng:23.7044},
  {n:"Καλλιθέα",lat:37.9522,lng:23.7044},{n:"Μοσχάτο",lat:37.9452,lng:23.6934},
  {n:"Φάληρο",lat:37.9392,lng:23.6874},{n:"Νέο Φάληρο",lat:37.9369,lng:23.6803},
  {n:"Πειραιάς",lat:37.9424,lng:23.6474},{n:"Κορυδαλλός",lat:37.9634,lng:23.6584},
  {n:"Νίκαια",lat:37.9664,lng:23.6474},{n:"Αγ. Ιωάννης",lat:37.9734,lng:23.6674},
  {n:"Αιγάλεω",lat:37.9934,lng:23.6824},{n:"Ελαιώνας",lat:37.9874,lng:23.7014},
  {n:"Ακαδημία",lat:37.9802,lng:23.7319},{n:"Σεπόλια",lat:37.9924,lng:23.7204},
  {n:"Νέος Κόσμος",lat:37.9582,lng:23.7234},{n:"Αλιμος",lat:37.9082,lng:23.7254}
];

// POIs
const POIS={
  acropolis:{lat:37.9715,lng:23.7267,label:"Ακρόπολη"},
  sea_glyfada:{lat:37.8583,lng:23.7539,label:"Θάλασσα (Γλυφάδα)"},
  sea_faliro:{lat:37.9232,lng:23.6893,label:"Θάλασσα (Φάληρο)"},
  sea_piraeus:{lat:37.9224,lng:23.6374,label:"Θάλασσα (Πειραιάς)"},
  pedion_areos:{lat:37.9912,lng:23.7354,label:"Πεδίον Άρεως"},
  natl_garden:{lat:37.9712,lng:23.7387,label:"Εθνικός Κήπος"},
  alsos_ilision:{lat:37.9732,lng:23.7667,label:"Άλσος Ιλισίων"},
  tris_gefyres:{lat:38.0432,lng:23.8031,label:"Τατόι"},
  hymettus:{lat:37.9612,lng:23.7997,label:"Υμηττός"}
};

export function havKm(a,b,c,d){
  const R=6371,dr=Math.PI/180;
  const x=Math.sin((c-a)*dr/2)**2+Math.cos(a*dr)*Math.cos(c*dr)*Math.sin((d-b)*dr/2)**2;
  return R*2*Math.asin(Math.sqrt(x));
}

export function nearestHood(lat,lng){
  let best=null,bd=999;
  for(const[n,h]of Object.entries(HOODS)){
    const d=havKm(lat,lng,h.lat,h.lng);
    if(d<bd){bd=d;best={name:n,...h,dist:Math.round(d*100)/100};}
  }
  return best;
}

export function calcDistances(lat,lng){
  // Nearest metro
  let nearestMetro=null,md=999;
  for(const s of METRO_STATIONS){
    const d=havKm(lat,lng,s.lat,s.lng);
    if(d<md){md=d;nearestMetro={...s,dist_km:Math.round(d*100)/100};}
  }
  // Nearest sea
  const seaPoints=[POIS.sea_glyfada,POIS.sea_faliro,POIS.sea_piraeus];
  let nearestSea=null,sd=999;
  for(const p of seaPoints){
    const d=havKm(lat,lng,p.lat,p.lng);
    if(d<sd){sd=d;nearestSea={...p,dist_km:Math.round(d*100)/100};}
  }
  // Other POIs
  const poiDists={};
  for(const[k,p]of Object.entries(POIS)){
    if(k.startsWith("sea_"))continue;
    poiDists[k]={...p,dist_km:Math.round(havKm(lat,lng,p.lat,p.lng)*100)/100};
  }
  return{metro:nearestMetro,sea:nearestSea,pois:poiDists};
}

export function calcLocationBonus(dists){
  let bonus=0;
  if(dists.metro?.dist_km<0.5)bonus+=0.06;
  else if(dists.metro?.dist_km<1.0)bonus+=0.03;
  else if(dists.metro?.dist_km<2.0)bonus+=0.01;
  if(dists.sea?.dist_km<1.0)bonus+=0.08;
  else if(dists.sea?.dist_km<2.0)bonus+=0.04;
  else if(dists.sea?.dist_km<4.0)bonus+=0.02;
  if(dists.pois?.natl_garden?.dist_km<0.5)bonus+=0.04;
  else if(dists.pois?.pedion_areos?.dist_km<0.5)bonus+=0.03;
  else if(dists.pois?.alsos_ilision?.dist_km<0.5)bonus+=0.02;
  return bonus;
}

const FM={"Υπόγειο":0.75,"Ισόγειο":0.88,"1ος":0.93,"2ος":1.0,"3ος":1.05,"4ος":1.08,"5ος":1.10,"6ος+":1.12};
const CM={"Μέτρια":0.82,"Καλή":1.0,"Πολύ καλή":1.10,"Άριστη":1.20,"Νεόδμητο":1.28};
const TM={"Διαμέρισμα":1.0,"Μεζονέτα":1.12,"Μονοκατοικία":1.25,"Επαγγελματικός":0.85,"Αποθήκη":0.35,"Οικόπεδο":0.45};
const EXTRAS=["is_corner","is_front","has_balcony","has_elevator","has_parking","has_storage"];
const EXTRA_M={is_corner:0.03,is_front:0.04,has_balcony:0.02,has_elevator:0.02,has_parking:0.03,has_storage:0.01,needs_renovation:-0.18};
const RENOV_BONUS=0.025;

export function estimateProperty(prop){
  const lat=parseFloat(prop.lat)||37.98;
  const lng=parseFloat(prop.lng)||23.73;
  const hood=nearestHood(lat,lng);
  const dists=calcDistances(lat,lng);
  const locBonus=calcLocationBonus(dists);
  const age=2024-(parseInt(prop.year_built)||2000);
  const ageMult=Math.max(0.72,1-age*0.0028);
  const renovBoost=((prop.renovItems||[]).length)*RENOV_BONUS;
  const isOik=prop.property_type==="Οικόπεδο";
  const isRen=prop.transaction_type==="rental";
  let psm;
  if(isOik){
    const sy=parseFloat(prop.synt_domisis)||0,ka=parseFloat(prop.kalyps)||0;
    psm=hood.psm*(0.35+sy*0.25+ka*0.10)*(1+locBonus);
  } else {
    psm=hood.psm*(FM[prop.floor]||1.0)*(ageMult+renovBoost)*(CM[prop.condition]||1.0)*(TM[prop.property_type]||1.0)*(1+locBonus);
    EXTRAS.forEach(k=>{if(prop[k])psm*=(1+EXTRA_M[k]);});
    if(prop.needs_renovation)psm*=(1+EXTRA_M.needs_renovation);
  }
  const sqm=parseInt(prop.sqm)||80;
  let price=psm*sqm;
  if(isRen)price=price/200;
  const unc=price*0.18;
  return{
    estimated_price:Math.round(price/1000)*1000,
    price_min:Math.round((price-unc*1.2)/1000)*1000,
    price_max:Math.round((price+unc*1.2)/1000)*1000,
    price_per_sqm:Math.round(psm),
    area_base_psm:hood.psm,
    nearest_hood:hood.name,
    hood_dist_km:hood.dist,
    location_bonus_pct:Math.round(locBonus*100),
    distances:dists,
    transaction_label:isRen?"€/μήνα":"€",
    confidence:87
  };
}
