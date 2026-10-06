import * as Sentry from '@sentry/nextjs'
import { AI_USER_MESSAGES, callClaudeChat, NEEDS_ATTENTION, type AiFailureKind, type ChatMessage } from '@/lib/ai'

// Server-side wrapper every AI feature should use. It adds what a feature should not have to repeat: the API key, a label for the logs,
// a plain message for the person at the screen, and an alert to Smart Assess Ja when the problem needs a person (a bad key, no credit,
// a retired model) so it is seen straight away instead of by a teacher hitting an error.

export type AskResult =
  | { ok: true; text: string; stopReason?: string }
  | { ok: false; kind: AiFailureKind; status: number; message: string; httpStatus: number }

// Alert once per kind per ten minutes per server instance, so a burst of failed requests does not become a flood of alerts.
const lastAlert = new Map<string, number>()
function alertOnce(kind: AiFailureKind, label: string, status: number, detail: string) {
  const now = Date.now()
  if (now - (lastAlert.get(kind) ?? 0) < 10 * 60 * 1000) return
  lastAlert.set(kind, now)
  try { Sentry.captureMessage(`AI problem: ${kind} (${label}, HTTP ${status}): ${detail.slice(0, 200)}`, { level: 'error', tags: { ai_problem: kind, ai_feature: label } }) } catch { /* alerts must never break a request */ }
}

export async function askClaude(args: { label: string; messages: ChatMessage[]; system?: string; maxTokens: number; model?: string; timeoutMs?: number; retries?: number }): Promise<AskResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    alertOnce('invalid_key', args.label, 0, 'ANTHROPIC_API_KEY is not set on this server')
    return { ok: false, kind: 'invalid_key', status: 0, message: AI_USER_MESSAGES.invalid_key, httpStatus: 503 }
  }
  const reply = await callClaudeChat({ system: args.system, messages: args.messages }, { maxTokens: args.maxTokens, apiKey, model: args.model, timeoutMs: args.timeoutMs, retries: args.retries })
  if (reply.ok) return reply.stopReason ? { ok: true, text: reply.text, stopReason: reply.stopReason } : { ok: true, text: reply.text }
  console.error(`AI call failed (${args.label}):`, reply.kind, reply.status, reply.message)
  if (NEEDS_ATTENTION.includes(reply.kind)) alertOnce(reply.kind, args.label, reply.status, reply.message)
  // 503 for "not available right now" (the person can try again later or work by hand), 502 for a bad exchange.
  const unavailable: AiFailureKind[] = ['invalid_key', 'no_credit', 'bad_model', 'busy', 'timeout', 'network']
  return { ok: false, kind: reply.kind, status: reply.status, message: AI_USER_MESSAGES[reply.kind], httpStatus: unavailable.includes(reply.kind) ? 503 : reply.kind === 'too_large' ? 413 : 502 }
}
