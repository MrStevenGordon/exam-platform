import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { validateBody } from '@/lib/validateBody'
import { sendEmail, EMAIL_FROM } from '@/lib/email'
import { substitutionUnfilledEmail } from '@/lib/emailTemplates'
import { authorizeAbsenceCaller, emailFor, formatCoverDay, jamaicaToday } from '@/lib/substitutionServer'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!
)

const schema = z.object({
  absence_id: z.string().uuid(),
  accessToken: z.string().min(1).max(4000),
}).strict()

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

    const access = await authorizeAbsenceCaller(supabaseAdmin, accessToken, absence_id)
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

    const { data: rows } = await supabaseAdmin
      .from('substitution_assignments')
      .select('id, class_date, timetable_sections(subject, timetable_periods(name), class_groups(name))')
      .eq('absence_id', absence_id)
      .eq('status', 'unfilled')
      .is('unfilled_notified_at', null)
      .gte('class_date', jamaicaToday())
      .order('class_date')
    const unfilled = (rows || []) as unknown as UnfilledRow[]
    if (unfilled.length === 0) return NextResponse.json({ sent: 0, unfilled: 0 })

    // HODs of the department: every supervisor whose department it is, plus the named head.
    const recipientIds = new Set<string>()
    if (access.absent.department_id) {
      const { data: hods } = await supabaseAdmin.from('profiles').select('id').eq('role', 'supervisor').eq('department_id', access.absent.department_id).neq('is_active', false)
      for (const h of hods || []) recipientIds.add(h.id)
      if (access.headId) recipientIds.add(access.headId)
    }
    const recipients = new Set<string>()
    for (const id of recipientIds) {
      const email = await emailFor(supabaseAdmin, id)
      if (email) recipients.add(email)
    }
    if (recipients.size === 0) return NextResponse.json({ sent: 0, unfilled: unfilled.length, note: 'No HOD email address on file.' })

    const classes = unfilled.map((r) => ({
      when: formatCoverDay(r.class_date),
      what: [r.timetable_sections?.timetable_periods?.name, r.timetable_sections?.subject, r.timetable_sections?.class_groups?.name].filter(Boolean).join(' · '),
    }))
    const origin = req.headers.get('origin') || req.nextUrl.origin
    const { subject, html } = substitutionUnfilledEmail(access.absent.full_name, classes, `${origin}/supervisor/substitution`)

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
