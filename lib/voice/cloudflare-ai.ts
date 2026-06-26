// Cloudflare Workers AI client — retry + jittered exponential backoff

const CF_BASE = `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID?.trim()}/ai/run`

export const CF_MODELS = {
  whisper: `${CF_BASE}/@cf/openai/whisper`,
  llama:   `${CF_BASE}/@cf/meta/llama-3.1-8b-instruct`,
} as const

async function retryWithBackoff<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err: unknown) {
      const isRateLimit = err instanceof Error && err.message.includes('429')
      if (!isRateLimit || attempt === maxRetries - 1) throw err
      // jittered exponential backoff: 1s, 2s, 4s ± 300ms
      const delay = (2 ** attempt) * 1000 + Math.random() * 300
      await new Promise(r => setTimeout(r, delay))
    }
  }
  throw new Error('Max retries exceeded')
}

export async function whisperTranscribe(audioBlob: Blob): Promise<string> {
  return retryWithBackoff(async () => {
    // CF Workers AI Whisper REST API expects { audio: uint8array }
    const audioBuffer = await audioBlob.arrayBuffer()
    const audioArray  = Array.from(new Uint8Array(audioBuffer))

    const res = await fetch(CF_MODELS.whisper, {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${process.env.CF_AI_TOKEN?.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ audio: audioArray }),
    })

    if (res.status === 429) throw new Error('429')
    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      throw new Error(`Whisper ${res.status}: ${errText.slice(0, 300)}`)
    }

    const data = await res.json()
    return (data?.result?.text ?? '').trim()
  })
}

export async function llamaExtract(
  systemPrompt: string,
  userText: string,
  maxTokens = 300,
): Promise<Record<string, unknown>> {
  return retryWithBackoff(async () => {
    const res = await fetch(CF_MODELS.llama, {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${process.env.CF_AI_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userText.slice(0, 600) },
        ],
        max_tokens: maxTokens,
      }),
    })

    if (res.status === 429) throw new Error('429')
    const data = await res.json()
    const raw  = data?.result?.response ?? '{}'

    // JSON-repair: extract first { } block even if model adds prose
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return {}
    try { return JSON.parse(match[0]) }
    catch { return {} }
  })
}
