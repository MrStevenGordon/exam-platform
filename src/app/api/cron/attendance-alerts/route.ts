import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail, EMAIL_FROM } from '@/lib/email'
import { buildAlertDigest } from '@/lib/attendanceAlerts'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!
)

// Emails principals a digest of new attendance alerts. Not scheduled by
// default: to switch it on, add a cron entry for this path in vercel.json
// (every 5 minutes needs a Vercel plan that allows sub-daily crons). Alerts
// already reach principals inside the portal without it. Guarded by
// CRON_SECRET like the other cron route; add ?dry=1 to see what would be sent
// without sending or marking anything.
export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const dry = req.nextUrl.searchParams.get('dry') === '1'

  // Raise any "class not started" alerts that are due (late starts and truancy
  // alerts are raised the instant they happen, by database triggers).
  const { error: refreshError } = await supabaseAdmin.rpc('refresh_attendance_alerts')
  if (refreshError) console.error('attendance alert refresh failed:', refreshError.message)

  const since = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
  const { data: pending, error } = await supabaseAdmin
    .from('attendance_alerts')
    .select('id, kind, message')
    .is('emailed_at', null)
    .is('resolved_at', null)
    .gt('created_at', since)
    .order('created_at')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!pending || pending.length === 0) return NextResponse.json({ sent: 0, alerts: 0 })

  const { data: principals } = await supabaseAdmin.from('profiles').select('id, school_email').eq('role', 'principal').neq('is_active', false)
  const recipients: string[] = []
  for (const p of principals || []) {
    const email = p.school_email || (await supabaseAdmin.auth.admin.getUserById(p.id)).data.user?.email
    if (email) recipients.push(email)
  }
  if (recipients.length === 0) return NextResponse.json({ sent: 0, alerts: pending.length, note: 'No principal email addresses on file.' })

  const { subject, html } = buildAlertDigest(pending, process.env.NEXT_PUBLIC_SCHOOL_NAME || 'your school')
  if (dry) return NextResponse.json({ dry: true, recipients: recipients.length, alerts: pending.length, subject })

  let sent = 0
  for (const to of recipients) {
    try { await sendEmail({ to, subject, html, from: EMAIL_FROM.notifications }); sent++ } catch (err) { console.error('attendance alert email failed:', err) }
  }
  // Only mark them emailed if at least one message went out, so a failure retries next run.
  if (sent > 0) await supabaseAdmin.from('attendance_alerts').update({ emailed_at: new Date().toISOString() }).in('id', pending.map((a) => a.id))
  return NextResponse.json({ sent, alerts: pending.length })
}
