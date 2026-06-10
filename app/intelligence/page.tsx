'use client'
import { useState } from 'react'
import Shell from '@/components/Shell'

const REAL_DATA = {
  insights: [
    { type: 'warning', icon: '⚠️', title: 'Συγκέντρωση ρίσκου', text: 'Ο Xenofon Zades κατέχει το 75.6% του χαρτοφυλακίου (161/213). Τυχόν αποχώρηση θα επηρεάσει κρίσιμα τον τζίρο.' },
    { type: 'opportunity', icon: '🎯', title: 'Υψηλή αξία Κέντρου', text: 'Κέντρο €4.648/τμ — 82% υψηλότερα από μέσο όρο. 8 ακίνητα αξίας ~€12M. Προτεραιότητα στο closing.' },
    { type: 'opportunity', icon: '📈', title: 'Γλυφάδα premium', text: 'Γλυφάδα €5.613/τμ — ακριβότερο segment. Μόνο 3 ακίνητα. Υπάρχει χώρος για επέκταση.' },
    { type: 'insight', icon: '💡', title: 'Εμπορικά underweight', text: '14.4% καταστήματα+γραφεία. Ο κλάδος ανακάμπτει post-pandemic. Στρατηγική B2B listings.' },
    { type: 'insight', icon: '📊', title: 'Portfolio €68.7M', text: 'Αν κλείσει το 60% @ 4% commission: €1.65M gross. Στο 70% split → €1.15M agents.' },
    { type: 'warning', icon: '🔄', title: 'Sales/Rentals ratio', text: '77% πωλήσεις vs 23% ενοικιάσεις. Τα rentals έχουν ταχύτερο κύκλο. Target: 35% rentals.' },
  ],
  agents: [
    { name: 'Xenofon Zades', total: 161, sales: 122, rentals: 39, portfolio: 42738500, pct: 75.6 },
    { name: 'Katerina Karpouzopoulou', total: 25, sales: 19, rentals: 6, portfolio: 19077500, pct: 11.7 },
    { name: 'Themis Nikolaou', total: 15, sales: 14, rentals: 1, portfolio: 4828800, pct: 7.0 },
    { name: 'Alexandra Georgaki', total: 12, sales: 9, rentals: 3, portfolio: 2054000, pct: 5.6 },
  ],
  areas: [
    { area: 'Εξάρχεια - Νεάπολη', count: 12, price_sqm: 2549 },
    { area: 'Καλλιθέα', count: 10, price_sqm: 2200 },
    { area: 'Κυψέλη', count: 9, price_sqm: 2100 },
    { area: 'Κέντρο', count: 8, price_sqm: 4648 },
    { area: 'Νέα Σμύρνη', count: 7, price_sqm: 2800 },
    { area: 'Παγκράτι', count: 7, price_sqm: 2750 },
  ],
  psqm: [
    { area: 'Γλυφάδα', price_sqm: 5613, n: 3 },
    { area: 'Κέντρο', price_sqm: 4648, n: 8 },
    { area: 'Ιστορικό Κέντρο', price_sqm: 4383, n: 3 },
    { area: 'Κηφισιά', price_sqm: 2432, n: 3 },
    { area: 'Εξάρχεια', price_sqm: 2549, n: 12 },
  ],
  types: [
    { type: 'Διαμέρισμα', count: 126, pct: 59 },
    { type: 'Κατάστημα', count: 20, pct: 9.4 },
    { type: 'Μονοκατοικία', count: 17, pct: 8 },
    { type: 'Οικόπεδο', count: 13, pct: 6.1 },
    { type: 'Γραφείο', count: 12, pct: 5.6 },
    { type: 'Μεζονέτα', count: 10, pct: 4.7 },
  ]
}

function fmt(n: number) { return n.toLocaleString('el-GR') }
function fmtM(n: number) { return (n/1000000).toFixed(1)+'M' }

const IC: Record<string,string> = {warning:'#FEF3C7',opportunity:'#EAF3DE',insight:'#E6F1FB'}
const IB: Record<string,string> = {warning:'#FCD34D',opportunity:'#86EFAC',insight:'#93C5FD'}

