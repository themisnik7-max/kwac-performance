'use client'
import { useState, useEffect } from 'react'
import Shell from '@/components/Shell'
import { useApp } from '@/lib/AppContext'
import { createClient } from '@/lib/supabase'
import { authedFetch } from '@/lib/authedFetch'

const STAGES = [
  { key: 'listing',   label: 'Ανάθεση',     icon: '📋', color: '#185FA5', bg: '#E6F1FB' },
  { key: 'showing',   label: 'Υποδείξεις',  icon: '👁️', color: '#854F0B', bg: '#FAEEDA' },
  { key: 'offer',     label: 'Προσφορά',    icon: '💬', color: '#534AB7', bg: '#EEEDFE' },
  { key: 'presale',   label: 'Προσύμφωνο', icon: '📝', color: '#0F6E56', bg: '#E1F5EE' },
  { key: 'contract',  label: 'Συμβόλαιο',  icon: '✅', color: '#3B6D11', bg: '#EAF3DE' },
  { key: 'closed',    label: 'Κλειστό',    icon: '🏁', color: '#666',    bg: '#f0f0f0' },
  { key: 'withdrawn', label: 'Αποσύρθηκε', icon: '❌', color: '#CC2229', bg: '#FCEBEB' },
]

const EVENT_TYPES = [
  { key: 'showing',        label: 'Υπόδειξη' },
  { key: 'open_house',     label: 'Open House' },
  { key: 'offer',          label: 'Προσφορά' },
  { key: 'offer_rejected', label: 'Απόρριψη Προσφοράς' },
  { key: 'presale',        label: 'Προσύμφωνο' },
  { key: 'contract',       label: 'Συμβόλαιο' },
  { key: 'withdrawn',      label: 'Αποσύρθηκε' },
  { key: 'price_change',   label: 'Αλλαγή Τιμής' },
  { key: 'note',           label: 'Σημείωση' },
]

const STAGE_PROGRESS: Record<string,number> = { listing:1, showing:2, offer:3, presale:4, contract:5, closed:6, withdrawn:0 }

