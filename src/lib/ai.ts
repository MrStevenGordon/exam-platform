// A small, testable call to Claude for features that need one plain-text reply. It never throws:
// it returns the reply, or the status and message for the caller to turn into something readable.
export const AI_MODEL = 'claude-sonnet-5'

export type AiReply = { ok: true; text: string } | { ok: false; status: number; message: string }
export type ChatMessage = { role: 'user' | 'assistant'; content: string }
type CallOpts = { maxTokens: number; apiKey: string; fetchImpl?: typeof fetch; baseUrl?: string }

export async function callClaude(prompt: string, opts: CallOpts): Promise<AiReply> {
  return callClaudeChat({ messages: [{ role: 'user', content: prompt }] }, opts)
}

// An Anthropic reply's `content` is a list of typed blocks, not always a single text block at
// index 0 — grabbing content[0].text directly fails whenever a non-text block (for example a
// refusal note) comes first, even though a usable text block exists later in the array. Every
// Anthropic call site in this app should read its reply through this, not content[0].text.
export function extractText(data: { content?: unknown; stop_reason?: unknown }): string | null {
  const blocks = Array.isArray(data?.content) ? data.content : []
  const textBlock = blocks.find((b: unknown): b is { type: string; text: string } => (
    !!b && typeof b === 'object' && (b as { type?: unknown }).type === 'text' && typeof (b as { text?: unknown }).text === 'string'
  ))
  return textBlock ? textBlock.text : null
}

// A multi-turn conversation with an optional system prompt (used by the tutor).
export async function callClaudeChat(input: { system?: string; messages: ChatMessage[] }, opts: CallOpts): Promise<AiReply> {
  const doFetch = opts.fetchImpl ?? fetch
  const base = (opts.baseUrl ?? process.env.ANTHROPIC_BASE_URL ?? 'https://api.anthropic.com').replace(/\/$/, '')
  try {
    const res = await doFetch(`${base}/v1/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': opts.apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: AI_MODEL, max_tokens: opts.maxTokens, ...(input.system ? { system: input.system } : {}), messages: input.messages }),
    })
    if (!res.ok) {
      const raw = await res.text()
      let message = raw.slice(0, 500)
      try { const j = JSON.parse(raw); if (j?.error?.message) message = String(j.error.message) } catch {}
      return { ok: false, status: res.status, message }
    }
    const data = await res.json()
    const text = extractText(data)
    if (text === null) {
      const blocks = Array.isArray(data?.content) ? data.content : []
      return { ok: false, status: 502, message: `The AI reply had no text (stop_reason: ${data?.stop_reason ?? 'unknown'}, blocks: ${blocks.map((b: { type?: unknown }) => b?.type).join(',') || 'none'}).` }
    }
    return { ok: true, text }
  } catch (e) {
    return { ok: false, status: 0, message: e instanceof Error ? e.message : 'Could not reach the AI service.' }
  }
}
