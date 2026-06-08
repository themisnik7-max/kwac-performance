'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError('Λάθος email ή κωδικός'); setLoading(false); return }
    window.location.href = '/dashboard'
  }

  return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#F5F5F5'}}>
      <div style={{background:'#fff',borderRadius:16,padding:40,width:360,boxShadow:'0 2px 20px rgba(0,0,0,0.08)'}}>
        <div style={{textAlign:'center',marginBottom:32}}>
          <div style={{fontSize:28,fontWeight:700}}>KW<span style={{color:'#E8192C'}}>AC</span></div>
          <div style={{fontSize:13,color:'#999',marginTop:4}}>Performance OS</div>
        </div>
        <form onSubmit={handleLogin}>
          <div style={{marginBottom:16}}>
            <label style={{fontSize:12,fontWeight:500,display:'block',marginBottom:6}}>Email</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required
              style={{width:'100%',padding:'10px 14px',borderRadius:8,border:'1px solid #E0E0E0',fontSize:14}}
              placeholder="name@kwac.gr"/>
          </div>
          <div style={{marginBottom:24}}>
            <label style={{fontSize:12,fontWeight:500,display:'block',marginBottom:6}}>Κωδικός</label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} required
              style={{width:'100%',padding:'10px 14px',borderRadius:8,border:'1px solid #E0E0E0',fontSize:14}}
              placeholder="••••••••"/>
          </div>
          {error && <div style={{color:'#E8192C',fontSize:13,marginBottom:16}}>{error}</div>}
          <button type="submit" disabled={loading}
            style={{width:'100%',background:'#E8192C',color:'#fff',border:'none',borderRadius:10,padding:'12px 0',fontSize:15,fontWeight:600,cursor:'pointer'}}>
            {loading ? 'Σύνδεση...' : 'Σύνδεση →'}
          </button>
        </form>
      </div>
    </div>
  )
}