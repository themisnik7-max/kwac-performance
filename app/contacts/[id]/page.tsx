'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import CallLink from '@/components/CallLink'
import { contactName, splitName } from '@/lib/contacts'

const C = {red:'#CC2229',dark:'#1A1A1A',muted:'#6B7280',border:'#EBEBEB',subtle:'#F7F7F7',white:'#FFFFFF',green:'#16A34A',blue:'#2563EB'}

function Field({label,value,onChange,type='text'}: any){
  return (
    <div style={{marginBottom:12}}>
      <label style={{fontSize:11,fontWeight:600,color:C.muted,display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:.4}}>{label}</label>
      <input type={type} value={value??''} onChange={e=>onChange(e.target.value)}
        style={{width:'100%',padding:'9px 12px',borderRadius:8,border:'1px solid '+C.border,fontSize:13,background:'#FAFAFA',color:C.dark,boxSizing:'border-box',outline:'none'}}/>
    </div>
  )
}
function Sec({children}: any){return <div style={{fontSize:11,fontWeight:700,color:C.muted,letterSpacing:.8,textTransform:'uppercase',margin:'20px 0 12px',paddingBottom:8,borderBottom:'1px solid '+C.border}}>{children}</div>}

type OwnedProperty = { id: string; address: string | null; area: string | null; asking_price: number | null; status: string }
type HistoryEntry = { date: string; channel: string; label: string; status: string }

