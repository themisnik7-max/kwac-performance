'use client'

import { useState, useRef, useEffect } from 'react'
import { Mic, MicOff, Loader2, CheckCircle2 } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'

interface VoiceMemoButtonProps {
  leadId?:     string
  propertyId?: string
  meetingId?:  string
  onSuccess?:  (intent: string, summary: string) => void
  maxSeconds?: number
}

type UIState = 'idle' | 'recording' | 'uploading' | 'done'

function getSupportedMimeType(): string {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ]
  for (const mime of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) return mime
  }
  return ''
}

const INTENT_LABELS: Record<string, string> = {
  property_scouted: 'Καταγραφή Ακινήτου',
  demand_profile:   'Ζήτηση',
  voice_note:       'Σημείωση',
}

export function VoiceMemoButton({
  leadId, propertyId, meetingId, onSuccess,
  maxSeconds = 120,
}: VoiceMemoButtonProps) {
  const [uiState,     setUiState]     = useState<UIState>('idle')
  const [elapsed,     setElapsed]     = useState(0)
  const [lastIntent,  setLastIntent]  = useState<string | null>(null)
  const [lastSummary, setLastSummary] = useState<string | null>(null)
  const [error,       setError]       = useState<string | null>(null)

  const mediaRef  = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  const mimeRef   = useRef<string>('')

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
      setElapsed(0)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uiState])

  async function startRecording() {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mimeRef.current = getSupportedMimeType()

      const mr = new MediaRecorder(stream, {
        ...(mimeRef.current ? { mimeType: mimeRef.current } : {}),
      })
      chunksRef.current = []

      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = handleUpload

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
    setUiState('uploading')
  }

  async function handleUpload() {
    const mimeType = mimeRef.current || 'audio/webm'
    const blob     = new Blob(chunksRef.current, { type: mimeType })

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setUiState('idle'); return }

    const form = new FormData()
    form.append('audio', blob, `memo.${mimeType.includes('mp4') ? 'm4a' : 'webm'}`)
    if (leadId)     form.append('lead_id',     leadId)
    if (propertyId) form.append('property_id', propertyId)
    if (meetingId)  form.append('meeting_id',  meetingId)

    try {
      const res  = await fetch('/api/voice-ingest', {
        method:  'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body:    form,
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Σφάλμα')
        setUiState('idle')
        return
      }

      setLastIntent(data.intent)
      setLastSummary(data.summary)
      setUiState('done')
      onSuccess?.(data.intent, data.summary)

      setTimeout(() => { setUiState('idle'); setLastIntent(null); setLastSummary(null) }, 4000)
    } catch {
      setError('Δίκτυο αδύνατο — δοκίμασε ξανά')
      setUiState('idle')
    }
  }

  if (uiState === 'done' && lastIntent) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderRadius: 6, border: '1px solid #166534', background: '#052e16', padding: '8px 12px', fontSize: 13 }}>
        <CheckCircle2 size={16} style={{ color: '#4ade80', flexShrink: 0 }} />
        <div style={{ minWidth: 0 }}>
          <p style={{ fontWeight: 600, color: '#86efac', margin: 0 }}>{INTENT_LABELS[lastIntent]}</p>
          {lastSummary && (
            <p style={{ color: '#4ade80', margin: 0, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lastSummary}</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <button
        onClick={uiState === 'idle' ? startRecording : uiState === 'recording' ? stopRecording : undefined}
        disabled={uiState === 'uploading'}
        title={uiState === 'recording' ? `Σταμάτα (${elapsed}s)` : 'Φωνητική καταχώρηση'}
        style={{
          position: 'relative',
          width: 40,
          height: 40,
          borderRadius: 6,
          border: '1px solid #333',
          background: uiState === 'recording' ? '#7f1d1d' : '#1e1e1e',
          color: '#f0f0f0',
          cursor: uiState === 'uploading' ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: uiState === 'uploading' ? 0.6 : 1,
        }}
      >
        {uiState === 'uploading' ? (
          <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
        ) : uiState === 'recording' ? (
          <>
            <MicOff size={16} />
            <span style={{ position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: '50%', background: '#ef4444', fontSize: 9, fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {elapsed}
            </span>
          </>
        ) : (
          <Mic size={16} />
        )}
      </button>
      {error && <p style={{ fontSize: 11, color: '#f87171', margin: 0 }}>{error}</p>}
    </div>
  )
}
