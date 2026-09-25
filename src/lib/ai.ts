// A small, testable call to Claude for features that need one plain-text reply. It never throws:
// it returns the reply, or the status and message for the caller to turn into something readable.
export const AI_MODEL = 'claude-sonnet-5'

export type AiReply = { ok: true; text: string } | { ok: false; status: number; message: string }

export async function callClaude(
  prompt: string,
  opts: { maxTokens: number; apiKey: string; fetchImpl?: typeof fetch; baseUrl?: string },
): Promise<AiReply> {
  const doFetch = opts.fetchImpl ?? fetch
  const base = (opts.baseUrl ?? process.env.ANTHROPIC_BASE_URL ?? 'https://api.anthropic.com').replace(/\/$/, '')
  try {
    const res = await doFetch(`${base}/v1/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': opts.apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: AI_MODEL, max_tokens: opts.maxTokens, messages: [{ role: 'user', content: prompt }] }),
    })
    if (!res.ok) {
      const raw = await res.text()
      let message = raw.slice(0, 500)
      try { const j = JSON.parse(raw); if (j?.error?.message) message = String(j.error.message) } catch {}
      return { ok: false, status: res.status, message }
    }
    const data = await res.json()
    const text = data?.content?.[0]?.text
    if (typeof text !== 'string') return { ok: false, status: 502, message: 'The AI reply had no text.' }
    return { ok: true, text }
  } catch (e) {
    return { ok: false, status: 0, message: e instanceof Error ? e.message : 'Could not reach the AI service.' }
  }
}
