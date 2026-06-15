import type{Metadata}from"next";
import"./globals.css";
export const metadata:Metadata={title:"KWAC Performance OS",description:"Real Estate Intelligence Platform"};
export default function RootLayout({children}:{children:React.ReactNode}){
return(<html lang="el"><body style={{display:"flex",minHeight:"100vh",background:"#0a0a0a"}}>
<Sidebar/>
<main style={{flex:1,marginLeft:220,minHeight:"100vh",background:"#0a0a0a"}}>
{children}
</main>
</body></html>);}

function Sidebar(){
const links=[
  {href:"/dashboard",icon:"⊞",label:"Dashboard"},
  {href:"/submit",icon:"✎",label:"Μετρησιμότητα"},
  {href:"/meeting",icon:"⬡",label:"Meeting"},
  {href:"/import",icon:"↑",label:"iList Import"},
  {href:"/profile",icon:"◎",label:"Χάρτης"},
  {href:"/sprint",icon:"▶",label:"Sprint Calls"},
  {href:"/board",icon:"◈",label:"Ανακοινώσεις"},
  {href:"/gps",icon:"◉",label:"GPS Goals"},
  {href:"/intelligence",icon:"✦",label:"Intelligence"},
  {href:"/export",icon:"↓",label:"Export"},
];
return(<nav style={{position:"fixed",left:0,top:0,bottom:0,width:220,background:"#111111",borderRight:"1px solid #1e1e1e",display:"flex",flexDirection:"column",zIndex:100,overflowY:"auto"}}>
  {/* Logo */}
  <div style={{padding:"20px 20px 16px",borderBottom:"1px solid #1e1e1e"}}>
    <div style={{display:"flex",alignItems:"center",gap:10}}>
      <div style={{width:32,height:32,borderRadius:8,background:"#CC2229",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:14,color:"white",flexShrink:0}}>KW</div>
      <div>
        <div style={{fontWeight:600,fontSize:13,color:"#f0f0f0",letterSpacing:"-0.01em"}}>KWAC</div>
        <div style={{fontSize:10,color:"#555",marginTop:1}}>Performance OS</div>
      </div>
    </div>
  </div>
  {/* Nav */}
  <div style={{flex:1,padding:"8px 0"}}>
    {links.map(l=>(<a key={l.href} href={l.href} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 16px",margin:"1px 8px",borderRadius:6,color:"#888",fontSize:13,transition:"all .15s",textDecoration:"none"}} onMouseOver={e=>{e.currentTarget.style.background="#1a1a1a";e.currentTarget.style.color="#f0f0f0";}} onMouseOut={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color="#888";}}>
      <span style={{fontSize:15,width:18,textAlign:"center",flexShrink:0}}>{l.icon}</span>
      <span>{l.label}</span>
    </a>))}
  </div>
  {/* Footer */}
  <div style={{padding:"12px 16px",borderTop:"1px solid #1e1e1e"}}>
    <div style={{fontSize:10,color:"#333",textAlign:"center"}}>KWAC AC · ZadesHome</div>
  </div>
</nav>);}
