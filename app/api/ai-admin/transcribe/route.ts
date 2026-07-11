import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthedAgent } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rateLimit'
import { transcribeGreek } from '@/lib/voice/openai-stt'

const MAX_AUDIO_MB = 24

// Whisper transcription of a longer voice note can run past the platform
// default with no maxDuration set — same reasoning as voice-transcribe/route.ts.
export const maxDuration = 60

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// POST multipart: field "audio" — plain transcription only (no intent/field
// extraction, unlike /api/voice-transcribe which is a different feature).
// The AI Admin chat feeds the returned text into the same pipeline as typed
// messages, so voice and text commands go through identical logic.
export async function POST(req: NextRequest) {
  const caller = await getAuthedAgent(req)
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const withinRate = await checkRateLimit(sb, `voice-transcribe:${caller.id}`, 60, 5)
  if (!withinRate) return NextResponse.json({ error: 'Too many requests — try again shortly' }, { status: 429 })

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
