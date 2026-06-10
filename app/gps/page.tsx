'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'

const PRESETS: Record<string, number[]> = {
  starter: [25000,150000,3.5,8,40,30,60,70,48],
  capper:  [50000,200000,4,10,50,40,60,70,48],
  pro:     [80000,280000,4,12,55,45,65,72,48],
  elite:   [120000,400000,4.5,15,60,50,70,75,50],
}

function fmt(n: number) { return n.toLocaleString('el-GR') }

export default function GPSPage() {
  const [agent, setAgent] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [realRates, setRealRates] = useState<any>(null)
  const [weeksData, setWeeksData] = useState(0)

  const [target, setTarget] = useState(50000)
  const [avgPrice, setAvgPrice] = useState(200000)
  const [commRate, setCommRate] = useState(4)
  const [cr1, setCr1] = useState(10)
  const [cr2, setCr2] = useState(50)
  const [cr3, setCr3] = useState(40)
  const [cr4, setCr4] = useState(60)
  const [split, setSplit] = useState(70)
  const [weeks, setWeeks] = useState(48)
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { window.location.href = '/login'; return }
      supabase.from('agents').select('*').eq('email', data.user.email).single()
        .then(({ data: a }) => {
          setAgent(a)
          if (a) loadGPS(a.id)
        })
    })
  }, [])

  async function loadGPS(agentId: string) {
    const res = await fetch(`/api/gps?agent_id=${agentId}`)
    const { goal, realRates: rr } = await res.json()
    if (goal) {
      setTarget(goal.target_income || 50000)
      setAvgPrice(goal.avg_property_price || 200000)
      setCommRate(goal.commission_rate || 4)
      setSplit(goal.agent_split || 70)
      setWeeks(goal.work_weeks || 48)
    }
    if (rr) {
      setRealRates(rr)
      setWeeksData(rr.weeks_of_data || 0)
      if (rr.cr_call_appt1) setCr1(rr.cr_call_appt1)
      if (rr.cr_appt1_appt2) setCr2(rr.cr_appt1_appt2)
      if (rr.cr_appt2_listing) setCr3(rr.cr_appt2_listing)
      if (rr.cr_listing_deal) setCr4(rr.cr_listing_deal)
    }
  }

  async function saveGoal() {
    if (!agent) return
    setSaving(true)
    await fetch('/api/gps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_id: agent.id,
        target_income: target, avg_property_price: avgPrice,
        commission_rate: commRate, agent_split: split, work_weeks: weeks,
        cr_call_appt1: cr1, cr_appt1_appt2: cr2,
        cr_appt2_listing: cr3, cr_listing_deal: cr4
      })
    })
    setToast('✅ GPS αποθηκεύτηκε!')
    setSaving(false)
    setTimeout(() => setToast(''), 2500)
  }

  function applyPreset(key: string) {
    const p = PRESETS[key]
    if (!p) return
    setTarget(p[0]); setAvgPrice(p[1]); setCommRate(p[2])
    setCr1(p[3]); setCr2(p[4]); setCr3(p[5]); setCr4(p[6])
    setSplit(p[7]); setWeeks(p[8])
  }

  const perDeal = avgPrice * (commRate/100) * (split/100)
  const dealsNeeded = Math.ceil(target / perDeal)
  const listingsNeeded = Math.ceil(dealsNeeded / (cr4/100))
  const appt2Needed = Math.ceil(listingsNeeded / (cr3/100))
  const appt1Needed = Math.ceil(appt2Needed / (cr2/100))
  const callsNeeded = Math.ceil(appt1Needed / (cr1/100))

  const callsW = Math.ceil(callsNeeded/weeks)
  const appt1W = Math.ceil(appt1Needed/weeks)
  const appt2W = Math.ceil(appt2Needed/weeks)
  const listW  = Math.ceil(listingsNeeded/weeks)
  const dealsM = dealsNeeded/12
  const listM  = listingsNeeded/12

  const level = target>=100000?'Elite':target>=70000?'Pro':target>=40000?'Capper':'Starter'
  const levelColors: Record<string,string> = {Starter:'#0F6E56',Capper:'#854F0B',Pro:'#185FA5',Elite:'#534AB7'}
  const levelBg: Record<string,string> = {Starter:'#E1F5EE',Capper:'#FAEEDA',Pro:'#E6F1FB',Elite:'#EEEDFE'}

  const sl = (label: string, val: number, set: (v:number)=>void, min:number, max:number, step:number, fmt2?:(v:number)=>string) => (
    <div style={{marginBottom:12}}>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
        <span style={{fontSize:12,color:'#888'}}>{label}</span>
        <span style={{fontSize:13,fontWeight:500}}>{fmt2 ? fmt2(val) : val}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={val}
        onChange={e=>set(Number(e.target.value))}
        style={{width:'100%'}} />
    </div>
  )

  const bar = (label: string, val: number, weekly: number, color: string) => (
    <div key={label} style={{marginBottom:12}}>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
        <span style={{fontSize:13,color:'#1a1a1a'}}>{label}</span>
        <div style={{display:'flex',gap:12}}>
          <span style={{fontSize:12,color:'#888'}}>Εβδομάδα: <strong>{weekly}</strong></span>
          <span style={{fontSize:12,color:'#888'}}>Χρόνος: <strong>{val}</strong></span>
        </div>
      </div>
      <div style={{background:'#f0f0f0',borderRadius:100,height:10,overflow:'hidden'}}>
        <div style={{height:'100%',borderRadius:100,background:color,width:'100%',transition:'width .5s'}} />
      </div>
      <div style={{display:'flex',justifyContent:'space-between',marginTop:2}}>
        <span style={{fontSize:11,color:'#bbb'}}>Στόχος: {weekly}/εβδομάδα</span>
        <span style={{fontSize:11,color:'#bbb'}}>{(val/12).toFixed(1)}/μήνα</span>
      </div>
    </div>
  )

  return (
    <div style={{display:'flex',minHeight:'100vh',background:'#f8f8f7'}}>
      <Sidebar active="gps" role={agent?.role} />
      <main style={{flex:1,padding:'2rem',maxWidth:960}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'1.5rem'}}>
          <div>
            <h1 style={{fontSize:22,fontWeight:500,color:'#1a1a1a',margin:0}}>GPS — Οικονομικό Πλάνο</h1>
            <p style={{color:'#888',fontSize:14,margin:'4px 0 0'}}>
              Βάλε τον στόχο σου — δες τι ακριβώς χρειάζεται για να τον πετύχεις
              {weeksData > 0 && <span style={{marginLeft:8,background:'#EAF3DE',color:'#3B6D11',fontSize:11,padding:'2px 8px',borderRadius:100}}> Βάσει {weeksData} εβδομάδων data</span>}
            </p>
          </div>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <select onChange={e=>applyPreset(e.target.value)} style={{padding:'7px 10px',border:'0.5px solid #ddd',borderRadius:8,fontSize:13,background:'#fff'}}>
              <option value="">Επίλεξε preset</option>
              <option value="starter">Starter €25k</option>
              <option value="capper">Capper €50k</option>
              <option value="pro">Pro €80k</option>
              <option value="elite">Elite €120k</option>
            </select>
            <button onClick={saveGoal} disabled={saving} style={{padding:'8px 16px',background:'#CC2229',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:500,cursor:'pointer'}}>
              {saving ? 'Αποθήκευση...' : 'Αποθήκευση GPS'}
            </button>
          </div>
        </div>

        {toast && <div style={{background:'#EAF3DE',color:'#3B6D11',padding:'10px 16px',borderRadius:8,marginBottom:16,fontSize:14}}>{toast}</div>}

        {realRates && (
          <div style={{background:'#E6F1FB',border:'0.5px solid #B5D4F4',borderRadius:8,padding:'10px 16px',marginBottom:16,fontSize:13,color:'#185FA5'}}>
            <strong>Τα conversion rates παρακάτω είναι αυτόματα από τα δεδομένα σου</strong> — βάσει {weeksData} εβδομάδων μετρησιμότητας. Μπορείς να τα αλλάξεις χειροκίνητα.
          </div>
        )}

        <div style={{display:'grid',gridTemplateColumns:'340px 1fr',gap:16}}>
          <div>
            <div style={{background:'#fff',border:'0.5px solid #e8e8e8',borderRadius:12,padding:'1.25rem',marginBottom:12}}>
              <div style={{fontSize:13,fontWeight:500,marginBottom:12}}>Οικονομικός στόχος</div>
              {sl('Ετήσιο εισόδημα (€)', target, setTarget, 10000, 200000, 5000, v=>'€'+fmt(v))}
              {sl('Μέση αξία ακινήτου (€)', avgPrice, setAvgPrice, 50000, 1000000, 10000, v=>'€'+fmt(v))}
              {sl('Αμοιβή γραφείου (%)', commRate, setCommRate, 1, 6, 0.5, v=>v+'%')}
              {sl('Split με γραφείο (%)', split, setSplit, 30, 90, 5, v=>v+'%')}
              {sl('Εβδομάδες/χρόνο', weeks, setWeeks, 40, 52, 1)}
            </div>

            <div style={{background:'#fff',border:'0.5px solid #e8e8e8',borderRadius:12,padding:'1.25rem'}}>
              <div style={{fontSize:13,fontWeight:500,marginBottom:4}}>Conversion rates</div>
              <div style={{fontSize:12,color:'#888',marginBottom:12}}>
                {realRates ? 'Αυτόματα από τα data σου' : 'Συμπλήρωσε τα προσωπικά σου ποσοστά'}
              </div>
              {sl('Call → 1ο Ραντεβού', cr1, setCr1, 1, 50, 1, v=>v+'%')}
              {sl('1ο → 2ο Ραντεβού', cr2, setCr2, 10, 90, 5, v=>v+'%')}
              {sl('2ο Ραντεβού → Ανάθεση', cr3, setCr3, 10, 90, 5, v=>v+'%')}
              {sl('Ανάθεση → Συμβόλαιο', cr4, setCr4, 10, 90, 5, v=>v+'%')}
            </div>
          </div>

          <div>
            <div style={{background:'#1a1a1a',borderRadius:12,padding:'1.25rem',marginBottom:12,color:'#fff'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
                <div style={{fontSize:14,fontWeight:500}}>Στόχος</div>
                <span style={{background:levelBg[level],color:levelColors[level],fontSize:12,padding:'3px 10px',borderRadius:100,fontWeight:500}}>{level}</span>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}>
                {[
                  {l:'Εισόδημα/χρόνο',v:'€'+fmt(target)},
                  {l:'Αμοιβή/συμβόλαιο',v:'€'+fmt(Math.round(perDeal))},
                  {l:'Εισόδημα/μήνα',v:'€'+fmt(Math.round(target/12))},
                ].map(m=>(
                  <div key={m.l} style={{background:'rgba(255,255,255,.08)',borderRadius:8,padding:'10px 12px'}}>
                    <div style={{fontSize:11,color:'#888',marginBottom:3}}>{m.l}</div>
                    <div style={{fontSize:18,fontWeight:500,color:'#fff'}}>{m.v}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{background:'#fff',border:'0.5px solid #e8e8e8',borderRadius:12,padding:'1.25rem',marginBottom:12}}>
              <div style={{fontSize:13,fontWeight:500,color:'#888',marginBottom:12,textTransform:'uppercase',letterSpacing:'.05em'}}>Funnel — τι χρειάζεσαι / χρόνο</div>
              {[
                {icon:'📞',label:'Calls',val:callsNeeded,color:'#378ADD'},
                {icon:'📅',label:'1ο Ραντεβού',val:appt1Needed,color:'#BA7517'},
                {icon:'🤝',label:'2ο Ραντεβού',val:appt2Needed,color:'#534AB7'},
                {icon:'📋',label:'Αναθέσεις',val:listingsNeeded,color:'#0F6E56'},
                {icon:'✅',label:'Συμβόλαια',val:dealsNeeded,color:'#3B6D11'},
              ].map(f=>(
                <div key={f.label} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderBottom:'0.5px solid #f5f5f5'}}>
                  <span style={{fontSize:16,minWidth:24}}>{f.icon}</span>
                  <div style={{flex:1}}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                      <span style={{fontSize:13}}>{f.label}</span>
                      <span style={{fontSize:13,fontWeight:500}}>{f.val}</span>
                    </div>
                    <div style={{background:'#f0f0f0',borderRadius:100,height:6,overflow:'hidden'}}>
                      <div style={{height:'100%',background:f.color,width:Math.max(10,Math.round(f.val/callsNeeded*100))+'%',borderRadius:100}} />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{background:'#fff',border:'0.5px solid #e8e8e8',borderRadius:12,padding:'1.25rem'}}>
              <div style={{fontSize:13,fontWeight:500,color:'#888',marginBottom:12,textTransform:'uppercase',letterSpacing:'.05em'}}>Εβδομαδιαίος στόχος</div>
              {bar('Calls', callsNeeded, callsW, '#378ADD')}
              {bar('1ο Ραντεβού', appt1Needed, appt1W, '#BA7517')}
              {bar('2ο Ραντεβού', appt2Needed, appt2W, '#534AB7')}
              {bar('Αναθέσεις', listingsNeeded, listW, '#0F6E56')}
              <div style={{marginTop:12,padding:'10px 12px',background:'#f8f8f7',borderRadius:8,fontSize:13}}>
                <strong>Συνοπτικά:</strong> {callsW} calls/εβδ → {appt1W} ραντ.1 → {appt2W} ραντ.2 → {listW} αναθέσεις/εβδ
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}