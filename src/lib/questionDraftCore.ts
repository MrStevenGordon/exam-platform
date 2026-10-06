import { classifyAiFailure, NEEDS_ATTENTION, type AiFailureKind } from './ai'
import { buildPrompt, checkRequest, LIMITS, parseReply, PROBLEM_MESSAGES, REQUEST_MESSAGES, type Draft, type DraftRequest } from './questionDraftPure'

// The decisions behind /api/draft-questions, with everything that touches the outside world passed in. The route supplies the real
// sign-in, database and AI; the tests (scripts/tests/question-draft/questionDraftCore.test.mjs) supply fakes and check every path.

export type AiResult = { ok: true; text: string } | { ok: false; status: number; message: string; kind?: AiFailureKind }

export type Deps = {
  authorize: (accessToken: string) => Promise<{ ok: true; userId: string } | { ok: false; status: number; body: Record<string, unknown> }>
  usedThisMonth: (userId: string) => Promise<number>
  burstLimited: (userId: string) => Promise<boolean>
  callAi: (system: string, user: string) => Promise<AiResult>
  recordUsage: (userId: string) => Promise<void>
  monthlyLimit: number
  random?: () => number
}

export type Outcome = { status: number; body: Record<string, unknown> }
const usage = (used: number, limit: number) => ({ used, limit, remaining: Math.max(0, limit - used) })

export async function draftQuestions(deps: Deps, p: { accessToken: string; request: DraftRequest }): Promise<Outcome> {
  const who = await deps.authorize(p.accessToken)
  if (!who.ok) return { status: who.status, body: who.body }
  const userId = who.userId

  const problem = checkRequest(p.request)
  if (problem) return { status: 400, body: { error: REQUEST_MESSAGES[problem], problem } }

  if (await deps.burstLimited(userId)) return { status: 429, body: { error: 'Too many requests. Please wait a moment and try again.' } }
  const used = await deps.usedThisMonth(userId)
  if (used >= deps.monthlyLimit) {
    return { status: 429, body: { error: `You have used all ${deps.monthlyLimit} AI question drafts for this month. The allowance resets on the 1st.`, limitReached: true, usage: usage(used, deps.monthlyLimit) } }
  }

  const { system, user } = buildPrompt(p.request)
  const reply = await deps.callAi(system, user)
  if (!reply.ok) {
    const kind = reply.kind ?? classifyAiFailure(reply.status, reply.message)
    if (NEEDS_ATTENTION.includes(kind)) return { status: 503, body: { error: 'The AI service is not available at the moment. You can still write questions by hand.', creditProblem: true } }
    if (kind === 'busy' || kind === 'timeout' || kind === 'network') return { status: 503, body: { error: 'The AI service is busy. Please try again in a minute.' } }
    return { status: 502, body: { error: 'The AI request failed. Please try again, or write the questions by hand.' } }
  }
  const checked = parseReply(reply.text, p.request, deps.random)
  if (!checked.ok) return { status: 502, body: { error: PROBLEM_MESSAGES[checked.reason], problem: checked.reason } }

  // Only a request that produced something usable uses up the allowance.
  await deps.recordUsage(userId)
  return { status: 200, body: { drafts: checked.drafts as Draft[], dropped: checked.dropped, usage: usage(used + 1, deps.monthlyLimit) } }
}

export { LIMITS }
