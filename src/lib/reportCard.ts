import { supabase } from '@/lib/supabase'

export const TASK_KINDS = ['homework', 'assignment', 'group_project']

export function currentAcademicYear() {
  const now = new Date()
  const y = now.getFullYear()
  return now.getMonth() >= 7 ? `${y}-${y + 1}` : `${y - 1}-${y}`
}

export type SubjectGrade = { subject: string; percentage: number; sessionCount: number }

export async function computeSubjectGrades(
  studentId: string,
  term: { start_date: string; end_date: string }
): Promise<SubjectGrade[]> {
  const { data: finalSessions } = await supabase
    .from('exam_sessions')
    .select('total_score, max_possible_score, completed_at, final_exams(subject)')
    .eq('student_id', studentId)
    .eq('status', 'completed')
    .eq('results_released', true)
    .eq('fully_graded', true)
    .not('final_exam_id', 'is', null)
    .gte('completed_at', term.start_date)
    .lte('completed_at', term.end_date)

  const { data: draftSessions } = await supabase
    .from('exam_sessions')
    .select('total_score, max_possible_score, completed_at, draft_exams(subject, exam_kind)')
    .eq('student_id', studentId)
    .eq('status', 'completed')
    .eq('results_released', true)
    .eq('fully_graded', true)
    .not('draft_exam_id', 'is', null)
    .gte('completed_at', term.start_date)
    .lte('completed_at', term.end_date)

  const totals: Record<string, { score: number; max: number; count: number }> = {}

  for (const s of (finalSessions as any) || []) {
    const subject = s.final_exams?.subject
    if (!subject || !(s.max_possible_score > 0)) continue
    totals[subject] ||= { score: 0, max: 0, count: 0 }
    totals[subject].score += s.total_score
    totals[subject].max += s.max_possible_score
    totals[subject].count += 1
  }

  for (const s of (draftSessions as any) || []) {
    if (s.draft_exams?.exam_kind === 'final_exam_submission') continue
    const subject = s.draft_exams?.subject
    if (!subject || !(s.max_possible_score > 0)) continue
    totals[subject] ||= { score: 0, max: 0, count: 0 }
    totals[subject].score += s.total_score
    totals[subject].max += s.max_possible_score
    totals[subject].count += 1
  }

  return Object.entries(totals)
    .map(([subject, t]) => ({
      subject,
      percentage: Math.round((t.score / t.max) * 100),
      sessionCount: t.count,
    }))
    .sort((a, b) => a.subject.localeCompare(b.subject))
}
