'use client'

import { useState, useRef, useEffect } from 'react'
import { Mic, MicOff, Loader2, CheckCircle2, Send, X } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'

interface VoiceMemoButtonProps {
  leadId?:     string
  propertyId?: string
  meetingId?:  string
  onSuccess?:  (intent: string, summary: string) => void
  maxSeconds?: number
}

type UIState = 'idle' | 'recording' | 'transcribing' | 'reviewing' | 'submitting' | 'done'

function getSupportedMimeType() {
  for (const m of ['audio/webm;codecs=opus','audio/webm','audio/mp4','audio/ogg;codecs=opus'])
    if (MediaRecorder.isTypeSupported(m)) return m
  return ''
}

const RED = '#CC2229'

// ── Structured field definitions ─────────────────────────────────

type FieldDef = { key: string; label: string; type: 'text' | 'number' | 'checkbox' | 'select'; options?: string[] }

const PROPERTY_FIELDS: FieldDef[] = [
  { key: 'owner_name',       label: 'Ιδιοκτήτης',          type: 'text'     },
  { key: 'owner_phone',      label: 'Τηλέφωνο',            type: 'text'     },
  { key: 'address',          label: 'Διεύθυνση Ακινήτου',  type: 'text'     },
  { key: 'area',             label: 'Περιοχή',             type: 'text'     },
  { key: 'transaction_type', label: 'Τύπος',               type: 'select',  options: ['sale','rent'] },
  { key: 'asking_price',     label: 'Τιμή (€)',            type: 'number'   },
  { key: 'size_sqm',         label: 'τμ',                  type: 'number'   },
  { key: 'floor',            label: 'Όροφος',              type: 'number'   },
  { key: 'rooms',            label: 'Υ/Δ',                 type: 'number'   },
  { key: 'year_built',       label: 'Έτος κατασκευής',     type: 'number'   },
  { key: 'year_renovated',   label: 'Έτος ανακαίνισης',   type: 'number'   },
  { key: 'condition',        label: 'Κατάσταση',           type: 'text'     },
  { key: 'balcony',          label: 'Μπαλκόνι',           type: 'checkbox' },
  { key: 'parking',          label: 'Πάρκινγκ',           type: 'checkbox' },
  { key: 'security_door',    label: 'Ασφ. Πόρτα',         type: 'checkbox' },
  { key: 'seller_motivation',label: 'Κίνητρο πωλητή',     type: 'text'     },
  { key: 'ai_summary',       label: 'Σύνοψη',             type: 'text'     },
]

const DEMAND_FIELDS: FieldDef[] = [
  { key: 'client_name',     label: 'Πελάτης',        type: 'text'     },
  { key: 'client_phone',    label: 'Τηλέφωνο',       type: 'text'     },
  { key: 'transaction_type',label: 'Τύπος',          type: 'select', options: ['buy','rent'] },
  { key: 'property_type',   label: 'Τύπος Ακινήτου', type: 'text'     },
  { key: 'budget_eur',      label: 'Budget (€)',      type: 'number'   },
  { key: 'size_min',        label: 'τμ από',          type: 'number'   },
  { key: 'size_max',        label: 'τμ έως',          type: 'number'   },
  { key: 'floor_min',       label: 'Όροφος από',      type: 'number'   },
  { key: 'floor_max',       label: 'Όροφος έως',      type: 'number'   },
  { key: 'areas_preferred', label: 'Περιοχές',        type: 'text'     },
  { key: 'must_have',       label: 'Must-have',       type: 'text'     },
  { key: 'condition_req',   label: 'Κατάσταση',       type: 'text'     },
  { key: 'ai_summary',      label: 'Σύνοψη',          type: 'text'     },
]

// ── Helpers ───────────────────────────────────────────────────────

function fmtVal(v: unknown): string {
  if (v == null) return ''
  if (Array.isArray(v)) return v.join(', ')
  return String(v)
}

function parseVal(raw: string, type: FieldDef['type']): unknown {
  if (type === 'number') return raw === '' ? null : Number(raw)
  if (type === 'checkbox') return raw === 'true'
  if (type === 'text' && raw.includes(',')) return raw.split(',').map(s => s.trim()).filter(Boolean)
  return raw === '' ? null : raw
}

// ── Structured review form ────────────────────────────────────────

