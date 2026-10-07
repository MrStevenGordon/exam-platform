import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { rateLimit } from '@/lib/rateLimit'
import { validateBody } from '@/lib/validateBody'
import { normalizeGeneratedPlan } from '@/lib/lessonPlan'
import { askClaude } from '@/lib/aiCall'
import { parseAiJson } from '@/lib/aiJson'
import { buildLessonPlanPrompt } from '@/lib/lessonPlanPrompt'
import { curriculumExcerpts } from '@/lib/curriculum'
import { describeSources } from '@/lib/curriculumPure'
import { problemRef, recordAiProblem } from '@/lib/aiProblems'
import * as Sentry from '@sentry/nextjs'

// A multi-lesson draft is a long response: the AI writes it all in one go, and several lessons took longer than the
// old 60 seconds. 300 is the most the Hobby plan allows (with Fluid compute, which both projects have on).
export const maxDuration = 300

// Stop waiting a little before the platform would cut us off, so the teacher gets a clear message instead of an error page.
const AI_TIMEOUT_MS = 280_000

const MONTHLY_LIMIT = 15

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!
)

const schema = z.object({
  subject: z.string().trim().min(1).max(200),
  grade: z.string().trim().min(1).max(50),
  topic: z.string().trim().min(1).max(500),
  focusQuestion: z.string().trim().max(500).optional(),
  attainmentTarget: z.string().trim().max(1000).optional(),
  // How many lessons the unit should have. One keeps the original
  // single-lesson behaviour.
  lessonCount: z.number().int().min(1).max(10).optional(),
  duration: z.string().trim().max(100).optional(),
  accessToken: z.string().min(1).max(4000),
}).strict()

