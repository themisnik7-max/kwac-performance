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

// idle → recording → transcribing → reviewing → submitting → done
type UIState = 'idle' | 'recording' | 'transcribing' | 'reviewing' | 'submitting' | 'done'

function getSupportedMimeType(): string {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']
  for (const mime of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) return mime
  }
  return ''
}

const INTENT_LABELS: Record<string, string> = {
  property_scouted: 'Καταγραφή Ακινήτου',
  demand_profile:   'Ζήτηση Πελάτη',
  voice_note:       'Σημείωση',
}

const RED  = '#CC2229'
const S = {
  btn: (active: boolean, disabled: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: 6, padding: '7px 14px', borderRadius: 6, border: 'none',
    fontSize: 13, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    background: active ? RED : '#2a2a2a', color: '#f0f0f0',
  }),
}

export function VoiceMemoButton({
  leadId, propertyId, meetingId, onSuccess,
  maxSeconds = 120,
}: VoiceMemoButtonProps) {
  const [uiState,    setUiState]    = useState<UIState>('idle')
  const [elapsed,    setElapsed]    = useState(0)
  const [transcript, setTranscript] = useState('')
  const [lastIntent, setLastIntent] = useState<string | null>(null)
  const [lastSummary,setLastSummary]= useState<string | null>(null)
  const [error,      setError]      = useState<string | null>(null)

  const mediaRef  = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  const mimeRef   = useRef<string>('')
  const blobRef   = useRef<Blob | null>(null)

  // Recording timer
  useEffect(() => {
    if (uiState === 'recording') {
      timerRef.current = setInterval(() => {
        setElapsed(s => {
          if (s + 1 >= maxSeconds) { stopRecording(); return 0 }
          return s + 1
        })
      }, 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
      if (uiState !== 'reviewing') setElapsed(0)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uiState])

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
    } catch {
      setError('Δεν επιτρέπεται μικρόφωνο')
    }
  }

  function stopRecording() {
    mediaRef.current?.stop()
    mediaRef.current?.stream.getTracks().forEach(t => t.stop())
    setUiState('transcribing')
  }

  async function handleTranscribe() {
    const mimeType = mimeRef.current || 'audio/webm'
    const blob = new Blob(chunksRef.current, { type: mimeType })
    blobRef.current = blob

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setUiState('idle'); return }

    const form = new FormData()
    form.append('audio', blob, `memo.${mimeType.includes('mp4') ? 'm4a' : 'webm'}`)

    try {
      const res  = await fetch('/api/voice-transcribe', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: form,
      })
      const data = await res.json()

      if (!res.ok) { setError(data.error ?? 'Σφάλμα μεταγραφής'); setUiState('idle'); return }

      setTranscript(data.transcript)
      setUiState('reviewing')
    } catch {
      setError('Αδύνατη σύνδεση — δοκίμασε ξανά')
      setUiState('idle')
    }
  }

  async function handleSubmit() {
    if (!transcript.trim()) return
    setUiState('submitting')

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setUiState('idle'); return }

    try {
      const res  = await fetch('/api/voice-ingest', {
        method:  'POST',
        headers: {
          Authorization:  `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transcript,
          lead_id:     leadId     ?? null,
          property_id: propertyId ?? null,
          meeting_id:  meetingId  ?? null,
        }),
      })
      const data = await res.json()

      if (!res.ok) { setError(data.error ?? 'Σφάλμα'); setUiState('reviewing'); return }

      setLastIntent(data.intent)
      setLastSummary(data.summary)
      setUiState('done')
      onSuccess?.(data.intent, data.summary)

      setTimeout(() => {
        setUiState('idle')
        setTranscript('')
        setLastIntent(null)
        setLastSummary(null)
      }, 4000)
    } catch {
      setError('Αδύνατη σύνδεση — δοκίμασε ξανά')
      setUiState('reviewing')
    }
  }

  function handleDiscard() {
    setTranscript('')
    setError(null)
    setUiState('idle')
  }

  // ── Done state ────────────────────────────────────────────────
  if (uiState === 'done' && lastIntent) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderRadius: 6, border: '1px solid #166534', background: '#052e16', padding: '8px 12px', fontSize: 13 }}>
        <CheckCircle2 size={16} style={{ color: '#4ade80', flexShrink: 0 }} />
        <div>
          <p style={{ fontWeight: 600, color: '#86efac', margin: 0 }}>{INTENT_LABELS[lastIntent] ?? lastIntent}</p>
          {lastSummary && <p style={{ color: '#4ade80', margin: 0, fontSize: 11 }}>{lastSummary}</p>}
        </div>
      </div>
    )
  }

  // ── Review state — editable transcript ───────────────────────
  if (uiState === 'reviewing' || uiState === 'submitting') {
    const busy = uiState === 'submitting'
    return (
      <div style={{ background: '#111', border: '1px solid #2a2a2a', borderRadius: 8, padding: 14, width: '100%', maxWidth: 480 }}>
        <p style={{ fontSize: 11, color: '#555', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Έλεγξε & διόρθωσε αν χρειάζεται
        </p>
        <textarea
          value={transcript}
          onChange={e => setTranscript(e.target.value)}
          disabled={busy}
          rows={5}
          style={{
            width: '100%', boxSizing: 'border-box',
            background: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: 6,
            color: '#e0e0e0', fontSize: 14, lineHeight: 1.6,
            padding: '10px 12px', resize: 'vertical', fontFamily: 'inherit',
            outline: 'none', opacity: busy ? 0.6 : 1,
          }}
        />
        {error && <p style={{ fontSize: 12, color: '#f87171', margin: '6px 0 0' }}>{error}</p>}
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button
            onClick={handleSubmit}
            disabled={busy || !transcript.trim()}
            style={S.btn(true, busy || !transcript.trim())}
          >
            {busy
              ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Αποθήκευση…</>
              : <><Send size={14} /> Αποστολή</>
            }
          </button>
          <button
            onClick={handleDiscard}
            disabled={busy}
            style={S.btn(false, busy)}
          >
            <X size={14} /> Ακύρωση
          </button>
        </div>
      </div>
    )
  }

  // ── Idle / recording / transcribing ──────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <button
        onClick={uiState === 'idle' ? startRecording : uiState === 'recording' ? stopRecording : undefined}
        disabled={uiState === 'transcribing'}
        title={
          uiState === 'recording'    ? `Σταμάτα (${elapsed}s)` :
          uiState === 'transcribing' ? 'Μεταγραφή…' :
          'Φωνητική καταχώρηση'
        }
        style={{
          position: 'relative', width: 40, height: 40, borderRadius: 6,
          border: '1px solid #333',
          background: uiState === 'recording' ? '#7f1d1d' : '#1e1e1e',
          color: '#f0f0f0',
          cursor: uiState === 'transcribing' ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: uiState === 'transcribing' ? 0.6 : 1,
        }}
      >
        {uiState === 'transcribing' ? (
          <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
        ) : uiState === 'recording' ? (
          <>
            <MicOff size={16} />
            <span style={{
              position: 'absolute', top: -4, right: -4,
              width: 16, height: 16, borderRadius: '50%',
              background: '#ef4444', fontSize: 9, fontWeight: 700,
              color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{elapsed}</span>
          </>
        ) : (
          <Mic size={16} />
        )}
      </button>
      {error && <p style={{ fontSize: 11, color: '#f87171', margin: 0 }}>{error}</p>}
    </div>
  )
}
