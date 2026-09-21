import { lessonsForPlan, LESSON_FIELDS, type Lesson } from '@/lib/lessonPlan'

// What goes into an exported lesson plan (Word or PDF), decided once so the two
// formats always say the same thing.

export type PlanForDoc = {
  subject: string
  grade: string
  topic: string
  term?: string | null
  duration?: string | null
  unit_theme?: string | null
  focus_strand?: string | null
  focus_question?: string | null
  attainment_target?: string | null
  specific_objective?: string | null
  skills?: string | null
  prior_learning?: string | null
  materials?: string | null
  success_criteria?: string | null
  sub_topics?: string | null
  prerequisite_knowledge?: string | null
  four_cs?: string | null
  subject_practices?: string | null
  general_objectives?: string | null
  key_terms_formulae?: string | null
  lessons?: unknown
  engage?: string | null
  explore?: string | null
  explain?: string | null
  elaborate?: string | null
  evaluate?: string | null
}

export const LESSON_TABLE_HEADER: [string, string] = ['Component', 'Activities / Teaching and Learning']

export const nonEmpty = (v: string | null | undefined): v is string => typeof v === 'string' && v.trim().length > 0
export const textLines = (text: string) => text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
export const stripMarker = (l: string) => l.replace(/^(\d+[.)]|[-•*])\s+/, '')

export function planFileName(plan: Pick<PlanForDoc, 'grade' | 'topic'>, ext: 'docx' | 'pdf' = 'docx'): string {
  const clean = (s: string) => s.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  return `${clean(plan.grade) || 'Grade'}_${clean(plan.topic) || 'Lesson'}_5E_Lesson_Plan.${ext}`
}

export function planTitle(plan: PlanForDoc): string {
  return `5E LESSON PLAN – ${plan.topic.toUpperCase()}`
}

// Lessons that actually have something in them, in order.
export function filledLessons(plan: PlanForDoc): Lesson[] {
  return lessonsForPlan(plan).filter((l) => Object.values(l).some((v) => v.trim()))
}

export function planSubtitle(plan: PlanForDoc, lessonCount: number): string {
  const parts = [`${plan.grade} ${plan.subject}`.trim()]
  if (nonEmpty(plan.duration)) parts.push(plan.duration.trim())
  else if (lessonCount > 1) parts.push(`${lessonCount} lessons`)
  return parts.join(' | ')
}

export function overviewRows(plan: PlanForDoc): [string, string][] {
  const practicesLabel = /math/i.test(plan.subject) ? 'Mathematical Practices' : 'Subject Practices'
  const all: [string, string | null | undefined][] = [
    ['Topic', plan.topic],
    ['Sub-topics', plan.sub_topics],
    ['Grade', plan.grade],
    ['Term', plan.term],
    ['Duration', plan.duration],
    ['Unit & Theme', plan.unit_theme],
    ['Focus Strand', plan.focus_strand],
    ['Focus Question', plan.focus_question],
    ['Attainment Target', plan.attainment_target],
    ['Prerequisite Knowledge', plan.prerequisite_knowledge || plan.prior_learning],
    ['4Cs', plan.four_cs],
    [practicesLabel, plan.subject_practices],
    ['Specific Objective', plan.specific_objective],
    ['Skills', plan.skills],
    ['Materials', plan.materials],
    ['Success Criteria', plan.success_criteria],
  ]
  return all.filter(([, v]) => nonEmpty(v)) as [string, string][]
}

// A list section (General Learning Objectives, Key Formulae and Vocabulary):
// one line stays a paragraph, several lines become bullets with any typed
// numbering or dashes removed.
export function listSection(text: string | null | undefined): { bullets: boolean; items: string[] } | null {
  if (!nonEmpty(text)) return null
  const ls = textLines(text)
  return ls.length === 1 ? { bullets: false, items: ls } : { bullets: true, items: ls.map(stripMarker) }
}

export function lessonHeading(lesson: Lesson, index: number): string {
  return `Lesson ${index + 1}${lesson.title.trim() ? ` – ${lesson.title.trim()}` : ''}`
}

export function lessonRows(lesson: Lesson): [string, string][] {
  return LESSON_FIELDS.filter(({ key }) => lesson[key].trim()).map(({ key, label }) => [label, lesson[key]] as [string, string])
}
