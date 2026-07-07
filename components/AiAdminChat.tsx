'use client'

import { useState, useRef, useEffect } from 'react'
import { MessageCircle, X, Send, Mic, MicOff, Loader2 } from 'lucide-react'
import { useApp } from '@/lib/AppContext'
import { authedFetch } from '@/lib/authedFetch'

const RED = '#CC2229'

type PendingAction = { tool_name: string; tool_args: Record<string, any> }
type ChatMsg = { role: 'user' | 'assistant'; text: string; pendingAction?: PendingAction; resolved?: boolean }

function getSupportedMimeType() {
  for (const m of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'])
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) return m
  return ''
}

// Floating AI Admin assistant — available on every authenticated page (see
// components/AppShell.tsx). Handles portfolio Q&A and executes actions
// (add_contact, create_open_house, send_email) via /api/intelligence-chat's
// tool-calling; see lib/aiAdmin.ts for the execution/confirm/cap logic this
// UI is just a thin client for.
export default function AiAdminChat() {
  const { agent } = useApp()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)

  const listRef = useRef<HTMLDivElement>(null)
  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const mimeRef = useRef('')

  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' }) }, [messages, open])

  if (!agent) return null

  async function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed || sending) return
    setMessages(m => [...m, { role: 'user', text: trimmed }])
    setInput('')
    setSending(true)
    try {
      const res = await authedFetch('/api/intelligence-chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: trimmed }),
      })
      const data = await res.json()
      setMessages(m => [...m, { role: 'assistant', text: data.reply || 'Σφάλμα.', pendingAction: data.pending_action }])
    } catch {
      setMessages(m => [...m, { role: 'assistant', text: 'Αδύνατη σύνδεση με τον server.' }])
    } finally {
      setSending(false)
    }
  }

  async function confirm(msgIndex: number, action: PendingAction) {
    setMessages(m => m.map((msg, i) => i === msgIndex ? { ...msg, resolved: true } : msg))
    setSending(true)
    try {
      const res = await authedFetch('/api/intelligence-chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirm_action: action }),
      })
      const data = await res.json()
      setMessages(m => [...m, { role: 'assistant', text: data.reply || 'Σφάλμα.' }])
    } catch {
      setMessages(m => [...m, { role: 'assistant', text: 'Αδύνατη σύνδεση με τον server.' }])
    } finally {
      setSending(false)
    }
  }

  function decline(msgIndex: number) {
    setMessages(m => m.map((msg, i) => i === msgIndex ? { ...msg, resolved: true } : msg))
    setMessages(m => [...m, { role: 'assistant', text: 'Εντάξει, ακυρώθηκε.' }])
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mimeRef.current = getSupportedMimeType()
      const mr = new MediaRecorder(stream, mimeRef.current ? { mimeType: mimeRef.current } : {})
      chunksRef.current = []
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = handleTranscribe
      mediaRef.current = mr
      mr.start(250)
      setRecording(true)
    } catch {
      setMessages(m => [...m, { role: 'assistant', text: 'Δεν επιτρέπεται πρόσβαση στο μικρόφωνο.' }])
    }
  }

  function stopRecording() {
    mediaRef.current?.stop()
    mediaRef.current?.stream.getTracks().forEach(t => t.stop())
    setRecording(false)
    setTranscribing(true)
  }

  async function handleTranscribe() {
    const mimeType = mimeRef.current || 'audio/webm'
    const blob = new Blob(chunksRef.current, { type: mimeType })
    const form = new FormData()
    form.append('audio', blob, `voice.${mimeType.includes('mp4') ? 'm4a' : 'webm'}`)
    try {
      const res = await authedFetch('/api/ai-admin/transcribe', { method: 'POST', body: form })
      const data = await res.json()
      if (res.ok && data.transcript) setInput(data.transcript) // let the agent review/edit before sending
      else setMessages(m => [...m, { role: 'assistant', text: data.error || 'Σφάλμα μεταγραφής.' }])
    } catch {
      setMessages(m => [...m, { role: 'assistant', text: 'Αδύνατη μεταγραφή.' }])
    } finally {
      setTranscribing(false)
    }
  }

  return (
    <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 1000, fontFamily: 'inherit' }}>
      {open && (
        <div style={{ width: 360, height: 480, marginBottom: 12, background: '#111', border: '1px solid #2a2a2a', borderRadius: 12, display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,.5)' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #2a2a2a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#f0f0f0' }}>🤖 AI Admin</span>
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', display: 'flex' }}><X size={16} /></button>
          </div>

          <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {messages.length === 0 && (
              <p style={{ fontSize: 12, color: '#555', textAlign: 'center', marginTop: 40 }}>
                π.χ. "πρόσθεσε πελάτη Κώστα Μάντη, τηλ 6912345678" ή "openhouse Τετάρτη 15:00 στην Ναϊάδων 52"
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                <div style={{
                  padding: '8px 12px', borderRadius: 10, fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap',
                  background: m.role === 'user' ? RED : '#1e1e1e', color: m.role === 'user' ? '#fff' : '#e0e0e0',
                }}>
                  {m.text}
                </div>
                {m.pendingAction && !m.resolved && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                    <button onClick={() => confirm(i, m.pendingAction!)} disabled={sending}
                      style={{ padding: '5px 12px', background: '#166534', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      Ναι, στείλε
                    </button>
                    <button onClick={() => decline(i)} disabled={sending}
                      style={{ padding: '5px 12px', background: '#1e1e1e', color: '#888', border: '1px solid #2a2a2a', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
                      Άκυρο
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div style={{ padding: 10, borderTop: '1px solid #2a2a2a', display: 'flex', gap: 6 }}>
            <button
              onClick={recording ? stopRecording : startRecording}
              disabled={transcribing || sending}
              title={recording ? 'Σταμάτα' : 'Φωνητική εντολή'}
              style={{ width: 36, height: 36, flexShrink: 0, borderRadius: 8, border: '1px solid #2a2a2a', background: recording ? '#7f1d1d' : '#1e1e1e', color: '#e0e0e0', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              {transcribing ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : recording ? <MicOff size={15} /> : <Mic size={15} />}
            </button>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') send(input) }}
              placeholder="Γράψε μια εντολή..."
              disabled={sending}
              style={{ flex: 1, background: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: 8, color: '#e0e0e0', fontSize: 13, padding: '0 10px' }}
            />
            <button onClick={() => send(input)} disabled={sending || !input.trim()}
              style={{ width: 36, height: 36, flexShrink: 0, borderRadius: 8, border: 'none', background: RED, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: sending ? 0.6 : 1 }}>
              {sending ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={15} />}
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: 52, height: 52, borderRadius: '50%', border: 'none', background: RED, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(204,34,41,.4)', marginLeft: 'auto' }}
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
      </button>
    </div>
  )
}
