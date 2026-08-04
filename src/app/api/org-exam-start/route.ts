import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { rateLimit, getClientIp } from '@/lib/rateLimit'
import { validateBody } from '@/lib/validateBody'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!
)

const schema = z.object({
  examId: z.string().uuid(),
  password: z.string().max(200).optional(),
  fieldValues: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
  accessToken: z.string().min(1).max(4000),
}).strict()

// Verifies the exam password server-side (never exposed to the client) and
// creates the respondent's session + field values. The caller must already
// be signed in anonymously (supabase.auth.signInAnonymously()) and pass
// their access token — we re-derive the verified user id from it rather
// than trusting a client-supplied id.
export async function POST(req: NextRequest) {
  try {
    const parsed = await validateBody(req, schema)
    if ('error' in parsed) return parsed.error
    const { examId, password, fieldValues, accessToken } = parsed.data

    // Two limits: a tight one scoped to this exam (stops password-guessing
    // against a single exam) and a broader one per IP across all exams
    // (stops someone rotating through exam ids to find guessable ones).
    const ip = getClientIp(req)
    const perExamLimited = await rateLimit(`${ip}:${examId}`, 'org-exam-start', { limit: 8, windowSeconds: 600 })
    if (perExamLimited) return perExamLimited
    const perIpLimited = await rateLimit(ip, 'org-exam-start-ip', { limit: 30, windowSeconds: 3600 })
    if (perIpLimited) return perIpLimited

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken)
    if (userError || !userData.user) {
      return NextResponse.json({ error: 'Invalid session. Please refresh and try again.' }, { status: 401 })
    }
    const authUserId = userData.user.id

    const { data: exam, error: examError } = await supabaseAdmin
      .from('org_exams')
      .select('id, access_password, duration_minutes')
      .eq('id', examId)
      .eq('status', 'published')
      .maybeSingle()

    if (examError || !exam) {
      return NextResponse.json({ error: 'Exam not found.' }, { status: 404 })
    }

    if ((password || '').trim().toUpperCase() !== exam.access_password.trim().toUpperCase()) {
      return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 })
    }

    const { data: fields } = await supabaseAdmin
      .from('org_respondent_fields')
      .select('id, label, required')
      .eq('org_exam_id', examId)

    for (const field of fields || []) {
      if (field.required && !(fieldValues || {})[field.id]?.toString().trim()) {
        return NextResponse.json({ error: `"${field.label}" is required.` }, { status: 400 })
      }
    }

    const { data: session, error: sessionError } = await supabaseAdmin
      .from('org_exam_sessions')
      .insert({
        org_exam_id: examId,
        auth_user_id: authUserId,
        time_limit_seconds: exam.duration_minutes * 60,
        option_shuffle_seed: Math.floor(Math.random() * 1000000),
      })
      .select('id')
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ error: sessionError?.message || 'Could not start session.' }, { status: 500 })
    }

    const fieldValueRows = Object.entries(fieldValues || {})
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .map(([fieldId, value]) => ({ session_id: session.id, field_id: fieldId, value: String(value) }))

    if (fieldValueRows.length > 0) {
      await supabaseAdmin.from('org_respondent_field_values').insert(fieldValueRows)
    }

    return NextResponse.json({ sessionId: session.id })
  } catch (err) {
    console.error('org-exam-start error:', err)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
