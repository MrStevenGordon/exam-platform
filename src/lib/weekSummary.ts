import { supabase } from '@/lib/supabase'
import { loadMyTopics } from '@/lib/studentTopics'
import { computeTopics } from '@/lib/studentTopicsPure'
import { DAY, jamaicaDate, studentWeek, teacherWeek, type CardItem, type CheckItem, type ClassWeek, type LessonItem, type ResultRow, type StudentWeek, type TeacherCompletion, type TeacherLesson, type TeacherSession, type TeacherStudent, type TeacherUpcoming, type UpcomingItem } from '@/lib/weekSummaryPure'

// Loads what the weekly summary needs, using the signed-in person's own access (nothing here widens it). Each part is read on its own
// and a part that cannot be read (a feature not installed, no access) is simply left out, so one missing piece never blanks the page.

type Rows = Array<Record<string, any>> // eslint-disable-line @typescript-eslint/no-explicit-any

async function part<T>(fn: () => PromiseLike<T>, fallback: T): Promise<T> {
  try { return await fn() } catch { return fallback }
}
const rows = (res: { data: unknown; error: unknown }): Rows => (res.error || !Array.isArray(res.data) ? [] : (res.data as Rows))
const pctOf = (score: unknown, max: unknown) => (Number(max) > 0 ? Math.round((Number(score) / Number(max)) * 100) : null)

const TEST_KINDS = ['pop_quiz', 'class_test', 'weekly_test']
const TASK_KINDS = ['assignment', 'homework', 'group_project']
const kindOf = (examKind: string | null): 'exam' | 'test' | 'task' => (examKind && TASK_KINDS.includes(examKind) ? 'task' : examKind && TEST_KINDS.includes(examKind) ? 'test' : 'exam')
const hrefFor = (kind: 'exam' | 'test' | 'task', id: string, type: 'final' | 'direct') => (type === 'final' ? `/student/exam/${id}` : kind === 'task' ? '/student/tasks' : `/student/direct-exam/${id}`)

