import { NextRequest, NextResponse }                                      from 'next/server'
import { createClient }                                                    from '@supabase/supabase-js'
import { transcribeGreek }                                                 from '@/lib/voice/openai-stt'
import { detectIntent, extractPropertyScouted, extractDemandProfile }     from '@/lib/voice/extractors'

const MAX_AUDIO_MB = 24

async function resolveUser(token: string) {
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  )
  const { data: { user }, error } = await client.auth.getUser(token)
  if (error || !user) return null
  return user
}

// Returns transcript + intent + pre-extracted structured fields.
// Client shows a structured form for review before submission.
export async function POST(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? ''
  const user  = await resolveUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
