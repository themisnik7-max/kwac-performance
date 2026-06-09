'use client'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

const NAV = [
  { href: '/dashboard', icon: '▦', label: 'Dashboard', key: 'dashboard' },
  { href: '/submit', icon: '✎', label: 'Μετρησιμότητα', key: 'submit' },
  { href: '/profile', icon: '⊙', label: 'Ακίνητα & Χάρτης', key: 'profile' },
  { href: '/sprint', icon: '⚡', label: 'Sprint Calls', key: 'sprint' },
  { href: '/rooms', icon: '◫', label: 'Αίθουσες', key: 'rooms' },
  { href: '/board', icon: '◈', label: 'Πίνακας', key: 'board' },
  { href: '/valuation', icon: '◎', label: 'Εκτίμηση', key: 'valuation' },
  { href: '/intelligence', icon: '◉', label: 'Intelligence', key: 'intelligence', ceoOnly: true },
]

export default function Sidebar({ active, role }: { active: string, role?: string }) {
  const router = useRouter()
  const supabase = createClient()
  async function logout() {
    await supabase.auth.signOut()
    router.push('/login')
  }
  const isCeo = role === 'ceo' || role === 'admin'
  return (
    <aside style={{width:220,background:'#1a1a1a',minHeight:'100vh',display:'flex',flexDirection:'column',padding:'1.5rem 0',flexShrink:0}}>
      <div style={{padding:'0 1.25rem 1.5rem',borderBottom:'0.5px solid #333'}}>
        <div style={{color:'#CC2229',fontWeight:600,fontSize:16,letterSpacing:'.05em'}}>KWAC</div>
        <div style={{color:'#666',fontSize:11,marginTop:2}}>Performance OS</div>
      </div>
      <nav style={{flex:1,padding:'1rem 0'}}>
        {NAV.filter(n => !n.ceoOnly || isCeo).map(n => (
          <a key={n.key} href={n.href} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 1.25rem',fontSize:13,color:active===n.key?'#fff':'#888',background:active===n.key?'#2a2a2a':'none',borderLeft:active===n.key?'2px solid #CC2229':'2px solid transparent',textDecoration:'none',transition:'all .15s',cursor:'pointer'}}>
            <span style={{fontSize:14}}>{n.icon}</span>{n.label}
          </a>
        ))}
      </nav>
      <div style={{padding:'0 1.25rem',borderTop:'0.5px solid #333',paddingTop:'1rem'}}>
        <button onClick={logout} style={{width:'100%',padding:'8px',background:'none',border:'0.5px solid #333',borderRadius:8,color:'#666',fontSize:12,cursor:'pointer'}}>Αποσύνδεση</button>
      </div>
    </aside>
  )
}