export default function ContactProfilePage({params}: {params: {id: string}}){
  const id = params?.id
  const [loading,setLoading]=useState(true)
  const [err,setErr]=useState<string|null>(null)
  const [saving,setSaving]=useState(false)
  const [saved,setSaved]=useState(false)
  const [contact,setContact]=useState<any>(null)
  const [properties,setProperties]=useState<OwnedProperty[]>([])
  const [history,setHistory]=useState<HistoryEntry[]>([])
  const [demandMatches,setDemandMatches]=useState<any[]>([])

  useEffect(()=>{
    if(!id) return
    ;(async () => {
      setLoading(true)
      const { data: c, error } = await supabase.from('contacts').select('*').eq('id', id).single()
      if (error || !c) { setErr('Δεν βρέθηκε η επαφή.'); setLoading(false); return }
      setContact(c)

      const { data: props } = await supabase.from('meeting_properties')
        .select('id,address,area,asking_price,status').eq('owner_contact_id', id)
      setProperties(props || [])

      const entries: HistoryEntry[] = []
      const { data: recipients } = await supabase.from('marketing_campaign_recipients')
        .select('sent_at,clicked_at,marketing_campaigns(channel,subject)').eq('contact_id', id)
      for (const r of (recipients || []) as any[]) {
        if (!r.sent_at) continue
        const camp = r.marketing_campaigns
        entries.push({
          date: r.sent_at, channel: camp?.channel === 'sms' ? '📱 SMS' : '📧 Email',
          label: camp?.subject || (camp?.channel === 'sms' ? 'SMS καμπάνια' : 'Email καμπάνια'),
          status: r.clicked_at ? 'Άνοιξε/έκανε κλικ' : 'Στάλθηκε',
        })
      }
      const { data: aiActions } = await supabase.from('ai_admin_actions_log')
        .select('created_at,tool_name,status,result_summary').eq('tool_args->>contact_id', id)
      for (const a of aiActions || []) {
        entries.push({ date: a.created_at, channel: '🤖 AI Admin', label: a.result_summary || a.tool_name, status: a.status })
      }
      entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      setHistory(entries)

      const { data: dp } = await supabase.from('demand_profiles')
        .select('id,property_type,budget_eur,status').eq('contact_id', id)
      setDemandMatches(dp || [])

      setLoading(false)
    })()
  },[id])

  async function handleSave(){
    if (!contact) return
    setSaving(true); setErr(null)
    const { first_name, last_name } = splitName(contactName(contact))
    const payload = {
      full_name: contact.full_name, first_name, last_name,
      phone: contact.phone, phone2: contact.phone2, email: contact.email,
      email_consent: !!contact.email_consent, sms_consent: !!contact.sms_consent,
      notes: contact.notes,
    }
    const { error } = await supabase.from('contacts').update(payload).eq('id', id)
    setSaving(false)
    if (error) { setErr(error.message); return }
    setSaved(true); setTimeout(()=>setSaved(false),3000)
  }

  const set = (k: string) => (v: any) => setContact((c: any) => ({ ...c, [k]: v }))

  if (loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'#F4F4F4'}}><div style={{fontSize:13,color:C.muted}}>Φόρτωση...</div></div>
  if (err && !contact) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'#F4F4F4'}}><div style={{fontSize:13,color:C.red}}>{err}</div></div>

  return (
    <div style={{display:'flex',minHeight:'100vh',background:'#F4F4F4',fontFamily:"-apple-system,BlinkMacSystemFont,'Inter',sans-serif",color:C.dark}}>
      <Sidebar/>
      <div style={{marginLeft:64,flex:1,display:'flex',flexDirection:'column',height:'100vh',overflow:'hidden'}}>
        <div style={{background:C.dark,padding:'16px 28px',display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0}}>
          <div>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <a href="/personal-admin" style={{color:'rgba(255,255,255,.5)',textDecoration:'none',fontSize:12,fontWeight:500}}>← Personal Admin</a>
              <span style={{color:'rgba(255,255,255,.2)'}}>|</span>
              <h1 style={{fontSize:15,fontWeight:700,color:'#fff',margin:0}}>{contactName(contact) || 'Επαφή'}</h1>
            </div>
            {properties.length > 0 && <p style={{fontSize:11,color:'rgba(255,255,255,.4)',margin:'3px 0 0'}}>Ιδιοκτήτης {properties.length} ακινήτ{properties.length===1?'ου':'ων'}</p>}
          </div>
          <button onClick={handleSave} disabled={saving} style={{background:saved?C.green:C.red,color:'#fff',border:'none',borderRadius:10,padding:'10px 22px',fontSize:13,fontWeight:700,cursor:'pointer'}}>
            {saving?'Αποθήκευση...':saved?'✓ Αποθηκεύτηκε':'Αποθήκευση'}
          </button>
        </div>

        <div style={{flex:1,overflowY:'auto',padding:'24px 28px'}}>
          {err && <div style={{marginBottom:16,padding:'10px 14px',background:'#FEE2E2',color:'#B91C1C',borderRadius:8,fontSize:13}}>{err}</div>}

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:24}}>
            <div>
              <Sec>Στοιχεία Επαφής</Sec>
              <Field label="Ονοματεπώνυμο" value={contactName(contact)} onChange={set('full_name')}/>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
                <div style={{flex:1}}><Field label="Τηλέφωνο" value={contact.phone} onChange={set('phone')} type="tel"/></div>
                {contact.phone && <div style={{paddingTop:18}}><CallLink phone={contact.phone} contactId={id}/></div>}
              </div>
              <Field label="Δεύτερο τηλέφωνο" value={contact.phone2} onChange={set('phone2')} type="tel"/>
              <Field label="Email" value={contact.email} onChange={set('email')} type="email"/>
              <div style={{display:'flex',gap:16,marginTop:8,marginBottom:12}}>
                <label style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:C.muted,cursor:'pointer'}}>
                  <input type="checkbox" checked={!!contact.email_consent} onChange={e=>set('email_consent')(e.target.checked)}/> Συναίνεση Email marketing
                </label>
                <label style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:C.muted,cursor:'pointer'}}>
                  <input type="checkbox" checked={!!contact.sms_consent} onChange={e=>set('sms_consent')(e.target.checked)}/> Συναίνεση SMS marketing
                </label>
              </div>
              <label style={{fontSize:11,fontWeight:600,color:C.muted,display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:.4}}>Σημειώσεις</label>
              <textarea value={contact.notes||''} onChange={e=>set('notes')(e.target.value)} rows={3}
                style={{width:'100%',padding:'9px 12px',borderRadius:8,border:'1px solid '+C.border,fontSize:13,background:'#FAFAFA',color:C.dark,boxSizing:'border-box',resize:'vertical'}}/>

              <Sec>Ακίνητα ({properties.length})</Sec>
              {properties.length===0 && <div style={{padding:16,textAlign:'center',color:C.muted,fontSize:13,background:C.subtle,borderRadius:12}}>Δεν κατέχει ακίνητα (ή δεν έχουν συνδεθεί ακόμα).</div>}
              {properties.map(p => (
                <a key={p.id} href={`/properties/${p.id}`} style={{display:'block',padding:'10px 14px',background:C.white,border:'1px solid '+C.border,borderRadius:10,marginBottom:8,textDecoration:'none',color:C.dark,fontSize:13}}>
                  <strong>{p.address || 'Ακίνητο'}</strong>{p.area && ` · ${p.area}`}{p.asking_price && ` · €${Number(p.asking_price).toLocaleString('el-GR')}`}
                  <span style={{float:'right',color:C.muted,fontSize:11}}>{p.status}</span>
                </a>
              ))}

              <Sec>Ζητήσεις ({demandMatches.length})</Sec>
              {demandMatches.length===0 && <div style={{padding:16,textAlign:'center',color:C.muted,fontSize:13,background:C.subtle,borderRadius:12}}>Καμία ζήτηση καταγεγραμμένη.</div>}
              {demandMatches.map(d => (
                <div key={d.id} style={{padding:'10px 14px',background:C.white,border:'1px solid '+C.border,borderRadius:10,marginBottom:8,fontSize:13}}>
                  {d.property_type || 'Ζήτηση'}{d.budget_eur && ` · έως €${Number(d.budget_eur).toLocaleString('el-GR')}`}
                  <span style={{float:'right',color:C.muted,fontSize:11}}>{d.status}</span>
                </div>
              ))}
            </div>

            <div>
              <Sec>Ιστορικό Επικοινωνίας ({history.length})</Sec>
              {history.length===0 && <div style={{padding:20,textAlign:'center',color:C.muted,fontSize:13,background:C.subtle,borderRadius:12}}>Καμία επικοινωνία καταγεγραμμένη ακόμα.</div>}
              {history.map((h,i) => (
                <div key={i} style={{background:C.white,border:'1px solid '+C.border,borderRadius:10,padding:'10px 14px',marginBottom:8}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                    <span style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:'uppercase'}}>{h.channel}</span>
                    <span style={{fontSize:10,color:C.muted}}>{new Date(h.date).toLocaleDateString('el-GR')}</span>
                  </div>
                  <p style={{fontSize:13,margin:0}}>{h.label}</p>
                  <p style={{fontSize:11,color:C.muted,margin:'4px 0 0'}}>{h.status}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
