import { classifyAiFailure, NEEDS_ATTENTION, type AiFailureKind } from './ai'
import { parseStoredRubric } from './essayRubricPure'
import { blankSuggestion, buildPrompt, checkInput, LIMITS, parseReply, PROBLEM_MESSAGES, type Suggestion } from './essayMarkingPure'

// The decisions behind /api/essay-marking, with everything that touches the outside world passed in. The route supplies the real
// sign-in, database and AI; the tests (scripts/tests/essay-marking/essayMarkingCore.test.mjs) supply fakes and check every path.

export type AiResult = { ok: true; text: string } | { ok: false; status: number; message: string; kind?: AiFailureKind }
export type LoadedResponse = { answer: string | null; question: { question_text: string | null; question_type: string; essay_rubric: unknown } }
export type SaveResult = { error?: { code?: string } | null }

export type Deps = {
  authorize: (accessToken: string) => Promise<{ ok: true; userId: string } | { ok: false; status: number; body: Record<string, unknown> }>
  canSee: (accessToken: string, responseId: string) => Promise<boolean>
  loadResponse: (responseId: string) => Promise<LoadedResponse | null>
  existing: (responseId: string) => Promise<{ suggestion: Suggestion; createdAt: string } | null>
  usedThisMonth: (userId: string) => Promise<number>
  burstLimited: (userId: string) => Promise<boolean>
  callAi: (system: string, user: string) => Promise<AiResult>
  save: (responseId: string, suggestion: Suggestion, userId: string) => Promise<SaveResult>
  recordUsage: (userId: string) => Promise<void>
  monthlyLimit: number
  aiAvailable: boolean
}

export type Outcome = { status: number; body: Record<string, unknown> }

const usage = (used: number, limit: number) => ({ used, limit, remaining: Math.max(0, limit - used) })

export async function suggestMarks(deps: Deps, p: { responseId: string; accessToken: string; regenerate?: boolean }): Promise<Outcome> {
  const who = await deps.authorize(p.accessToken)
  if (!who.ok) return { status: who.status, body: who.body }
  const userId = who.userId

  // They may only ask about a response they can already read.
  if (!(await deps.canSee(p.accessToken, p.responseId))) return { status: 404, body: { error: 'Response not found or not accessible.' } }
  const loaded = await deps.loadResponse(p.responseId)
  if (!loaded) return { status: 404, body: { error: 'Response not found or not accessible.' } }
  if (loaded.question.question_type !== 'essay') return { status: 400, body: { error: 'Not an essay response.' } }

  const points = parseStoredRubric(loaded.question.essay_rubric)
  const input = { question: loaded.question.question_text || '', points, answer: loaded.answer || '' }
  const used = await deps.usedThisMonth(userId)

  // Already suggested: show it again for free, unless they asked for a fresh one.
  if (!p.regenerate) {
    const existing = await deps.existing(p.responseId)
    if (existing) return { status: 200, body: { suggestion: existing.suggestion, createdAt: existing.createdAt, reused: true, usage: usage(used, deps.monthlyLimit) } }
  }

  const problem = checkInput(input)
  if (problem === 'no_points' || problem === 'answer_too_long') return { status: 400, body: { error: PROBLEM_MESSAGES[problem], problem } }

  let suggestion: Suggestion
  let spent = false
  if (problem === 'blank_answer') {
    suggestion = blankSuggestion(points) // earns nothing: no AI call, no allowance used
  } else {
    if (await deps.burstLimited(userId)) return { status: 429, body: { error: 'Too many requests. Please wait a moment and try again.' } }
    if (used >= deps.monthlyLimit) {
      return { status: 429, body: { error: `You have used all ${deps.monthlyLimit} AI suggestions for this month. The allowance resets on the 1st.`, limitReached: true, usage: usage(used, deps.monthlyLimit) } }
    }
    if (!deps.aiAvailable) return { status: 503, body: { error: 'AI marking is not available right now.' } }

    const { system, user } = buildPrompt(input)
    const reply = await deps.callAi(system, user)
    if (!reply.ok) {
      const kind = reply.kind ?? classifyAiFailure(reply.status, reply.message)
      if (NEEDS_ATTENTION.includes(kind)) return { status: 503, body: { error: 'The AI service is not available at the moment. Please mark by hand and tell Smart Assess Ja.', creditProblem: true } }
      if (kind === 'busy' || kind === 'timeout' || kind === 'network') return { status: 503, body: { error: 'The AI service is busy. Please try again in a minute.' } }
      return { status: 502, body: { error: 'The AI request failed. Please try again, or mark by hand.' } }
    }
    const checked = parseReply(reply.text, input)
    if (!checked.ok) return { status: 502, body: { error: PROBLEM_MESSAGES[checked.reason], problem: checked.reason } }
    suggestion = checked.suggestion
    spent = true
  }

  const saved = await deps.save(p.responseId, suggestion, userId)
  if (saved.error) {
    if (saved.error.code === '42P01' || saved.error.code === 'PGRST205') return { status: 501, body: { error: 'AI marking is not set up for your school yet.' } }
    return { status: 500, body: { error: 'Something went wrong.' } }
  }
  if (spent) await deps.recordUsage(userId)
  return { status: 200, body: { suggestion, reused: false, usage: usage(used + (spent ? 1 : 0), deps.monthlyLimit) } }
}

export { LIMITS }
