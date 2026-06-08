'use client'
import { usePathname } from 'next/navigation'

const C = { red:'#CC2229', dark:'#111' }

const NAV = [
  {icon:'⊞', label:'Dashboard', href:'/dashboard'},
  {icon:'✏', label:'Καταχώρηση', href:'/submit'},
  {icon:'📍', label:'Προφίλ', href:'/profile'},
  {icon:'💎', label:'Εκτίμηση', href:'/valuation'},
  {icon:'◎', label:'AI Coach', href:'/chat'},
]

export default function Sidebar({isCEO, onCEOToggle}) {
  const path = usePathname()
  return (
    <div style={{width:64,background:C.dark,display:'flex',flexDirection:'column',alignItems:'center',paddingTop:16,paddingBottom:16,gap:4,position:'fixed',top:0,left:0,height:'100vh',zIndex:100}}>
      <div style={{color:'#fff',fontWeight:800,fontSize:12,marginBottom:18,letterSpacing:1,textAlign:'center',lineHeight:1.2}}>
        KW<br/><span style={{color:C.red}}>AC</span>
      </div>
      {NAV.map((it,i) => (
        <a key={i} href={it.href} style={{
          width:48,height:48,borderRadius:10,display:'flex',flexDirection:'column',
          alignItems:'center',justifyContent:'center',gap:2,
          background:path===it.href?'rgba(255,255,255,.12)':'transparent',
          color:path===it.href?'#fff':'rgba(255,255,255,.35)',
          fontSize:16,textDecoration:'none',transition:'all .15s'
        }}>
          <span>{it.icon}</span>
          <span style={{fontSize:7,fontWeight:600}}>{it.label}</span>
        </a>
      ))}
      <div style={{flex:1}}/>
      {onCEOToggle && (
        <button onClick={onCEOToggle} style={{
          width:44,height:44,borderRadius:10,
          border:isCEO?'1px solid '+C.red:'1px solid rgba(255,255,255,.1)',
          cursor:'pointer',display:'flex',flexDirection:'column',
          alignItems:'center',justifyContent:'center',gap:2,
          background:isCEO?C.red+'33':'transparent',
          color:isCEO?C.red:'rgba(255,255,255,.35)',fontSize:13
        }}>
          <span>👔</span><span style={{fontSize:7,fontWeight:600}}>CEO</span>
        </button>
      )}
      <a href="/login" style={{
        width:44,height:44,borderRadius:10,border:'1px solid rgba(255,255,255,.08)',
        display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
        gap:2,background:'transparent',color:'rgba(255,255,255,.3)',fontSize:13,
        textDecoration:'none',marginTop:4
      }}>
        <span>🚪</span><span style={{fontSize:7,fontWeight:600}}>Έξοδος</span>
      </a>
    </div>
  )
}