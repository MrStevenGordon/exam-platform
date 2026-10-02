import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { validateBody } from '@/lib/validateBody'
import { sendEmail, EMAIL_FROM } from '@/lib/email'
import { substitutionUnfilledEmail } from '@/lib/emailTemplates'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!
)

const schema = z.object({
  absence_id: z.string().uuid(),
  accessToken: z.string().min(1).max(4000),
}).strict()

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type UnfilledRow = {
  id: string
  class_date: string
  timetable_sections: {
    subject: string
    timetable_periods: { name: string } | null
    class_groups: { name: string } | null
  } | null
}

// After an absence is reported, tells the absent teacher's HOD about any class nobody could cover. Called by the
// screens that report absences; safe to call more than once, because each class is only ever announced once
// (unfilled_notified_at). School time is Jamaica time.
export async function POST(req: NextRequest) {
  try {
    const parsed = await validateBody(req, schema)
    if ('error' in parsed) return parsed.error
    const { absence_id, accessToken } = parsed.data

    const { data: callerData, error: callerError } = await supabaseAdmin.auth.getUser(accessToken)
    if (callerError || !callerData.user) return NextResponse.json({ error: 'Invalid session.' }, { status: 401 })
    const callerId = callerData.user.id

    const { data: absence } = await supabaseAdmin.from('teacher_absences').select('id, teacher_id').eq('id', absence_id).single()
    if (!absence) return NextResponse.json({ error: 'Absence not found.' }, { status: 404 })

    const { data: absentTeacher } = await supabaseAdmin.from('profiles').select('full_name, department_id').eq('id', absence.teacher_id).single()
    if (!absentTeacher) return NextResponse.json({ error: 'Absence not found.' }, { status: 404 })

    const { data: dept } = absentTeacher.department_id
      ? await supabaseAdmin.from('departments').select('head_id').eq('id', absentTeacher.department_id).single()
      : { data: null }

    // Allowed: the absent teacher, a school admin, or an HOD of the teacher's department.
    const { data: caller } = await supabaseAdmin.from('profiles').select('role, department_id, is_active').eq('id', callerId).single()
    const active = caller?.is_active !== false
    const isSelf = callerId === absence.teacher_id
    const isAdmin = active && caller?.role === 'admin'
    const isDeptHod = active && (dept?.head_id === callerId || (caller?.role === 'supervisor' && !!absentTeacher.department_id && caller.department_id === absentTeacher.department_id))
    if (!isSelf && !isAdmin && !isDeptHod) return NextResponse.json({ error: 'Not authorized.' }, { status: 403 })

    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Jamaica', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
    const { data: rows } = await supabaseAdmin
      .from('substitution_assignments')
      .select('id, class_date, timetable_sections(subject, timetable_periods(name), class_groups(name))')
      .eq('absence_id', absence_id)
      .eq('status', 'unfilled')
      .is('unfilled_notified_at', null)
      .gte('class_date', today)
      .order('class_date')
    const unfilled = (rows || []) as unknown as UnfilledRow[]
    if (unfilled.length === 0) return NextResponse.json({ sent: 0, unfilled: 0 })

    // HODs of the department: every supervisor whose department it is, plus the named head.
    const recipientIds = new Set<string>()
    if (absentTeacher.department_id) {
      const { data: hods } = await supabaseAdmin.from('profiles').select('id').eq('role', 'supervisor').eq('department_id', absentTeacher.department_id).neq('is_active', false)
      for (const h of hods || []) recipientIds.add(h.id)
      if (dept?.head_id) recipientIds.add(dept.head_id)
    }
    // Same lookup the attendance alert email uses: a school inbox if one is on file, else the sign-in address.
    const recipients = new Set<string>()
    for (const id of recipientIds) {
      const { data: p } = await supabaseAdmin.from('profiles').select('school_email').eq('id', id).single()
      const email = p?.school_email || (await supabaseAdmin.auth.admin.getUserById(id)).data.user?.email
      if (email && EMAIL_PATTERN.test(email)) recipients.add(email)
    }
    if (recipients.size === 0) return NextResponse.json({ sent: 0, unfilled: unfilled.length, note: 'No HOD email address on file.' })

    const formatDay = (d: string) => new Intl.DateTimeFormat('en-JM', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${d}T12:00:00Z`))
    const classes = unfilled.map((r) => ({
      when: formatDay(r.class_date),
      what: [r.timetable_sections?.timetable_periods?.name, r.timetable_sections?.subject, r.timetable_sections?.class_groups?.name].filter(Boolean).join(' · '),
    }))
    const origin = req.headers.get('origin') || req.nextUrl.origin
    const { subject, html } = substitutionUnfilledEmail(absentTeacher.full_name, classes, `${origin}/supervisor/substitution`)

    let sent = 0
    for (const to of recipients) {
      try { await sendEmail({ to, subject, html, from: EMAIL_FROM.notifications }); sent++ } catch (err) { console.error('substitution unfilled email failed:', err) }
    }
    // Only mark them announced if at least one message went out, so a failed send can be retried.
    if (sent > 0) await supabaseAdmin.from('substitution_assignments').update({ unfilled_notified_at: new Date().toISOString() }).in('id', unfilled.map((r) => r.id))
    return NextResponse.json({ sent, unfilled: unfilled.length })
  } catch (err) {
    console.error('notify-unfilled error:', err)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
