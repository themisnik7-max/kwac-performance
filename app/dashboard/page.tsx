'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const RED = '#E8192C'
const RED_LIGHT = '#FEE8EA'

const TARGETS = { cold_calls:120, follow_up:200, meet1:8, meet2:4, excl_listing:2, contract:1 }

const BADGES = [
  { key:'king_calls', label:'King of Calls', icon:'📞' },
  { key:'meeting_machine', label:'Meeting Machine', icon:'🤝' },
  { key:'closer', label:'Closer', icon:'🏆' },
  { key:'listing_legend', label:'Listing Legend', icon:'🔑' },
  { key:'follow_up_king', label:'Follow Up King', icon:'🔥' },
]

const MOCK_DATA = {
  cold_calls:143, follow_up:210, meet1:6, meet2:4, excl_listing:2, contract:1,
  xp:290, level:6, levelName:'Deal Hunter', streak:4, totalXP:9100,
}

const LEADERBOARD = [
  { name:'Κώστας Μ.', initials:'ΚΜ', xp:380, streak:8 },
  { name:'Νίκος Κ.', initials:'ΝΚ', xp:340, streak:5 },
  { name:'Γιώργος Σ.', initials:'ΓΣ', xp:290, streak:4 },
  { name:'Μαρία Π.', initials:'ΜΠ', xp:210, streak:2 },
  { name:'Ελένη Δ.', initials:'ΕΔ', xp:180, streak:1 },
]

const WINNERS = [
  { title:'King of Cold Calls', icon:'📞', name:'Νίκος Κ.', val:'187 calls' },
  { title:'Closer of the Week', icon:'🏆', name:'Κώστας Μ.', val:'3 συμβόλαια' },
  { title:'Meeting Machine', icon:'🤝', name:'Μαρία Π.', val:'9 ραντεβού' },
]

function ProgressBar({ value, max, color, height=6 }) {
  const pct = Math.min(100, Math.round(value/max*100))
  return (
    <div style={{background:'#E8E8E8',borderRadius:3,height,overflow:'hidden'}}>
      <div style={{width:pct+'%',height,background:color,borderRadius:3,transition:'width .4s'}}/>
    </div>
  )
}

