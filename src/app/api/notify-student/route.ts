import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { validateBody } from '@/lib/validateBody'
import { rateLimit } from '@/lib/rateLimit'
import { sendEmail, EMAIL_FROM } from '@/lib/email'
import { studentNotificationEmail } from '@/lib/emailTemplates'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!
)

const schema = z.object({
  studentIds: z.array(z.string().uuid()).min(1).max(100),
  subject: z.string().trim().min(1).max(200),
  message: z.string().trim().min(1).max(5000),
  accessToken: z.string().min(1).max(4000),
}).strict()

export async function POST(req: NextRequest) {
  try {
    const parsed = await validateBody(req, schema)
    if ('error' in parsed) return parsed.error
    const { studentIds, subject, message, accessToken } = parsed.data

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken)
    if (userError || !userData.user) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
    }
    const { data: callerProfile } = await supabaseAdmin
      .from('profiles')
      .select('full_name, role, is_active')
      .eq('id', userData.user.id)
      .single()
    if (!callerProfile || !['teacher', 'supervisor', 'admin'].includes(callerProfile.role) || callerProfile.is_active === false) {
      return NextResponse.json({ error: 'Not authorized.' }, { status: 403 })
    }

    const limited = await rateLimit(userData.user.id, 'notify-student', { limit: 10, windowSeconds: 60 })
    if (limited) return limited

    // Real authorization boundary: reuse the caller's own RLS-scoped
    // session rather than re-deriving "is this my student" server-side —
    // profiles already has policies for exactly this (a teacher's own
    // class/exam students, a supervisor's department, an admin's anyone).
    // A student id this doesn't return isn't one the caller can see, full
    // stop — we never fall back to the service-role client to check them.
    const callerClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
    )
    const { data: visibleStudents } = await callerClient
      .from('profiles')
      .select('id, full_name, school_email')
      .in('id', studentIds)
      .eq('role', 'student')

    const unauthorized = studentIds.filter((id) => !(visibleStudents || []).some((s) => s.id === id))

    let sent = 0
    let noEmail = 0

    for (const student of visibleStudents || []) {
      if (!student.school_email) {
        noEmail++
        continue
      }
      try {
        const { subject: emailSubject, html } = studentNotificationEmail(student.full_name, callerProfile.full_name, subject, message)
        await sendEmail({ to: student.school_email, subject: emailSubject, html, from: EMAIL_FROM.notifications })
        sent++
      } catch (emailError) {
        console.error('notify-student email failed:', emailError)
        noEmail++
      }
    }

    return NextResponse.json({ success: true, sent, noEmail, unauthorized: unauthorized.length })
  } catch (err) {
    console.error('notify-student error:', err)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
