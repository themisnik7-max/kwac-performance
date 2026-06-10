'use client'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

const NAV = [
  { href: '/dashboard', icon: '▦', label: 'Dashboard', key: 'dashboard' },
  { href: '/submit', icon: '✎', label: 'Μετρησιμότητα', key: 'submit' },
  { href: '/gps', icon: '🎯', label: 'GPS Στόχοι', key: 'gps' },
  { href: '/profile', icon: '⊙', label: 'Ακίνητα & Χάρτης', key: 'profile' },
  { href: '/sprint', icon: '⚡', label: 'Sprint Calls', key: 'sprint' },
  { href: '/rooms', icon: '◫', label: 'Αίθουσες', key: 'rooms' },
  { href: '/board', icon: '◈', label: 'Πίνακας', key: 'board' },
  { href: '/valuation', icon: '◎', label: 'Εκτίμηση', key: 'valuation' },
  { href: '/intelligence', icon: '◉', label: 'Intelligence', key: 'intelligence', ceoOnly: true },
]

export default function Sidebar({ active, role }: { active?: string; role?: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const isCeo = role === 'ceo' || role === 'admin'
  const currentKey = active || NAV.find(n => pathname?.startsWith(n.href))?.key || 'dashboard'

  async function logout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside style={{
      width:220, minWidth:220, background:'#1a1a1a', minHeight:'100vh',
      display:'flex', flexDirection:'column', padding:'1.5rem 0', flexShrink:0,
      position:'sticky', top:0, height:'100vh', overflowY:'auto'
    }}>
      <div style={{padding:'0 1.25rem 1.25rem', borderBottom:'0.5px solid #333', marginBottom:'0.5rem'}}>
        <div style={{color:'#CC2229', fontWeight:600, fontSize:16, letterSpacing:'.05em'}}>KWAC</div>
        <div style={{color:'#555', fontSize:11, marginTop:2}}>Performance OS</div>
      </div>

      <nav style={{flex:1}}>
        {NAV.filter(n => !n.ceoOnly || isCeo).map(n => {
          const isActive = currentKey === n.key
          return (
            <a key={n.key} href={n.href} style={{
              display:'flex', alignItems:'center', gap:10,
              padding:'10px 1.25rem', fontSize:13,
              color: isActive ? '#fff' : '#888',
              background: isActive ? '#2a2a2a' : 'transparent',
              borderLeft: isActive ? '2px solid #CC2229' : '2px solid transparent',
              textDecoration:'none', transition:'all .15s'
            }}>
              <span style={{fontSize:14, minWidth:18}}>{n.icon}</span>
              {n.label}
            </a>
          )
        })}
      </nav>

      <div style={{padding:'1rem 1.25rem', borderTop:'0.5px solid #333'}}>
        <button onClick={logout} style={{
          width:'100%', padding:'8px', background:'none',
          border:'0.5px solid #333', borderRadius:8, color:'#666',
          fontSize:12, cursor:'pointer'
        }}>Αποσύνδεση</button>
      </div>
    </aside>
  )
}