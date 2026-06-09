'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'

const ROOMS = ['Αίθουσα 1', 'Αίθουσα 2']
const TIME_SLOTS = ['09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00']

export default function RoomsPage() {
  const [user, setUser] = useState<any>(null)
  const [agent, setAgent] = useState<any>(null)
  const [bookings, setBookings] = useState<any[]>([])
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [booking, setBooking] = useState<{room:string,slot:string}|null>(null)
  const [clientName, setClientName] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState('')
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { window.location.href = '/login'; return }
      setUser(data.user)
      supabase.from('agents').select('*').eq('email', data.user.email).single()
        .then(({ data: a }) => setAgent(a))
    })
  }, [])

  useEffect(() => { if (selectedDate) fetchBookings() }, [selectedDate])

  async function fetchBookings() {
    const { data } = await supabase.from('room_bookings')
      .select('*, agents(full_name)')
      .eq('date', selectedDate)
    setBookings(data || [])
  }

  function getBooking(room: string, slot: string) {
    return bookings.find(b => b.room === room && b.time_slot === slot)
  }

  async function confirmBooking() {
    if (!booking || !clientName) return
    setLoading(true)
    const { error } = await supabase.from('room_bookings').insert({
      room: booking.room,
      date: selectedDate,
      time_slot: booking.slot,
      agent_id: agent?.id,
      client_name: clientName,
      client_phone: clientPhone,
    })
    if (error) {
      setToast('Σφάλμα — μάλλον έχει ήδη κλειστεί αυτή η ώρα')
    } else {
      setToast(`✅ ${booking.room} ${booking.slot} κλείστηκε για ${clientName}`)
      setBooking(null); setClientName(''); setClientPhone('')
      fetchBookings()
    }
    setLoading(false)
    setTimeout(() => setToast(''), 3000)
  }

  const isAdmin = agent?.role === 'ceo' || agent?.role === 'admin'
  const today = new Date().toISOString().split('T')[0]

  return (
    <div style={{display:'flex',minHeight:'100vh',background:'#f8f8f7'}}>
      <Sidebar active="rooms" role={agent?.role} />
      <main style={{flex:1,padding:'2rem',maxWidth:900}}>
        <div style={{marginBottom:'1.5rem'}}>
          <h1 style={{fontSize:22,fontWeight:500,color:'#1a1a1a',margin:0}}>Κλείσιμο Αίθουσας</h1>
          <p style={{color:'#888',fontSize:14,margin:'4px 0 0'}}>Επίλεξε ημερομηνία και ώρα — δεν επιτρέπεται διπλοκράτηση</p>
        </div>

        {toast && (
          <div style={{background: toast.includes('✅') ? '#EAF3DE' : '#FCEBEB', color: toast.includes('✅') ? '#3B6D11' : '#A32D2D', padding:'10px 16px', borderRadius:8, marginBottom:16, fontSize:14}}>
            {toast}
          </div>
        )}

        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:24}}>
          <label style={{fontSize:14,color:'#666'}}>Ημερομηνία:</label>
          <input type="date" value={selectedDate} min={isAdmin ? undefined : today}
            onChange={e => setSelectedDate(e.target.value)}
            style={{padding:'7px 12px',border:'0.5px solid #ddd',borderRadius:8,fontSize:14,background:'#fff'}} />
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
          {ROOMS.map(room => (
            <div key={room} style={{background:'#fff',border:'0.5px solid #e8e8e8',borderRadius:12,padding:'1.25rem'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
                <div style={{fontSize:15,fontWeight:500}}>{room}</div>
                <div style={{fontSize:12,color:'#888'}}>
                  {TIME_SLOTS.filter(s => !getBooking(room,s)).length} διαθέσιμες
                </div>
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                {TIME_SLOTS.map(slot => {
                  const b = getBooking(room, slot)
                  const isMine = b?.agent_id === agent?.id
                  const isPast = selectedDate === today && parseInt(slot) < new Date().getHours()
                  return (
                    <div key={slot}
                      onClick={() => !b && !isPast && setBooking({room, slot})}
                      style={{
                        padding:'8px 12px', borderRadius:8, fontSize:13, cursor: b || isPast ? 'default' : 'pointer',
                        border: booking?.room===room && booking?.slot===slot ? '1.5px solid #CC2229' :
                               b ? '0.5px solid #f0c0c0' : '0.5px solid #e8e8e8',
                        background: b ? (isMine ? '#EAF3DE' : '#FCEBEB') : isPast ? '#f5f5f5' :
                                   booking?.room===room && booking?.slot===slot ? '#fff5f5' : '#fff',
                        color: b ? (isMine ? '#3B6D11' : '#A32D2D') : isPast ? '#bbb' : '#1a1a1a',
                        transition:'all .15s'
                      }}>
                      <div style={{display:'flex',justifyContent:'space-between'}}>
                        <span>{slot} – {TIME_SLOTS[TIME_SLOTS.indexOf(slot)+1] || '18:00'}</span>
                        {b && <span style={{fontWeight:500,fontSize:12}}>
                          {isMine ? `Εσύ · ${b.client_name}` : `${b.agents?.full_name || 'Agent'} · ${b.client_name}`}
                        </span>}
                        {!b && !isPast && <span style={{color:'#CC2229',fontSize:11}}>+ Κλείσιμο</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {booking && (
          <div style={{marginTop:20,background:'#fff',border:'1.5px solid #CC2229',borderRadius:12,padding:'1.25rem'}}>
            <div style={{fontSize:15,fontWeight:500,marginBottom:12}}>
              {booking.room} — {booking.slot} · {selectedDate}
            </div>
            <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'flex-end'}}>
              <div>
                <div style={{fontSize:12,color:'#888',marginBottom:4}}>Όνομα πελάτη *</div>
                <input value={clientName} onChange={e=>setClientName(e.target.value)}
                  placeholder="π.χ. Γιώργος Παπαδόπουλος"
                  style={{padding:'8px 12px',border:'0.5px solid #ddd',borderRadius:8,fontSize:13,width:220}} />
              </div>
              <div>
                <div style={{fontSize:12,color:'#888',marginBottom:4}}>Τηλέφωνο</div>
                <input value={clientPhone} onChange={e=>setClientPhone(e.target.value)}
                  placeholder="69xxxxxxxx"
                  style={{padding:'8px 12px',border:'0.5px solid #ddd',borderRadius:8,fontSize:13,width:150}} />
              </div>
              <button onClick={confirmBooking} disabled={loading || !clientName}
                style={{padding:'8px 20px',background:'#CC2229',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:500,cursor:'pointer',opacity:!clientName?0.5:1}}>
                {loading ? 'Αποθήκευση...' : '✓ Επιβεβαίωση'}
              </button>
              <button onClick={()=>setBooking(null)}
                style={{padding:'8px 14px',background:'none',border:'0.5px solid #ddd',borderRadius:8,fontSize:13,cursor:'pointer'}}>
                Ακύρωση
              </button>
            </div>
          </div>
        )}

        {isAdmin && bookings.length > 0 && (
          <div style={{marginTop:24,background:'#fff',border:'0.5px solid #e8e8e8',borderRadius:12,padding:'1.25rem'}}>
            <div style={{fontSize:14,fontWeight:500,marginBottom:12,color:'#888'}}>Όλες οι κρατήσεις — {selectedDate}</div>
            {bookings.map(b => (
              <div key={b.id} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'0.5px solid #f0f0f0',fontSize:13}}>
                <span style={{fontWeight:500}}>{b.room} · {b.time_slot}</span>
                <span style={{color:'#666'}}>{b.agents?.full_name} → {b.client_name} {b.client_phone && `(${b.client_phone})`}</span>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
