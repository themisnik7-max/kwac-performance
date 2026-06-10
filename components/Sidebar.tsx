'use client'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

const NAV_AGENT = [
  { href: '/dashboard', icon: '▦', label: 'Dashboard' },
  { href: '/submit', icon: '✎', label: 'Μετρησιμότητα' },
  { href: '/gps', icon: '🎯', label: 'GPS Στόχοι' },
  { href: '/profile', icon: '⊙', label: 'Ακίνητα & Χάρτης' },
  { href: '/sprint', icon: '⚡', label: 'Sprint Calls' },
  { href: '/rooms', icon: '◫', label: 'Αίθουσες' },
  { href: '/board', icon: '◈', label: 'Πίνακας' },
  { href: '/valuation', icon: '◎', label: 'Εκτίμηση' },
]

const NAV_CEO = [
  { href: '/dashboard', icon: '▦', label: 'Dashboard' },
  { href: '/intelligence', icon: '◉', label: 'Intelligence' },
  { href: '/profile', icon: '⊙', label: 'Ακίνητα & Χάρτης' },
  { href: '/sprint', icon: '⚡', label: 'Sprint Calls' },
  { href: '/rooms', icon: '◫', label: 'Αίθουσες' },
  { href: '/board', icon: '◈', label: 'Πίνακας' },
  { href: '/valuation', icon: '◎', label: 'Εκτίμηση' },
]

export default function Sidebar({ active, role }: { active?: string; role?: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const isCeo = role === 'ceo' || role === 'admin'
  const NAV = isCeo ? NAV_CEO : NAV_AGENT
  const currentKey = active || NAV.find(n => pathname?.startsWith(n.href))?.key || ''

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
      <div style={{padding:'0 1.25rem 1.25rem', borderBottom:'0.5px solid #2a2a2a', marginBottom:'0.5rem'}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <span style={{color:'#CC2229', fontWeight:700, fontSize:17, letterSpacing:'.03em'}}>KWAC</span>
          {isCeo && <span style={{background:'#CC2229',color:'#fff',fontSize:10,padding:'1px 6px',borderRadius:4,fontWeight:600,letterSpacing:'.05em'}}>CEO</span>}
        </div>
        <div style={{color:'#555', fontSize:11, marginTop:2}}>Performance OS</div>
      </div>

      <nav style={{flex:1}}>
        {NAV.map(n => {
          const isActive = pathname?.startsWith(n.href)
          return (
            <a key={n.href} href={n.href} style={{
              display:'flex', alignItems:'center', gap:10,
              padding:'10px 1.25rem', fontSize:13,
              color: isActive ? '#fff' : '#777',
              background: isActive ? '#2a2a2a' : 'transparent',
              borderLeft: isActive ? '2px solid #CC2229' : '2px solid transparent',
              textDecoration:'none', transition:'all .12s'
            }}>
              <span style={{fontSize:14, minWidth:18}}>{n.icon}</span>
              {n.label}
            </a>
          )
        })}
      </nav>

      <div style={{padding:'1rem 1.25rem', borderTop:'0.5px solid #2a2a2a'}}>
        <div style={{fontSize:11,color:'#444',marginBottom:8}}>{isCeo ? '👔 CEO View' : '🏠 Agent View'}</div>
        <button onClick={logout} style={{
          width:'100%', padding:'8px', background:'none',
          border:'0.5px solid #333', borderRadius:8, color:'#555',
          fontSize:12, cursor:'pointer'
        }}>Αποσύνδεση</button>
      </div>
    </aside>
  )
}