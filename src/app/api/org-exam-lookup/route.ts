import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!
)

// Public, unauthenticated lookup for the respondent-facing "take an exam"
// flow. Deliberately never selects access_password — that's checked
// separately in /api/org-exam-start, server-side only.
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  const examId = req.nextUrl.searchParams.get('examId')

  if (!code && !examId) {
    return NextResponse.json({ error: 'Missing code or examId' }, { status: 400 })
  }

  const query = supabaseAdmin
    .from('org_exams')
    .select('id, title, instructions, show_score_to_respondent')
    .eq('status', 'published')

  const { data: exam, error } = code
    ? await query.eq('exam_code', code.trim().toUpperCase()).maybeSingle()
    : await query.eq('id', examId).maybeSingle()

  if (error || !exam) {
    return NextResponse.json({ error: 'Exam not found. Check the code and try again.' }, { status: 404 })
  }

  const { data: fields } = await supabaseAdmin
    .from('org_respondent_fields')
    .select('id, label, field_type, required')
    .eq('org_exam_id', exam.id)
    .order('order_index', { ascending: true })

  return NextResponse.json({
    examId: exam.id,
    title: exam.title,
    instructions: exam.instructions,
    showScoreToRespondent: exam.show_score_to_respondent,
    fields: fields || [],
  })
}
