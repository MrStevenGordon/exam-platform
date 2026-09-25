import { lessonsForPlan } from '@/lib/lessonPlan'
import { gradeFromText } from '@/lib/topics'

export const STEP_KEYS = ['engage', 'explore', 'explain', 'elaborate', 'evaluate'] as const
export type StepKey = (typeof STEP_KEYS)[number]

export const STEP_INFO: Record<StepKey, { label: string; icon: string; hint: string }> = {
  engage: { label: 'Engage', icon: 'ti-bulb', hint: 'A hook that gets students thinking' },
  explore: { label: 'Explore', icon: 'ti-compass', hint: 'Something for students to try or discover' },
  explain: { label: 'Explain', icon: 'ti-book', hint: 'The idea itself, with a worked example' },
  elaborate: { label: 'Elaborate', icon: 'ti-pencil', hint: 'Practice to deepen understanding' },
  evaluate: { label: 'Evaluate', icon: 'ti-checklist', hint: 'A short check of what they learned' },
}

export type ResourceKind = 'video' | 'link' | 'file'
export type Resource = { title: string; url: string; kind: ResourceKind }
export type LessonStep = { key: StepKey; text: string; resources: Resource[]; approved: boolean }

export type LessonStatus = 'draft' | 'published' | 'archived'

export type LessonRow = {
  id: string
  title: string
  subject: string
  grade: number | null
  topic_id: string | null
  key_terms: string
  steps: LessonStep[]
  status: LessonStatus
  lesson_plan_id: string | null
  updated_at: string
}

export function emptySteps(): LessonStep[] {
  return STEP_KEYS.map((key) => ({ key, text: '', resources: [], approved: false }))
}

// The same rule the database applies: web addresses only.
export function isWebUrl(url: string): boolean {
  return /^https?:\/\/[^\s]+$/i.test(url.trim()) && url.trim().length <= 2000
}

export function resourceKindFor(url: string): ResourceKind {
  const u = url.toLowerCase()
  if (/(youtube\.com|youtu\.be|vimeo\.com)/.test(u)) return 'video'
  if (/\.(pdf|docx?|pptx?|xlsx?)(\?|#|$)/.test(u)) return 'file'
  return 'link'
}

// A friendly title for a link the teacher did not name.
export function defaultResourceTitle(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    return resourceKindFor(url) === 'video' ? `Video (${host})` : host
  } catch {
    return 'Link'
  }
}

export function readyCount(steps: LessonStep[]): number {
  return steps.filter((s) => s.approved && s.text.trim().length > 0).length
}

export const allReady = (steps: LessonStep[]) => readyCount(steps) === STEP_KEYS.length

// The starting point for a student lesson: the plan's own 5E text for one lesson of
// the unit. It is written for the teacher, so the teacher reviews and rewords it for
// students; nothing is approved automatically.
export type PlanForLesson = {
  subject: string
  grade: string
  topic: string
  topic_id?: string | null
  key_terms_formulae?: string | null
  lessons?: unknown
  engage?: string | null; explore?: string | null; explain?: string | null; elaborate?: string | null; evaluate?: string | null
}

export function lessonFromPlan(plan: PlanForLesson, lessonIndex: number) {
  const lessons = lessonsForPlan(plan)
  const l = lessons[Math.min(Math.max(lessonIndex, 0), lessons.length - 1)]
  const steps = emptySteps().map((s) => ({ ...s, text: (l[s.key] || '').trim() }))
  return {
    title: l.title.trim() || (lessons.length > 1 ? `${plan.topic}: lesson ${lessonIndex + 1}` : plan.topic),
    subject: plan.subject,
    grade: gradeFromText(plan.grade),
    topic_id: plan.topic_id ?? null,
    key_terms: (plan.key_terms_formulae || '').trim(),
    steps,
  }
}

export type StudentLessonRow = {
  lesson_id: string; title: string; subject: string; teacher_name: string; due_date: string | null
  steps_done: number; completed_at: string | null; last_activity_at: string | null; closed: boolean
}

export type LessonState = 'not_started' | 'in_progress' | 'done'
export const lessonState = (r: { steps_done: number; completed_at: string | null }): LessonState =>
  r.completed_at ? 'done' : r.steps_done > 0 ? 'in_progress' : 'not_started'

export const STATE_INFO: Record<LessonState, { label: string; badge: string }> = {
  not_started: { label: 'Not started', badge: 'badge-default' },
  in_progress: { label: 'In progress', badge: 'badge-warning' },
  done: { label: 'Done', badge: 'badge-success' },
}

// "Due Fri 26 Sept", "Due today", "Overdue by 2 days" (dates are plain school dates, compared without time zones).
export function dueLabel(due: string | null, today: string): { text: string; overdue: boolean } | null {
  if (!due) return null
  const d = Date.parse(`${due}T12:00:00Z`)
  const t = Date.parse(`${today}T12:00:00Z`)
  const days = Math.round((d - t) / 86400000)
  if (days === 0) return { text: 'Due today', overdue: false }
  if (days < 0) return { text: `Overdue by ${-days} day${days === -1 ? '' : 's'}`, overdue: true }
  const nice = new Intl.DateTimeFormat('en-JM', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(d))
  return { text: `Due ${nice}`, overdue: false }
}

// Plain text with blank lines between paragraphs -> paragraphs (line breaks inside one are kept).
export function paragraphs(text: string): string[] {
  return text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
}
