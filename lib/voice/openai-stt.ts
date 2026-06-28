import OpenAI, { toFile } from 'openai'

let _client: OpenAI | null = null
function client() {
  if (!_client) _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY?.trim() ?? 'placeholder' })
  return _client
}

// ── Transcription ────────────────────────────────────────────────
// whisper-1 with explicit Greek language hint — far better than CF Whisper for Greek
export async function transcribeGreek(audioBlob: Blob): Promise<string> {
  const buffer = Buffer.from(await audioBlob.arrayBuffer())
  const file   = await toFile(buffer, 'audio.webm', { type: audioBlob.type || 'audio/webm' })

  const result = await client().audio.transcriptions.create({
    file,
    model:    'whisper-1',
    language: 'el',
  })
  return result.text.trim()
}

// ── Structured extraction ────────────────────────────────────────
// GPT-4o-mini with response_format:json_object — never returns invalid JSON
export async function gptExtract(
  systemPrompt: string,
  userText: string,
): Promise<Record<string, unknown>> {
  const completion = await client().chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userText.slice(0, 800) },
    ],
    max_tokens:      400,
    temperature:     0,
    response_format: { type: 'json_object' },
  })

  try {
    return JSON.parse(completion.choices[0]?.message?.content ?? '{}')
  } catch {
    return {}
  }
}