export default function IntelligencePage() {
  const [tab, setTab] = useState<'overview'|'agents'|'areas'|'chat'>('overview')
  const [chatInput, setChatInput] = useState('')
  const [messages, setMessages] = useState([{role:'assistant',text:'Καλημέρα! Έχω αναλύσει το portfolio: 213 ακίνητα, €68.7M αξία, 4 agents. Ρώτα με οτιδήποτε.'}])
  const [loading, setLoading] = useState(false)

  async function sendMessage() {
    if(!chatInput.trim()||loading) return
    const userMsg = chatInput.trim(); setChatInput('')
    setMessages(prev=>[...prev,{role:'user',text:userMsg}]); setLoading(true)
    try {
      const res = await fetch('/api/intelligence-chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:userMsg})})
      const data = await res.json()
      setMessages(prev=>[...prev,{role:'assistant',text:data.reply||'Σφάλμα'}])
    } catch(e) { setMessages(prev=>[...prev,{role:'assistant',text:'Σφάλμα σύνδεσης.'}]) }
    setLoading(false)
  }

  const tabs = [{key:'overview',label:'Overview'},{key:'agents',label:'Agents'},{key:'areas',label:'Περιοχές'},{key:'chat',label:'AI Analyst'}] as const

  return (
    <Shell>
      <div style={{ padding: '2rem', maxWidth: 1100 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'1.5rem' }}>
          <div>
            <h1 style={{ fontSize:22, fontWeight:500, color:'#1a1a1a', margin:0 }}>Intelligence Dashboard</h1>
            <p style={{ color:'#888', fontSize:14, margin:'4px 0 0' }}>213 ενεργά ακίνητα · Portfolio €{fmtM(68698800)} · Real data από i-list</p>
          </div>
          <div style={{ background:'#EAF3DE', color:'#3B6D11', borderRadius:8, padding:'6px 14px', fontSize:13, fontWeight:500 }}>🟢 Live</div>
        </div>

        <div style={{ display:'flex', gap:4, marginBottom:20, borderBottom:'0.5px solid #e8e8e8' }}>
          {tabs.map(t=>(
            <button key={t.key} onClick={()=>setTab(t.key)}
              style={{ padding:'8px 18px', border:'none', background:'none', fontSize:13, cursor:'pointer',
                color:tab===t.key?'#CC2229':'#888', fontWeight:tab===t.key?500:400,
                borderBottom:tab===t.key?'2px solid #CC2229':'2px solid transparent', marginBottom:-1 }}>
              {t.label}
            </button>
          ))}
        </div>

        {tab==='overview' && (
          <div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
              {[{l:'Portfolio',v:'€'+fmtM(68698800),sub:'164 πωλ. + 49 ενοικ.',c:'#CC2229'},{l:'Avg Πώληση',v:'€'+fmt(418895),sub:'median €220.000',c:'#185FA5'},{l:'Avg Ενοικίαση',v:'€'+fmt(6612),sub:'ανά μήνα',c:'#534AB7'},{l:'Gross Comm.',v:'€'+fmtM(68698800*0.04),sub:'@4% αν κλείσουν όλα',c:'#3B6D11'}].map(k=>(
                <div key={k.l} style={{ background:'#fff', border:'0.5px solid #e8e8e8', borderRadius:12, padding:'1rem' }}>
                  <div style={{ fontSize:11, color:'#888', marginBottom:4, textTransform:'uppercase', letterSpacing:'.05em' }}>{k.l}</div>
                  <div style={{ fontSize:22, fontWeight:600, color:k.c, marginBottom:2 }}>{k.v}</div>
                  <div style={{ fontSize:12, color:'#888' }}>{k.sub}</div>
                </div>
              ))}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:20 }}>
              {REAL_DATA.insights.map((ins,i)=>(
                <div key={i} style={{ background:IC[ins.type], border:'0.5px solid '+IB[ins.type], borderRadius:12, padding:'1rem' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                    <span style={{ fontSize:18 }}>{ins.icon}</span>
                    <span style={{ fontSize:13, fontWeight:500 }}>{ins.title}</span>
                  </div>
                  <p style={{ fontSize:13, color:'#555', lineHeight:1.6, margin:0 }}>{ins.text}</p>
                </div>
              ))}
            </div>
            <div style={{ background:'#fff', border:'0.5px solid #e8e8e8', borderRadius:12, padding:'1.25rem' }}>
              <div style={{ fontSize:13, fontWeight:500, marginBottom:12 }}>Mix ακινήτων</div>
              {REAL_DATA.types.map(pt=>(
                <div key={pt.type} style={{ marginBottom:10 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                    <span style={{ fontSize:13 }}>{pt.type}</span>
                    <span style={{ fontSize:13, fontWeight:500 }}>{pt.count} <span style={{ color:'#888', fontWeight:400 }}>({pt.pct}%)</span></span>
                  </div>
                  <div style={{ background:'#f0f0f0', borderRadius:100, height:6, overflow:'hidden' }}>
                    <div style={{ height:'100%', background:'#CC2229', borderRadius:100, width:pt.pct+'%' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab==='agents' && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            {REAL_DATA.agents.map((a,i)=>(
              <div key={a.name} style={{ background:'#fff', border:'0.5px solid #e8e8e8', borderRadius:12, padding:'1.25rem' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
                  <div>
                    <div style={{ fontSize:15, fontWeight:500 }}>{a.name}</div>
                    <div style={{ fontSize:12, color:'#888', marginTop:2 }}>{a.pct}% portfolio</div>
                  </div>
                  <div style={{ background:i===0?'#FAEEDA':'#f0f0f0', color:i===0?'#854F0B':'#666', borderRadius:8, padding:'4px 10px', fontSize:12, fontWeight:500 }}>#{i+1}</div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:12 }}>
                  {[{l:'Ακίνητα',v:a.total},{l:'Πωλήσεις',v:a.sales},{l:'Ενοικ.',v:a.rentals}].map(m=>(
                    <div key={m.l} style={{ background:'#f8f8f7', borderRadius:8, padding:'8px', textAlign:'center' }}>
                      <div style={{ fontSize:11, color:'#888' }}>{m.l}</div>
                      <div style={{ fontSize:18, fontWeight:500 }}>{m.v}</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize:12, color:'#888' }}>Portfolio αξία</div>
                <div style={{ fontSize:20, fontWeight:600, color:'#CC2229' }}>€{fmtM(a.portfolio)}</div>
                <div style={{ background:'#f0f0f0', borderRadius:100, height:6, overflow:'hidden', marginTop:8 }}>
                  <div style={{ height:'100%', background:'#CC2229', borderRadius:100, width:a.pct+'%' }} />
                </div>
                {i===0 && <div style={{ marginTop:10, background:'#FEF3C7', borderRadius:8, padding:'8px', fontSize:12, color:'#854F0B' }}>⚠️ 75.6% εξάρτηση — ρίσκο συγκέντρωσης</div>}
              </div>
            ))}
          </div>
        )}

        {tab==='areas' && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
            <div style={{ background:'#fff', border:'0.5px solid #e8e8e8', borderRadius:12, padding:'1.25rem' }}>
              <div style={{ fontSize:13, fontWeight:500, marginBottom:12 }}>Αριθμός ακινήτων ανά περιοχή</div>
              {REAL_DATA.areas.map((a,i)=>(
                <div key={a.area} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom:'0.5px solid #f5f5f5' }}>
                  <span style={{ fontSize:12, color:'#bbb', minWidth:18 }}>#{i+1}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13 }}>{a.area}</div>
                    <div style={{ background:'#f0f0f0', borderRadius:100, height:5, overflow:'hidden', marginTop:3 }}>
                      <div style={{ height:'100%', background:'#CC2229', borderRadius:100, width:(a.count/12*100)+'%' }} />
                    </div>
                  </div>
                  <span style={{ fontSize:13, fontWeight:500 }}>{a.count}</span>
                </div>
              ))}
            </div>
            <div style={{ background:'#fff', border:'0.5px solid #e8e8e8', borderRadius:12, padding:'1.25rem' }}>
              <div style={{ fontSize:13, fontWeight:500, marginBottom:12 }}>Premium €/τμ ανά περιοχή</div>
              {REAL_DATA.psqm.map((a,i)=>(
                <div key={a.area} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom:'0.5px solid #f5f5f5' }}>
                  <span style={{ fontSize:12, color:'#bbb', minWidth:18 }}>#{i+1}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13 }}>{a.area} <span style={{ color:'#bbb', fontSize:11 }}>n={a.n}</span></div>
                    <div style={{ background:'#f0f0f0', borderRadius:100, height:5, overflow:'hidden', marginTop:3 }}>
                      <div style={{ height:'100%', background:'#185FA5', borderRadius:100, width:(a.price_sqm/5613*100)+'%' }} />
                    </div>
                  </div>
                  <span style={{ fontSize:13, fontWeight:500, color:'#185FA5' }}>€{fmt(a.price_sqm)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab==='chat' && (
          <div style={{ display:'flex', flexDirection:'column', height:'58vh' }}>
            <div style={{ flex:1, overflow:'auto', display:'flex', flexDirection:'column', gap:10, paddingBottom:12 }}>
              {messages.map((m,i)=>(
                <div key={i} style={{ display:'flex', justifyContent:m.role==='user'?'flex-end':'flex-start' }}>
                  <div style={{ maxWidth:'75%', padding:'10px 14px', borderRadius:12, fontSize:13, lineHeight:1.6,
                    background:m.role==='user'?'#CC2229':'#fff', color:m.role==='user'?'#fff':'#1a1a1a',
                    border:m.role==='assistant'?'0.5px solid #e8e8e8':'none' }}>
                    {m.text}
                  </div>
                </div>
              ))}
              {loading && <div style={{ background:'#fff', border:'0.5px solid #e8e8e8', borderRadius:12, padding:'10px 14px', fontSize:13, color:'#888', width:'fit-content' }}>Αναλύω...</div>}
            </div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:8 }}>
              {['Ποιος agent έχει μεγαλύτερο ρίσκο;','Πού να επεκταθούμε;','Ανάλυση pricing strategy'].map(q=>(
                <button key={q} onClick={()=>setChatInput(q)} style={{ padding:'4px 10px', background:'#f5f5f5', border:'0.5px solid #e8e8e8', borderRadius:100, fontSize:12, cursor:'pointer', color:'#666' }}>{q}</button>
              ))}
            </div>
            <div style={{ display:'flex', gap:8, paddingTop:8, borderTop:'0.5px solid #e8e8e8' }}>
              <input value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendMessage()}
                placeholder="Ρώτα για το portfolio..." style={{ flex:1, padding:'10px 14px', border:'0.5px solid #ddd', borderRadius:10, fontSize:13 }} />
              <button onClick={sendMessage} disabled={loading||!chatInput.trim()}
                style={{ padding:'10px 20px', background:'#CC2229', color:'#fff', border:'none', borderRadius:10, fontSize:13, fontWeight:500, cursor:'pointer', opacity:loading?0.6:1 }}>
                Αποστολή
              </button>
            </div>
          </div>
        )}
      </div>
    </Shell>
  )
}