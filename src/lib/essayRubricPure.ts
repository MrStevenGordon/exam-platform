// Marking points for an essay question, kept free of imports so each rule can be tested on its own
// (scripts/tests/essay-marking/essayRubricPure.test.mjs).

export type EssayPoint = { text: string; marks: number }
// What an editor holds while a teacher is typing: a point may be half written, and marks may be an empty box.
export type EssayPointDraft = { text: string; marks: number | string }

export const RUBRIC_LIMITS = { maxPoints: 12, maxText: 300, maxMarksPerPoint: 20, maxTotal: 100 } as const

const wholeMarks = (m: number | string): number | null => {
  const n = typeof m === 'number' ? m : Number(String(m).trim())
  return Number.isInteger(n) ? n : null
}

// The points a teacher has actually written: blank rows are dropped, text is trimmed. Marks are left as typed so checkRubric can say what is wrong.
export function writtenPoints(rows: EssayPointDraft[]): EssayPointDraft[] {
  return rows.map((r) => ({ text: r.text.trim(), marks: r.marks })).filter((r) => r.text !== '')
}

export function rubricTotal(points: Array<{ marks: number }>): number {
  return points.reduce((sum, p) => sum + p.marks, 0)
}

// null when the rows are fine (or empty: an essay does not have to have marking points), otherwise a sentence for the teacher.
// Rows with no description are simply ignored, so the blank row an editor starts with never causes an error.
export function checkRubric(rows: EssayPointDraft[]): string | null {
  const written = writtenPoints(rows)
  if (written.length === 0) return null
  if (written.length > RUBRIC_LIMITS.maxPoints) return `Use at most ${RUBRIC_LIMITS.maxPoints} marking points.`
  for (let i = 0; i < written.length; i++) {
    const w = written[i]
    if (w.text.length > RUBRIC_LIMITS.maxText) return `Marking point ${i + 1} is too long. Keep it under ${RUBRIC_LIMITS.maxText} characters.`
    const m = wholeMarks(w.marks)
    if (m === null || m < 1) return `Marking point ${i + 1} needs a whole number of marks, 1 or more.`
    if (m > RUBRIC_LIMITS.maxMarksPerPoint) return `Marking point ${i + 1} is worth too many marks. The most is ${RUBRIC_LIMITS.maxMarksPerPoint}.`
  }
  const total = rubricTotal(written.map((w) => ({ marks: wholeMarks(w.marks) as number })))
  if (total > RUBRIC_LIMITS.maxTotal) return `The marking points add up to ${total} marks. The most is ${RUBRIC_LIMITS.maxTotal}.`
  return null
}

// What gets saved: null for no marking points, otherwise the clean list. Call checkRubric first.
export function cleanRubric(rows: EssayPointDraft[]): EssayPoint[] | null {
  const written = writtenPoints(rows)
  if (written.length === 0) return null
  return written.map((w) => ({ text: w.text, marks: wholeMarks(w.marks) as number }))
}

// Reads whatever the database holds back into editable rows. Anything that is not a sensible list gives no rows.
export function parseStoredRubric(value: unknown): EssayPoint[] {
  if (!Array.isArray(value)) return []
  const out: EssayPoint[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const text = (item as { text?: unknown }).text
    const marks = (item as { marks?: unknown }).marks
    if (typeof text === 'string' && text.trim() !== '' && typeof marks === 'number' && Number.isFinite(marks) && marks > 0) out.push({ text: text.trim(), marks })
  }
  return out
}
