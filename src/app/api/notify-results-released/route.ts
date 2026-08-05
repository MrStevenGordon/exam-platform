import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { validateBody } from '@/lib/validateBody'
import { rateLimit } from '@/lib/rateLimit'
import { sendEmail, EMAIL_FROM } from '@/lib/email'
import { resultsReleasedEmail } from '@/lib/emailTemplates'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!
)

const schema = z.object({
  sessionIds: z.array(z.string().uuid()).min(1).max(500),
  accessToken: z.string().min(1).max(4000),
}).strict()

// Deliberately doesn't re-verify per-session teacher/supervisor ownership —
// that's a real RLS authorization chain (own draft exam, assigned class,
// or supervised department) already enforced on the actual
// results_released update the caller must have just performed
// client-side. This route only ever emails about sessions that are
// *already* results_released = true and not yet notified, so it can't
// expose anything a legitimate release didn't already expose; the staff
// token check below is just a basic sanity gate, not the real boundary.
export async function POST(req: NextRequest) {
  try {
    const parsed = await validateBody(req, schema)
    if ('error' in parsed) return parsed.error
    const { sessionIds, accessToken } = parsed.data

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken)
    if (userError || !userData.user) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
    }
    const { data: callerProfile } = await supabaseAdmin
      .from('profiles')
      .select('role, is_active')
      .eq('id', userData.user.id)
      .single()
    if (!callerProfile || !['teacher', 'supervisor', 'admin'].includes(callerProfile.role) || callerProfile.is_active === false) {
      return NextResponse.json({ error: 'Not authorized.' }, { status: 403 })
    }

    const limited = await rateLimit(userData.user.id, 'notify-results-released', { limit: 20, windowSeconds: 60 })
    if (limited) return limited

    const { data: sessions } = await supabaseAdmin
      .from('exam_sessions')
      .select(`
        id, results_released, results_notified_at,
        draft_exams(title), final_exams(title),
        profiles!exam_sessions_student_id_fkey(full_name, school_email)
      `)
      .in('id', sessionIds)
      .eq('results_released', true)
      .is('results_notified_at', null)

    let sent = 0
    let skipped = 0

    for (const session of sessions || []) {
      const student = (session as any).profiles
      const examTitle = (session as any).draft_exams?.title || (session as any).final_exams?.title || 'your exam'

      if (!student?.school_email) {
        skipped++
        continue
      }

      try {
        const { subject, html } = resultsReleasedEmail(student.full_name, examTitle)
        await sendEmail({ to: student.school_email, subject, html, from: EMAIL_FROM.notifications })
        sent++
      } catch (emailError) {
        console.error('results-released email failed:', emailError)
        skipped++
        continue
      }

      await supabaseAdmin.from('exam_sessions').update({ results_notified_at: new Date().toISOString() }).eq('id', session.id)
    }

    return NextResponse.json({ success: true, sent, skipped })
  } catch (err) {
    console.error('notify-results-released error:', err)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
