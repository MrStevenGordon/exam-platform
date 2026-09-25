import { z } from 'zod'
import { STEP_KEYS } from '@/lib/learning'
import type { AiReply } from '@/lib/ai'
import {
  DRAFT_STEP_MAX, DRAFT_TOTAL_INPUT_MAX, KEY_TERMS_MAX, buildDraftPrompt, friendlyAiError, parseDraft, type DraftResult,
} from '@/lib/studentDraft'

export const STUDENT_DRAFT_MONTHLY_LIMIT = 30
export const STUDENT_DRAFT_FEATURE = 'learning_student_draft'

export const studentDraftSchema = z.object({
  subject: z.string().trim().min(1).max(200),
  grade: z.number().int().min(7).max(13).nullable(),
  title: z.string().trim().min(1).max(300),
  topic: z.string().trim().max(300).optional(),
  keyTerms: z.string().max(KEY_TERMS_MAX).optional(),
  steps: z.array(z.object({ key: z.enum(STEP_KEYS), text: z.string().max(DRAFT_STEP_MAX) }).strict()).length(STEP_KEYS.length),
  accessToken: z.string().min(1).max(4000),
}).strict()

export type StudentDraftBody = z.infer<typeof studentDraftSchema>

// Everything the handler needs from the outside world, so each can be replaced in a test.
export type DraftDeps = {
  authenticate: (token: string) => Promise<{ userId: string; role: string; active: boolean } | null>
  hasApiKey: () => boolean
  burstLimited: (userId: string) => Promise<boolean>
  usedThisMonth: (userId: string, monthYear: string) => Promise<number>
  recordUse: (userId: string, monthYear: string) => Promise<void>
  callAi: (prompt: string, maxTokens: number) => Promise<AiReply>
  now: () => Date
  log: (message: string, detail?: unknown) => void
}

export type DraftResponse = { status: number; json: Record<string, unknown> }

// Drafts student-friendly text for a lesson's five steps. It never saves anything: it returns a draft
// for the teacher to read, change and approve. Usage is counted only when a draft is actually delivered.
export async function handleStudentDraft(body: StudentDraftBody, deps: DraftDeps): Promise<DraftResponse> {
  const who = await deps.authenticate(body.accessToken)
  if (!who) return { status: 401, json: { error: 'Invalid session.' } }
  if (!['teacher', 'supervisor', 'admin'].includes(who.role) || !who.active) return { status: 403, json: { error: 'Not authorized.' } }

  const total = body.steps.reduce((n, s) => n + s.text.length, 0) + (body.keyTerms?.length ?? 0)
  if (total > DRAFT_TOTAL_INPUT_MAX) return { status: 400, json: { error: 'This lesson is too long to draft in one go. Shorten the steps and try again.' } }
  if (body.steps.every((s) => !s.text.trim())) return { status: 400, json: { error: 'Write or paste something into at least one step first, so the AI has something to work from.' } }

  if (!deps.hasApiKey()) return { status: 503, json: { error: 'AI assist isn’t set up on this server yet (no Anthropic API key configured).' } }
  if (await deps.burstLimited(who.userId)) return { status: 429, json: { error: 'Too many requests. Please wait a minute and try again.' } }

  const monthYear = deps.now().toISOString().slice(0, 7)
  const used = await deps.usedThisMonth(who.userId, monthYear)
  if (used >= STUDENT_DRAFT_MONTHLY_LIMIT) {
    return {
      status: 429,
      json: {
        error: `Monthly AI student-draft limit reached. You have used ${used}/${STUDENT_DRAFT_MONTHLY_LIMIT} this month. The limit resets on the 1st of next month.`,
        limit_reached: true, used, limit: STUDENT_DRAFT_MONTHLY_LIMIT,
      },
    }
  }

  const prompt = buildDraftPrompt({ subject: body.subject, grade: body.grade, title: body.title, topic: body.topic, keyTerms: body.keyTerms, steps: body.steps })
  const reply = await deps.callAi(prompt, 4000)
  if (!reply.ok) {
    deps.log('AI student-draft request failed', { status: reply.status, message: reply.message })
    return { status: 502, json: { error: friendlyAiError(reply.status, reply.message) } }
  }

  const draft: DraftResult | null = parseDraft(reply.text)
  if (!draft) {
    deps.log('AI student-draft reply could not be read')
    return { status: 502, json: { error: 'The AI returned something unexpected. Please try again.' } }
  }

  await deps.recordUse(who.userId, monthYear)
  return {
    status: 200,
    json: { steps: draft.steps, keyTerms: draft.keyTerms, removedLinks: draft.removedLinks, usage: { used: used + 1, limit: STUDENT_DRAFT_MONTHLY_LIMIT, remaining: STUDENT_DRAFT_MONTHLY_LIMIT - used - 1 } },
  }
}
