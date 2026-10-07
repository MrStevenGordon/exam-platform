import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { rateLimit } from '@/lib/rateLimit'
import { validateBody } from '@/lib/validateBody'
import { askClaude } from '@/lib/aiCall'
import { parseAiJson } from '@/lib/aiJson'
import { problemRef, recordAiProblem } from '@/lib/aiProblems'
import { addWeeks, classKey, type ReportRow } from '@/lib/classFeedbackPure'
import { buildSummaryPrompt, normalizeSummary } from '@/lib/classFeedbackPrompt'

export const maxDuration = 60
const MONTHLY_LIMIT = 40

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!)

const schema = z.object({
  week: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  teacherId: z.string().uuid(),
  subject: z.string().trim().min(1).max(100),
  classGroupId: z.string().uuid().nullable(),
  accessToken: z.string().min(1).max(4000),
}).strict()

// Writes a short progress summary for one class and week. It reads the report AS THE SIGNED-IN PERSON, so the database's privacy rules decide
// what the AI is given (a head of department sees their department, a teacher their own classes, and so on). Nothing is saved.
export async function POST(req: NextRequest) {
  try {
    const parsed = await validateBody(req, schema)
    if ('error' in parsed) return parsed.error
    const { week, teacherId, subject, classGroupId, accessToken } = parsed.data

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken)
    if (userError || !userData.user) return NextResponse.json({ error: 'Invalid session.' }, { status: 401 })
    const { data: profile } = await supabaseAdmin.from('profiles').select('role, is_active').eq('id', userData.user.id).single()
    if (!profile || !['teacher', 'supervisor', 'principal', 'admin'].includes(profile.role) || profile.is_active === false) return NextResponse.json({ error: 'Not authorized.' }, { status: 403 })
    if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'AI assist isn’t set up on this server yet (no Anthropic API key configured).' }, { status: 503 })

    const burst = await rateLimit(userData.user.id, 'class-feedback-summary', { limit: 6, windowSeconds: 60 })
    if (burst) return burst

    const asUser = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } }, auth: { persistSession: false },
    })
    const { data, error } = await asUser.rpc('class_feedback_report', { p_from: addWeeks(week, -1), p_to: week })
    if (error) return NextResponse.json({ error: 'Could not read the feedback for that class.' }, { status: 403 })
    const rows = (data || []) as ReportRow[]
    const key = classKey({ teacher_id: teacherId, subject, class_group_id: classGroupId })
    const mine = rows.filter((r) => classKey(r) === key)
    const row = mine.find((r) => r.week_start === week)
    if (!row) return NextResponse.json({ error: 'That class was not found.' }, { status: 404 })
    if (row.responded === 0 && !row.reflection) return NextResponse.json({ error: 'There is nothing to summarise yet. Students have not answered and no reflection is written.' }, { status: 422 })
    const previous = mine.find((r) => r.week_start === addWeeks(week, -1)) ?? null

    const monthYear = new Date().toISOString().slice(0, 7)
    const { count } = await supabaseAdmin.from('ai_polish_usage').select('id', { count: 'exact', head: true }).eq('teacher_id', userData.user.id).eq('feature', 'class_feedback_summary').eq('month_year', monthYear)
    if ((count || 0) >= MONTHLY_LIMIT) return NextResponse.json({ error: `Monthly limit reached (${count}/${MONTHLY_LIMIT}). It resets on the 1st of next month.`, limit_reached: true }, { status: 429 })

    const prompt = buildSummaryPrompt(row, previous)
    const reply = await askClaude({ label: 'class-feedback-summary', messages: [{ role: 'user', content: prompt }], maxTokens: 1200, model: 'claude-sonnet-4-6', timeoutMs: 45_000, retries: 1 })
    if (!reply.ok) return NextResponse.json({ error: reply.message, ai_problem: reply.kind }, { status: reply.httpStatus })
    const result = parseAiJson(reply.text, { stopReason: reply.stopReason })
    const summary = result.ok ? normalizeSummary(result.value) : null
    if (!summary) {
      const reason = result.ok ? 'invalid' : result.reason
      await recordAiProblem(supabaseAdmin, { feature: 'class-feedback-summary', reason, stopReason: reply.stopReason, text: reply.text, attempt: 1 })
      return NextResponse.json({ error: `The AI could not write a readable summary this time. Please try again. (ref: ${problemRef(reason)})` }, { status: 502 })
    }
    await supabaseAdmin.from('ai_polish_usage').insert({ teacher_id: userData.user.id, feature: 'class_feedback_summary', month_year: monthYear })
    return NextResponse.json({ summary })
  } catch (err) {
    const name = (err as { name?: string } | null)?.name
    if (name === 'TimeoutError' || name === 'AbortError') return NextResponse.json({ error: 'The AI took too long. Please try again.' }, { status: 504 })
    console.error('Class feedback summary error:', err)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
