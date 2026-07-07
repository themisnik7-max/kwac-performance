import { NextRequest, NextResponse } from 'next/server'
import { getAuthedAgent } from '@/lib/auth'
import { transcribeGreek } from '@/lib/voice/openai-stt'

const MAX_AUDIO_MB = 24

// POST multipart: field "audio" — plain transcription only (no intent/field
// extraction, unlike /api/voice-transcribe which is a different feature).
// The AI Admin chat feeds the returned text into the same pipeline as typed
// messages, so voice and text commands go through identical logic.
export async function POST(req: NextRequest) {
  const caller = await getAuthedAgent(req)
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const form = await req.formData()
  const audioBlob = form.get('audio') as Blob | null
  if (!audioBlob || audioBlob.size === 0) return NextResponse.json({ error: 'No audio received' }, { status: 400 })
  if (audioBlob.size > MAX_AUDIO_MB * 1024 * 1024) return NextResponse.json({ error: `Audio exceeds ${MAX_AUDIO_MB}MB` }, { status: 413 })

  try {
    const transcript = await transcribeGreek(audioBlob)
    return NextResponse.json({ transcript })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[ai-admin/transcribe]', msg)
    return NextResponse.json({ error: msg }, { status: 503 })
  }
}