export async function loadStudentWeek(now: Date = new Date()): Promise<StudentWeek | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const since = new Date(now.getTime() - 60 * DAY).toISOString()
  const since14 = new Date(now.getTime() - 14 * DAY).toISOString()

  const [finalSessions, directSessions, topicsRes, lessonsRes, checksRes, cardsRes, takenRes, enrolRes] = await Promise.all([
    part(async () => rows(await supabase.from('exam_sessions').select('total_score, max_possible_score, completed_at, final_exams(title, subject)').eq('student_id', user.id).eq('status', 'completed').eq('results_released', true).not('final_exam_id', 'is', null).gte('completed_at', since).order('completed_at', { ascending: false }).limit(50)), [] as Rows),
    part(async () => rows(await supabase.from('exam_sessions').select('total_score, max_possible_score, completed_at, draft_exams(title, subject)').eq('student_id', user.id).eq('status', 'completed').eq('results_released', true).not('draft_exam_id', 'is', null).gte('completed_at', since).order('completed_at', { ascending: false }).limit(50)), [] as Rows),
    part(() => loadMyTopics(), { ok: false as const, reason: 'failed' as const }),
    part(async () => rows(await supabase.rpc('learning_student_lessons')), [] as Rows),
    part(async () => rows(await supabase.from('learning_check_attempts').select('lesson_id, attempt_no, score, max_score, submitted_at').eq('student_id', user.id).gte('submitted_at', since14)), [] as Rows),
    part(async () => rows(await supabase.from('flashcards').select('due_at, last_reviewed_at')), [] as Rows),
    part(async () => rows(await supabase.from('exam_sessions').select('final_exam_id, draft_exam_id').eq('student_id', user.id)), [] as Rows),
    part(async () => rows(await supabase.from('enrollments').select('class_group_id').eq('student_id', user.id)), [] as Rows),
  ])

  const results: ResultRow[] = []
  for (const s of finalSessions) { const pct = pctOf(s.total_score, s.max_possible_score); if (pct !== null) results.push({ title: s.final_exams?.title || 'Exam', subject: s.final_exams?.subject || '', pct, at: s.completed_at }) }
  for (const s of directSessions) { const pct = pctOf(s.total_score, s.max_possible_score); if (pct !== null) results.push({ title: s.draft_exams?.title || 'Test', subject: s.draft_exams?.subject || '', pct, at: s.completed_at }) }

  const topics = topicsRes.ok ? computeTopics(topicsRes.rows) : []
  const lessons: LessonItem[] = lessonsRes.map((l) => ({ id: l.lesson_id, title: l.title, subject: l.subject || '', dueDate: l.due_date ?? null, completedAt: l.completed_at ?? null }))
  const checks: CheckItem[] = checksRes.map((c) => ({ lessonId: c.lesson_id, attemptNo: Number(c.attempt_no), score: Number(c.score), max: Number(c.max_score), submittedAt: c.submitted_at }))
  const cards: CardItem[] = cardsRes.map((c) => ({ dueAt: c.due_at, lastReviewedAt: c.last_reviewed_at ?? null }))

  // Tests, exams and tasks open to this student that they have not sat yet (the same idea as the Upcoming box on the home page).
  const takenFinal = new Set(takenRes.filter((t) => t.final_exam_id).map((t) => t.final_exam_id))
  const takenDirect = new Set(takenRes.filter((t) => t.draft_exam_id).map((t) => t.draft_exam_id))
  const classIds = enrolRes.map((e) => e.class_group_id)
  const [finals, directs] = await Promise.all([
    part(async () => rows(await supabase.from('final_exams').select('id, title, subject, exam_category, available_until').order('published_at', { ascending: false }).limit(20)), [] as Rows),
    part(async () => (classIds.length ? rows(await supabase.from('draft_exam_class_groups').select('draft_exams!draft_exam_class_groups_draft_exam_id_fkey(id, title, subject, exam_kind, available_until)').in('class_group_id', classIds).limit(40)) : []), [] as Rows),
  ])
  const upcoming: UpcomingItem[] = [
    ...finals.filter((e) => !takenFinal.has(e.id)).map((e) => ({ kind: 'exam' as const, title: e.title, subject: e.subject || '', dueAt: e.available_until ?? null, href: hrefFor('exam', e.id, 'final') })),
    ...directs.map((d) => d.draft_exams).filter((e) => e && !takenDirect.has(e.id)).map((e) => { const k = kindOf(e.exam_kind); return { kind: k, title: e.title, subject: e.subject || '', dueAt: e.available_until ?? null, href: hrefFor(k, e.id, 'direct') } }),
  ]
  return studentWeek({ now, results, topics, lessons, checks, cards, upcoming })
}

export type TeacherWeekLoad = { classes: ClassWeek[]; note: string | null }

