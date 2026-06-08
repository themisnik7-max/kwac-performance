'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const C = {red:'#CC2229',redLight:'#FDF2F2',dark:'#1A1A1A',muted:'#6B7280',border:'#EBEBEB',subtle:'#F7F7F7',white:'#FFFFFF',green:'#16A34A',greenLight:'#F0FDF4',amber:'#D97706'}

const TARGETS = {cold_calls:120,follow_up:200,meet1_seller_live:4,meet1_seller_phone:2,meet1_buyer_live:2,meet2_seller:4,excl_listing_sale:2,contract_seller:1}
const XP_MAP = {cold_calls:1,follow_up:1,leads_cold:3,leads_cultivation:3,leads_mail:3,leads_social:3,leads_database:3,meet1_seller_live:15,meet1_seller_phone:10,meet2_seller:25,meet1_buyer_live:15,meet1_buyer_phone:10,meet1_tenant_live:10,meet1_tenant_phone:7,excl_listing_sale:80,simple_listing_sale:40,excl_rental_high:60,excl_rental_low:40,simple_rental:20,contract_seller:150,contract_buyer:150,collab_internal:30,collab_external:30,offer_buyer:10,offer_tenant:10,photo_professional:5,open_house:20,matterport:15,new_partner:25,referral_sent:10,referral_received:10,training_meeting:5,admin_1on1:5}

const FORM_SECTIONS = [
  {label:'Lead Generation',accent:C.red,fields:[
    {key:'cold_calls',label:'Cold Calls (1ης επικοινωνίας)',min:120,suffix:'calls'},
    {key:'leads_cold',label:'Leads από Cold Calls',suffix:'leads'},
    {key:'follow_up',label:'Τηλεφωνικό Follow Up',min:200,suffix:'calls'},
    {key:'leads_cultivation',label:'Leads από Καλλιέργεια Περιοχής',suffix:'leads'},
    {key:'leads_mail',label:'Leads από Mail / Viber / SMS',suffix:'leads'},
    {key:'leads_social',label:'Leads από Social Media',suffix:'leads'},
    {key:'leads_database',label:'Leads από Βάση Δεδομένων',suffix:'leads'},
  ]},
  {label:'Ραντεβού',accent:'#2563EB',fields:[
    {key:'meet1_seller_live',label:'1ο Ραντεβού Πωλητή — ζωντανά',min:4,suffix:'ραντ.'},
    {key:'meet1_seller_phone',label:'1ο Ραντεβού Πωλητή — τηλεφωνικά',suffix:'ραντ.'},
    {key:'meet2_seller',label:'2ο Ραντεβού Πωλητή (Παρουσίαση)',min:4,suffix:'ραντ.'},
    {key:'meet1_buyer_live',label:'1ο Ραντεβού Αγοραστή — ζωντανά',suffix:'ραντ.'},
    {key:'meet1_buyer_phone',label:'1ο Ραντεβού Αγοραστή — τηλεφωνικά',suffix:'ραντ.'},
    {key:'meet1_tenant_live',label:'1ο Ραντεβού Μισθωτή — ζωντανά',suffix:'ραντ.'},
    {key:'meet1_tenant_phone',label:'1ο Ραντεβού Μισθωτή — τηλεφωνικά',suffix:'ραντ.'},
  ]},
  {label:'Αναθέσεις',accent:'#D97706',fields:[
    {key:'excl_listing_sale',label:'Αποκλειστική Ανάθεση Πώλησης',min:2,suffix:'εντολές'},
    {key:'simple_listing_sale',label:'Απλή Ανάθεση Πώλησης',suffix:'εντολές'},
    {key:'excl_rental_high',label:'Αποκλ. Εκμίσθωσης (>1.000€)',suffix:'εντολές'},
    {key:'excl_rental_low',label:'Αποκλ. Εκμίσθωσης (≤1.000€)',suffix:'εντολές'},
    {key:'simple_rental',label:'Απλή Εντολή Εκμίσθωσης',suffix:'εντολές'},
  ]},
  {label:'Συμβόλαια',accent:C.green,fields:[
    {key:'contract_seller',label:'Πράξη Συμβολαίου Πωλητή',min:1,suffix:'συμβόλ.'},
    {key:'contract_buyer',label:'Πράξη Συμβολαίου Αγοραστή',suffix:'συμβόλ.'},
    {key:'offer_buyer',label:'Προσφορά Αγοραστή (υπογ.)',suffix:''},
    {key:'offer_tenant',label:'Προσφορά Μισθωτή (υπογ.)',suffix:''},
    {key:'collab_internal',label:'Συνεργασία εντός KW',suffix:''},
    {key:'collab_external',label:'Συνεργασία εκτός KW',suffix:''},
  ]},
  {label:'Marketing',accent:'#7C3AED',fields:[
    {key:'photo_professional',label:'Επαγγελματική Φωτογράφιση',suffix:'ακίν.'},
    {key:'open_house',label:'Open House',suffix:'events'},
    {key:'matterport',label:'Matterport 3D Tour',suffix:'tours'},
  ]},
  {label:'Networking & Training',accent:C.muted,fields:[
    {key:'new_partner',label:'Πρόταση Νέου Συνεργάτη',suffix:''},
    {key:'referral_sent',label:'Αποστολή Σύστασης',suffix:''},
    {key:'referral_received',label:'Αποδοχή Σύστασης',suffix:''},
    {key:'training_meeting',label:'Meeting Εκπαίδευσης',suffix:''},
    {key:'admin_1on1',label:'Admin 1:1',suffix:''},
  ]},
]

