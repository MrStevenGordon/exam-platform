import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { validateBody } from '@/lib/validateBody'
import { sendEmail, EMAIL_FROM } from '@/lib/email'
import { substitutionCoverEmail, substitutionReleasedEmail, substitutionAbsentToldEmail } from '@/lib/emailTemplates'
import { authorizeAbsenceCaller, emailFor, formatCoverDay, jamaicaToday, planCoverEmails } from '@/lib/substitutionServer'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!
)

const schema = z.object({
  absence_id: z.string().uuid(),
  accessToken: z.string().min(1).max(4000),
}).strict()

type Row = {
  id: string
  class_date: string
  status: 'assigned' | 'unfilled'
  substitute_teacher_id: string | null
  assigned_by: string | null
  substitute_notified_id: string | null
  absent_told_id: string | null
  absent_told_at: string | null
  timetable_sections: { subject: string; timetable_periods: { name: string; order_index: number } | null; class_groups: { name: string } | null } | null
  lesson_plans: { topic: string } | null
  learning_lessons: { title: string } | null
}

const what = (r: Row) => [r.timetable_sections?.timetable_periods?.name, r.timetable_sections?.subject, r.timetable_sections?.class_groups?.name].filter(Boolean).join(' · ')
const lessonOf = (r: Row) => (r.lesson_plans?.topic ? `${r.lesson_plans.topic} (lesson plan)` : r.learning_lessons?.title ? `${r.learning_lessons.title} (Smart Learning)` : '')

// Brings people's email up to date with who is covering what, for one absence. It works out who still needs telling
// rather than trusting that it is called exactly once: each class remembers who was last emailed about it
// (substitute_notified_id) and who the absent teacher was last told about (absent_told_id). So calling it again
// after a swap tells the new substitute, releases the old one, and updates the absent teacher, and calling it
// twice in a row sends nothing the second time. The in-app messages are sent by the database at the moment of the
// change; this is the email half.
export async function POST(req: NextRequest) {
  try {
    const parsed = await validateBody(req, schema)
    if ('error' in parsed) return parsed.error
    const { absence_id, accessToken } = parsed.data

    const access = await authorizeAbsenceCaller(supabaseAdmin, accessToken, absence_id)
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

    const { data, error } = await supabaseAdmin
      .from('substitution_assignments')
      .select('id, class_date, status, substitute_teacher_id, assigned_by, substitute_notified_id, absent_told_id, absent_told_at, timetable_sections(subject, timetable_periods(name, order_index), class_groups(name)), lesson_plans(topic), learning_lessons(title)')
      .eq('absence_id', absence_id)
      .gte('class_date', jamaicaToday())
    if (error) {
      // Migration 075 has not been applied yet: nothing to reconcile, and nothing the caller can do about it.
      if (error.code === '42703' || error.code === 'PGRST200') return NextResponse.json({ skipped: 'Migration 075 is not applied.' })
      throw error
    }
    const rows = ((data || []) as unknown as Row[]).sort((a, b) =>
      a.class_date.localeCompare(b.class_date) || (a.timetable_sections?.timetable_periods?.order_index ?? 0) - (b.timetable_sections?.timetable_periods?.order_index ?? 0))
    if (rows.length === 0) return NextResponse.json({ notified: 0, released: 0, told: false })

    const ids = new Set<string>()
    for (const r of rows) { if (r.substitute_teacher_id) ids.add(r.substitute_teacher_id); if (r.substitute_notified_id) ids.add(r.substitute_notified_id) }
    const { data: people } = await supabaseAdmin.from('profiles').select('id, full_name').in('id', Array.from(ids))
    const nameOf = new Map((people || []).map((p) => [p.id as string, p.full_name as string]))

    const origin = req.headers.get('origin') || req.nextUrl.origin
    const send = async (userId: string, mail: { subject: string; html: string }): Promise<boolean> => {
      const to = await emailFor(supabaseAdmin, userId)
      if (!to) return false
      try { await sendEmail({ to, subject: mail.subject, html: mail.html, from: EMAIL_FROM.notifications }); return true } catch (err) { console.error('substitution cover email failed:', err); return false }
    }
    const groupBy = (list: Row[], key: (r: Row) => string) => {
      const m = new Map<string, Row[]>()
      for (const r of list) { const k = key(r); m.set(k, [...(m.get(k) || []), r]) }
      return m
    }
    const { releasedRows, freshRows, toTell } = planCoverEmails(rows, access.absence.teacher_id)
    const line = (r: Row) => ({ when: formatCoverDay(r.class_date), what: what(r), note: `For ${access.absent.full_name}${lessonOf(r) ? `. Lesson: ${lessonOf(r)}` : ''}` })

    // 1. Substitutes who have been swapped out of a class.
    let released = 0
    for (const [oldSub, list] of groupBy(releasedRows, (r) => r.substitute_notified_id as string)) {
      if (await send(oldSub, substitutionReleasedEmail(nameOf.get(oldSub) || 'there', list.map(line)))) {
        released++
        // Cleared, so a failed email to the new substitute below does not make this one go out twice.
        await supabaseAdmin.from('substitution_assignments').update({ substitute_notified_id: null }).in('id', list.map((r) => r.id))
      }
    }

    // 2. Substitutes who have been given a class they have not been told about.
    let notified = 0
    for (const [sub, list] of groupBy(freshRows, (r) => r.substitute_teacher_id as string)) {
      if (await send(sub, substitutionCoverEmail(nameOf.get(sub) || 'there', list.map(line), `${origin}/teacher/cover`))) {
        notified++
        await supabaseAdmin.from('substitution_assignments').update({ substitute_notified_id: sub, substitute_notified_at: new Date().toISOString() }).in('id', list.map((r) => r.id))
      }
    }

    // 3. The absent teacher, when somebody else arranged or changed their cover.
    let told = false
    if (toTell.length > 0) {
      const lines = toTell.map((r) => ({
        when: formatCoverDay(r.class_date),
        what: what(r),
        note: r.status === 'assigned' && r.substitute_teacher_id ? `Covered by ${nameOf.get(r.substitute_teacher_id) || 'a colleague'}` : 'No substitute yet',
      }))
      if (await send(access.absence.teacher_id, substitutionAbsentToldEmail(access.absent.full_name, lines))) {
        told = true
        for (const [subKey, list] of groupBy(toTell, (r) => r.substitute_teacher_id ?? '')) {
          await supabaseAdmin.from('substitution_assignments').update({ absent_told_at: new Date().toISOString(), absent_told_id: subKey || null }).in('id', list.map((r) => r.id))
        }
      }
    }

    return NextResponse.json({ notified, released, told })
  } catch (err) {
    console.error('notify-cover error:', err)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