// Drafts the body of a lesson plan (the "5E" sections used verbatim in real
// Ministry of Education NSC lesson plans) from a subject/grade/topic. Never
// saves anything itself — this only returns a draft for the teacher to
// review and edit client-side before they choose to save it, same pattern
// as /api/import-pdf-exam.
export async function POST(req: NextRequest) {
  try {
    const bodyParsed = await validateBody(req, schema)
    if ('error' in bodyParsed) return bodyParsed.error
    const { subject, grade, topic, focusQuestion, attainmentTarget, duration, accessToken } = bodyParsed.data
    const lessonCount = bodyParsed.data.lessonCount ?? 1

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken)
    if (userError || !userData.user) {
      return NextResponse.json({ error: 'Invalid session.' }, { status: 401 })
    }
    const { data: callerProfile } = await supabaseAdmin
      .from('profiles')
      .select('role, is_active')
      .eq('id', userData.user.id)
      .single()
    if (!callerProfile || !['teacher', 'supervisor', 'admin'].includes(callerProfile.role) || callerProfile.is_active === false) {
      return NextResponse.json({ error: 'Not authorized.' }, { status: 403 })
    }
    const teacherId = userData.user.id

    // Without a key the request would fail with Anthropic's raw "x-api-key
    // header is required"; say what is actually wrong instead.
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'AI assist isn’t set up on this server yet (no Anthropic API key configured).' }, { status: 503 })
    }

    const burstLimited = await rateLimit(teacherId, 'lesson-plan-generate-burst', { limit: 5, windowSeconds: 60 })
    if (burstLimited) return burstLimited

    const monthYear = new Date().toISOString().slice(0, 7)

    const { count } = await supabaseAdmin
      .from('ai_polish_usage')
      .select('id', { count: 'exact', head: true })
      .eq('teacher_id', teacherId)
      .eq('feature', 'lesson_plan_generate')
      .eq('month_year', monthYear)

    const usedCount = count || 0

    if (usedCount >= MONTHLY_LIMIT) {
      return NextResponse.json({
        error: `Monthly AI lesson-plan draft limit reached. You have used ${usedCount}/${MONTHLY_LIMIT} this month. Limit resets on the 1st of next month.`,
        limit_reached: true,
        used: usedCount,
        limit: MONTHLY_LIMIT,
      }, { status: 429 })
    }

    // Subject/grade/topic/etc are untrusted teacher-submitted input —
    // wrapped in explicit delimiters with an instruction that they're data,
    // not instructions, matching the convention already used in
    // /api/polish-question and /api/essay-integrity-check.
    // The national curriculum text for this subject and grade, when it has been loaded (central migration 003). Drafting works without it.
    const curriculum = await curriculumExcerpts({ subject, grade, topic, focusQuestion, attainmentTarget })
    const prompt = buildLessonPlanPrompt({ subject, grade, topic, lessonCount, duration, focusQuestion, attainmentTarget, curriculum: curriculum.text })

    // The draft is a long JSON answer. If it comes back cut off (the AI ran out of room) or garbled, ask once more with more room and a
    // plainer instruction, so the teacher is not told "try again" for something we can sort out ourselves.
    const started = Date.now()
    let parsed: unknown
    let lastProblem = ''
    let lastReason = 'invalid'
    for (let attempt = 1; attempt <= 2; attempt++) {
      const elapsed = Date.now() - started
      if (attempt === 2 && elapsed > 150_000) break      // not enough time left for a second try before the platform cuts us off
      const retryNote = attempt === 2 ? '\n\nIMPORTANT: your last answer could not be read. Keep every field to one or two short sentences, use plain text only (no markdown, no bullet characters), write line breaks inside a value as \\n, and make sure the JSON is complete.' : ''
      const room = attempt === 1 ? 3000 + 1400 * lessonCount : 5000 + 2000 * lessonCount
      const reply = await askClaude({ label: 'lesson-plans', messages: [{ role: 'user', content: prompt + retryNote }], maxTokens: room, model: 'claude-sonnet-4-6', timeoutMs: Math.min(AI_TIMEOUT_MS, 285_000 - elapsed), retries: 1 })
      if (!reply.ok) return NextResponse.json({ error: reply.message, ai_problem: reply.kind }, { status: reply.httpStatus })
      const result = parseAiJson(reply.text, { stopReason: reply.stopReason })
      if (result.ok && result.value && typeof result.value === 'object') { parsed = result.value; break }
      lastProblem = result.ok ? 'The reply was not a JSON object.' : `${result.reason}: ${result.detail}`
      lastReason = result.ok ? 'invalid' : result.reason
      await recordAiProblem(supabaseAdmin, { feature: 'lesson-plans', reason: lastReason, stopReason: reply.stopReason, text: reply.text, attempt })
      // Say why, so a failure can be understood from the logs instead of guessed at.
      console.error(`Lesson plan generate: unreadable reply (attempt ${attempt}, stop_reason ${reply.stopReason ?? 'unknown'}, ${reply.text.length} characters). ${lastProblem}\nstart: ${JSON.stringify(reply.text.slice(0, 200))}\nend: ${JSON.stringify(reply.text.slice(-200))}`)
      try { Sentry.captureMessage(`AI lesson plan: unreadable reply (${lastProblem})`, { level: 'warning', tags: { ai_feature: 'lesson-plans', attempt: String(attempt) } }) } catch { /* alerts must never break the request */ }
    }
    if (!parsed) {
      return NextResponse.json({ error: `The AI could not finish a readable draft this time. Please try again, or ask for fewer lessons at a time. (ref: ${problemRef(lastReason)})` }, { status: 502 })
    }

    await supabaseAdmin.from('ai_polish_usage').insert({
      teacher_id: teacherId,
      feature: 'lesson_plan_generate',
      month_year: monthYear,
    })

    return NextResponse.json({
      ...normalizeGeneratedPlan(parsed, lessonCount),
      // What the draft was lined up with, so the teacher can see it and check the guide.
      alignedWith: describeSources(curriculum.sources),
      usage: { used: usedCount + 1, limit: MONTHLY_LIMIT, remaining: MONTHLY_LIMIT - usedCount - 1 }
    })

  } catch (err: any) {
    if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
      console.error('Lesson plan generate: the AI did not answer in time')
      return NextResponse.json({ error: 'The AI took too long to draft this. Try again, or ask for fewer lessons at a time.' }, { status: 504 })
    }
    console.error('Lesson plan generate error:', err)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