export async function loadTeacherWeek(now: Date = new Date()): Promise<TeacherWeekLoad | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const mine = rows(await supabase.from('teacher_class_groups').select('class_group_id, class_groups(id, name)').eq('teacher_id', user.id))
  const classes = mine.map((m) => (Array.isArray(m.class_groups) ? m.class_groups[0] : m.class_groups)).filter(Boolean).map((c: any) => ({ id: c.id as string, name: c.name as string })) // eslint-disable-line @typescript-eslint/no-explicit-any
  if (classes.length === 0) return { classes: [], note: 'You are not set up as the teacher of any class yet, so there is nothing to summarise.' }
  const classIds = classes.map((c) => c.id)
  const since = new Date(now.getTime() - 15 * DAY).toISOString()

  const enrol = rows(await supabase.from('enrollments').select('student_id, class_group_id').in('class_group_id', classIds))
  const studentIds = [...new Set(enrol.map((e) => e.student_id as string))]
  const profiles = studentIds.length ? rows(await supabase.from('profiles').select('id, full_name').in('id', studentIds)) : []
  const nameOf = new Map(profiles.map((p) => [p.id as string, (p.full_name as string) || 'Student']))
  const students: TeacherStudent[] = enrol.map((e) => ({ id: e.student_id, name: nameOf.get(e.student_id) ?? 'Student', classId: e.class_group_id }))

  const [finalS, directS, assignments, finalUp, directUp] = await Promise.all([
    part(async () => (studentIds.length ? rows(await supabase.from('exam_sessions').select('student_id, total_score, max_possible_score, completed_at, final_exams(title, subject)').in('student_id', studentIds).eq('status', 'completed').eq('fully_graded', true).not('final_exam_id', 'is', null).gte('completed_at', since).limit(1500)) : []), [] as Rows),
    part(async () => (studentIds.length ? rows(await supabase.from('exam_sessions').select('student_id, total_score, max_possible_score, completed_at, draft_exams(title, subject)').in('student_id', studentIds).eq('status', 'completed').eq('fully_graded', true).not('draft_exam_id', 'is', null).gte('completed_at', since).limit(1500)) : []), [] as Rows),
    // only lessons this teacher wrote: those are the ones whose progress they are allowed to read
    part(async () => rows(await supabase.from('learning_assignments').select('lesson_id, class_group_id, due_date, learning_lessons!inner(id, title, teacher_id, status)').in('class_group_id', classIds).eq('learning_lessons.teacher_id', user.id).eq('learning_lessons.status', 'published')), [] as Rows),
    part(async () => rows(await supabase.from('final_exam_class_groups').select('class_group_id, final_exams(id, title, subject, available_until)').in('class_group_id', classIds)), [] as Rows),
    part(async () => rows(await supabase.from('draft_exam_class_groups').select('class_group_id, draft_exams!draft_exam_class_groups_draft_exam_id_fkey(id, title, subject, available_until)').in('class_group_id', classIds)), [] as Rows),
  ])
  const sessions: TeacherSession[] = []
  for (const s of finalS) { const pct = pctOf(s.total_score, s.max_possible_score); if (pct !== null) sessions.push({ studentId: s.student_id, title: s.final_exams?.title || 'Exam', subject: s.final_exams?.subject || '', pct, at: s.completed_at }) }
  for (const s of directS) { const pct = pctOf(s.total_score, s.max_possible_score); if (pct !== null) sessions.push({ studentId: s.student_id, title: s.draft_exams?.title || 'Test', subject: s.draft_exams?.subject || '', pct, at: s.completed_at }) }

  const lessons: TeacherLesson[] = assignments.map((a) => { const l = Array.isArray(a.learning_lessons) ? a.learning_lessons[0] : a.learning_lessons; return { lessonId: a.lesson_id, title: l?.title || 'Lesson', classId: a.class_group_id, dueDate: a.due_date ?? null } })
  const lessonIds = [...new Set(lessons.map((l) => l.lessonId))]
  const progress = lessonIds.length ? await part(async () => rows(await supabase.from('learning_progress').select('lesson_id, student_id').in('lesson_id', lessonIds).not('completed_at', 'is', null)), [] as Rows) : []
  const completions: TeacherCompletion[] = progress.map((p) => ({ lessonId: p.lesson_id, studentId: p.student_id }))

  const upcoming: TeacherUpcoming[] = [
    ...finalUp.filter((r) => r.final_exams).map((r) => ({ title: r.final_exams.title, subject: r.final_exams.subject || '', classId: r.class_group_id, dueAt: r.final_exams.available_until ?? null, href: '/teacher/tests' })),
    ...directUp.filter((r) => r.draft_exams).map((r) => ({ title: r.draft_exams.title, subject: r.draft_exams.subject || '', classId: r.class_group_id, dueAt: r.draft_exams.available_until ?? null, href: `/teacher/exam/${r.draft_exams.id}` })),
  ]
  void jamaicaDate
  return { classes: teacherWeek({ now, classes, students, sessions, lessons, completions, upcoming }), note: null }
}
