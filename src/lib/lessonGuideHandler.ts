import { z } from 'zod'
import { STEP_KEYS } from '@/lib/learning'
import {
  GUIDE_KEY_TERMS_MAX, GUIDE_STEP_MAX, GUIDE_TOTAL_INPUT_MAX, buildGuidePrompt, guideFailureMessage, lessonSourceText, parseGuide,
} from '@/lib/lessonGuide'

export const LESSON_GUIDE_MONTHLY_LIMIT = 60
export const LESSON_GUIDE_FEATURE = 'learning_lesson_guide'

export const lessonGuideSchema = z.object({
  subject: z.string().trim().min(1).max(200),
  grade: z.number().int().min(7).max(13).nullable(),
  title: z.string().trim().min(1).max(300),
  topic: z.string().trim().max(300).optional(),
  keyTerms: z.string().max(GUIDE_KEY_TERMS_MAX).optional(),
  steps: z.array(z.object({ key: z.enum(STEP_KEYS), text: z.string().max(GUIDE_STEP_MAX) }).strict()).length(STEP_KEYS.length),
  accessToken: z.string().min(1).max(4000),
}).strict()

export type LessonGuideBody = z.infer<typeof lessonGuideSchema>

export type AiAnswer = { ok: true; text: string; stopReason?: string } | { ok: false; message: string; httpStatus: number }

// Everything the handler needs from the outside world, so each can be replaced in a test.
export type GuideDeps = {
  authenticate: (token: string) => Promise<{ userId: string; role: string; active: boolean } | null>
  hasApiKey: () => boolean
  burstLimited: (userId: string) => Promise<boolean>
  usedThisMonth: (userId: string, monthYear: string) => Promise<number>
  recordUse: (userId: string, monthYear: string) => Promise<void>
  callAi: (prompt: string, maxTokens: number) => Promise<AiAnswer>
  now: () => Date
  log: (message: string, detail?: unknown) => void
}

export type GuideResponse = { status: number; json: Record<string, unknown> }

// Drafts a study guide from a lesson's own text. It never saves anything: it returns a draft for the teacher to read, change and
// approve. The allowance is counted only when a usable draft is actually delivered.
export async function handleLessonGuide(body: LessonGuideBody, deps: GuideDeps): Promise<GuideResponse> {
  const who = await deps.authenticate(body.accessToken)
  if (!who) return { status: 401, json: { error: 'Invalid session.' } }
  if (!['teacher', 'supervisor', 'admin'].includes(who.role) || !who.active) return { status: 403, json: { error: 'Not authorized.' } }

  const total = body.steps.reduce((n, s) => n + s.text.length, 0) + (body.keyTerms?.length ?? 0)
  if (total > GUIDE_TOTAL_INPUT_MAX) return { status: 400, json: { error: 'This lesson is too long to make a guide from in one go. Shorten the longest steps and try again.' } }
  if (total < 80) return { status: 400, json: { error: 'There is not enough written in the lesson yet. Write the steps first, then make the guide.' } }

  if (!deps.hasApiKey()) return { status: 503, json: { error: 'AI assist isn’t set up on this server yet (no Anthropic API key configured).' } }
  if (await deps.burstLimited(who.userId)) return { status: 429, json: { error: 'Too many requests. Please wait a minute and try again.' } }

  const monthYear = deps.now().toISOString().slice(0, 7)
  const used = await deps.usedThisMonth(who.userId, monthYear)
  if (used >= LESSON_GUIDE_MONTHLY_LIMIT) {
    return {
      status: 429,
      json: {
        error: `Monthly study guide limit reached. You have used ${used}/${LESSON_GUIDE_MONTHLY_LIMIT} this month. The limit resets on the 1st of next month.`,
        limit_reached: true, used, limit: LESSON_GUIDE_MONTHLY_LIMIT,
      },
    }
  }

  const input = { subject: body.subject, grade: body.grade, title: body.title, topic: body.topic, keyTerms: body.keyTerms, steps: body.steps }
  const reply = await deps.callAi(buildGuidePrompt(input), 5000)
  if (!reply.ok) {
    deps.log('AI study guide request failed', { status: reply.httpStatus, message: reply.message })
    return { status: reply.httpStatus >= 500 ? 503 : 502, json: { error: reply.message } }
  }

  const parsed = parseGuide(reply.text, lessonSourceText(input), { stopReason: reply.stopReason })
  if (!parsed.ok) {
    deps.log('AI study guide reply could not be used', { reason: parsed.reason })
    return { status: 502, json: { error: guideFailureMessage(parsed.reason) } }
  }

  await deps.recordUse(who.userId, monthYear)
  const d = parsed.draft
  return {
    status: 200,
    json: {
      keyPoints: d.keyPoints, canDo: d.canDo, cards: d.cards, questions: d.questions, removedLinks: d.removedLinks, dropped: d.dropped,
      usage: { used: used + 1, limit: LESSON_GUIDE_MONTHLY_LIMIT, remaining: LESSON_GUIDE_MONTHLY_LIMIT - used - 1 },
    },
  }
}
