// How the student exam pages load questions and submit answers.
//
// Migration 066 adds server-side functions so that the correct answers and marking guide never reach the
// student's browser and the marks are worked out by the database, not by the student's device. This module
// calls those functions. If the database has not had 066 applied yet (PGRST202, "function not found"), each
// call falls back to the original behaviour, so the app can be deployed before or after the migration and an
// exam in progress is never broken by either order.
import { supabase } from '@/lib/supabase'
import { gradeAnswer, gradeMultiPoint } from '@/lib/grading'
import type { IntegritySignals } from '@/hooks/useIntegrityCapture'

export type ExamKind = 'final' | 'direct'

// A question as the student sees it: no correct answer, no marking guide (only whether there is one).
export type ExamQuestion = {
  id: string
  question_type: string
  question_text: string
  points: number
  options: string[] | null
  order_index: number
  has_marking_points: boolean
  total_marks: number | null
  section_id: string | null
  image_url: string | null
  audio_url: string | null
  video_url: string | null
  show_working: boolean | null
}

type LegacyKey = { correct_answer: string | null; marking_points: any[] | null }
type LegacyKeys = Record<string, LegacyKey>

export type LoadedQuestions = { questions: ExamQuestion[]; legacyKeys: LegacyKeys | null }

export type IntegrityBySlot = Record<string, { answer?: IntegritySignals; working?: IntegritySignals }>

export type SubmitResult = {
  totalScore: number
  maxScore: number
  fullyGraded: boolean
  alreadySubmitted: boolean
  late: boolean
}

// PostgREST answers PGRST202 (or a 404 with this wording) when the function has not been created yet.
function functionMissing(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false
  return error.code === 'PGRST202' || /Could not find the function|schema cache/i.test(error.message ?? '')
}

function toExamQuestion(q: any, orderIndex: number): ExamQuestion {
  return {
    id: q.id,
    question_type: q.question_type,
    question_text: q.question_text,
    points: q.points,
    options: q.options ?? null,
    order_index: orderIndex,
    // The function reports it as a yes/no; the old table read has the marking points themselves.
    has_marking_points: typeof q.has_marking_points === 'boolean' ? q.has_marking_points : Array.isArray(q.marking_points) && q.marking_points.length > 0,
    total_marks: q.total_marks ?? null,
    section_id: q.section_id ?? null,
    image_url: q.image_url ?? null,
    audio_url: q.audio_url ?? null,
    video_url: q.video_url ?? null,
    show_working: q.show_working ?? null,
  }
}

// The original way: read the questions straight from the table (which includes the answer key).
async function loadQuestionsLegacy(kind: ExamKind, examId: string): Promise<LoadedQuestions> {
  const cols = 'id, question_type, question_text, points, options, correct_answer, marking_points, total_marks, section_id, image_url, audio_url, video_url, show_working'
  const rows: { q: any; order: number }[] = []
  if (kind === 'final') {
    const { data, error } = await supabase
      .from('final_exam_questions')
      .select(`order_index, questions(${cols})`)
      .eq('final_exam_id', examId)
      .order('order_index', { ascending: true })
    if (error) throw error
    for (const l of data || []) {
      const q = Array.isArray((l as any).questions) ? (l as any).questions[0] : (l as any).questions
      if (q?.id) rows.push({ q, order: (l as any).order_index })
    }
  } else {
    const { data, error } = await supabase
      .from('questions')
      .select(`order_index, ${cols}`)
      .eq('draft_exam_id', examId)
      .order('order_index', { ascending: true })
    if (error) throw error
    for (const q of data || []) rows.push({ q, order: (q as any).order_index })
  }
  const legacyKeys: LegacyKeys = {}
  for (const { q } of rows) legacyKeys[q.id] = { correct_answer: q.correct_answer ?? null, marking_points: q.marking_points ?? null }
  return { questions: rows.map(({ q, order }) => toExamQuestion(q, order)), legacyKeys }
}

// The questions of an exam the student has started, in exam order, without any answers.
export async function loadExamQuestions(kind: ExamKind, examId: string): Promise<LoadedQuestions> {
  const { data, error } = await supabase.rpc('student_exam_questions', { p_kind: kind, p_exam_id: examId })
  if (error) {
    if (functionMissing(error)) return loadQuestionsLegacy(kind, examId)
    throw error
  }
  return { questions: ((data || []) as any[]).map((q) => toExamQuestion(q, q.order_index)), legacyKeys: null }
}

// How many questions an exam has (for the start page). Falls back to counting the rows the student can read.
export async function loadQuestionCount(kind: ExamKind, examId: string): Promise<number> {
  const { data, error } = await supabase.rpc('student_exam_meta', { p_kind: kind, p_exam_id: examId })
  if (!error && data && typeof (data as any).question_count === 'number') return (data as any).question_count
  if (error && !functionMissing(error)) throw error
  if (kind === 'final') {
    const { count } = await supabase.from('final_exam_questions').select('question_id', { count: 'exact', head: true }).eq('final_exam_id', examId)
    return count ?? 0
  }
  const { count } = await supabase.from('questions').select('id', { count: 'exact', head: true }).eq('draft_exam_id', examId)
  return count ?? 0
}

