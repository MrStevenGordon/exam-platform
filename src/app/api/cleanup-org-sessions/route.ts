import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!
)

// Deletes respondent data past its exam's retention window. Cascades to
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

  return NextResponse.json({ deletedSessions: deletedCount })
}
