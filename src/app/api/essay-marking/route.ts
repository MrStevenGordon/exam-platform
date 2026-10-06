import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { rateLimit } from '@/lib/rateLimit'
import { validateBody } from '@/lib/validateBody'
import { AI_MODEL } from '@/lib/ai'
import { askClaude } from '@/lib/aiCall'
import { LIMITS, type Suggestion } from '@/lib/essayMarkingPure'
import { suggestMarks, type Deps, type LoadedResponse } from '@/lib/essayMarkingCore'
import { authorizeMarker, callerClient, MONTHLY_LIMIT, monthKey, supabaseAdmin, usedThisMonth, USAGE_FEATURE } from '@/lib/essayMarkingServer'

export const maxDuration = 60

const schema = z.object({
  responseId: z.string().uuid(),
  accessToken: z.string().min(1).max(4000),
  regenerate: z.boolean().optional(),
}).strict()

// Suggests marks for one essay answer. The decisions are in essayMarkingCore.ts (tested with fakes); this wires them to the real
// sign-in, database and AI. A suggestion is stored apart from the marks and nothing here ever writes a mark.
export async function POST(req: NextRequest) {
  try {
    const parsed = await validateBody(req, schema)
    if ('error' in parsed) return parsed.error
    const { responseId, accessToken, regenerate } = parsed.data

    const deps: Deps = {
      authorize: async (token) => {
        const who = await authorizeMarker(token)
        if (who.ok) return { ok: true, userId: who.caller.userId }
        return { ok: false, status: who.response.status, body: await who.response.json() }
      },
      canSee: async (token, id) => {
        const { data } = await callerClient(token).from('responses').select('id').eq('id', id).maybeSingle()
        return !!data
      },
      // The service key reads the question because a class teacher may not be able to read a school exam's question table.
      loadResponse: async (id) => {
        const { data } = await supabaseAdmin.from('responses').select('answer, questions(question_text, question_type, essay_rubric)').eq('id', id).maybeSingle()
        if (!data) return null
        const q = Array.isArray(data.questions) ? data.questions[0] : data.questions
        return q ? ({ answer: data.answer, question: q } as LoadedResponse) : null
      },
      existing: async (id) => {
        const { data } = await supabaseAdmin.from('essay_ai_marking').select('suggestion, created_at').eq('response_id', id).maybeSingle()
        return data ? { suggestion: data.suggestion as Suggestion, createdAt: data.created_at as string } : null
      },
      usedThisMonth,
      burstLimited: async (userId) => (await rateLimit(userId, 'essay-marking-burst', { limit: 30, windowSeconds: 60 })) !== null,
      callAi: async (system, user) => {
        const reply = await askClaude({ label: 'essay-marking', system, messages: [{ role: 'user', content: user }], maxTokens: LIMITS.maxTokens })
        return reply.ok ? reply : { ok: false, status: reply.status, message: reply.message, kind: reply.kind }
      },
      // A fresh suggestion replaces the old one and clears any recorded final marks.
      save: async (id, suggestion, userId) => {
        const { error } = await supabaseAdmin.from('essay_ai_marking').upsert({
          response_id: id, suggestion, model: AI_MODEL, created_by: userId, created_at: new Date().toISOString(),
          final_marks: null, final_total: null, finalized_by: null, finalized_at: null,
        }, { onConflict: 'response_id' })
        if (error) console.error('essay-marking save error:', error)
        return { error }
      },
      recordUsage: async (userId) => { await supabaseAdmin.from('ai_polish_usage').insert({ teacher_id: userId, feature: USAGE_FEATURE, month_year: monthKey() }) },
      monthlyLimit: MONTHLY_LIMIT,
      aiAvailable: !!process.env.ANTHROPIC_API_KEY,
    }

    const out = await suggestMarks(deps, { responseId, accessToken, regenerate })
    return NextResponse.json(out.body, { status: out.status })
  } catch (err) {
    console.error('essay-marking route error:', err)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