function calcXP(d){return Object.keys(XP_MAP).reduce((s,k)=>s+(d[k]||0)*XP_MAP[k],0)}
function Bar({value,max,color,h=4}){const p=Math.min(100,Math.round(value/max*100));return <div style={{background:'#E9E9E9',borderRadius:99,height:h,overflow:'hidden'}}><div style={{width:p+'%',height:h,background:color,borderRadius:99,transition:'width .4s'}}/></div>}

function getWeekNumber(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(),0,1))
  return {week: Math.ceil((((date - yearStart) / 86400000) + 1)/7), year: date.getUTCFullYear()}
}

export default function SubmitPage() {
  const [user, setUser] = useState(null)
  const [agentData, setAgentData] = useState(null)
  const [vals, setVals] = useState({})
  const [sec, setSec] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)
  const [isEditable, setIsEditable] = useState(true)
  const [lastSaved, setLastSaved] = useState(null)

  const {week, year} = getWeekNumber(new Date())

  useEffect(() => {
    supabase.auth.getUser().then(async ({data}) => {
      if(!data.user) { window.location.href = '/login'; return }
      setUser(data.user)

      // Get agent record
      const {data: agent} = await supabase
        .from('agents')
        .select('*')
        .eq('email', data.user.email)
        .single()
      setAgentData(agent)

      if(agent) {
        // Load existing submission for this week
        const {data: existing} = await supabase
          .from('weekly_submissions')
          .select('*')
          .eq('agent_id', agent.id)
          .eq('week_number', week)
          .eq('year', year)
          .single()

        if(existing) {
          setVals(existing)
          setIsEditable(existing.is_editable)
          setLastSaved(new Date(existing.updated_at).toLocaleString('el-GR'))
        }
      }
    })
  }, [])

  function set(k, v) { setVals(p => ({...p, [k]: Math.max(0, parseInt(v)||0)})) }

  async function handleSave() {
    if(!agentData) { setError('Δεν βρέθηκε ο λογαριασμός σου. Επικοινώνησε με τον διαχειριστή.'); return }
    if(!isEditable) { setError('Η προθεσμία έχει λήξει. Δεν μπορείς να επεξεργαστείς αυτή την εβδομάδα.'); return }

    setSaving(true)
    setError(null)

    const xp = calcXP(vals)
    const payload = {
      agent_id: agentData.id,
      week_number: week,
      year: year,
      ...vals,
      xp_earned: xp,
      is_editable: true,
      updated_at: new Date().toISOString(),
    }

    const {error: err} = await supabase
      .from('weekly_submissions')
      .upsert(payload, {onConflict: 'agent_id,week_number,year', ignoreDuplicates: false})

    setSaving(false)
    if(err) {
      setError('Σφάλμα αποθήκευσης: ' + err.message)
    } else {
      setSaved(true)
      setLastSaved(new Date().toLocaleString('el-GR'))
      setTimeout(() => setSaved(false), 3000)
    }
  }

  const xp = calcXP(vals)
  const done = Object.entries(TARGETS).filter(([k,t]) => (vals[k]||0) >= t).length
  const total = Object.keys(TARGETS).length

  if(!user) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'#F4F4F4'}}><div style={{fontSize:13,color:C.muted}}>Φόρτωση...</div></div>

  return (
    <div style={{display:'flex',minHeight:'100vh',background:'#F4F4F4',fontFamily:"-apple-system,BlinkMacSystemFont,'Inter',sans-serif",color:C.dark}}>
      {/* Sidebar */}
      <div style={{width:64,background:'#111',display:'flex',flexDirection:'column',alignItems:'center',paddingTop:16,paddingBottom:16,gap:4,position:'fixed',top:0,left:0,height:'100vh',zIndex:100}}>
        <div style={{color:'#fff',fontWeight:800,fontSize:12,marginBottom:18,letterSpacing:1,textAlign:'center',lineHeight:1.2}}>KW<br/><span style={{color:C.red}}>AC</span></div>
        {[{icon:'⊞',label:'Dashboard',href:'/dashboard'},{icon:'✏',label:'Καταχώρηση',href:'/submit',active:true},{icon:'📍',label:'Προφίλ',href:'/profile'},{icon:'💎',label:'Εκτίμηση',href:'/valuation'},{icon:'◎',label:'AI Coach',href:'/chat'}].map((it,i)=>(
          <a key={i} href={it.href} style={{width:48,height:48,borderRadius:10,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:2,background:it.active?'rgba(255,255,255,.12)':'transparent',color:it.active?'#fff':'rgba(255,255,255,.35)',fontSize:16,textDecoration:'none',transition:'all .15s'}}>
            <span>{it.icon}</span><span style={{fontSize:7,fontWeight:600}}>{it.label}</span>
          </a>
        ))}
      </div>

      <div style={{marginLeft:64,flex:1,padding:'28px 32px',overflowY:'auto'}}>
        {/* Header */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:24}}>
          <div>
            <h1 style={{fontSize:22,fontWeight:700,letterSpacing:-.5,margin:'0 0 4px',color:C.dark}}>Καταχώρηση Εβδομάδας {week}</h1>
            <p style={{fontSize:13,color:C.muted,margin:0}}>
              {year} · {isEditable ? 'Ανοιχτό μέχρι Κυριακή 23:59' : '⚠️ Κλειδωμένο'}
              {lastSaved && <span style={{marginLeft:12,color:C.green}}>✓ Τελευταία αποθήκευση: {lastSaved}</span>}
            </p>
          </div>
          <div style={{display:'flex',gap:12,alignItems:'center'}}>
            <div style={{background:C.dark,borderRadius:12,padding:'10px 16px',textAlign:'center'}}>
              <div style={{fontSize:20,fontWeight:800,color:C.red}}>+{xp}</div>
              <div style={{fontSize:10,color:'rgba(255,255,255,.5)',fontWeight:600}}>XP · {done}/{total} στόχοι</div>
            </div>
            <button onClick={handleSave} disabled={saving||!isEditable}
              style={{background:saved?C.green:!isEditable?C.muted:C.red,color:'#fff',border:'none',borderRadius:10,padding:'12px 24px',fontSize:13,fontWeight:700,cursor:!isEditable?'not-allowed':'pointer',transition:'background .3s',opacity:saving?0.7:1}}>
              {saving?'Αποθήκευση...' : saved?'✓ Αποθηκεύτηκε' : !isEditable?'🔒 Κλειδωμένο' : 'Αποθήκευση'}
            </button>
          </div>
        </div>

        {error && (
          <div style={{background:'#FEF2F2',border:'1px solid #FCA5A5',borderRadius:10,padding:'12px 16px',marginBottom:16,fontSize:13,color:'#991B1B'}}>
            ⚠️ {error}
          </div>
        )}

        {!agentData && user && (
          <div style={{background:'#FFFBEB',border:'1px solid #FCD34D',borderRadius:10,padding:'12px 16px',marginBottom:16,fontSize:13,color:'#92400E'}}>
            ⚠️ Ο λογαριασμός σου δεν έχει συνδεθεί ακόμα με agent profile. Τα δεδομένα δεν θα αποθηκευτούν μέχρι ο διαχειριστής να σε προσθέσει στη βάση.
          </div>
        )}

        {/* Progress */}
        <div style={{background:C.white,borderRadius:12,padding:'14px 18px',border:'1px solid '+C.border,marginBottom:20}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
            <span style={{fontSize:12,fontWeight:600}}>Πρόοδος στόχων εβδομάδας</span>
            <span style={{fontSize:12,color:C.muted}}>{done} / {total} στόχοι ✓</span>
          </div>
          <Bar value={done} max={total} color={C.red} h={6}/>
        </div>

        {/* Section tabs */}
        <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:16}}>
          {FORM_SECTIONS.map((s,i) => (
            <button key={i} onClick={()=>setSec(i)} style={{padding:'7px 16px',borderRadius:99,border:'1px solid '+(sec===i?s.accent:C.border),background:sec===i?s.accent:C.white,color:sec===i?'#fff':C.muted,fontSize:12,fontWeight:600,cursor:'pointer',transition:'all .15s'}}>
              {s.label}
            </button>
          ))}
        </div>

        {/* Fields */}
        <div style={{background:C.white,borderRadius:16,border:'1px solid '+C.border,overflow:'hidden',boxShadow:'0 1px 4px rgba(0,0,0,.04)'}}>
          <div style={{padding:'14px 22px',borderBottom:'1px solid '+C.border,display:'flex',alignItems:'center',gap:10,background:C.subtle}}>
            <div style={{width:8,height:8,borderRadius:'50%',background:FORM_SECTIONS[sec].accent}}/>
            <span style={{fontSize:13,fontWeight:700}}>{FORM_SECTIONS[sec].label}</span>
          </div>
          {FORM_SECTIONS[sec].fields.map((f,fi) => {
            const val = vals[f.key]||0
            const isT = f.min !== undefined
            const ok = isT && val >= f.min
            return (
              <div key={f.key} style={{display:'flex',alignItems:'center',padding:'13px 22px',borderBottom:fi<FORM_SECTIONS[sec].fields.length-1?'1px solid #F5F5F5':'none',gap:16,background:ok?'#F0FFF4':'#fff'}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,color:isT?C.dark:C.muted,fontWeight:isT?500:400}}>{f.label}</div>
                  {isT && <div style={{fontSize:11,color:C.muted,marginTop:2}}>Στόχος: {f.min} {f.suffix}</div>}
                </div>
                {ok && <span style={{fontSize:13,color:C.green,fontWeight:700}}>✓</span>}
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <button onClick={()=>set(f.key,val-1)} disabled={!isEditable} style={{width:32,height:32,borderRadius:8,border:'1px solid '+C.border,background:C.white,cursor:!isEditable?'not-allowed':'pointer',fontSize:16,color:C.muted}}>−</button>
                  <input type="number" value={val} min={0} onChange={e=>set(f.key,e.target.value)} disabled={!isEditable}
                    style={{width:64,textAlign:'center',padding:'6px 0',borderRadius:8,border:'1px solid '+(isT&&!ok&&val>0?'#FCA5A5':C.border),fontSize:15,fontWeight:700,color:ok?C.green:C.dark,background:'#FAFAFA'}}/>
                  <button onClick={()=>set(f.key,val+1)} disabled={!isEditable} style={{width:32,height:32,borderRadius:8,border:'1px solid '+C.border,background:C.white,cursor:!isEditable?'not-allowed':'pointer',fontSize:16,color:C.red,fontWeight:700}}>+</button>
                </div>
              </div>
            )
          })}
        </div>

        <div style={{marginTop:16,display:'flex',justifyContent:'flex-end'}}>
          <button onClick={handleSave} disabled={saving||!isEditable}
            style={{background:saved?C.green:!isEditable?C.muted:C.red,color:'#fff',border:'none',borderRadius:12,padding:'14px 32px',fontSize:14,fontWeight:700,cursor:!isEditable?'not-allowed':'pointer',transition:'background .3s'}}>
            {saving?'Αποθήκευση...' : saved?'✓ Αποθηκεύτηκε!' : !isEditable?'🔒 Κλειδωμένο' : 'Αποθήκευση εβδομάδας'}
          </button>
        </div>
      </div>
    </div>
  )
}