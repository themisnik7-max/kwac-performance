'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient }                      from '@supabase/supabase-js'
import { VoiceMemoButton }                   from '@/components/VoiceMemoButton'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type ScoutedRow = {
  id: string
  owner_name: string | null
  owner_phone: string | null
  area: string | null
  address: string | null
  transaction_type: string | null
  asking_price: number | null
  size_sqm: number | null
  floor: number | null
  condition: string | null
  ai_summary: string | null
  status: string
  updated_at: string
  voice_note_ids: string[]
}

type DemandRow = {
  id: string
  client_name: string | null
  client_phone: string | null
  transaction_type: string | null
  property_type: string | null
  budget_eur: number | null
  size_min: number | null
  size_max: number | null
  areas_preferred: string[]
  must_have: string[]
  ai_summary: string | null
  status: string
  updated_at: string
  voice_note_ids: string[]
}

const RED   = '#CC2229'
const CARD  = { background: '#161616', border: '1px solid #1e1e1e', borderRadius: 8, padding: '14px 16px', marginBottom: 10 }
const LABEL = { fontSize: 10, color: '#555', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: 2 }
const VAL   = { fontSize: 13, color: '#d0d0d0' }
const BADGE: Record<string, { bg: string; color: string }> = {
  scouted:           { bg: '#1e293b', color: '#94a3b8' },
  contacted:         { bg: '#1c2e1c', color: '#86efac' },
  listing_requested: { bg: '#2d1b00', color: '#fbbf24' },
  listed:            { bg: '#1a1a2e', color: '#818cf8' },
  lost:              { bg: '#2d0a0a', color: '#f87171' },
  active:            { bg: '#1c2e1c', color: '#86efac' },
  matched:           { bg: '#1a1a2e', color: '#818cf8' },
  closed:            { bg: '#1e293b', color: '#94a3b8' },
  inactive:          { bg: '#1e1e1e', color: '#555' },
}

