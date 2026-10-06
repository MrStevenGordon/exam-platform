// The weekly summary: what changed in the last 7 days and what is coming up in the next 7. No network, no database, no screen, so every
// rule can be tested with made-up rows (scripts/tests/week-summary/weekSummaryPure.test.mjs).
//
// Two readers: a student (their own week) and a teacher (each of their classes). Everything here only SUMMARISES what the person can
// already see; it adds no new access. Dates for lessons are Jamaica dates (UTC-5, no daylight saving), like the rest of the platform.

import type { TopicResult } from './studentTopicsPure'

export const DAY = 24 * 60 * 60 * 1000
export const WINDOW_DAYS = 7
export const SUPPORT_BELOW = 50        // a student averaging under this over the last two weeks may need support
export const DROP_POINTS = 15
export const MAX_UNDATED = 3                // reminders for things that are open but have no closing date          // or one whose week average fell by this many points or more

const whole = (n: number) => Math.round(n)
const ms = (iso: string) => new Date(iso).getTime()

// ---------- dates ----------
export const jamaicaDate = (now: Date): string => new Date(now.getTime() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10)
const dayNumber = (isoDate: string): number => Math.floor(ms(isoDate + 'T00:00:00Z') / DAY)
export const daysBetween = (fromIsoDate: string, toIsoDate: string): number => dayNumber(toIsoDate) - dayNumber(fromIsoDate)
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export function dayLabel(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00Z')
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`
}

// How a closing date reads: "Closes today", "Closes tomorrow", "Closes Friday 10 Oct".
export function closesText(day: string, today: string): string {
  const d = daysBetween(today, day)
  return `Closes ${d <= 0 ? 'today' : d === 1 ? 'tomorrow' : dayLabel(day)}`
}

// How a due date reads: "Overdue by 2 days", "Due today", "Due tomorrow", "Due Friday 10 Oct".
export function dueText(dueDate: string, today: string): string {
  const d = daysBetween(today, dueDate)
  if (d < 0) return `Overdue by ${-d} day${d === -1 ? '' : 's'}`
  if (d === 0) return 'Due today'
  if (d === 1) return 'Due tomorrow'
  return `Due ${dayLabel(dueDate)}`
}

// ---------- results ----------
export type ResultRow = { title: string; subject: string; pct: number; at: string }

export function averagePct(rows: Array<{ pct: number }>): number | null {
  return rows.length ? whole(rows.reduce((s, r) => s + r.pct, 0) / rows.length) : null
}

export type WeekResults = { thisWeek: ResultRow[]; previous: ResultRow[]; avgThis: number | null; avgPrev: number | null; change: number | null }
export function weekResults(rows: ResultRow[], now: Date): WeekResults {
  const t = now.getTime()
  const thisWeek = rows.filter((r) => ms(r.at) > t - WINDOW_DAYS * DAY && ms(r.at) <= t).sort((a, b) => ms(b.at) - ms(a.at))
  const previous = rows.filter((r) => ms(r.at) > t - 2 * WINDOW_DAYS * DAY && ms(r.at) <= t - WINDOW_DAYS * DAY)
  const avgThis = averagePct(thisWeek), avgPrev = averagePct(previous)
  return { thisWeek, previous, avgThis, avgPrev, change: avgThis !== null && avgPrev !== null ? avgThis - avgPrev : null }
}

export function resultsHeadline(w: WeekResults): string {
  if (w.avgThis === null) return 'No new results this week.'
  const base = `Your average on results shared this week is ${w.avgThis}%`
  if (w.change === null) return `${base}.`
  if (w.change === 0) return `${base}, the same as last week.`
  return `${base}, ${w.change > 0 ? 'up' : 'down'} ${Math.abs(w.change)} point${Math.abs(w.change) === 1 ? '' : 's'} on last week.`
}

// ---------- the student's week ----------
export type LessonItem = { id: string; title: string; subject: string; dueDate: string | null; completedAt: string | null }
export type CheckItem = { lessonId: string; attemptNo: number; score: number; max: number; submittedAt: string }
export type CardItem = { dueAt: string; lastReviewedAt: string | null }
export type UpcomingItem = { kind: 'exam' | 'test' | 'task'; title: string; subject: string; dueAt: string | null; href: string }
export type Reminder = { title: string; detail: string; href: string; urgent: boolean; kind: 'lesson' | 'exam' | 'test' | 'task'; sort: number }

export type StudentWeekInput = {
  now: Date
  results: ResultRow[]
  topics: TopicResult[]
  lessons: LessonItem[]
  checks: CheckItem[]
  cards: CardItem[]
  upcoming: UpcomingItem[]
}

export type StudentWeek = {
  results: WeekResults
  headline: string
  improvedTopics: TopicResult[]
  workOnTopics: TopicResult[]
  lessonsDone: LessonItem[]
  checks: { count: number; avgPct: number | null }
  flashcards: { reviewed: number; daysStudied: number; dueNow: number }
  reminders: Reminder[]
  nextSteps: string[]
  quiet: boolean         // nothing at all happened this week
}

export function studentWeek(i: StudentWeekInput): StudentWeek {
  const now = i.now.getTime()
  const since = now - WINDOW_DAYS * DAY
  const results = weekResults(i.results, i.now)

  // Topics that moved this week: judged topics whose latest exam was this week.
  const recentTopic = (t: TopicResult) => t.lastAt !== '' && ms(t.lastAt) > since
  const improvedTopics = i.topics.filter((t) => t.trend === 'improving' && recentTopic(t))
  const workOnTopics = i.topics.filter((t) => t.level === 'weak').slice(0, 3)

  const lessonsDone = i.lessons.filter((l) => l.completedAt && ms(l.completedAt) > since).sort((a, b) => ms(b.completedAt!) - ms(a.completedAt!))
  const checksThis = i.checks.filter((c) => ms(c.submittedAt) > since)
  // First tries only: later attempts are practice, the same as on the lesson itself.
  const first = checksThis.filter((c) => c.attemptNo === 1 && c.max > 0)
  const checks = { count: checksThis.length, avgPct: first.length ? whole(first.reduce((s, c) => s + (c.score / c.max) * 100, 0) / first.length) : null }

  const reviewedCards = i.cards.filter((c) => c.lastReviewedAt && ms(c.lastReviewedAt) > since)
  const days = new Set(reviewedCards.map((c) => jamaicaDate(new Date(c.lastReviewedAt!))))
  const flashcards = { reviewed: reviewedCards.length, daysStudied: days.size, dueNow: i.cards.filter((c) => ms(c.dueAt) <= now).length }

  const reminders = buildReminders(i)
  const nextSteps = buildNextSteps({ workOnTopics, reminders, flashcards })
  const quiet = results.thisWeek.length === 0 && lessonsDone.length === 0 && checks.count === 0 && flashcards.reviewed === 0
  return { results, headline: resultsHeadline(results), improvedTopics, workOnTopics, lessonsDone, checks, flashcards, reminders, nextSteps, quiet }
}

// Things to do soon: unfinished lessons that are overdue or due in the next 7 days, and tests, exams and tasks that close in the next
// 7 days. Anything with no closing date is shown as "Open now" and listed after the dated ones. Overdue first, then soonest.
export function buildReminders(i: Pick<StudentWeekInput, 'now' | 'lessons' | 'upcoming'>, max = 8): Reminder[] {
  const today = jamaicaDate(i.now)
  const out: Reminder[] = []
  for (const l of i.lessons) {
    if (l.completedAt || !l.dueDate) continue
    const d = daysBetween(today, l.dueDate)
    if (d > WINDOW_DAYS) continue
    out.push({ title: l.title, detail: dueText(l.dueDate, today), href: `/learning/lesson/${l.id}`, urgent: d <= 1, kind: 'lesson', sort: d })
  }
  const now = i.now.getTime()
  for (const u of i.upcoming) {
    if (u.dueAt) {
      const due = ms(u.dueAt)
      if (due < now) continue                          // already closed
      if (due > now + WINDOW_DAYS * DAY) continue      // not this week
      const day = jamaicaDate(new Date(due))
      const d = daysBetween(today, day)
      out.push({ title: u.title, detail: closesText(day, today), href: u.href, urgent: d <= 1, kind: u.kind, sort: d })
    } else {
      out.push({ title: u.title, detail: 'Open now', href: u.href, urgent: false, kind: u.kind, sort: 1000 })
    }
  }
  // Undated items (open with no closing date) can pile up from months ago, so only the first few are worth a reminder.
  const sorted = out.sort((a, b) => a.sort - b.sort || a.title.localeCompare(b.title))
  let undated = 0
  return sorted.filter((r) => (r.sort === 1000 ? ++undated <= MAX_UNDATED : true)).slice(0, max)
}

export function buildNextSteps(i: { workOnTopics: TopicResult[]; reminders: Reminder[]; flashcards: { dueNow: number } }): string[] {
  const steps: string[] = []
  const overdue = i.reminders.find((r) => r.sort < 0)
  if (overdue) steps.push(`Finish "${overdue.title}". It is ${overdue.detail.toLowerCase()}.`)
  const soon = i.reminders.find((r) => r.sort >= 0 && r.sort <= 2)
  if (soon) steps.push(`"${soon.title}": ${soon.detail.toLowerCase()}.`)
  if (i.workOnTopics[0]) steps.push(`Practise ${i.workOnTopics[0].name}. You are at ${i.workOnTopics[0].pct}% on it.`)
  if (i.flashcards.dueNow > 0) steps.push(`Study your flashcards: ${i.flashcards.dueNow} ${i.flashcards.dueNow === 1 ? 'card is' : 'cards are'} due.`)
  return steps.slice(0, 4)
}

// ---------- the teacher's week ----------
export type TeacherStudent = { id: string; name: string; classId: string }
export type TeacherSession = { studentId: string; title: string; subject: string; pct: number; at: string }
export type TeacherLesson = { lessonId: string; title: string; classId: string; dueDate: string | null }
export type TeacherCompletion = { lessonId: string; studentId: string }
export type TeacherUpcoming = { title: string; subject: string; classId: string; dueAt: string | null; href: string }

export type TeacherWeekInput = {
  now: Date
  classes: Array<{ id: string; name: string }>
  students: TeacherStudent[]
  sessions: TeacherSession[]
  lessons: TeacherLesson[]
  completions: TeacherCompletion[]
  upcoming: TeacherUpcoming[]
}

export type SupportStudent = { id: string; name: string; reasons: string[] }
export type ClassWeek = {
  id: string
  name: string
  students: number
  exams: { sat: number; avgThis: number | null; avgPrev: number | null; change: number | null }
  support: SupportStudent[]
  lessons: Array<{ lessonId: string; title: string; dueDate: string | null; detail: string; done: number; total: number; overdue: boolean }>
  upcoming: Array<{ title: string; subject: string; detail: string; href: string }>
}

export function teacherWeek(i: TeacherWeekInput): ClassWeek[] {
  const today = jamaicaDate(i.now)
  const now = i.now.getTime()
  return i.classes.map((c) => {
    const roster = i.students.filter((s) => s.classId === c.id)
    const ids = new Set(roster.map((s) => s.id))
    const sessions = i.sessions.filter((s) => ids.has(s.studentId))
    const w = weekResults(sessions, i.now)

    const support: SupportStudent[] = []
    for (const s of roster) {
      const mine = sessions.filter((x) => x.studentId === s.id)
      const wk = weekResults(mine, i.now)
      const reasons: string[] = []
      const fortnight = [...wk.thisWeek, ...wk.previous]
      const fortnightAvg = averagePct(fortnight)
      if (fortnightAvg !== null && fortnightAvg < SUPPORT_BELOW) reasons.push(`Averaging ${fortnightAvg}% over the last two weeks`)
      if (wk.change !== null && wk.change <= -DROP_POINTS) reasons.push(`Down ${-wk.change} points on last week`)
      if (reasons.length) support.push({ id: s.id, name: s.name, reasons })
    }
    support.sort((a, b) => b.reasons.length - a.reasons.length || a.name.localeCompare(b.name))

    const lessons = i.lessons.filter((l) => l.classId === c.id).map((l) => {
      const done = i.completions.filter((x) => x.lessonId === l.lessonId && ids.has(x.studentId)).length
      const d = l.dueDate ? daysBetween(today, l.dueDate) : null
      return { l, done, d }
    })
      // unfinished lessons that are overdue or due within 7 days, plus undated ones still open for the class
      .filter(({ done, d }) => done < roster.length && (d === null || d <= WINDOW_DAYS))
      .sort((a, b) => (a.d ?? 1000) - (b.d ?? 1000) || a.l.title.localeCompare(b.l.title))
      .map(({ l, done, d }) => ({ lessonId: l.lessonId, title: l.title, dueDate: l.dueDate, detail: l.dueDate ? dueText(l.dueDate, today) : 'No due date', done, total: roster.length, overdue: d !== null && d < 0 }))

    // only items with a closing date in the next 7 days: undated ones cannot be told apart from old ones
    const upcoming = i.upcoming.filter((u) => u.classId === c.id).filter((u) => u.dueAt !== null && ms(u.dueAt) >= now && ms(u.dueAt) <= now + WINDOW_DAYS * DAY)
      .sort((a, b) => ms(a.dueAt as string) - ms(b.dueAt as string))
      .map((u) => ({ title: u.title, subject: u.subject, detail: closesText(jamaicaDate(new Date(u.dueAt as string)), today), href: u.href }))

    return { id: c.id, name: c.name, students: roster.length, exams: { sat: w.thisWeek.length, avgThis: w.avgThis, avgPrev: w.avgPrev, change: w.change }, support, lessons, upcoming }
  })
}
