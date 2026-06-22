'use client'
import { useState, useEffect, useRef } from 'react'
import Shell from '@/components/Shell'
import { useApp } from '@/lib/AppContext'
import { createClient } from '@/lib/supabase'
import { authedFetch } from '@/lib/authedFetch'

const COND_LABELS: Record<string,string> = {excellent:'Αριστη',good:'Καλη',fair:'Μετρια',needs_work:'Χρειαζεται εργασιες'}

function fmt(n: number) { return n?.toLocaleString('el-GR') || '–' }
function fmtE(n: number) { return n ? '€' + fmt(Math.round(n)) : '–' }

export default function MeetingPage() {
  const { agent } = useApp()
  const [props, setProps] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [valuation, setValuation] = useState<any>(null)
  const [comments, setComments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [estimating, setEstimating] = useState(false)
  const [importing, setImporting] = useState(false)
  const [myComment, setMyComment] = useState('')
  const [myEstimate, setMyEstimate] = useState('')
  const [agrees, setAgrees] = useState<boolean|null>(null)
  const [savingComment, setSavingComment] = useState(false)
  const [toast, setToast] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const sb = createClient()

  useEffect(() => { fetchProps() }, [])
  useEffect(() => { if (selected) { fetchValuation(selected.id); fetchComments(selected.id) } }, [selected])

  async function fetchProps() {
    setLoading(true)
    const { data } = await sb.from('meeting_properties').select('*').order('meeting_date',{ascending:false})
    setProps(data||[])
    setLoading(false)
  }
  async function fetchValuation(pid: string) {
    setValuation(null)
    const { data } = await sb.from('meeting_valuations').select('*').eq('property_id',pid).single()
    setValuation(data)
  }
  async function fetchComments(pid: string) {
    const { data } = await sb.from('meeting_comments').select('*').eq('property_id',pid).order('created_at',{ascending:false})
    setComments(data||[])
  }

  async function runEstimation() {
    if (!selected) return
    setEstimating(true)
    const res = await authedFetch('/api/meeting-valuation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({property_id:selected.id})})
    const data = await res.json()
    if (data.success) { setValuation({...data.valuation,top_producers:data.top_producers,comparables:data.comparables}); setToast('✅ Εκτιμηση ολοκληρωθηκε!') }
    else setToast('❌ ' + (data.error||'Σφαλμα'))
    setEstimating(false)
    setTimeout(() => setToast(''), 3000)
    fetchProps()
  }

  async function submitComment() {
    if (!selected || !myComment.trim() || agrees === null) return
    setSavingComment(true)
    await sb.from('meeting_comments').insert({
      property_id: selected.id, agent_id: agent?.id||null,
      agent_name: agent?.full_name||'Αγνωστος', comment: myComment,
      agent_estimate: myEstimate ? parseFloat(myEstimate) : null,
      agrees_with_ai: agrees, feedback_processed: false,
      feedback_weight: 1.0
    })
    setMyComment(''); setMyEstimate(''); setAgrees(null)
    setSavingComment(false)
    setToast('✅ Σχολιο αποθηκευτηκε!')
    setTimeout(() => setToast(''), 2500)
    fetchComments(selected.id)
  }

  async function handleExcelImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setImporting(true); setToast('Εισαγωγη...')
    const text = await file.text()
    const lines = text.split('\n').filter(l=>l.trim())
    const headers = lines[0].split('\t').map(h=>h.trim().toLowerCase())
    let imported = 0
    for (let i=1; i<lines.length; i++) {
      const cols = lines[i].split('\t')
      const row: Record<string,string> = {}
      headers.forEach((h,j)=>{ row[h] = (cols[j]||'').trim() })
      const ilistId = row['κωδικος']||row['code']||row['id']||row['κωδ']||String(i)
      const title = row['τιτλος']||row['title']||row['ακινητο']||'Ακινητο '+ilistId
      const area = row['περιοχη']||row['area']||''
      const sqm = parseFloat(row['τμ']||row['εμβαδο']||row['sqm']||'0')||null
      const price = parseFloat((row['τιμη']||row['price']||'0').replace(/[^0-9.]/g,''))||null
      const floor = row['οροφος']||row['floor']||null
      const yearBuilt = parseInt(row['ετος']||row['year']||'0')||null
      if (!title || title==='Ακινητο '+ilistId && !area) continue
      await sb.from('meeting_properties').upsert({
        ilist_id: ilistId, title, area, sqm, asking_price:price, floor,
        year_built:yearBuilt, meeting_date:new Date().toISOString().split('T')[0],
        ilist_url: row['url']||row['link']||null, status:'pending'
      },{onConflict:'ilist_id'})
      imported++
    }
    setImporting(false); setToast(`✅ ${imported} ακινητα εισηχθησαν!`)
    setTimeout(() => setToast(''), 3000)
    fetchProps()
  }

  async function addManual() {
    const { data } = await sb.from('meeting_properties').insert({
      ilist_id: 'MAN-'+Date.now(), title:'Νεο Ακινητο',
      meeting_date:new Date().toISOString().split('T')[0], status:'pending'
    }).select().single()
    if (data) { fetchProps(); setSelected(data) }
  }

  const statusColor: Record<string,string> = {pending:'#888',estimated:'#185FA5',completed:'#3B6D11'}
  const statusLabel: Record<string,string> = {pending:'Εκκρεμει',estimated:'Εκτιμηθηκε',completed:'Ολοκληρωθηκε'}

  return (
    <Shell>
      <div style={{padding:'1.5rem 2rem',maxWidth:1200}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'1.25rem'}}>
          <div>
            <h1 style={{fontSize:22,fontWeight:500,color:'#1a1a1a',margin:0}}>Μιτινγκ Ακινητων</h1>
            <p style={{color:'#888',fontSize:14,margin:'4px 0 0'}}>AI εκτιμηση + feedback απο top producers</p>
          </div>
          <div style={{display:'flex',gap:8}}>
            <button onClick={addManual} style={{padding:'8px 14px',background:'#f8f8f7',border:'0.5px solid #ddd',borderRadius:8,fontSize:13,cursor:'pointer'}}>+ Χειροκινητα</button>
            <label style={{padding:'8px 16px',background:'#1a1a1a',color:'#fff',borderRadius:8,fontSize:13,fontWeight:500,cursor:'pointer'}}>
              📤 Import iList Excel
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,.tsv,.txt" onChange={handleExcelImport} style={{display:'none'}} />
            </label>
          </div>
        </div>

        {toast && <div style={{background:toast.startsWith('❌')?'#FCEBEB':'#EAF3DE',color:toast.startsWith('❌')?'#A32D2D':'#3B6D11',padding:'10px 16px',borderRadius:8,marginBottom:14,fontSize:13}}>{toast}</div>}

        <div style={{display:'grid',gridTemplateColumns:'340px 1fr',gap:16}}>
          {/* Property list */}
          <div style={{display:'flex',flexDirection:'column',gap:8,maxHeight:'78vh',overflowY:'auto',paddingRight:4}}>
            {loading ? <div style={{color:'#bbb',fontSize:14,padding:'2rem',textAlign:'center'}}>Φορτωση...</div>
            : props.length === 0 ? (
              <div style={{background:'#fff',border:'0.5px solid #e8e8e8',borderRadius:12,padding:'2.5rem',textAlign:'center'}}>
                <div style={{fontSize:32,marginBottom:10}}>🏠</div>
                <div style={{fontSize:14,fontWeight:500,marginBottom:6}}>Κανενα ακινητο</div>
                <div style={{fontSize:13,color:'#888',marginBottom:14}}>Ανεβαστε Excel απο iList η προσθεστε χειροκινητα</div>
              </div>
            ) : props.map(p => (
              <div key={p.id} onClick={() => setSelected(p)}
                style={{background:selected?.id===p.id?'#f5f8ff':'#fff',border:selected?.id===p.id?'1.5px solid #CC2229':'0.5px solid #e8e8e8',borderRadius:12,padding:'10px 14px',cursor:'pointer'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:4}}>
                  <span style={{fontSize:13,fontWeight:500,flex:1,marginRight:8,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.title}</span>
                  <span style={{fontSize:10,background:statusColor[p.status]+'18',color:statusColor[p.status],padding:'2px 7px',borderRadius:100,flexShrink:0}}>{statusLabel[p.status]}</span>
                </div>
                {p.area && <div style={{fontSize:12,color:'#888'}}>📍 {p.area}{p.sqm?' · '+p.sqm+'τμ':''}</div>}
                {p.asking_price && <div style={{fontSize:12,color:'#CC2229',fontWeight:500,marginTop:3}}>Ζητα: {fmtE(p.asking_price)}</div>}
                {p.ilist_id && <div style={{fontSize:11,color:'#bbb',marginTop:2}}>#{p.ilist_id}</div>}
              </div>
            ))}
          </div>

          {/* Detail panel */}
          {selected ? (
            <div style={{background:'#fff',border:'0.5px solid #e8e8e8',borderRadius:12,overflow:'hidden',maxHeight:'78vh',display:'flex',flexDirection:'column'}}>
              {/* Header */}
              <div style={{padding:'1.25rem',borderBottom:'0.5px solid #f0f0f0'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
                  <h2 style={{fontSize:16,fontWeight:500,margin:0,flex:1,marginRight:12}}>{selected.title}</h2>
                  <div style={{display:'flex',gap:6}}>
                    {selected.ilist_url && <a href={selected.ilist_url} target="_blank" style={{padding:'5px 10px',background:'#f5f5f5',border:'0.5px solid #e8e8e8',borderRadius:6,fontSize:12,color:'#666',textDecoration:'none'}}>i-list ↗</a>}
                    {selected.ilist_id && <span style={{fontSize:11,color:'#bbb',padding:'5px 8px',background:'#f8f8f7',borderRadius:6}}>#{selected.ilist_id}</span>}
                    <button onClick={()=>setSelected(null)} style={{padding:'5px 10px',background:'none',border:'0.5px solid #e8e8e8',borderRadius:6,fontSize:14,cursor:'pointer',color:'#888'}}>✕</button>
                  </div>
                </div>
                <div style={{display:'flex',gap:12,flexWrap:'wrap',fontSize:13}}>
                  {selected.area && <span><span style={{color:'#888'}}>Περιοχη: </span>{selected.area}</span>}
                  {selected.sqm && <span><span style={{color:'#888'}}>Τ.μ.: </span>{selected.sqm}</span>}
                  {selected.floor && <span><span style={{color:'#888'}}>Οροφος: </span>{selected.floor}</span>}
                  {selected.year_built && <span><span style={{color:'#888'}}>Ετος: </span>{selected.year_built}</span>}
                  {selected.rooms && <span><span style={{color:'#888'}}>Δωμ.: </span>{selected.rooms}</span>}
                  {selected.condition && <span><span style={{color:'#888'}}>Κατ/ση: </span>{COND_LABELS[selected.condition]||selected.condition}</span>}
                  {selected.asking_price && <span style={{color:'#CC2229',fontWeight:500}}>Ζητα: {fmtE(selected.asking_price)}</span>}
                </div>
                <button onClick={runEstimation} disabled={estimating}
                  style={{marginTop:10,padding:'8px 20px',background:'#CC2229',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:500,cursor:'pointer',opacity:estimating?0.7:1}}>
                  {estimating ? '🤖 Εκτιμηση...' : '🤖 AI Εκτιμηση'}
                </button>
              </div>

              <div style={{flex:1,overflowY:'auto',padding:'1rem 1.25rem'}}>
                {/* Valuation result */}
                {valuation && (
                  <div style={{marginBottom:20}}>
                    <div style={{background:'#1a1a1a',borderRadius:12,padding:'1.25rem',color:'#fff',marginBottom:12}}>
                      <div style={{fontSize:11,color:'#888',marginBottom:6,textTransform:'uppercase',letterSpacing:'.05em'}}>AI Εκτιμηση</div>
                      <div style={{fontSize:28,fontWeight:700,color:'#CC2229',marginBottom:4}}>{fmtE(valuation.ai_recommended||valuation.recommended)}</div>
                      <div style={{fontSize:13,color:'#888'}}>Ευρος: {fmtE(valuation.ai_min||valuation.min)} – {fmtE(valuation.ai_max||valuation.max)}</div>
                      {(valuation.ai_price_per_sqm||valuation.price_per_sqm) && <div style={{fontSize:13,color:'#888'}}>{fmtE(valuation.ai_price_per_sqm||valuation.price_per_sqm)}/τμ</div>}
                      <div style={{marginTop:8,background:'rgba(255,255,255,.1)',borderRadius:100,height:6,overflow:'hidden'}}>
                        <div style={{height:'100%',background:'#CC2229',width:((valuation.confidence_score||valuation.confidence||0.5)*100)+'%'}} />
                      </div>
                      <div style={{fontSize:11,color:'#888',marginTop:3}}>Εμπιστοσυνη: {Math.round((valuation.confidence_score||valuation.confidence||0.5)*100)}%</div>
                    </div>
                    {(valuation.ai_reasoning||valuation.reasoning) && <p style={{fontSize:13,color:'#555',lineHeight:1.7,background:'#f8f8f7',borderRadius:8,padding:'10px 12px',margin:0}}>{valuation.ai_reasoning||valuation.reasoning}</p>}

                    {/* Comparables */}
                    {(valuation.comparables||[]).length > 0 && (
                      <div style={{marginTop:12}}>
                        <div style={{fontSize:12,color:'#888',marginBottom:6,textTransform:'uppercase',letterSpacing:'.05em'}}>Συγκρισιμα ({(valuation.comparables||[]).length})</div>
                        {(valuation.comparables||[]).map((c: any,i: number) => (
                          <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'0.5px solid #f0f0f0',fontSize:12}}>
                            <span>{c.area} · {c.sqm}τμ · {c.year_built||'?'}</span>
                            <span style={{fontWeight:500}}>€{fmt(c.price)} <span style={{color:'#bbb',fontWeight:400}}>(€{fmt(c.ppsqm||c.price_per_sqm)}/τμ) ·{Math.round((c.w||c.weight)*100)}%</span></span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Top producers */}
                    {(valuation.top_producers||[]).length > 0 && (
                      <div style={{marginTop:14,background:'#FAEEDA',borderRadius:10,padding:'12px'}}>
                        <div style={{fontSize:12,color:'#854F0B',fontWeight:500,marginBottom:8}}>⭐ Top Producers στην {selected.area} (τελευταιος χρονος)</div>
                        {(valuation.top_producers||[]).map((p: any,i: number) => (
                          <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',fontSize:13}}>
                            <span>{i===0?'🥇':i===1?'🥈':'🥉'} <strong>{p.name}</strong></span>
                            <span style={{color:'#854F0B'}}>{p.count} πωλησεις · μ.ο. {fmtE(p.avg_price)}</span>
                          </div>
                        ))}
                        <div style={{fontSize:11,color:'#854F0B',marginTop:6,opacity:.8}}>Καλουνται να σχολιασουν παρακατω</div>
                      </div>
                    )}
                  </div>
                )}

                {/* Comments */}
                <div>
                  <div style={{fontSize:13,fontWeight:500,color:'#888',marginBottom:10,textTransform:'uppercase',letterSpacing:'.05em'}}>Σχολια Producers ({comments.length})</div>
                  
                  {/* Add comment */}
                  <div style={{background:'#f8f8f7',border:'0.5px solid #e8e8e8',borderRadius:10,padding:'12px',marginBottom:14}}>
                    <div style={{fontSize:12,color:'#888',marginBottom:8}}>Η γνωμη σου για την εκτιμηση:</div>
                    <div style={{display:'flex',gap:8,marginBottom:8}}>
                      <button onClick={()=>setAgrees(true)} style={{flex:1,padding:'7px',borderRadius:8,fontSize:12,cursor:'pointer',background:agrees===true?'#3B6D11':'#fff',color:agrees===true?'#fff':'#666',border:agrees===true?'none':'0.5px solid #ddd',fontWeight:agrees===true?600:400}}>✅ Συμφωνω</button>
                      <button onClick={()=>setAgrees(false)} style={{flex:1,padding:'7px',borderRadius:8,fontSize:12,cursor:'pointer',background:agrees===false?'#CC2229':'#fff',color:agrees===false?'#fff':'#666',border:agrees===false?'none':'0.5px solid #ddd',fontWeight:agrees===false?600:400}}>❌ Διαφωνω</button>
                    </div>
                    <input value={myEstimate} onChange={e=>setMyEstimate(e.target.value)} placeholder="Δικη σου εκτιμηση (€) — προαιρετικα" type="number"
                      style={{width:'100%',padding:'7px 10px',border:'0.5px solid #ddd',borderRadius:8,fontSize:13,marginBottom:8,boxSizing:'border-box'}} />
                    <textarea value={myComment} onChange={e=>setMyComment(e.target.value)} placeholder="Σχολιο (π.χ. η περιοχη εχει πτωτικη ταση, το ακινητο εχει θεση parking...)" rows={3}
                      style={{width:'100%',padding:'7px 10px',border:'0.5px solid #ddd',borderRadius:8,fontSize:13,marginBottom:8,boxSizing:'border-box',resize:'none'}} />
                    <button onClick={submitComment} disabled={savingComment||!myComment.trim()||agrees===null}
                      style={{padding:'7px 16px',background:'#CC2229',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:500,cursor:'pointer',opacity:(!myComment.trim()||agrees===null)?0.5:1}}>
                      {savingComment?'...':'Υποβολη σχολιου'}
                    </button>
                    {agrees===null && myComment.trim() && <span style={{fontSize:11,color:'#CC2229',marginLeft:8}}>Επιλεξε αν συμφωνεις η οχι</span>}
                  </div>

                  {/* Existing comments */}
                  {comments.length === 0 ? <div style={{color:'#bbb',fontSize:13,textAlign:'center',padding:'1rem 0'}}>Κανενα σχολιο ακομα</div>
                  : comments.map((c,i) => (
                    <div key={c.id} style={{display:'flex',gap:10,marginBottom:12,padding:'10px 12px',background:'#f8f8f7',borderRadius:10}}>
                      <div style={{width:32,height:32,borderRadius:'50%',background:c.agrees_with_ai?'#EAF3DE':'#FCEBEB',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,flexShrink:0}}>{c.agrees_with_ai?'✅':'❌'}</div>
                      <div style={{flex:1}}>
                        <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                          <span style={{fontSize:13,fontWeight:500}}>{c.agent_name}</span>
                          {c.agent_estimate && <span style={{fontSize:12,color:'#CC2229',fontWeight:500}}>Εκτιμα: {fmtE(c.agent_estimate)}</span>}
                        </div>
                        <p style={{fontSize:13,color:'#555',margin:0,lineHeight:1.5}}>{c.comment}</p>
                        <div style={{fontSize:11,color:'#bbb',marginTop:4}}>{new Date(c.created_at).toLocaleDateString('el-GR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div style={{background:'#f8f8f7',border:'0.5px solid #e8e8e8',borderRadius:12,display:'flex',alignItems:'center',justifyContent:'center',minHeight:400}}>
              <div style={{textAlign:'center',color:'#bbb'}}>
                <div style={{fontSize:40,marginBottom:12}}>🏠</div>
                <div style={{fontSize:14}}>Επιλεξε ακινητο για εκτιμηση</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Shell>
  )
}