function StructuredForm({
  intent, fields, transcript, onSubmit, onDiscard, busy, error,
}: {
  intent: string
  fields: Record<string, unknown>
  transcript: string
  onSubmit: (f: Record<string, unknown>) => void
  onDiscard: () => void
  busy: boolean
  error: string | null
}) {
  const [vals, setVals] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    const defs = intent === 'demand_profile' ? DEMAND_FIELDS : PROPERTY_FIELDS
    for (const f of defs) init[f.key] = fmtVal(fields[f.key])
    return init
  })

  const defs = intent === 'demand_profile' ? DEMAND_FIELDS : PROPERTY_FIELDS

  function set(key: string, val: string) { setVals(p => ({ ...p, [key]: val })) }

  function handleSubmit() {
    const parsed: Record<string, unknown> = {}
    for (const f of defs) parsed[f.key] = parseVal(vals[f.key] ?? '', f.type)
    onSubmit(parsed)
  }

  const label = intent === 'property_scouted' ? 'Ακίνητο (1ο Ραντεβού)' : intent === 'demand_profile' ? 'Ζήτηση Πελάτη' : 'Σημείωση'

  return (
    <div style={{ background: '#111', border: '1px solid #2a2a2a', borderRadius: 8, padding: 16, width: '100%', maxWidth: 560 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: RED, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
        <span style={{ fontSize: 11, color: '#444' }}>Διόρθωσε αν χρειάζεται</span>
      </div>

      {/* Transcript reference */}
      <details style={{ marginBottom: 12 }}>
        <summary style={{ fontSize: 11, color: '#444', cursor: 'pointer' }}>Πρωτότυπο κείμενο ▾</summary>
        <p style={{ fontSize: 12, color: '#666', margin: '6px 0 0', lineHeight: 1.5 }}>{transcript}</p>
      </details>

      {/* Fields grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px', marginBottom: 12 }}>
        {defs.map(f => (
          <div key={f.key} style={{ gridColumn: ['address','condition','seller_motivation','ai_summary','areas_preferred','must_have'].includes(f.key) ? '1 / -1' : undefined }}>
            <label style={{ fontSize: 10, color: '#555', display: 'block', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{f.label}</label>
            {f.type === 'checkbox' ? (
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={vals[f.key] === 'true'}
                  onChange={e => set(f.key, String(e.target.checked))}
                  disabled={busy}
                  style={{ accentColor: RED, width: 14, height: 14 }}
                />
                <span style={{ fontSize: 12, color: '#888' }}>{vals[f.key] === 'true' ? 'Ναι' : 'Όχι'}</span>
              </label>
            ) : f.type === 'select' ? (
              <select
                value={vals[f.key] ?? ''}
                onChange={e => set(f.key, e.target.value)}
                disabled={busy}
                style={{ width: '100%', background: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: 4, color: '#e0e0e0', fontSize: 13, padding: '5px 8px' }}
              >
                <option value="">—</option>
                {f.options?.map(o => <option key={o} value={o}>{o === 'sale' ? 'Πώληση' : o === 'rent' ? 'Ενοίκιο' : o === 'buy' ? 'Αγορά' : o}</option>)}
              </select>
            ) : (
              <input
                type={f.type === 'number' ? 'number' : 'text'}
                value={vals[f.key] ?? ''}
                onChange={e => set(f.key, e.target.value)}
                disabled={busy}
                placeholder="—"
                style={{ width: '100%', boxSizing: 'border-box', background: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: 4, color: '#e0e0e0', fontSize: 13, padding: '5px 8px', outline: 'none' }}
              />
            )}
          </div>
        ))}
      </div>

      {error && <p style={{ fontSize: 12, color: '#f87171', margin: '0 0 10px' }}>{error}</p>}

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={handleSubmit}
          disabled={busy}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: RED, color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}
        >
          {busy ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Αποθήκευση…</> : <><Send size={14} /> Αποθήκευση</>}
        </button>
        <button
          onClick={onDiscard}
          disabled={busy}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#1e1e1e', color: '#888', border: '1px solid #2a2a2a', borderRadius: 6, fontSize: 13, cursor: busy ? 'not-allowed' : 'pointer' }}
        >
          <X size={14} /> Ακύρωση
        </button>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────

export function VoiceMemoButton({ leadId, propertyId, meetingId, onSuccess, maxSeconds = 120 }: VoiceMemoButtonProps) {
  const [uiState,    setUiState]    = useState<UIState>('idle')
  const [elapsed,    setElapsed]    = useState(0)
  const [transcript, setTranscript] = useState('')
  const [intent,     setIntent]     = useState<string>('voice_note')
  const [extracted,  setExtracted]  = useState<Record<string, unknown>>({})
  const [lastIntent, setLastIntent] = useState<string | null>(null)
  const [lastSummary,setLastSummary]= useState<string | null>(null)
  const [error,      setError]      = useState<string | null>(null)

  const mediaRef  = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  const mimeRef   = useRef('')

  useEffect(() => {
    if (uiState === 'recording') {
      timerRef.current = setInterval(() => {
        setElapsed(s => { if (s + 1 >= maxSeconds) { stopRecording(); return 0 } return s + 1 })
      }, 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
      if (uiState !== 'reviewing') setElapsed(0)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uiState])

  function getSupabase() {
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  }

  async function startRecording() {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mimeRef.current = getSupportedMimeType()
      const mr = new MediaRecorder(stream, mimeRef.current ? { mimeType: mimeRef.current } : {})
      chunksRef.current = []
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = handleTranscribe
      mediaRef.current = mr
      mr.start(250)
      setUiState('recording')
    } catch { setError('Δεν επιτρέπεται μικρόφωνο') }
  }

  function stopRecording() {
    mediaRef.current?.stop()
    mediaRef.current?.stream.getTracks().forEach(t => t.stop())
    setUiState('transcribing')
  }

  async function handleTranscribe() {
    const mimeType = mimeRef.current || 'audio/webm'
    const blob = new Blob(chunksRef.current, { type: mimeType })
    const { data: { session } } = await getSupabase().auth.getSession()
    if (!session) { setUiState('idle'); return }

    const form = new FormData()
    form.append('audio', blob, `memo.${mimeType.includes('mp4') ? 'm4a' : 'webm'}`)

    try {
      const res  = await fetch('/api/voice-transcribe', {
        method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` }, body: form,
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Σφάλμα μεταγραφής'); setUiState('idle'); return }

      setTranscript(data.transcript)
      setIntent(data.intent)
      setExtracted(data.extracted ?? {})
      setUiState('reviewing')
    } catch { setError('Αδύνατη σύνδεση'); setUiState('idle') }
  }

  async function handleSubmit(fields: Record<string, unknown>) {
    setUiState('submitting')
    const { data: { session } } = await getSupabase().auth.getSession()
    if (!session) { setUiState('reviewing'); return }

    try {
      const res  = await fetch('/api/voice-ingest', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript, intent, fields, lead_id: leadId ?? null, property_id: propertyId ?? null, meeting_id: meetingId ?? null }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Σφάλμα'); setUiState('reviewing'); return }

      setLastIntent(data.intent)
      setLastSummary(data.summary)
      setUiState('done')
      onSuccess?.(data.intent, data.summary)
      setTimeout(() => { setUiState('idle'); setTranscript(''); setLastIntent(null); setLastSummary(null) }, 4000)
    } catch { setError('Αδύνατη σύνδεση'); setUiState('reviewing') }
  }

  function handleDiscard() { setTranscript(''); setError(null); setUiState('idle') }

  // Done
  if (uiState === 'done' && lastIntent) {
    const labels: Record<string, string> = { property_scouted: 'Ακίνητο καταγράφηκε', demand_profile: 'Ζήτηση αποθηκεύτηκε', voice_note: 'Σημείωση αποθηκεύτηκε' }
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderRadius: 6, border: '1px solid #166534', background: '#052e16', padding: '8px 12px', fontSize: 13 }}>
        <CheckCircle2 size={16} style={{ color: '#4ade80', flexShrink: 0 }} />
        <div>
          <p style={{ fontWeight: 600, color: '#86efac', margin: 0 }}>{labels[lastIntent] ?? lastIntent}</p>
          {lastSummary && <p style={{ color: '#4ade80', margin: 0, fontSize: 11 }}>{lastSummary}</p>}
        </div>
      </div>
    )
  }

  // Review — structured form
  if (uiState === 'reviewing' || uiState === 'submitting') {
    return (
      <StructuredForm
        intent={intent}
        fields={extracted}
        transcript={transcript}
        onSubmit={handleSubmit}
        onDiscard={handleDiscard}
        busy={uiState === 'submitting'}
        error={error}
      />
    )
  }

  // Idle / recording / transcribing
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <button
        onClick={uiState === 'idle' ? startRecording : uiState === 'recording' ? stopRecording : undefined}
        disabled={uiState === 'transcribing'}
        title={uiState === 'recording' ? `Σταμάτα (${elapsed}s)` : uiState === 'transcribing' ? 'Μεταγραφή + Ανάλυση…' : 'Φωνητική καταχώρηση'}
        style={{
          position: 'relative', width: 40, height: 40, borderRadius: 6,
          border: '1px solid #333', background: uiState === 'recording' ? '#7f1d1d' : '#1e1e1e',
          color: '#f0f0f0', cursor: uiState === 'transcribing' ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: uiState === 'transcribing' ? 0.6 : 1,
        }}
      >
        {uiState === 'transcribing' ? (
          <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
        ) : uiState === 'recording' ? (
          <>
            <MicOff size={16} />
            <span style={{ position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: '50%', background: '#ef4444', fontSize: 9, fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{elapsed}</span>
          </>
        ) : (
          <Mic size={16} />
        )}
      </button>
      {error && <p style={{ fontSize: 11, color: '#f87171', margin: 0 }}>{error}</p>}
    </div>
  )
}
