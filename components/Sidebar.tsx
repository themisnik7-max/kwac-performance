'use client'
import { usePathname } from 'next/navigation'
const C = { red:'#CC2229' }
const NAV = [
  {icon:'⊞',label:'Dashboard',href:'/dashboard'},
  {icon:'✏',label:'Καταχώρηση',href:'/submit'},
  {icon:'📍',label:'Προφίλ',href:'/profile'},
  {icon:'📋',label:'Ακίνητα',href:'/properties/new'},
  {icon:'📣',label:'Πίνακας',href:'/board'},
  {icon:'💎',label:'Εκτίμηση',href:'/valuation'},
  {icon:'🧠',label:'Analytics',href:'/intelligence'},
  {icon:'◎',label:'AI Coach',href:'/chat'},
]
export default function Sidebar({isCEO,onCEOToggle}){
  const path=usePathname()
  return (
    <div style={{width:64,background:'#111',display:'flex',flexDirection:'column',alignItems:'center',paddingTop:16,paddingBottom:16,gap:2,position:'fixed',top:0,left:0,height:'100vh',zIndex:100,overflowY:'auto'}}>
      <div style={{color:'#fff',fontWeight:800,fontSize:12,marginBottom:14,letterSpacing:1,textAlign:'center',lineHeight:1.2,flexShrink:0}}>KW<br/><span style={{color:C.red}}>AC</span></div>
      {NAV.map((it,i)=>(
        <a key={i} href={it.href} style={{width:48,height:46,borderRadius:10,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:2,flexShrink:0,background:path===it.href||path?.startsWith(it.href.split('/')[1]==='properties'?'/properties':it.href)?'rgba(255,255,255,.12)':'transparent',color:path===it.href?'#fff':'rgba(255,255,255,.35)',fontSize:14,textDecoration:'none',transition:'all .15s'}}>
          <span>{it.icon}</span><span style={{fontSize:7,fontWeight:600}}>{it.label}</span>
        </a>
      ))}
      <div style={{flex:1}}/>
      {onCEOToggle&&(
        <button onClick={onCEOToggle} style={{width:44,height:44,borderRadius:10,flexShrink:0,border:isCEO?'1px solid '+C.red:'1px solid rgba(255,255,255,.1)',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:2,background:isCEO?C.red+'33':'transparent',color:isCEO?C.red:'rgba(255,255,255,.35)',fontSize:13}}>
          <span>👔</span><span style={{fontSize:7,fontWeight:600}}>CEO</span>
        </button>
      )}
      <a href="/login" style={{width:44,height:44,borderRadius:10,flexShrink:0,border:'1px solid rgba(255,255,255,.08)',marginTop:4,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:2,background:'transparent',color:'rgba(255,255,255,.3)',fontSize:13,textDecoration:'none'}}>
        <span>🚪</span><span style={{fontSize:7,fontWeight:600}}>Έξοδος</span>
      </a>
    </div>
  )
}