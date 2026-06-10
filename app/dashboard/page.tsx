'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import { useRouter } from 'next/navigation'

export default function DashboardPage() {
  const [agent, setAgent] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/login'); return }
      supabase.from('agents').select('*').eq('email', data.user.email).single()
        .then(({ data: a }) => {
          setAgent(a)
          setLoading(false)
          // CEO goes directly to intelligence
          if (a?.role === 'ceo' || a?.role === 'admin') {
            router.push('/intelligence')
          }
        })
    })
  }, [])

  if (loading) return (
    <div style={{display:'flex',minHeight:'100vh',background:'#f8f8f7'}}>
      <Sidebar role="agent" />
      <main style={{flex:1,padding:'2rem',display:'flex',alignItems:'center',justifyContent:'center'}}>
        <div style={{color:'#888',fontSize:14}}>Φόρτωση...</div>
      </main>
    </div>
  )

  const weekNum = Math.ceil((new Date().getTime() - new Date(new Date().getFullYear(),0,1).getTime()) / 604800000)

  return (
    <div style={{display:'flex',minHeight:'100vh',background:'#f8f8f7'}}>
      <Sidebar active="dashboard" role={agent?.role} />
      <main style={{flex:1,padding:'2rem',maxWidth:1100}}>
        <div style={{background:'#1a1a1a',borderRadius:16,padding:'1.75rem',marginBottom:20,color:'#fff'}}>
          <div style={{fontSize:12,color:'#666',textTransform:'uppercase',letterSpacing:'.1em',marginBottom:6}}>ΚΑΛΗΜΕΡΑ</div>
          <div style={{fontSize:28,fontWeight:600,marginBottom:6}}>{agent?.full_name || 'Agent'}</div>
          <div style={{display:'flex',alignItems:'center',gap:12,color:'#888',fontSize:14}}>
            <span>Level 1 · Rookie</span>
            <span style={{background:'#CC2229',color:'#fff',borderRadius:100,padding:'2px 10px',fontSize:12}}>🔥 0 εβδ. streak</span>
          </div>
        </div>

        <div style={{background:'#fff',border:'0.5px solid #e8e8e8',borderRadius:12,padding:'1.25rem',marginBottom:16}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div>
              <div style={{fontSize:15,fontWeight:500}}>Εβδομάδα {weekNum} — καταχώρηση ανοιχτή</div>
              <div style={{fontSize:13,color:'#888',marginTop:2}}>Deadline: Κυριακή 23:59</div>
            </div>
            <a href="/submit" style={{padding:'10px 20px',background:'#CC2229',color:'#fff',borderRadius:8,fontSize:13,fontWeight:500,textDecoration:'none',display:'inline-block'}}>
              ✎ Καταχώρηση →
            </a>
          </div>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:20}}>
          {[
            {l:'Cold Calls',v:0,target:120,prev:0},
            {l:'1ο Ραντεβού',v:0,target:6,prev:0},
            {l:'Αναθέσεις',v:0,target:2,prev:0},
            {l:'Συμβόλαια',v:0,target:1,prev:0},
            {l:'Follow Up',v:0,target:200,prev:0},
            {l:'2ο Ραντεβού',v:0,target:3,prev:0},
          ].map(m=>(
            <div key={m.l} style={{background:'#fff',border:'0.5px solid #e8e8e8',borderRadius:12,padding:'1rem'}}>
              <div style={{fontSize:12,color:'#888',marginBottom:4,display:'flex',justifyContent:'space-between'}}>
                <span>{m.l}</span>
                <span style={{color:'#bbb'}}>Στόχος {m.target}</span>
              </div>
              <div style={{fontSize:26,fontWeight:500,marginBottom:6}}>{m.v}</div>
              <div style={{background:'#f0f0f0',borderRadius:100,height:5,overflow:'hidden'}}>
                <div style={{height:'100%',background:'#CC2229',borderRadius:100,width:Math.min(100,m.v/m.target*100)+'%'}} />
              </div>
            </div>
          ))}
        </div>

        <div style={{background:'#fff',border:'0.5px solid #e8e8e8',borderRadius:12,padding:'1.25rem'}}>
          <div style={{fontSize:14,fontWeight:500,marginBottom:12,color:'#888'}}>Γρήγορη πρόσβαση</div>
          <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
            {[
              {href:'/submit',label:'✎ Μετρησιμότητα'},
              {href:'/gps',label:'🎯 GPS Στόχοι'},
              {href:'/profile',label:'⊙ Ακίνητα'},
              {href:'/rooms',label:'◫ Αίθουσες'},
              {href:'/board',label:'◈ Πίνακας'},
            ].map(l=>(
              <a key={l.href} href={l.href}
                style={{padding:'8px 16px',background:'#f8f8f7',border:'0.5px solid #e8e8e8',borderRadius:8,fontSize:13,color:'#1a1a1a',textDecoration:'none'}}>
                {l.label}
              </a>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}