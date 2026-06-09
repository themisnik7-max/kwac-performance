'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

const C = {red:'#CC2229',dark:'#1A1A1A',muted:'#6B7280',border:'#EBEBEB',subtle:'#F7F7F7',white:'#FFFFFF',green:'#16A34A',greenLight:'#F0FDF4'}

export default function OpenHouseModal({property, onClose, onSaved}){
  const [date,setDate]=useState('')
  const [timeStart,setTimeStart]=useState('11:00')
  const [timeEnd,setTimeEnd]=useState('14:00')
  const [notes,setNotes]=useState('')
  const [saving,setSaving]=useState(false)
  const [done,setDone]=useState(false)

  async function save(){
    if(!date||!timeStart) return
    setSaving(true)
    const { error } = await supabase.from('open_houses').insert({
      property_address: property.address,
      area: property.area,
      ilist_code: property.ilist_code||null,
      property_type: property.property_type,
      sqm: property.sqm||null,
      price: property.price_asking||null,
      date,
      time_start: timeStart,
      time_end: timeEnd||null,
      notes: notes||null,
    })
    setSaving(false)
    if(!error){ setDone(true); setTimeout(()=>{ onSaved&&onSaved(); onClose&&onClose() },1500) }
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,backdropFilter:'blur(4px)'}}>
      <div style={{background:C.white,borderRadius:20,padding:'28px 32px',width:480,maxWidth:'90vw',boxShadow:'0 20px 60px rgba(0,0,0,.2)'}}>

        {done ? (
          <div style={{textAlign:'center',padding:'20px 0'}}>
            <div style={{fontSize:48,marginBottom:12}}>✅</div>
            <div style={{fontSize:18,fontWeight:700,color:C.green}}>Δημοσιεύτηκε!</div>
            <div style={{fontSize:13,color:C.muted,marginTop:4}}>Το Open House εμφανίζεται στον Πίνακα Ανακοινώσεων</div>
          </div>
        ) : (
          <>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:20}}>
              <div>
                <div style={{fontSize:11,fontWeight:600,color:C.red,textTransform:'uppercase',letterSpacing:.8,marginBottom:4}}>🏠 Open House</div>
                <h2 style={{fontSize:16,fontWeight:700,margin:'0 0 4px',color:C.dark}}>{property.address}</h2>
                <p style={{fontSize:12,color:C.muted,margin:0}}>
                  {property.area}{property.property_type&&' · '+property.property_type}
                  {property.sqm&&' · '+property.sqm+'τ.μ.'}
                  {property.price_asking&&' · €'+parseInt(property.price_asking).toLocaleString()}
                  {property.ilist_code&&' · i-list: '+property.ilist_code}
                </p>
              </div>
              <button onClick={onClose} style={{background:C.subtle,border:'none',borderRadius:8,width:32,height:32,cursor:'pointer',fontSize:16,color:C.muted,display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
            </div>

            <div style={{background:'#F9F9F9',borderRadius:12,padding:'16px',marginBottom:16}}>
              <div style={{fontSize:11,fontWeight:600,color:C.muted,textTransform:'uppercase',letterSpacing:.8,marginBottom:12}}>Ορισμός ημερομηνίας & ώρας</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}>
                <div>
                  <label style={{fontSize:11,fontWeight:600,color:C.muted,display:'block',marginBottom:5}}>Ημερομηνία *</label>
                  <input type="date" value={date} onChange={e=>setDate(e.target.value)}
                    style={{width:'100%',padding:'9px 10px',borderRadius:8,border:'1px solid '+C.border,fontSize:13,background:C.white,boxSizing:'border-box'}}/>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:600,color:C.muted,display:'block',marginBottom:5}}>Ώρα έναρξης *</label>
                  <input type="time" value={timeStart} onChange={e=>setTimeStart(e.target.value)}
                    style={{width:'100%',padding:'9px 10px',borderRadius:8,border:'1px solid '+C.border,fontSize:13,background:C.white,boxSizing:'border-box'}}/>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:600,color:C.muted,display:'block',marginBottom:5}}>Ώρα λήξης</label>
                  <input type="time" value={timeEnd} onChange={e=>setTimeEnd(e.target.value)}
                    style={{width:'100%',padding:'9px 10px',borderRadius:8,border:'1px solid '+C.border,fontSize:13,background:C.white,boxSizing:'border-box'}}/>
                </div>
              </div>
            </div>

            <div style={{marginBottom:20}}>
              <label style={{fontSize:11,fontWeight:600,color:C.muted,display:'block',marginBottom:5,textTransform:'uppercase',letterSpacing:.4}}>Σημειώσεις (προαιρετικό)</label>
              <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={2}
                placeholder="π.χ. Ανακαινισμένο, parking, θέα θάλασσα..."
                style={{width:'100%',padding:'9px 12px',borderRadius:8,border:'1px solid '+C.border,fontSize:13,background:'#FAFAFA',color:C.dark,boxSizing:'border-box',resize:'none'}}/>
            </div>

            <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
              <button onClick={onClose} style={{padding:'10px 18px',borderRadius:8,border:'1px solid '+C.border,background:C.white,fontSize:13,cursor:'pointer',color:C.muted,fontWeight:500}}>
                Ακύρωση
              </button>
              <button onClick={save} disabled={saving||!date||!timeStart}
                style={{padding:'10px 24px',borderRadius:8,border:'none',background:date&&timeStart?C.red:C.muted+'80',color:'#fff',fontSize:13,fontWeight:700,cursor:date&&timeStart?'pointer':'not-allowed',transition:'background .2s'}}>
                {saving?'Δημοσίευση...':'📣 Δημοσίευση στον Πίνακα'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}