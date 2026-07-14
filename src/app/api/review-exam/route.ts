import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!
)

export async function POST(req: NextRequest) {
  try {
    const { examId, action, accessToken } = await req.json()

    if (!accessToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(accessToken)
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    const { data: exam, error: examError } = await supabaseAdmin
      .from('draft_exams')
      .select('id, status, subject, target_grade, department_id')
      .eq('id', examId)
      .single()

    if (examError || !exam) {
      return NextResponse.json({ error: 'Exam not found' }, { status: 404 })
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role, department_id, is_system_admin')
      .eq('id', user.id)
      .single()

    let authorized = false

    if (profile?.is_system_admin || profile?.role === 'admin') {
      authorized = true
    } else if (profile?.role === 'supervisor' && profile.department_id === exam.department_id) {
      authorized = true
    } else {
      const { data: stla } = await supabaseAdmin
        .from('senior_team_lead_appointments')
        .select('id, year_grade')
        .eq('teacher_id', user.id)
        .eq('subject', exam.subject)

      if (stla && stla.some((a) => a.year_grade === null || a.year_grade === exam.target_grade)) {
        authorized = true
      }
    }

    if (!authorized) {
      return NextResponse.json({ error: 'You are not authorized to review this exam.' }, { status: 403 })
    }

    if (exam.status !== 'submitted') {
      return NextResponse.json({ error: 'This exam is not currently awaiting review.' }, { status: 400 })
    }

    if (action === 'approve') {
      const { error } = await supabaseAdmin
        .from('draft_exams')
        .update({ status: 'approved', reviewed_by: user.id, reviewed_at: new Date().toISOString() })
        .eq('id', examId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    } else if (action === 'request-changes') {
      const { error } = await supabaseAdmin
        .from('draft_exams')
        .update({ status: 'draft', reviewed_by: user.id, reviewed_at: new Date().toISOString() })
        .eq('id', examId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    } else {
      return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Unexpected error' }, { status: 500 })
  }
}