function StatusBadge({ s }: { s: string }) {
  const style = BADGE[s] ?? { bg: '#1e1e1e', color: '#888' }
  return (
    <span style={{ background: style.bg, color: style.color, borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>
      {s}
    </span>
  )
}

function fmt(n: number | null | undefined, unit = '') {
  if (n == null) return '—'
  return n.toLocaleString('el-GR') + (unit ? ' ' + unit : '')
}

export default function PersonalAdminPage() {
  const [tab,      setTab]      = useState<'scouted' | 'demand'>('scouted')
  const [scouted,  setScouted]  = useState<ScoutedRow[]>([])
  const [demands,  setDemands]  = useState<DemandRow[]>([])
  const [loading,  setLoading]  = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: s }, { data: d }] = await Promise.all([
      supabase
        .from('property_scouted')
        .select('id,owner_name,owner_phone,area,address,transaction_type,asking_price,size_sqm,floor,condition,ai_summary,status,updated_at,voice_note_ids')
        .order('updated_at', { ascending: false })
        .limit(50),
      supabase
        .from('demand_profiles')
        .select('id,client_name,client_phone,transaction_type,property_type,budget_eur,size_min,size_max,areas_preferred,must_have,ai_summary,status,updated_at,voice_note_ids')
        .order('updated_at', { ascending: false })
        .limit(50),
    ])
    setScouted((s ?? []) as ScoutedRow[])
    setDemands((d ?? []) as DemandRow[])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#f0f0f0', padding: '32px 24px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>Personal Admin</h1>
          <p style={{ fontSize: 13, color: '#555', marginTop: 4 }}>
            Καταγραφή ακινήτων & ζητήσεων μέσω φωνής
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, color: '#444' }}>Νέα εγγραφή:</span>
          <VoiceMemoButton onSuccess={() => load()} />
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid #1e1e1e', paddingBottom: 0 }}>
        {(['scouted', 'demand'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '8px 16px', fontSize: 13, background: 'none', border: 'none',
              color: tab === t ? '#f0f0f0' : '#555', cursor: 'pointer', fontWeight: tab === t ? 600 : 400,
              borderBottom: tab === t ? `2px solid ${RED}` : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            {t === 'scouted' ? `Ακίνητα (${scouted.length})` : `Ζητήσεις (${demands.length})`}
          </button>
        ))}
      </div>

      {loading && (
        <p style={{ color: '#444', fontSize: 13 }}>Φόρτωση…</p>
      )}

      {/* Property Scouted list */}
      {!loading && tab === 'scouted' && (
        <>
          {scouted.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#444' }}>
              <p style={{ fontSize: 32, margin: 0 }}>🎙</p>
              <p style={{ fontSize: 14, marginTop: 12 }}>Καμία καταγραφή ακόμα.</p>
              <p style={{ fontSize: 12, color: '#333' }}>Πάτα το μικρόφωνο και μίλησε για το πρώτο ακίνητο που επισκέφτηκες.</p>
            </div>
          )}
          {scouted.map(row => (
            <div key={row.id} style={CARD}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
                <div>
                  <span style={{ fontSize: 15, fontWeight: 600, color: '#f0f0f0' }}>
                    {row.owner_name ?? 'Άγνωστος Ιδιοκτήτης'}
                  </span>
                  {row.owner_phone && (
                    <span style={{ fontSize: 12, color: '#555', marginLeft: 10 }}>{row.owner_phone}</span>
                  )}
                </div>
                <StatusBadge s={row.status} />
              </div>

              {row.ai_summary && (
                <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 10px', fontStyle: 'italic' }}>
                  {row.ai_summary}
                </p>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '8px 16px' }}>
                <div><p style={LABEL}>Περιοχή</p><p style={VAL}>{row.area ?? '—'}</p></div>
                <div><p style={LABEL}>Διεύθυνση</p><p style={VAL}>{row.address ?? '—'}</p></div>
                <div><p style={LABEL}>Τύπος</p><p style={VAL}>{row.transaction_type === 'sale' ? 'Πώληση' : row.transaction_type === 'rent' ? 'Ενοίκιο' : '—'}</p></div>
                <div><p style={LABEL}>Τιμή</p><p style={VAL}>{fmt(row.asking_price, '€')}</p></div>
                <div><p style={LABEL}>Εμβαδόν</p><p style={VAL}>{fmt(row.size_sqm, 'τμ')}</p></div>
                <div><p style={LABEL}>Όροφος</p><p style={VAL}>{row.floor === 0 ? 'Ισόγειο' : fmt(row.floor, 'ος')}</p></div>
                <div><p style={LABEL}>Κατάσταση</p><p style={VAL}>{row.condition ?? '—'}</p></div>
                <div><p style={LABEL}>Σημειώσεις</p><p style={VAL}>{row.voice_note_ids.length} φωνητικά</p></div>
              </div>

              <p style={{ fontSize: 10, color: '#333', marginTop: 10, marginBottom: 0 }}>
                Τελ. ενημ. {new Date(row.updated_at).toLocaleDateString('el-GR')}
              </p>
            </div>
          ))}
        </>
      )}

      {/* Demand Profiles list */}
      {!loading && tab === 'demand' && (
        <>
          {demands.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#444' }}>
              <p style={{ fontSize: 32, margin: 0 }}>🎙</p>
              <p style={{ fontSize: 14, marginTop: 12 }}>Καμία ζήτηση ακόμα.</p>
              <p style={{ fontSize: 12, color: '#333' }}>Πάτα το μικρόφωνο και περιέγραψε τι ζητάει ο πελάτης σου.</p>
            </div>
          )}
          {demands.map(row => (
            <div key={row.id} style={CARD}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
                <div>
                  <span style={{ fontSize: 15, fontWeight: 600, color: '#f0f0f0' }}>
                    {row.client_name ?? 'Άγνωστος Πελάτης'}
                  </span>
                  {row.client_phone && (
                    <span style={{ fontSize: 12, color: '#555', marginLeft: 10 }}>{row.client_phone}</span>
                  )}
                </div>
                <StatusBadge s={row.status} />
              </div>

              {row.ai_summary && (
                <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 10px', fontStyle: 'italic' }}>
                  {row.ai_summary}
                </p>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '8px 16px' }}>
                <div><p style={LABEL}>Τύπος</p><p style={VAL}>{row.transaction_type === 'buy' ? 'Αγορά' : row.transaction_type === 'rent' ? 'Ενοίκιο' : '—'}</p></div>
                <div><p style={LABEL}>Ακίνητο</p><p style={VAL}>{row.property_type ?? '—'}</p></div>
                <div><p style={LABEL}>Budget</p><p style={VAL}>{fmt(row.budget_eur, '€')}</p></div>
                <div><p style={LABEL}>Εμβαδόν</p><p style={VAL}>{row.size_min || row.size_max ? `${row.size_min ?? '?'}–${row.size_max ?? '?'} τμ` : '—'}</p></div>
                <div><p style={LABEL}>Περιοχές</p><p style={VAL}>{row.areas_preferred.length ? row.areas_preferred.join(', ') : '—'}</p></div>
                <div><p style={LABEL}>Must-have</p><p style={VAL}>{row.must_have.length ? row.must_have.join(', ') : '—'}</p></div>
                <div><p style={LABEL}>Σημειώσεις</p><p style={VAL}>{row.voice_note_ids.length} φωνητικά</p></div>
              </div>

              <p style={{ fontSize: 10, color: '#333', marginTop: 10, marginBottom: 0 }}>
                Τελ. ενημ. {new Date(row.updated_at).toLocaleDateString('el-GR')}
              </p>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