export default function PipelinePage() {
  const { agent } = useApp()
  const [properties, setProperties] = useState<any[]>([])
  const [events, setEvents] = useState<Record<string, any[]>>({})
  const [selected, setSelected] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<any>(null)
  const [filterStage, setFilterStage] = useState('all')
  const [filterType, setFilterType] = useState('all')
  const [search, setSearch] = useState('')
  const [showAddEvent, setShowAddEvent] = useState(false)
  const [newEvent, setNewEvent] = useState({ event_type: 'showing', title: '', description: '', amount: '', event_date: new Date().toISOString().split('T')[0] })
  const supabase = createClient()

  useEffect(() => { fetchProperties() }, [])

  async function fetchProperties() {
    setLoading(true)
    const { data } = await supabase.from('pipeline_properties').select('*').order('listed_at', { ascending: false }).limit(1000)
    setProperties(data || [])
    setLoading(false)
  }

  async function fetchEvents(propId: string) {
    if (events[propId]) return
    const { data } = await supabase.from('pipeline_events').select('*, agents(full_name)').eq('property_id', propId).order('event_date', { ascending: false })
    setEvents(prev => ({ ...prev, [propId]: data || [] }))
  }

  function selectProperty(prop: any) {
    setSelected(prop)
    fetchEvents(prop.id)
    setShowAddEvent(false)
  }

  async function syncFromWordPress() {
    setSyncing(true)
    setSyncResult(null)
    const res = await authedFetch('/api/pipeline-sync?manual=1')
    const data = await res.json()
    setSyncResult(data)
    setSyncing(false)
    if (data.new_properties > 0) fetchProperties()
  }

  async function updateStage(propId: string, stage: string) {
    await supabase.from('pipeline_properties').update({ stage, stage_updated_at: new Date().toISOString() }).eq('id', propId)
    setProperties(prev => prev.map(p => p.id === propId ? { ...p, stage } : p))
    if (selected?.id === propId) setSelected((prev: any) => ({ ...prev, stage }))
  }

  async function addEvent() {
    if (!selected || !newEvent.title.trim()) return
    const payload = {
      property_id: selected.id,
      agent_id: agent?.id || null,
      agent_name: agent?.full_name || 'Team',
      event_type: newEvent.event_type,
      title: newEvent.title,
      description: newEvent.description || null,
      amount: newEvent.amount ? parseFloat(newEvent.amount) : null,
      event_date: newEvent.event_date
    }
    const { data } = await supabase.from('pipeline_events').insert(payload).select().single()
    if (data) {
      setEvents(prev => ({ ...prev, [selected.id]: [data, ...(prev[selected.id] || [])] }))
      // Auto-advance stage based on event type
      const stageMap: Record<string,string> = { showing:'showing', open_house:'showing', offer:'offer', presale:'presale', contract:'contract', withdrawn:'withdrawn' }
      if (stageMap[newEvent.event_type]) await updateStage(selected.id, stageMap[newEvent.event_type])
    }
    setNewEvent({ event_type: 'showing', title: '', description: '', amount: '', event_date: new Date().toISOString().split('T')[0] })
    setShowAddEvent(false)
  }

  const filtered = properties.filter(p => {
    if (filterStage !== 'all' && p.stage !== filterStage) return false
    if (filterType !== 'all' && p.deal_type !== filterType) return false
    if (search && !p.title?.toLowerCase().includes(search.toLowerCase()) && !p.address?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const stageCounts = STAGES.reduce((acc: Record<string,number>, s) => {
    acc[s.key] = properties.filter(p => p.stage === s.key).length
    return acc
  }, {})

  const getStage = (key: string) => STAGES.find(s => s.key === key) || STAGES[0]
  const propEvents = selected ? (events[selected.id] || []) : []

  return (
    <Shell>
      <div style={{ padding: '1.5rem 2rem', maxWidth: 1200 }}>
        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'1.25rem' }}>
          <div>
            <h1 style={{ fontSize:22, fontWeight:500, color:'#1a1a1a', margin:0 }}>Property Pipeline</h1>
            <p style={{ color:'#888', fontSize:14, margin:'4px 0 0' }}>
              {properties.length} ακίνητα · timeline από ανάθεση ως συμβόλαιο
            </p>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={syncFromWordPress} disabled={syncing}
              style={{ padding:'8px 16px', background: syncing ? '#f0f0f0' : '#1a1a1a', color: syncing ? '#888' : '#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer' }}>
              {syncing ? '🔄 Συγχρονισμός...' : '🔗 Sync από zadeshome'}
            </button>
          </div>
        </div>

        {/* Sync result */}
        {syncResult && (
          <div style={{ background: syncResult.errors?.length ? '#FCEBEB' : '#EAF3DE', border:'0.5px solid ' + (syncResult.errors?.length ? '#f5c6c6' : '#86EFAC'), borderRadius:8, padding:'10px 16px', marginBottom:14, fontSize:13 }}>
            {syncResult.errors?.length > 0
              ? <><strong>⚠️ Χρειάζεται WordPress credentials</strong> — πήγαινε στο Vercel → Settings → Environment Variables και πρόσθεσε ZADESHOME_WP_USER και ZADESHOME_WP_APP_PASSWORD</>
              : <><strong>✅ Sync ολοκληρώθηκε</strong> · {syncResult.synced} ακίνητα · {syncResult.new_properties} νέα</>
            }
          </div>
        )}

        {/* Stage pills */}
        <div style={{ display:'flex', gap:6, marginBottom:14, flexWrap:'wrap' }}>
          <button onClick={()=>setFilterStage('all')}
            style={{ padding:'5px 12px', borderRadius:100, fontSize:12, cursor:'pointer', background: filterStage==='all'?'#1a1a1a':'#fff', color: filterStage==='all'?'#fff':'#666', border: filterStage==='all'?'none':'0.5px solid #e8e8e8', fontWeight:500 }}>
            Όλα ({properties.length})
          </button>
          {STAGES.filter(s=>s.key!=='closed'&&s.key!=='withdrawn').map(s=>(
            <button key={s.key} onClick={()=>setFilterStage(s.key)}
              style={{ padding:'5px 12px', borderRadius:100, fontSize:12, cursor:'pointer',
                background: filterStage===s.key ? s.color : s.bg,
                color: filterStage===s.key ? '#fff' : s.color,
                border: 'none', fontWeight: filterStage===s.key ? 600 : 400 }}>
              {s.icon} {s.label} {stageCounts[s.key]>0 && '('+stageCounts[s.key]+')'}
            </button>
          ))}
        </div>

        {/* Search + filters */}
        <div style={{ display:'flex', gap:8, marginBottom:16 }}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Αναζήτηση ακινήτου..."
            style={{ flex:1, padding:'8px 12px', border:'0.5px solid #ddd', borderRadius:8, fontSize:13 }} />
          <select value={filterType} onChange={e=>setFilterType(e.target.value)}
            style={{ padding:'8px 12px', border:'0.5px solid #ddd', borderRadius:8, fontSize:13, background:'#fff' }}>
            <option value="all">Πώληση & Ενοικίαση</option>
            <option value="sale">Μόνο Πωλήσεις</option>
            <option value="rent">Μόνο Ενοικιάσεις</option>
          </select>
        </div>

        <div style={{ display:'grid', gridTemplateColumns: selected ? '420px 1fr' : '1fr', gap:16 }}>
          {/* Property list */}
          <div style={{ display:'flex', flexDirection:'column', gap:8, maxHeight:'75vh', overflowY:'auto', paddingRight:4 }}>
            {loading ? (
              <div style={{ color:'#bbb', fontSize:14, padding:'2rem', textAlign:'center' }}>Φόρτωση...</div>
            ) : filtered.length === 0 ? (
              <div style={{ background:'#fff', border:'0.5px solid #e8e8e8', borderRadius:12, padding:'2.5rem', textAlign:'center' }}>
                <div style={{ fontSize:32, marginBottom:10 }}>🏠</div>
                <div style={{ fontSize:15, fontWeight:500, marginBottom:6 }}>Κανένα ακίνητο</div>
                <div style={{ fontSize:13, color:'#888', marginBottom:16 }}>
                  {properties.length === 0 ? 'Κάνε Sync από zadeshome για να φορτωθούν τα ακίνητα' : 'Δοκίμασε διαφορετικό φίλτρο'}
                </div>
                {properties.length === 0 && (
                  <button onClick={syncFromWordPress} disabled={syncing}
                    style={{ padding:'9px 20px', background:'#CC2229', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer' }}>
                    🔗 Sync από zadeshome τώρα
                  </button>
                )}
              </div>
            ) : filtered.map(prop => {
              const stage = getStage(prop.stage)
              const isSelected = selected?.id === prop.id
              const progress = STAGE_PROGRESS[prop.stage] || 0
              return (
                <div key={prop.id} onClick={()=>selectProperty(prop)}
                  style={{ background: isSelected ? '#f5f8ff' : '#fff', border: isSelected ? '1.5px solid #CC2229' : '0.5px solid #e8e8e8',
                    borderRadius:12, padding:'12px 14px', cursor:'pointer', transition:'all .12s' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
                    <div style={{ fontSize:14, fontWeight:500, color:'#1a1a1a', flex:1, marginRight:8, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {prop.title}
                    </div>
                    <span style={{ background:stage.bg, color:stage.color, fontSize:11, padding:'2px 8px', borderRadius:100, flexShrink:0, fontWeight:500 }}>
                      {stage.icon} {stage.label}
                    </span>
                  </div>
                  {prop.address && <div style={{ fontSize:12, color:'#888', marginBottom:6 }}>📍 {prop.address}</div>}
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div style={{ display:'flex', gap:10 }}>
                      {prop.price && <span style={{ fontSize:12, fontWeight:500, color:'#CC2229' }}>€{prop.price.toLocaleString('el-GR')}</span>}
                      {prop.sqm && <span style={{ fontSize:12, color:'#888' }}>{prop.sqm}τμ</span>}
                      <span style={{ fontSize:11, color:'#bbb', background:'#f5f5f5', padding:'1px 6px', borderRadius:4 }}>
                        {prop.deal_type === 'rent' ? 'Ενοικ.' : 'Πώληση'}
                      </span>
                    </div>
                    {prop.agent_name && <span style={{ fontSize:11, color:'#888' }}>{prop.agent_name}</span>}
                  </div>
                  {/* Progress bar */}
                  {progress > 0 && (
                    <div style={{ marginTop:8 }}>
                      <div style={{ background:'#f0f0f0', borderRadius:100, height:4, overflow:'hidden' }}>
                        <div style={{ height:'100%', background:stage.color, borderRadius:100, width:(progress/5*100)+'%', transition:'width .3s' }} />
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Property detail */}
          {selected && (
            <div style={{ background:'#fff', border:'0.5px solid #e8e8e8', borderRadius:12, overflow:'hidden', maxHeight:'75vh', display:'flex', flexDirection:'column' }}>
              {/* Header */}
              <div style={{ padding:'1.25rem', borderBottom:'0.5px solid #f0f0f0' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                  <div style={{ flex:1, marginRight:12 }}>
                    <h2 style={{ fontSize:16, fontWeight:500, margin:'0 0 4px', lineHeight:1.3 }}>{selected.title}</h2>
                    {selected.address && <div style={{ fontSize:13, color:'#888' }}>📍 {selected.address}</div>}
                  </div>
                  <div style={{ display:'flex', gap:6 }}>
                    {selected.wp_url && (
                      <a href={selected.wp_url} target="_blank" rel="noopener noreferrer"
                        style={{ padding:'5px 10px', background:'#f5f5f5', border:'0.5px solid #e8e8e8', borderRadius:6, fontSize:12, color:'#666', textDecoration:'none' }}>
                        zadeshome ↗
                      </a>
                    )}
                    <button onClick={()=>setSelected(null)}
                      style={{ padding:'5px 10px', background:'none', border:'0.5px solid #e8e8e8', borderRadius:6, fontSize:14, cursor:'pointer', color:'#888' }}>✕</button>
                  </div>
                </div>

                {/* Stage selector */}
                <div style={{ marginTop:10 }}>
                  <div style={{ fontSize:11, color:'#888', marginBottom:6, textTransform:'uppercase', letterSpacing:'.05em' }}>Στάδιο Pipeline</div>
                  <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                    {STAGES.map(s => (
                      <button key={s.key} onClick={()=>updateStage(selected.id, s.key)}
                        style={{ padding:'4px 10px', borderRadius:100, fontSize:11, cursor:'pointer',
                          background: selected.stage===s.key ? s.color : s.bg,
                          color: selected.stage===s.key ? '#fff' : s.color,
                          border:'none', fontWeight: selected.stage===s.key ? 600 : 400 }}>
                        {s.icon} {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Key info */}
                <div style={{ display:'flex', gap:16, marginTop:10, flexWrap:'wrap' }}>
                  {selected.price && <div style={{ fontSize:13 }}><span style={{ color:'#888' }}>Τιμή: </span><strong style={{ color:'#CC2229' }}>€{selected.price.toLocaleString('el-GR')}</strong></div>}
                  {selected.sqm && <div style={{ fontSize:13 }}><span style={{ color:'#888' }}>Τ.μ.: </span><strong>{selected.sqm}</strong></div>}
                  {selected.property_type && <div style={{ fontSize:13 }}><span style={{ color:'#888' }}>Τύπος: </span><strong>{selected.property_type}</strong></div>}
                  {selected.area && <div style={{ fontSize:13 }}><span style={{ color:'#888' }}>Περιοχή: </span><strong>{selected.area}</strong></div>}
                </div>
              </div>

              {/* Timeline */}
              <div style={{ flex:1, overflowY:'auto', padding:'1rem 1.25rem' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                  <div style={{ fontSize:13, fontWeight:500, color:'#888', textTransform:'uppercase', letterSpacing:'.05em' }}>Timeline</div>
                  <button onClick={()=>setShowAddEvent(!showAddEvent)}
                    style={{ padding:'5px 12px', background:'#CC2229', color:'#fff', border:'none', borderRadius:6, fontSize:12, fontWeight:500, cursor:'pointer' }}>
                    + Νέα ενέργεια
                  </button>
                </div>

                {/* Add event form */}
                {showAddEvent && (
                  <div style={{ background:'#f8f8f7', border:'0.5px solid #e8e8e8', borderRadius:10, padding:'12px', marginBottom:14 }}>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
                      <select value={newEvent.event_type} onChange={e=>setNewEvent(p=>({...p, event_type:e.target.value}))}
                        style={{ padding:'7px 10px', border:'0.5px solid #ddd', borderRadius:8, fontSize:13, background:'#fff' }}>
                        {EVENT_TYPES.map(t=><option key={t.key} value={t.key}>{t.label}</option>)}
                      </select>
                      <input type="date" value={newEvent.event_date} onChange={e=>setNewEvent(p=>({...p, event_date:e.target.value}))}
                        style={{ padding:'7px 10px', border:'0.5px solid #ddd', borderRadius:8, fontSize:13 }} />
                    </div>
                    <input value={newEvent.title} onChange={e=>setNewEvent(p=>({...p, title:e.target.value}))} placeholder="Τίτλος ενέργειας *"
                      style={{ width:'100%', padding:'7px 10px', border:'0.5px solid #ddd', borderRadius:8, fontSize:13, marginBottom:8, boxSizing:'border-box' }} />
                    {(newEvent.event_type==='offer'||newEvent.event_type==='presale'||newEvent.event_type==='contract') && (
                      <input type="number" value={newEvent.amount} onChange={e=>setNewEvent(p=>({...p, amount:e.target.value}))} placeholder="Ποσό (€)"
                        style={{ width:'100%', padding:'7px 10px', border:'0.5px solid #ddd', borderRadius:8, fontSize:13, marginBottom:8, boxSizing:'border-box' }} />
                    )}
                    <textarea value={newEvent.description} onChange={e=>setNewEvent(p=>({...p, description:e.target.value}))} placeholder="Σημειώσεις (προαιρετικό)" rows={2}
                      style={{ width:'100%', padding:'7px 10px', border:'0.5px solid #ddd', borderRadius:8, fontSize:13, marginBottom:8, boxSizing:'border-box', resize:'none' }} />
                    <div style={{ display:'flex', gap:8 }}>
                      <button onClick={addEvent} disabled={!newEvent.title.trim()}
                        style={{ padding:'7px 16px', background:'#CC2229', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer', opacity:!newEvent.title.trim()?0.5:1 }}>
                        Αποθήκευση
                      </button>
                      <button onClick={()=>setShowAddEvent(false)} style={{ padding:'7px 12px', background:'none', border:'0.5px solid #ddd', borderRadius:8, fontSize:13, cursor:'pointer' }}>Ακύρωση</button>
                    </div>
                  </div>
                )}

                {/* Events list */}
                {propEvents.length === 0 ? (
                  <div style={{ color:'#bbb', fontSize:13, textAlign:'center', padding:'1.5rem 0' }}>Καμία ενέργεια ακόμα</div>
                ) : (
                  <div style={{ position:'relative' }}>
                    <div style={{ position:'absolute', left:11, top:0, bottom:0, width:1, background:'#e8e8e8' }} />
                    {propEvents.map((ev, i) => {
                      const evType = EVENT_TYPES.find(t=>t.key===ev.event_type)
                      return (
                        <div key={ev.id} style={{ display:'flex', gap:12, marginBottom:14, position:'relative' }}>
                          <div style={{ width:24, height:24, borderRadius:'50%', background:'#CC2229', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', zIndex:1, fontSize:11 }}>
                            <span style={{ color:'#fff' }}>●</span>
                          </div>
                          <div style={{ flex:1, paddingTop:2 }}>
                            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                              <div>
                                <span style={{ fontSize:13, fontWeight:500 }}>{ev.title}</span>
                                <span style={{ fontSize:11, color:'#bbb', marginLeft:8, background:'#f5f5f5', padding:'1px 6px', borderRadius:4 }}>{evType?.label || ev.event_type}</span>
                              </div>
                              <span style={{ fontSize:11, color:'#bbb', flexShrink:0 }}>
                                {new Date(ev.event_date).toLocaleDateString('el-GR',{day:'numeric',month:'short'})}
                              </span>
                            </div>
                            {ev.amount && <div style={{ fontSize:12, color:'#CC2229', fontWeight:500, marginTop:2 }}>€{ev.amount.toLocaleString('el-GR')}</div>}
                            {ev.description && <div style={{ fontSize:12, color:'#666', marginTop:3, lineHeight:1.5 }}>{ev.description}</div>}
                            {ev.agent_name && <div style={{ fontSize:11, color:'#bbb', marginTop:3 }}>{ev.agent_name}</div>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </Shell>
  )
}