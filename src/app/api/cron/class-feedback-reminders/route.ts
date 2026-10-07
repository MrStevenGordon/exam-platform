import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail, EMAIL_FROM } from '@/lib/email'
import { classFeedbackReminderEmail, type FeedbackReminderClass } from '@/lib/emailTemplates'
import { emailFor } from '@/lib/substitutionServer'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!
)

type Candidate = { teacher_id: string; teacher_name: string; classes: FeedbackReminderClass[] }

// The Friday reminder: emails each teacher or head of department who still has a class without an end-of-week reflection. Scheduled in
// vercel.json for Friday 2:00pm Jamaica time (Jamaica is UTC-5 all year, so "0 19 * * 5"). A teacher gets at most one email a week (the
// database keeps a small log, written only after the message went out, so a failure is retried on the next run). Guarded by CRON_SECRET like
// the other cron routes; add ?dry=1 to see how many people would be emailed without sending anything.
export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const dry = req.nextUrl.searchParams.get('dry') === '1'

  const { data, error } = await supabaseAdmin.rpc('class_feedback_reminder_candidates')
  if (error) return NextResponse.json({ skipped: error.message })      // migration 091 not applied yet: nothing to do
  const people = (data || []) as Candidate[]
  if (dry) return NextResponse.json({ dry: true, people: people.length })

  const { data: week } = await supabaseAdmin.rpc('school_today')
  const weekStart = mondayOf(String(week || new Date().toISOString().slice(0, 10)))
  const url = `${req.nextUrl.origin}/learning/feedback`
  let sent = 0
  let noAddress = 0
  for (const p of people) {
    const to = await emailFor(supabaseAdmin, p.teacher_id)
    if (!to) { noAddress++; continue }
    try {
      const { subject, html } = classFeedbackReminderEmail(p.teacher_name || 'there', p.classes, url)
      await sendEmail({ to, subject, html, from: EMAIL_FROM.notifications })
      await supabaseAdmin.from('weekly_feedback_reminder_log').insert({ teacher_id: p.teacher_id, week_start: weekStart })
      sent++
    } catch (err) {
      console.error('class feedback reminder email failed:', err)
    }
  }
  return NextResponse.json({ sent, noAddress, people: people.length })
}

function mondayOf(date: string): string {
  const dt = new Date(`${date}T12:00:00Z`)
  dt.setUTCDate(dt.getUTCDate() - ((dt.getUTCDay() || 7) - 1))
  return dt.toISOString().slice(0, 10)
}
