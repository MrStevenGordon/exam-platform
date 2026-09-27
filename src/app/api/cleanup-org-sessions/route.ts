import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!
)

// Two things run here, both daily: deletes respondent data past its exam's retention window. Cascades to
// org_exam_responses and org_respondent_field_values automatically (FK
// ON DELETE CASCADE) — the exam itself and its questions are untouched, so
// an organization can republish the same exam for its next round.
// Called daily by Vercel Cron (see vercel.json); guarded by CRON_SECRET so
// nothing else can trigger a mass-delete.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: exams, error: examsError } = await supabaseAdmin
    .from('org_exams')
    .select('id, retention_days')

  if (examsError) {
    return NextResponse.json({ error: examsError.message }, { status: 500 })
  }

  let deletedCount = 0
  for (const exam of exams || []) {
    const cutoff = new Date(Date.now() - exam.retention_days * 24 * 60 * 60 * 1000).toISOString()
    const { data: deleted, error } = await supabaseAdmin
      .from('org_exam_sessions')
      .delete()
      .eq('org_exam_id', exam.id)
      .not('submitted_at', 'is', null)
      .lt('submitted_at', cutoff)
      .select('id')

    if (error) {
      console.error(`Cleanup failed for exam ${exam.id}:`, error.message)
      continue
    }
    deletedCount += deleted?.length || 0
  }

  // Rate-limit counters are keyed by ip/user + endpoint and self-reset per
  // window, but rows for keys that never come back would otherwise
  // accumulate forever — sweep anything untouched for a day.
  const rateLimitCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  await supabaseAdmin.from('rate_limits').delete().lt('window_start', rateLimitCutoff)

  // AI tutor conversations: kept for a fixed number of days after the last message, then the whole
  // conversation (and its messages, by cascade) is removed. The school agreed 30 days; this is deliberately
  // a plain constant rather than a school setting, since nothing else asks for it to be configurable — change
  // it here if the school later asks for a different number. Bundled into this same daily cron (rather than a
  // second cron entry in vercel.json) since the account is not on a plan that allows more than one.
  const TUTOR_RETENTION_DAYS = 30
  const tutorCutoff = new Date(Date.now() - TUTOR_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const { data: deletedTutorConversations, error: tutorError } = await supabaseAdmin
    .from('learning_tutor_conversations')
    .delete()
    .lt('last_message_at', tutorCutoff)
    .select('id')
  if (tutorError) console.error('Tutor conversation cleanup failed:', tutorError.message)

  return NextResponse.json({ deletedSessions: deletedCount, deletedTutorConversations: deletedTutorConversations?.length || 0 })
}
