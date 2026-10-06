// The one place the app talks to Claude. It never throws: it returns the reply, or why it failed (with a plain kind of failure) for the
// caller to turn into something readable. It retries the failures that usually clear on their own (busy, a dropped connection), so a
// passing hiccup is not shown to a teacher as an error, and it names the failures that need a person (a bad key, no credit).
export const AI_MODEL = 'claude-sonnet-5'

export type AiFailureKind = 'invalid_key' | 'no_credit' | 'busy' | 'bad_model' | 'too_large' | 'timeout' | 'network' | 'other'
export type AiReply = { ok: true; text: string } | { ok: false; status: number; message: string; kind: AiFailureKind }
export type ContentBlock = Record<string, unknown>
export type ChatMessage = { role: 'user' | 'assistant'; content: string | ContentBlock[] }
type CallOpts = {
  maxTokens: number
  apiKey: string
  model?: string               // defaults to AI_MODEL; a route may keep an older model until it has been tested on a newer one
  timeoutMs?: number           // per attempt; none by default
  retries?: number             // extra attempts after the first, for busy or dropped connections. Default 2
  sleep?: (ms: number) => Promise<void>
  fetchImpl?: typeof fetch
  baseUrl?: string
}

export async function callClaude(prompt: string, opts: CallOpts): Promise<AiReply> {
  return callClaudeChat({ messages: [{ role: 'user', content: prompt }] }, opts)
}

// What went wrong, from the HTTP status and Anthropic's own message. Order matters: a credit problem is a 400 with a message, not a 402.
export function classifyAiFailure(status: number, message: string): AiFailureKind {
  const m = (message || '').toLowerCase()
  if (/credit|billing|balance|payment/.test(m)) return 'no_credit'
  if (status === 401 || status === 403 || /api key|x-api-key|authentication|permission/.test(m)) return 'invalid_key'
  if (status === 429 || status === 529 || /overloaded|rate limit|rate_limit/.test(m)) return 'busy'
  if (status === 404 || /model/.test(m) && /(not found|does not exist|deprecated|not available)/.test(m)) return 'bad_model'
  if (status === 413 || /too large|too long|prompt is too long|request_too_large/.test(m)) return 'too_large'
  if (status === 0 && /timeout|timed out|aborted/.test(m)) return 'timeout'
  if (status === 0) return 'network'
  return 'other'
}

// Failures that usually clear on their own, so are worth another go.
const RETRYABLE: AiFailureKind[] = ['busy', 'network', 'timeout']
const isRetryable = (status: number, kind: AiFailureKind) => RETRYABLE.includes(kind) || status === 500 || status === 502 || status === 503 || status === 504

// What to tell the person at the screen. Never the raw provider message: it names keys and balances nobody at a school can act on.
export const AI_USER_MESSAGES: Record<AiFailureKind, string> = {
  invalid_key: 'The AI service is not set up correctly at the moment. Smart Assess Ja has been told. Please carry on by hand for now.',
  no_credit: 'The AI service is not available at the moment. Smart Assess Ja has been told. Please carry on by hand for now.',
  busy: 'The AI service is busy. Please try again in a minute.',
  bad_model: 'The AI service is not set up correctly at the moment. Smart Assess Ja has been told. Please carry on by hand for now.',
  too_large: 'That is too large for the AI to handle. Please try something shorter.',
  timeout: 'The AI took too long to answer. Please try again.',
  network: 'Could not reach the AI service. Please check your connection and try again.',
  other: 'The AI request failed. Please try again.',
}

// Needs a person at Smart Assess Ja (as opposed to a passing hiccup), so it should raise an alert.
export const NEEDS_ATTENTION: AiFailureKind[] = ['invalid_key', 'no_credit', 'bad_model']

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

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
const BACKOFF_MS = [800, 2500]

// A multi-turn conversation with an optional system prompt (used by the tutor and others).
export async function callClaudeChat(input: { system?: string; messages: ChatMessage[] }, opts: CallOpts): Promise<AiReply> {
  const doFetch = opts.fetchImpl ?? fetch
  const sleep = opts.sleep ?? defaultSleep
  const retries = opts.retries ?? 2
  const base = (opts.baseUrl ?? process.env.ANTHROPIC_BASE_URL ?? 'https://api.anthropic.com').replace(/\/$/, '')
  const body = JSON.stringify({ model: opts.model ?? AI_MODEL, max_tokens: opts.maxTokens, ...(input.system ? { system: input.system } : {}), messages: input.messages })

  let last: Extract<AiReply, { ok: false }> = { ok: false, status: 0, message: 'No attempt was made.', kind: 'network' }
  for (let attempt = 0; attempt <= retries; attempt++) {
    let retryAfterMs: number | null = null
    try {
      const controller = opts.timeoutMs ? new AbortController() : null
      const timer = controller ? setTimeout(() => controller.abort(), opts.timeoutMs) : null
      let res: Response
      try {
        res = await doFetch(`${base}/v1/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': opts.apiKey, 'anthropic-version': '2023-06-01' },
          body,
          ...(controller ? { signal: controller.signal } : {}),
        })
      } finally {
        if (timer) clearTimeout(timer)
      }
      if (!res.ok) {
        const raw = await res.text()
        let message = raw.slice(0, 500)
        try { const j = JSON.parse(raw); if (j?.error?.message) message = String(j.error.message) } catch { /* keep the raw text */ }
        const retryAfter = Number(res.headers?.get?.('retry-after'))
        if (Number.isFinite(retryAfter) && retryAfter > 0) retryAfterMs = Math.min(retryAfter, 5) * 1000
        last = { ok: false, status: res.status, message, kind: classifyAiFailure(res.status, message) }
      } else {
        const data = await res.json()
        const text = extractText(data)
        if (text !== null) return { ok: true, text }
        const blocks = Array.isArray(data?.content) ? data.content : []
        // No text at all (for example the answer was declined): not worth retrying.
        return { ok: false, status: 502, kind: 'other', message: `The AI reply had no text (stop_reason: ${data?.stop_reason ?? 'unknown'}, blocks: ${blocks.map((b: { type?: unknown }) => b?.type).join(',') || 'none'}).` }
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not reach the AI service.'
      last = { ok: false, status: 0, message, kind: classifyAiFailure(0, `${e instanceof Error ? e.name : ''} ${message}`) }
    }
    // A long call that timed out has used the time a retry would need, so only short timeouts are retried.
    const longTimeout = last.kind === 'timeout' && (opts.timeoutMs ?? 0) > 60_000
    if (attempt < retries && !longTimeout && isRetryable(last.status, last.kind)) { await sleep(retryAfterMs ?? BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)]); continue }
    break
  }
  return last
}
