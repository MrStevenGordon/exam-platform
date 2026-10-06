import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { rateLimit } from '@/lib/rateLimit'
import { validateBody } from '@/lib/validateBody'
import { askClaude } from '@/lib/aiCall'
import { LIMITS } from '@/lib/questionDraftPure'
import { draftQuestions, type Deps } from '@/lib/questionDraftCore'
import { authorizeDrafter, MONTHLY_LIMIT, monthKey, supabaseAdmin, usedThisMonth, USAGE_FEATURE } from '@/lib/questionDraftServer'

export const maxDuration = 120

const count = z.number().int().min(0).max(LIMITS.maxTotal)
const schema = z.object({
  accessToken: z.string().min(1).max(4000),
  subject: z.string().trim().max(LIMITS.maxSubject),
  grade: z.string().trim().max(20),
  topic: z.string().trim().max(LIMITS.maxTopic),
  counts: z.object({ multiple_choice: count, true_false: count, short_answer: count, essay: count }).strict(),
  difficulty: z.enum(['easier', 'standard', 'harder']),
  notes: z.string().max(LIMITS.maxNotes),
}).strict()

// Drafts exam questions for a teacher to review. The decisions are in questionDraftCore.ts (tested with fakes); this wires them
// to the real sign-in, database and AI. Nothing here saves a question.
export async function POST(req: NextRequest) {
  try {
    const parsed = await validateBody(req, schema)
    if ('error' in parsed) return parsed.error
    const { accessToken, ...request } = parsed.data

    const deps: Deps = {
      authorize: async (token) => {
        const who = await authorizeDrafter(token)
        if (who.ok) return { ok: true, userId: who.userId }
        return { ok: false, status: who.response.status, body: await who.response.json() }
      },
      usedThisMonth,
      burstLimited: async (userId) => (await rateLimit(userId, 'draft-questions-burst', { limit: 5, windowSeconds: 60 })) !== null,
      callAi: async (system, user) => {
        const reply = await askClaude({ label: 'draft-questions', system, messages: [{ role: 'user', content: user }], maxTokens: LIMITS.maxTokens, timeoutMs: 100_000 })
        return reply.ok ? reply : { ok: false, status: reply.status, message: reply.message, kind: reply.kind }
      },
      recordUsage: async (userId) => {
        const { error } = await supabaseAdmin.from('ai_polish_usage').insert({ teacher_id: userId, feature: USAGE_FEATURE, month_year: monthKey() })
        if (error) console.error('draft-questions usage insert error:', error)
      },
      monthlyLimit: MONTHLY_LIMIT,
    }
    const out = await draftQuestions(deps, { accessToken, request })
    return NextResponse.json(out.body, { status: out.status })
  } catch (err) {
    console.error('draft-questions route error:', err)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
