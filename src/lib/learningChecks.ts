import { supabase } from '@/lib/supabase'

export type CheckKind = 'multiple_choice' | 'numeric'

export const MAX_CHECK_QUESTIONS = 10
export const MIN_OPTIONS = 2
export const MAX_OPTIONS = 6

// A question as stored (what the teacher can read).
export type CheckQuestion = {
  id: string
  lesson_id: string
  position: number
  kind: CheckKind
  prompt: string
  options: string[] | null
  correct_index: number | null
  correct_number: number | null
  tolerance: number
  explanation: string
}

// A question while it is being written: everything is text so half-typed values are fine.
export type QuestionDraft = {
  kind: CheckKind
  prompt: string
  options: string[]
  correctIndex: number | null
  correctNumber: string
  tolerance: string
  explanation: string
}

export function emptyDraft(kind: CheckKind = 'multiple_choice'): QuestionDraft {
  return { kind, prompt: '', options: ['', '', ''], correctIndex: null, correctNumber: '', tolerance: '', explanation: '' }
}

export function draftFromQuestion(q: CheckQuestion): QuestionDraft {
  return {
    kind: q.kind,
    prompt: q.prompt,
    options: q.kind === 'multiple_choice' ? [...(q.options ?? [])] : ['', '', ''],
    correctIndex: q.correct_index,
    correctNumber: q.correct_number === null ? '' : String(q.correct_number),
    tolerance: q.tolerance ? String(q.tolerance) : '',
    explanation: q.explanation,
  }
}

// The same reading of a typed number the database uses: spaces and commas are ignored,
// so "1 250" and "1,250" are both 1250. Anything else that is not a plain number is rejected.
export function parseNumber(text: string): number | null {
  const t = text.replace(/[\s,]/g, '')
  if (!/^-?([0-9]{1,15}(\.[0-9]{0,10})?|\.[0-9]{1,10})$/.test(t)) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

// Returns a message for the teacher, or null when the draft is fine. Mirrors the database's rules,
// so the teacher hears about a problem before saving rather than as a database error.
export function validateDraft(d: QuestionDraft): string | null {
  if (!d.prompt.trim()) return 'Write the question first.'
  if (d.prompt.length > 2000) return 'The question is too long (up to 2000 characters).'
  if (d.explanation.length > 1000) return 'The explanation is too long (up to 1000 characters).'
  if (d.kind === 'multiple_choice') {
    if (d.options.length < MIN_OPTIONS || d.options.length > MAX_OPTIONS) return `A multiple choice question needs ${MIN_OPTIONS} to ${MAX_OPTIONS} answers.`
    if (d.options.some((o) => !o.trim())) return 'Every answer needs some text. Remove any you do not need.'
    if (d.options.some((o) => o.length > 300)) return 'An answer is too long (up to 300 characters).'
    if (d.correctIndex === null || d.correctIndex < 0 || d.correctIndex >= d.options.length) return 'Choose which answer is correct.'
    return null
  }
  const n = parseNumber(d.correctNumber)
  if (n === null) return 'Type the correct answer as a number, for example 150 or 2.5.'
  if (Math.abs(n) >= 1e12) return 'That number is too large.'
  if (d.tolerance.trim()) {
    const t = parseNumber(d.tolerance)
    if (t === null || t < 0) return 'The allowed difference must be a number that is 0 or more.'
  }
  return null
}

// The row to save. Fields that do not apply to the kind are left null, as the database expects.
export function draftToRow(d: QuestionDraft) {
  const base = { kind: d.kind, prompt: d.prompt.trim(), explanation: d.explanation.trim() }
  if (d.kind === 'multiple_choice') {
    return { ...base, options: d.options.map((o) => o.trim()), correct_index: d.correctIndex, correct_number: null, tolerance: 0 }
  }
  return { ...base, options: null, correct_index: null, correct_number: parseNumber(d.correctNumber), tolerance: d.tolerance.trim() ? parseNumber(d.tolerance) ?? 0 : 0 }
}

// What a student sees before answering: no right answers.
export type StudentQuestion = { id: string; kind: CheckKind; prompt: string; options: string[] | null }
export type CheckOverview = {
  questions: StudentQuestion[]
  attempts: number
  first_try_score: number | null
  first_try_max: number | null
  best_score: number | null
}
export type CheckFeedback = { question_id: string; correct: boolean; correct_answer: string; explanation: string }
export type CheckSubmission = { attempt_no: number; first_try: boolean; score: number; max: number; results: CheckFeedback[] }

// Teacher-side result rows.
export type CheckResultRow = {
  student_id: string; student_name: string; student_code: string | null; class_group_id: string; class_name: string
  attempts: number; first_score: number | null; first_max: number | null; best_score: number | null; last_at: string | null
}
export type ItemStat = { question_id: string; question_position: number; prompt: string; answered: number; correct: number }

export function percent(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0
}

let availability: Promise<boolean> | null = null

// Check questions need migration 060. Until it is applied, every check screen stays hidden.
// Available means the query worked or was refused for permission (only true when the table exists).
export function isChecksAvailable(): Promise<boolean> {
  if (!availability) {
    availability = (async () => {
      try {
        const { error } = await supabase.from('learning_check_questions').select('id').limit(1)
        return !error || error.code === '42501'
      } catch {
        return false
      }
    })()
  }
  return availability
}
