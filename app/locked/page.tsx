export default function LockedPage() {
  return (
    <div style={{ minHeight:'100vh', background:'#0d0d0d', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'system-ui,sans-serif' }}>
      <div style={{ textAlign:'center', maxWidth:400 }}>
        <div style={{ fontSize:48, marginBottom:24 }}>🔒</div>
        <div style={{ fontSize:28, fontWeight:700, color:'#f0f0f0', marginBottom:8 }}>KW<span style={{ color:'#CC2229' }}>AC</span> OS</div>
        <div style={{ fontSize:14, color:'#CC2229', fontWeight:600, marginBottom:24, letterSpacing:'.05em', textTransform:'uppercase' }}>Σύστημα απενεργοποιημένο</div>
        <p style={{ fontSize:14, color:'#555', lineHeight:1.7, margin:0 }}>Το σύστημα είναι προσωρινά εκτός λειτουργίας.<br/>Επικοινωνήστε με τον διαχειριστή σας.</p>
        <div style={{ marginTop:40, fontSize:11, color:'#2a2a2a' }}>403 · Service Suspended</div>
      </div>
    </div>
  )
}