import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail, EMAIL_FROM } from '@/lib/email'
import { substitutionReminderEmail } from '@/lib/emailTemplates'
import { emailFor, jamaicaToday } from '@/lib/substitutionServer'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!
)

type Row = {
  id: string
  substitute_teacher_id: string
  timetable_sections: { subject: string; timetable_periods: { name: string; order_index: number } | null; class_groups: { name: string } | null } | null
  teacher_absences: { teacher_id: string } | null
  lesson_plans: { topic: string } | null
  learning_lessons: { title: string } | null
}

// The morning reminder: emails each substitute the classes they are covering today. Not scheduled by default. To
// switch it on, add a cron entry for this path to vercel.json, early on a school morning (Jamaica is UTC-5, so
// "30 11 * * *" is 6:30am). Each class is reminded once (reminded_at). Guarded by CRON_SECRET like the other cron
// routes; add ?dry=1 to see what would be sent without sending or marking anything.
export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const dry = req.nextUrl.searchParams.get('dry') === '1'

  const { data, error } = await supabaseAdmin
    .from('substitution_assignments')
    .select('id, substitute_teacher_id, timetable_sections(subject, timetable_periods(name, order_index), class_groups(name)), teacher_absences(teacher_id), lesson_plans(topic), learning_lessons(title)')
    .eq('class_date', jamaicaToday())
    .eq('status', 'assigned')
    .is('reminded_at', null)
    .not('substitute_teacher_id', 'is', null)
  if (error) {
    // Migration 075 not applied yet, or the tables are missing: nothing to do.
    return NextResponse.json({ skipped: error.message })
  }
  const rows = (data || []) as unknown as Row[]
  if (rows.length === 0) return NextResponse.json({ sent: 0, classes: 0 })

  const byPerson = new Map<string, Row[]>()
  for (const r of rows) byPerson.set(r.substitute_teacher_id, [...(byPerson.get(r.substitute_teacher_id) || []), r])
  const { data: people } = await supabaseAdmin.from('profiles').select('id, full_name').in('id', [...byPerson.keys(), ...rows.map((r) => r.teacher_absences?.teacher_id).filter(Boolean) as string[]])
  const nameOf = new Map((people || []).map((p) => [p.id as string, p.full_name as string]))
  const origin = req.nextUrl.origin

  let sent = 0
  for (const [personId, list] of byPerson) {
    const classes = list
      .sort((a, b) => (a.timetable_sections?.timetable_periods?.order_index ?? 0) - (b.timetable_sections?.timetable_periods?.order_index ?? 0))
      .map((r) => {
        const lesson = r.lesson_plans?.topic ? `${r.lesson_plans.topic} (lesson plan)` : r.learning_lessons?.title ? `${r.learning_lessons.title} (Smart Learning)` : ''
        return {
          when: 'Today',
          what: [r.timetable_sections?.timetable_periods?.name, r.timetable_sections?.subject, r.timetable_sections?.class_groups?.name].filter(Boolean).join(' · '),
          note: `For ${nameOf.get(r.teacher_absences?.teacher_id || '') || 'a colleague'}${lesson ? `. Lesson: ${lesson}` : ''}`,
        }
      })
    if (dry) { sent++; continue }
    const to = await emailFor(supabaseAdmin, personId)
    if (!to) continue
    try {
      const { subject, html } = substitutionReminderEmail(nameOf.get(personId) || 'there', classes, `${origin}/teacher/cover`)
      await sendEmail({ to, subject, html, from: EMAIL_FROM.notifications })
      sent++
      // Marked only after a message went out, so a failure is retried on the next run. They are told now, so they are
      // also counted as notified.
      await supabaseAdmin.from('substitution_assignments').update({ reminded_at: new Date().toISOString(), substitute_notified_id: personId, substitute_notified_at: new Date().toISOString() }).in('id', list.map((r) => r.id))
    } catch (err) {
      console.error('substitution reminder email failed:', err)
    }
  }
  return NextResponse.json(dry ? { dry: true, people: sent, classes: rows.length } : { sent, classes: rows.length })
}
