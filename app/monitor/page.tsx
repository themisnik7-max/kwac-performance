'use client'
import { useState, useEffect } from 'react'
import Shell from '@/components/Shell'
import { createClient } from '@/lib/supabase'

const TAG_COLORS: Record<string, string> = {
  'sale-rest': '#185FA5',
  'rent-attica': '#0F6E56',
}
const TAG_LABELS: Record<string, string> = {
  'sale-rest': 'Πώληση · Υπόλοιπη Ελλάδα',
  'rent-attica': 'Ενοικίαση · Αττική',
}

export default function MonitorPage() {
  const [listings, setListings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)
  const [lastCheck, setLastCheck] = useState<string | null>(null)
  const [newCount, setNewCount] = useState(0)
  const [filter, setFilter] = useState<string>('all')
  const supabase = createClient()

  useEffect(() => {
    fetchListings()
  }, [])

  async function fetchListings() {
    setLoading(true)
    const { data } = await supabase
      .from('monitored_listings')
      .select('*')
      .order('seen_at', { ascending: false })
      .limit(100)
    setListings(data || [])
    setNewCount((data || []).filter(l => l.is_new).length)
    setLoading(false)
  }

  async function checkNow() {
    setChecking(true)
    try {
      const res = await fetch('/api/monitor?manual=1')
      const data = await res.json()
      setLastCheck(data.checked_at)
      if (data.new_count > 0) {
        await fetchListings()
      }
    } catch(e) {}
    setChecking(false)
  }

  async function markAllSeen() {
    await supabase.from('monitored_listings').update({ is_new: false }).eq('is_new', true)
    setListings(prev => prev.map(l => ({ ...l, is_new: false })))
    setNewCount(0)
  }

  const filtered = filter === 'all' ? listings : filter === 'new' ? listings.filter(l => l.is_new) : listings.filter(l => l.tag === filter)

  return (
    <Shell>
      <div style={{ padding: '2rem', maxWidth: 1000 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 style={{ fontSize: 22, fontWeight: 500, color: '#1a1a1a', margin: 0 }}>Property Monitor</h1>
              {newCount > 0 && (
                <span style={{ background: '#CC2229', color: '#fff', borderRadius: 100, padding: '2px 10px', fontSize: 13, fontWeight: 600 }}>
                  {newCount} νέα
                </span>
              )}
            </div>
            <p style={{ color: '#888', fontSize: 14, margin: '4px 0 0' }}>
              Αυτόματη παρακολούθηση νέων ακινήτων από zadeshome.com · κάθε ώρα
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {newCount > 0 && (
              <button onClick={markAllSeen}
                style={{ padding: '8px 14px', background: 'none', border: '0.5px solid #ddd', borderRadius: 8, fontSize: 13, cursor: 'pointer', color: '#666' }}>
                Όλα ως διαβασμένα
              </button>
            )}
            <button onClick={checkNow} disabled={checking}
              style={{ padding: '8px 16px', background: '#CC2229', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', opacity: checking ? 0.7 : 1 }}>
              {checking ? '🔄 Έλεγχος...' : '🔍 Έλεγχος τώρα'}
            </button>
          </div>
        </div>

        {/* Last check info */}
        {lastCheck && (
          <div style={{ background: '#EAF3DE', color: '#3B6D11', padding: '10px 16px', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
            ✅ Έλεγχος ολοκληρώθηκε — {new Date(lastCheck).toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' })}
          </div>
        )}

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { l: 'Σύνολο ακινήτων', v: listings.length, c: '#1a1a1a' },
            { l: 'Νέα (αδιάβαστα)', v: newCount, c: '#CC2229' },
            { l: 'Πηγές παρακολούθησης', v: 2, c: '#185FA5' },
          ].map(s => (
            <div key={s.l} style={{ background: '#fff', border: '0.5px solid #e8e8e8', borderRadius: 12, padding: '1rem' }}>
              <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>{s.l}</div>
              <div style={{ fontSize: 28, fontWeight: 600, color: s.c }}>{s.v}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          {[
            { k: 'all', l: 'Όλα' },
            { k: 'new', l: '🔴 Νέα' },
            { k: 'sale-rest', l: 'Πώληση · Υπόλοιπη Ελλάδα' },
            { k: 'rent-attica', l: 'Ενοικίαση · Αττική' },
          ].map(f => (
            <button key={f.k} onClick={() => setFilter(f.k)}
              style={{ padding: '6px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
                background: filter === f.k ? '#1a1a1a' : '#fff',
                color: filter === f.k ? '#fff' : '#666',
                border: filter === f.k ? 'none' : '0.5px solid #e8e8e8' }}>
              {f.l}
            </button>
          ))}
        </div>

        {/* Listings */}
        {loading ? (
          <div style={{ color: '#bbb', fontSize: 14, padding: '2rem 0', textAlign: 'center' }}>Φόρτωση...</div>
        ) : filtered.length === 0 ? (
          <div style={{ background: '#fff', border: '0.5px solid #e8e8e8', borderRadius: 12, padding: '3rem', textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🏠</div>
            <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 6 }}>
              {listings.length === 0 ? 'Κανένα ακίνητο ακόμα' : 'Κανένα αποτέλεσμα'}
            </div>
            <div style={{ fontSize: 13, color: '#888', marginBottom: 16 }}>
              {listings.length === 0 ? 'Πάτα "Έλεγχος τώρα" για να τραβήξει τα πρώτα ακίνητα από το zadeshome.com' : 'Δοκίμασε διαφορετικό φίλτρο'}
            </div>
            {listings.length === 0 && (
              <button onClick={checkNow} disabled={checking}
                style={{ padding: '10px 24px', background: '#CC2229', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
                {checking ? '🔄 Έλεγχος...' : '🔍 Τράβα ακίνητα τώρα'}
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map(l => (
              <div key={l.id} style={{
                background: l.is_new ? '#fff8f8' : '#fff',
                border: l.is_new ? '0.5px solid #f5c6c6' : '0.5px solid #e8e8e8',
                borderRadius: 12, padding: '1rem 1.25rem',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    {l.is_new && <span style={{ background: '#CC2229', color: '#fff', fontSize: 10, padding: '2px 7px', borderRadius: 100, fontWeight: 600, flexShrink: 0 }}>ΝΕΟ</span>}
                    <span style={{ fontSize: 14, fontWeight: 500, color: '#1a1a1a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {l.title || 'Ακίνητο'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <span style={{
                      background: (TAG_COLORS[l.tag] || '#888') + '18',
                      color: TAG_COLORS[l.tag] || '#888',
                      fontSize: 11, padding: '2px 8px', borderRadius: 100
                    }}>
                      {TAG_LABELS[l.tag] || l.source_label}
                    </span>
                    <span style={{ fontSize: 12, color: '#bbb' }}>
                      {new Date(l.seen_at).toLocaleDateString('el-GR', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                </div>
                <a href={l.url} target="_blank" rel="noopener noreferrer"
                  style={{ padding: '7px 14px', background: '#f8f8f7', border: '0.5px solid #e8e8e8', borderRadius: 8, fontSize: 13, color: '#1a1a1a', textDecoration: 'none', flexShrink: 0, whiteSpace: 'nowrap' }}>
                  Δες ακίνητο →
                </a>
              </div>
            ))}
          </div>
        )}

        {/* Monitored URLs */}
        <div style={{ marginTop: 24, background: '#f8f8f7', borderRadius: 12, padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.05em' }}>Παρακολουθούμενες πηγές</div>
          {[
            { l: 'Πωλήσεις - Υπόλοιπη Ελλάδα', url: 'https://www.zadeshome.com/search-results/?status[]=agora-akinitou&states[]=ypoloipi-ellada' },
            { l: 'Ενοικιάσεις - Αττική', url: 'https://www.zadeshome.com/search-results/?status[]=enoikiasi-akinitou&states[]=attiki' },
          ].map(s => (
            <div key={s.url} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '0.5px solid #eee' }}>
              <span style={{ fontSize: 13, color: '#555' }}>🔗 {s.l}</span>
              <a href={s.url} target="_blank" style={{ fontSize: 12, color: '#888' }}>zadeshome.com ↗</a>
            </div>
          ))}
        </div>
      </div>
    </Shell>
  )
}