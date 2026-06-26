import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@supabase/supabase-js'
import { whisperTranscribe }         from '@/lib/voice/cloudflare-ai'

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

export async function POST(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? ''
  const user  = await resolveUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const form      = await req.formData()
  const audioBlob = form.get('audio') as Blob | null

  if (!audioBlob)
    return NextResponse.json({ error: 'No audio' }, { status: 400 })
  if (audioBlob.size > MAX_AUDIO_MB * 1024 * 1024)
    return NextResponse.json({ error: `Audio exceeds ${MAX_AUDIO_MB}MB` }, { status: 413 })

  try {
    const transcript = await whisperTranscribe(audioBlob)
    if (!transcript)
      return NextResponse.json({ error: 'Empty transcript' }, { status: 422 })
    return NextResponse.json({ transcript })
  } catch (err) {
    console.error('[voice-transcribe]', err)
    return NextResponse.json({ error: 'Transcription service unavailable' }, { status: 503 })
  }
}
