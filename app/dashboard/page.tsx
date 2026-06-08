'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Dashboard() {
  const [user, setUser] = useState(null)

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

  if (!user) return <div style={{padding:40,textAlign:'center'}}>Φόρτωση...</div>

  return (
    <div style={{minHeight:'100vh',background:'#F5F5F5',padding:32}}>
      <div style={{maxWidth:900,margin:'0 auto'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:32}}>
          <div style={{fontSize:24,fontWeight:700}}>KW<span style={{color:'#E8192C'}}>AC</span></div>
          <button onClick={logout} style={{padding:'8px 16px',borderRadius:8,border:'1px solid #E0E0E0',background:'#fff',cursor:'pointer',fontSize:13}}>
            Αποσύνδεση
          </button>
        </div>
        <div style={{background:'#fff',borderRadius:16,padding:32,textAlign:'center',border:'1px solid #F0F0F0'}}>
          <div style={{fontSize:48,marginBottom:16}}>🚀</div>
          <div style={{fontSize:20,fontWeight:600,marginBottom:8}}>KWAC Performance OS Online!</div>
          <div style={{fontSize:14,color:'#999'}}>Το πλήρες dashboard έρχεται σύντομα.</div>
        </div>
      </div>
    </div>
  )
}