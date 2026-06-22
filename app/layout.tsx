import type{Metadata}from"next";
import"./globals.css";
import Sidebar from"../components/Sidebar";
import{AppProvider}from"../lib/AppContext";
export const metadata:Metadata={title:"KWAC Performance OS",description:"Real Estate Intelligence"};
export default function RootLayout({children}:{children:React.ReactNode}){
  return(<html lang="el"><body style={{display:"flex",minHeight:"100vh",background:"#0d0d0d",margin:0}}>
    <AppProvider>
      <Sidebar/>
      <main style={{flex:1,marginLeft:220,minHeight:"100vh",background:"#0d0d0d"}}>
        {children}
      </main>
    </AppProvider>
  </body></html>);
}
