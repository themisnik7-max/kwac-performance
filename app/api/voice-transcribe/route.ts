import { NextRequest, NextResponse }                                      from 'next/server'
import { createClient }                                                    from '@supabase/supabase-js'
import { getAuthedAgent }                                                  from '@/lib/auth'
import { checkRateLimit }                                                  from '@/lib/rateLimit'
import { transcribeGreek }                                                 from '@/lib/voice/openai-stt'
import { detectIntent, extractPropertyScouted, extractDemandProfile }     from '@/lib/voice/extractors'

const MAX_AUDIO_MB = 24

// Chains Whisper transcription + GPT-4o-mini extraction in one request —
// needs an explicit budget rather than the platform default (CLAUDE.md's
// multi-step-external-call rule), same reasoning as the other maxDuration
// routes in this app.
export const maxDuration = 60

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// Returns transcript + intent + pre-extracted structured fields.
// Client shows a structured form for review before submission.
export async function POST(req: NextRequest) {
  // Was a hand-rolled auth.getUser() check (no agents-row requirement,
  // weaker than every other route) — unified on getAuthedAgent per
  // CLAUDE.md. Nothing downstream in this file used the old `user` object
  // beyond the auth gate itself, so this is a drop-in replacement.
  const caller = await getAuthedAgent(req)
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Real $ per call (OpenAI Whisper + GPT-4o-mini extraction below) with no
  // cap before this fix — a scripted loop had nothing stopping it.
  const withinRate = await checkRateLimit(sb, `voice-transcribe:${caller.id}`, 60, 5)
  if (!withinRate) return NextResponse.json({ error: 'Too many requests — try again shortly' }, { status: 429 })

  const form      = await req.formData()
  const audioBlob = form.get('audio') as Blob | null

  if (!audioBlob || audioBlob.size === 0)
    return NextResponse.json({ error: 'No audio received' }, { status: 400 })
  if (audioBlob.size > MAX_AUDIO_MB * 1024 * 1024)
    return NextResponse.json({ error: `Audio exceeds ${MAX_AUDIO_MB}MB` }, { status: 413 })

  // Step 1: transcribe
  let transcript: string
  try {
    transcript = await transcribeGreek(audioBlob)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[voice-transcribe]', msg)
    return NextResponse.json({ error: msg }, { status: 503 })
  }

  if (!transcript)
    return NextResponse.json({ error: 'Empty transcript' }, { status: 422 })

  // Step 2: intent + extraction (parallel)
  const intent = detectIntent(transcript)
  let extracted: Record<string, unknown> = {}
  try {
    if      (intent === 'property_scouted') extracted = await extractPropertyScouted(transcript)
    else if (intent === 'demand_profile')   extracted = await extractDemandProfile(transcript)
  } catch (err) {
    console.error('[voice-transcribe] extraction failed', err)
    // Non-fatal — client will show empty form fields
  }

  return NextResponse.json({ transcript, intent, extracted })
}