// Integrity notes are appended to the violation log while the session is still open; once it is completed the
// database only lets staff add to it. Remember what was sent so a retried submit does not repeat the entry.
const loggedIntegrity = new Set<string>()

async function logIntegrity(sessionId: string, reason: string | null) {
  if (!reason || loggedIntegrity.has(sessionId)) return
  const { error } = await supabase.rpc('append_violation_log', {
    session_id: sessionId,
    entry: { type: 'integrity', reason, timestamp: new Date().toISOString() },
  })
  if (!error) loggedIntegrity.add(sessionId)
}

export type SubmitInput = {
  kind: ExamKind
  sessionId: string
  examId: string
  questions: ExamQuestion[]
  legacyKeys: LegacyKeys | null
  answers: Record<string, string>
  workings: Record<string, string>
  integrity: IntegrityBySlot
  integrityFlags: string[]
  // Direct exams only: an uploaded file, saved on the session before it is completed.
  file?: { url: string | null; name: string | null }
}

// Submit the exam. The database marks it. Returns what the database worked out.
export async function submitExam(input: SubmitInput): Promise<SubmitResult> {
  const { sessionId } = input
  const flagged = input.integrityFlags.length > 0

  if (input.file && (input.file.url || input.file.name)) {
    // 42501: the session is already submitted (e.g. a second tab), so let the submit below report that.
    const { error } = await supabase.from('exam_sessions').update({ file_submission_url: input.file.url, file_submission_name: input.file.name }).eq('id', sessionId)
    if (error && error.code !== '42501') throw error
  }
  await logIntegrity(sessionId, flagged ? input.integrityFlags.join(', ') : null)

  const { data, error } = await supabase.rpc('student_submit_exam', {
    p_session_id: sessionId,
    p_answers: input.answers,
    p_workings: input.workings,
    p_integrity: input.integrity,
    p_flagged: flagged,
  })
  if (!error && data) {
    const r = data as any
    return { totalScore: Number(r.total_score ?? 0), maxScore: Number(r.max_possible_score ?? 0), fullyGraded: !!r.fully_graded, alreadySubmitted: !!r.already_submitted, late: !!r.late }
  }
  if (error && !functionMissing(error)) throw error
  return submitLegacy(input, flagged)
}

// The original way: mark in the browser and write the marks. Used only until migration 066 is applied.
async function submitLegacy(input: SubmitInput, flagged: boolean): Promise<SubmitResult> {
  const { kind, sessionId, questions } = input
  let keys = input.legacyKeys
  if (!keys) keys = (await loadQuestionsLegacy(kind, input.examId)).legacyKeys!

  let score = 0
  let max = 0
  let hasEssay = false
  const now = new Date().toISOString()
  const rows = questions.map((q) => {
    const answer = input.answers[q.id] || ''
    const key = keys![q.id] ?? { correct_answer: null, marking_points: null }
    const gradable = { question_type: q.question_type, points: q.points, correct_answer: key.correct_answer, marking_points: key.marking_points }
    let awarded: number | null
    if (kind === 'final' && key.marking_points && key.marking_points.length > 0) {
      // Final exams mark any question that has marking points by keyword, whatever its type.
      const boxes = answer.split('\n').map((a) => a.trim()).filter(Boolean)
      awarded = gradeMultiPoint(gradable, boxes.length > 0 ? boxes : [answer])
    } else {
      awarded = gradeAnswer(gradable, answer)
    }
    if (awarded === null) hasEssay = true
    else score += awarded
    max += q.points
    return {
      session_id: sessionId, question_id: q.id, answer, working: input.workings[q.id] || null,
      points_awarded: awarded, graded_at: awarded !== null ? now : null, integrity_signals: input.integrity[q.id] ?? null,
    }
  })

  await supabase.from('responses').delete().eq('session_id', sessionId)
  if (rows.length > 0) {
    const { error } = await supabase.from('responses').insert(rows)
    if (error) throw error
  }
  const { error } = await supabase
    .from('exam_sessions')
    .update({ status: 'completed', completed_at: now, total_score: score, max_possible_score: max, fully_graded: !hasEssay, ...(flagged ? { flagged: true } : {}) })
    .eq('id', sessionId)
  if (error) throw error
  return { totalScore: score, maxScore: max, fullyGraded: !hasEssay, alreadySubmitted: false, late: false }
}

// ---- review after results are released -------------------------------------------------------------------------

export type ReviewRow = {
  response_id: string
  question_id: string
  order_index: number
  question_text: string
  question_type: string
  options: string[] | null
  points: number
  correct_answer: string | null
  answer: string | null
  points_awarded: number | null
}

// The student's own answers with the correct answers, only once the teacher has released the results.
// Returns null when the database does not have 066 yet, so the caller keeps using its existing query.
export async function loadReview(kind: ExamKind, examId: string): Promise<ReviewRow[] | null> {
  const { data, error } = await supabase.rpc('student_exam_review', { p_kind: kind, p_exam_id: examId })
  if (error) {
    if (functionMissing(error)) return null
    throw error
  }
  return (data || []) as ReviewRow[]
}
