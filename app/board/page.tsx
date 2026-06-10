'use client'
import { useState, useEffect } from 'react'
import Shell from '@/components/Shell'
import { useApp } from '@/lib/AppContext'
import { createClient } from '@/lib/supabase'

export default function BoardPage() {
  const { agent } = useApp()
  const [openHouses, setOpenHouses] = useState<any[]>([])
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [tab, setTab] = useState<'openhouses'|'announcements'>('openhouses')
  const [toast, setToast] = useState('')
  const supabase = createClient()

  useEffect(() => {
    supabase.from('open_houses').select('*, agents(full_name)').order('date', { ascending: true }).then(({ data }) => setOpenHouses(data || []))
    supabase.from('announcements').select('*, agents(full_name)').order('created_at', { ascending: false }).limit(20).then(({ data }) => setAnnouncements(data || []))
  }, [])

  function fmt(d: string) {
    return new Date(d).toLocaleDateString('el-GR', { weekday: 'short', day: 'numeric', month: 'short' })
  }

  return (
    <Shell>
      <div style={{ padding: '2rem', maxWidth: 900 }}>
        <h1 style={{ fontSize: 22, fontWeight: 500, color: '#1a1a1a', margin: '0 0 4px' }}>Πινακας Ανακοινωσεων</h1>
        <p style={{ color: '#888', fontSize: 14, margin: '0 0 1.5rem' }}>Open Houses & ανακοινωσεις της εβδομαδας</p>

        <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '0.5px solid #e8e8e8' }}>
          {[{k:'openhouses',l:'Open Houses'},{k:'announcements',l:'Ανακοινωσεις'}].map(t=>(
            <button key={t.k} onClick={()=>setTab(t.k as any)}
              style={{ padding:'8px 18px', border:'none', background:'none', fontSize:13, cursor:'pointer',
                color:tab===t.k?'#CC2229':'#888', fontWeight:tab===t.k?500:400,
                borderBottom:tab===t.k?'2px solid #CC2229':'2px solid transparent', marginBottom:-1 }}>
              {t.l}
            </button>
          ))}
        </div>

        {tab==='openhouses' && (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {openHouses.length === 0 && <p style={{ color:'#bbb', fontSize:14 }}>Δεν υπαρχουν open houses προγραμματισμενα.</p>}
            {openHouses.map(oh=>(
              <div key={oh.id} style={{ background:'#fff', border:'0.5px solid #e8e8e8', borderRadius:12, padding:'1rem 1.25rem', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div style={{ fontSize:14, fontWeight:500 }}>{oh.address || 'Ακινητο'}</div>
                  <div style={{ fontSize:12, color:'#888', marginTop:3 }}>
                    {fmt(oh.date)} · {oh.start_time}–{oh.end_time} · {oh.agents?.full_name}
                  </div>
                  {oh.ilist_code && <div style={{ fontSize:11, color:'#bbb', marginTop:2 }}>Κωδ. {oh.ilist_code}</div>}
                </div>
                <div style={{ textAlign:'right' }}>
                  {oh.price && <div style={{ fontSize:15, fontWeight:600, color:'#CC2229' }}>€{oh.price.toLocaleString('el-GR')}</div>}
                  <div style={{ fontSize:12, color:'#888' }}>{oh.sqm} τμ</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab==='announcements' && (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {announcements.length === 0 && <p style={{ color:'#bbb', fontSize:14 }}>Δεν υπαρχουν ανακοινωσεις.</p>}
            {announcements.map(a=>(
              <div key={a.id} style={{ background:'#fff', border:'0.5px solid #e8e8e8', borderRadius:12, padding:'1rem 1.25rem' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
                  <span style={{ fontSize:14, fontWeight:500 }}>{a.title || 'Ανακοινωση'}</span>
                  <span style={{ fontSize:11, color:'#bbb' }}>{new Date(a.created_at).toLocaleDateString('el-GR')}</span>
                </div>
                <p style={{ fontSize:13, color:'#666', margin:0, lineHeight:1.6 }}>{a.content}</p>
                <div style={{ fontSize:12, color:'#888', marginTop:6 }}>{a.agents?.full_name}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Shell>
  )
}