export default function Dashboard() {
  const [user, setUser] = useState(null)
  const [active, setActive] = useState('dashboard')
  const [chatMsgs, setChatMsgs] = useState([{role:'ai',text:'Γεια! Τα νούμερά σου αυτή την εβδομάδα είναι δυνατά 💪 Τι θέλεις να βελτιώσεις;'}])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const d = MOCK_DATA

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { window.location.href = '/login'; return }
      setUser(data.user)
    })
  }, [])

  async function logout() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  async function sendChat() {
    const q = chatInput.trim()
    if (!q || chatLoading) return
    setChatInput('')
    setChatMsgs(m => [...m, {role:'user',text:q}])
    setChatLoading(true)
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          model:'claude-sonnet-4-20250514', max_tokens:500,
          system:'Είσαι ο AI coach ενός μεσίτη στη KWAC. Νούμερα εβδομάδας: Cold calls: '+d.cold_calls+'/120, Follow up: '+d.follow_up+'/200, 1ο ραντεβού: '+d.meet1+'/8, 2ο ραντεβού: '+d.meet2+'/4, Αναθέσεις: '+d.excl_listing+'/2, Συμβόλαια: '+d.contract+'/1. Απάντα στα ελληνικά, με ενθουσιασμό, σε 2-3 φράσεις.',
          messages:[...chatMsgs.filter(m=>m.role!=='ai'||chatMsgs.indexOf(m)>0).map(m=>({role:m.role==='ai'?'assistant':'user',content:m.text})),{role:'user',content:q}]
        })
      })
      const data = await r.json()
      setChatMsgs(m => [...m, {role:'ai',text:data.content[0].text}])
    } catch(e) {
      setChatMsgs(m => [...m, {role:'ai',text:'Κάτι πήγε στραβά, δοκίμασε ξανά!'}])
    }
    setChatLoading(false)
  }

  if (!user) return <div style={{padding:40,textAlign:'center',fontSize:14,color:'#999'}}>Φόρτωση...</div>

  const navItems = [
    {id:'dashboard',icon:'⊞',label:'Dashboard'},
    {id:'leaderboard',icon:'⬆',label:'Ranking'},
    {id:'chat',icon:'💬',label:'AI Coach'},
  ]

  const medals = ['🥇','🥈','🥉','4.','5.']

  return (
    <div style={{display:'flex',minHeight:'100vh',background:'#F5F5F5',fontFamily:'-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif'}}>
      {/* Sidebar */}
      <div style={{width:72,background:'#1A1A1A',display:'flex',flexDirection:'column',alignItems:'center',paddingTop:16,paddingBottom:16,gap:4,position:'fixed',top:0,left:0,height:'100vh',zIndex:10}}>
        <div style={{color:'#fff',fontWeight:700,fontSize:15,marginBottom:20,letterSpacing:1}}>KW<span style={{color:RED}}>AC</span></div>
        {navItems.map(it => (
          <button key={it.id} onClick={()=>setActive(it.id)}
            style={{width:52,height:52,borderRadius:12,border:'none',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:2,
              background:active===it.id?RED:'transparent',color:active===it.id?'#fff':'#888',fontSize:18,transition:'all .15s'}}>
            <span>{it.icon}</span>
            <span style={{fontSize:8,fontWeight:500}}>{it.label}</span>
          </button>
        ))}
        <div style={{flex:1}}/>
        <button onClick={logout} style={{width:52,height:52,borderRadius:12,border:'1px solid #333',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:2,background:'transparent',color:'#888',fontSize:18}}>
          <span>🚪</span>
          <span style={{fontSize:8}}>Έξοδος</span>
        </button>
      </div>

      {/* Content */}
      <div style={{marginLeft:72,flex:1,padding:24,maxWidth:960}}>

        {active==='dashboard' && (
          <>
            {/* Header */}
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:24}}>
              <div>
                <div style={{fontSize:22,fontWeight:600}}>Γεια 👋</div>
                <div style={{fontSize:13,color:'#999',marginTop:2}}>Εβδομάδα 23 · deadline Κυρ 23:59</div>
              </div>
            </div>

            {/* Level bar */}
            <div style={{background:'#fff',border:'1px solid #F0F0F0',borderRadius:14,padding:16,marginBottom:20,display:'flex',gap:14,alignItems:'center'}}>
              <div style={{width:48,height:48,borderRadius:'50%',background:RED,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20}}>⭐</div>
              <div style={{flex:1}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
                  <span style={{fontWeight:600,fontSize:15}}>Level {d.level} — {d.levelName}</span>
                  <span style={{fontSize:12,color:'#999'}}>{Math.round(d.totalXP/12000*100)}% → Lv{d.level+1}</span>
                </div>
                <ProgressBar value={d.totalXP} max={12000} color={RED} height={8}/>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{fontSize:20,fontWeight:700,color:RED}}>{d.totalXP.toLocaleString()}</div>
                <div style={{fontSize:11,color:'#999'}}>XP σύνολο</div>
              </div>
            </div>

            {/* KPIs */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:20}}>
              {[
                {label:'Cold Calls',val:d.cold_calls,target:TARGETS.cold_calls,color:RED},
                {label:'1ο Ραντεβού',val:d.meet1,target:TARGETS.meet1,color:'#534AB7'},
                {label:'2ο Ραντεβού',val:d.meet2,target:TARGETS.meet2,color:'#1D9E75'},
                {label:'Αποκλ. Ανάθεση',val:d.excl_listing,target:TARGETS.excl_listing,color:'#BA7517'},
                {label:'Follow Up',val:d.follow_up,target:TARGETS.follow_up,color:'#E65100'},
                {label:'Συμβόλαια',val:d.contract,target:TARGETS.contract,color:'#3B6D11'},
              ].map(m => {
                const ok = m.val >= m.target
                return (
                  <div key={m.label} style={{background:'#fff',border:'1px solid '+(ok?'#C8E6C9':'#F0F0F0'),borderRadius:12,padding:'12px 14px'}}>
                    <div style={{fontSize:11,color:'#999',marginBottom:4}}>{m.label}</div>
                    <div style={{fontSize:24,fontWeight:600,color:ok?'#2E7D32':m.color}}>{m.val}</div>
                    <div style={{fontSize:11,color:'#bbb',marginTop:4,marginBottom:6}}>στόχος {m.target} · {Math.min(100,Math.round(m.val/m.target*100))}%</div>
                    <ProgressBar value={m.val} max={m.target} color={ok?'#4CAF50':m.color} height={4}/>
                  </div>
                )
              })}
            </div>

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:20}}>
              {/* Badges */}
              <div style={{background:'#fff',border:'1px solid #F0F0F0',borderRadius:14,padding:16}}>
                <div style={{fontSize:13,fontWeight:600,marginBottom:12}}>Achievements & Streak</div>
                <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:12}}>
                  {BADGES.map(b => (
                    <div key={b.key} style={{background:RED_LIGHT,borderRadius:10,padding:'6px 10px',display:'flex',alignItems:'center',gap:6,fontSize:12,color:'#B01020'}}>
                      <span style={{fontSize:16}}>{b.icon}</span>{b.label}
                    </div>
                  ))}
                </div>
                <div style={{borderTop:'1px solid #F5F5F5',paddingTop:10}}>
                  <span style={{fontSize:11,color:'#999'}}>Streak </span>
                  <span style={{fontSize:18,fontWeight:600,color:'#E65100'}}>🔥 {d.streak} εβδομάδες</span>
                </div>
              </div>

              {/* Weekly Winners */}
              <div style={{background:'#fff',border:'1px solid #F0F0F0',borderRadius:14,padding:16}}>
                <div style={{fontSize:13,fontWeight:600,marginBottom:12}}>Weekly Winners 🏅</div>
                <div style={{display:'flex',flexDirection:'column',gap:10}}>
                  {WINNERS.map(w => (
                    <div key={w.title} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 10px',background:RED_LIGHT,borderRadius:10}}>
                      <span style={{fontSize:20}}>{w.icon}</span>
                      <div>
                        <div style={{fontSize:11,color:'#999'}}>{w.title}</div>
                        <div style={{fontSize:13,fontWeight:500,color:'#B01020'}}>{w.name} · {w.val}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* XP this week */}
            <div style={{background:'#fff',border:'1px solid #F0F0F0',borderRadius:14,padding:16}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
                <div style={{fontSize:13,fontWeight:600}}>XP εβδομάδας</div>
                <div style={{fontSize:18,fontWeight:700,color:RED}}>{d.xp} XP</div>
              </div>
              <ProgressBar value={d.xp} max={400} color={RED} height={8}/>
              <div style={{fontSize:11,color:'#999',marginTop:6}}>Στόχος: 400 XP · {Math.round(d.xp/400*100)}%</div>
            </div>
          </>
        )}

        {active==='leaderboard' && (
          <>
            <div style={{fontSize:20,fontWeight:600,marginBottom:4}}>Leaderboard</div>
            <div style={{fontSize:13,color:'#999',marginBottom:20}}>Εβδομάδα 23 — ζωντανή κατάταξη</div>
            <div style={{background:'#fff',border:'1px solid #F0F0F0',borderRadius:14,overflow:'hidden'}}>
              {LEADERBOARD.map((a,i) => (
                <div key={i} style={{display:'flex',alignItems:'center',gap:14,padding:'14px 18px',borderBottom:i<LEADERBOARD.length-1?'1px solid #F5F5F5':'none',background:i===0?RED_LIGHT:'#fff'}}>
                  <div style={{fontSize:18,width:28,textAlign:'center'}}>{medals[i]}</div>
                  <div style={{width:38,height:38,borderRadius:'50%',background:RED_LIGHT,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:500,color:RED}}>{a.initials}</div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:500}}>{a.name}</div>
                    <div style={{fontSize:11,color:'#999'}}>🔥 {a.streak} εβδομάδες streak</div>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <div style={{fontSize:18,fontWeight:700,color:i===0?RED:'#1A1A1A'}}>{a.xp}</div>
                    <div style={{fontSize:11,color:'#999'}}>XP</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {active==='chat' && (
          <div style={{display:'flex',flexDirection:'column',height:'calc(100vh - 48px)'}}>
            <div style={{fontSize:20,fontWeight:600,marginBottom:16}}>AI Coach 💬</div>
            <div style={{flex:1,overflowY:'auto',display:'flex',flexDirection:'column',gap:12,marginBottom:16}}>
              {chatMsgs.map((m,i) => (
                <div key={i} style={{display:'flex',justifyContent:m.role==='user'?'flex-end':'flex-start'}}>
                  <div style={{maxWidth:'75%',padding:'10px 14px',borderRadius:14,fontSize:13,lineHeight:1.6,
                    background:m.role==='user'?RED:'#fff',color:m.role==='user'?'#fff':'#1A1A1A',
                    border:m.role==='ai'?'1px solid #F0F0F0':'none'}}>
                    {m.text}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div style={{display:'flex',justifyContent:'flex-start'}}>
                  <div style={{background:'#fff',border:'1px solid #F0F0F0',borderRadius:14,padding:'10px 14px',fontSize:13,color:'#999',fontStyle:'italic'}}>Σκέφτομαι...</div>
                </div>
              )}
            </div>
            <div style={{display:'flex',gap:10}}>
              <input value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendChat()}
                placeholder="π.χ. Γιατί δεν κλείνω ραντεβού;"
                style={{flex:1,padding:'10px 14px',borderRadius:10,border:'1px solid #E0E0E0',fontSize:13}}/>
              <button onClick={sendChat} style={{background:RED,color:'#fff',border:'none',borderRadius:10,padding:'10px 18px',fontSize:13,fontWeight:500,cursor:'pointer'}}>↗</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}