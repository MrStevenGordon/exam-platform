// A student's results by topic: the calculation behind the "My topics" page. No network, no database, no screen, so every
// rule can be tested with made-up rows (scripts/tests/student-topics/studentTopicsPure.test.mjs).
//
// The rows come from my_topic_results() (migration 083), which only ever returns the student's own released, marked questions.

export type TopicRow = {
  subject: string
  topicId: string | null
  topicName: string | null
  topicText: string | null
  awarded: number
  points: number
  completedAt: string
  examId: string
  questionId: string
  questionType: string
}

export type TopicLevel = 'weak' | 'getting_there' | 'strong' | 'too_few'
export type Trend = 'improving' | 'slipping' | 'steady' | null

export type TopicResult = {
  key: string
  topicId: string | null       // the school's topic id, when the questions were tagged from the topic list (not free text)
  subject: string
  name: string
  pct: number                  // whole percent of the marks available on this topic
  earned: number
  available: number
  questions: number
  exams: number
  level: TopicLevel
  trend: Trend                 // latest exam on this topic against the earlier ones, when there is enough to compare
  lastAt: string
  practiceQuestionIds: string[] // non-essay questions on this topic the student has seen, for a practice mock
}

export const RULES = {
  minQuestions: 3,   // fewer questions than this on a topic and we say "not enough yet" instead of judging it
  weakBelow: 50,     // under this percent: needs work
  strongFrom: 75,    // from this percent: strong
  trendGap: 15,      // percentage points between the latest exam and the earlier ones before we call it a change
  trendMinQuestions: 2, // each side of that comparison needs at least this many questions
  practiceMax: 10,
} as const

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()
export const topicKey = (topicId: string | null, topicText: string | null): string | null =>
  topicId ? 'id:' + topicId : topicText && topicText.trim() ? 'text:' + norm(topicText) : null

// Reads the database's compact rows. Anything malformed is dropped rather than guessed at.
export function parseRows(payload: unknown): { rows: TopicRow[]; untagged: number } {
  const p = payload as { rows?: unknown; untagged?: unknown } | null
  const raw = Array.isArray(p?.rows) ? (p!.rows as unknown[]) : []
  const rows: TopicRow[] = []
  for (const r of raw) {
    if (!Array.isArray(r) || r.length < 10) continue
    const [subject, topicId, topicName, topicText, awarded, points, completedAt, examId, questionId, questionType] = r
    const a = Number(awarded), pts = Number(points)
    if (typeof subject !== 'string' || !Number.isFinite(a) || !Number.isFinite(pts) || pts <= 0 || typeof completedAt !== 'string') continue
    rows.push({
      subject, topicId: typeof topicId === 'string' ? topicId : null, topicName: typeof topicName === 'string' ? topicName : null,
      topicText: typeof topicText === 'string' ? topicText : null, awarded: Math.min(Math.max(a, 0), pts), points: pts,
      completedAt, examId: String(examId), questionId: String(questionId), questionType: String(questionType),
    })
  }
  return { rows, untagged: Number.isFinite(Number(p?.untagged)) ? Number(p!.untagged) : 0 }
}

const pctOf = (earned: number, available: number) => (available > 0 ? Math.round((earned / available) * 100) : 0)

export function levelFor(pct: number, questions: number): TopicLevel {
  if (questions < RULES.minQuestions) return 'too_few'
  if (pct < RULES.weakBelow) return 'weak'
  if (pct >= RULES.strongFrom) return 'strong'
  return 'getting_there'
}

// Latest exam on the topic against everything before it.
function trendFor(rows: TopicRow[]): Trend {
  const exams = new Map<string, { at: string; rows: TopicRow[] }>()
  for (const r of rows) {
    const e = exams.get(r.examId) ?? { at: r.completedAt, rows: [] }
    e.rows.push(r)
    if (r.completedAt > e.at) e.at = r.completedAt
    exams.set(r.examId, e)
  }
  if (exams.size < 2) return null
  const ordered = [...exams.values()].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
  const latest = ordered[0].rows
  const earlier = ordered.slice(1).flatMap((e) => e.rows)
  if (latest.length < RULES.trendMinQuestions || earlier.length < RULES.trendMinQuestions) return null
  const sum = (rs: TopicRow[]) => rs.reduce((s, r) => s + r.awarded, 0) / rs.reduce((s, r) => s + r.points, 0) * 100
  const diff = sum(latest) - sum(earlier)
  return diff >= RULES.trendGap ? 'improving' : diff <= -RULES.trendGap ? 'slipping' : 'steady'
}

// Every topic the student has questions on, weakest first among those we can judge, then the ones with too few questions.
export function computeTopics(rows: TopicRow[]): TopicResult[] {
  const groups = new Map<string, { subject: string; name: string; rows: TopicRow[] }>()
  for (const r of rows) {
    const k = topicKey(r.topicId, r.topicText)
    if (!k) continue
    const gk = norm(r.subject) + '|' + k
    const g = groups.get(gk) ?? { subject: r.subject.trim(), name: (r.topicName || r.topicText || 'Topic').trim(), rows: [] }
    g.rows.push(r)
    groups.set(gk, g)
  }
  const out: TopicResult[] = []
  for (const [gk, g] of groups) {
    const earned = g.rows.reduce((s, r) => s + r.awarded, 0)
    const available = g.rows.reduce((s, r) => s + r.points, 0)
    const pct = pctOf(earned, available)
    const questions = new Set(g.rows.map((r) => r.questionId)).size
    const level = levelFor(pct, questions)
    const ids = [...new Set(g.rows.filter((r) => r.questionType !== 'essay').map((r) => r.questionId))].sort()
    out.push({
      key: gk, topicId: g.rows.find((r) => r.topicId)?.topicId ?? null, subject: g.subject, name: g.name, pct, earned: Math.round(earned * 100) / 100, available, questions,
      exams: new Set(g.rows.map((r) => r.examId)).size, level, trend: level === 'too_few' ? null : trendFor(g.rows),
      lastAt: g.rows.reduce((m, r) => (r.completedAt > m ? r.completedAt : m), ''), practiceQuestionIds: ids,
    })
  }
  const rank = (t: TopicResult) => (t.level === 'too_few' ? 1 : 0)
  return out.sort((a, b) => rank(a) - rank(b) || a.pct - b.pct || a.name.localeCompare(b.name))
}

export const subjectsOf = (topics: TopicResult[]): string[] => [...new Set(topics.map((t) => t.subject))].sort((a, b) => a.localeCompare(b))

// A fair, random pick for a practice mock.
export function pickPractice(ids: string[], count = RULES.practiceMax, random: () => number = Math.random): string[] {
  const a = [...ids]
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a.slice(0, Math.min(count, a.length))
}

export const LEVEL_LABEL: Record<TopicLevel, string> = {
  weak: 'Needs work', getting_there: 'Getting there', strong: 'Strong', too_few: 'Not enough questions yet',
}
export const TREND_LABEL: Record<Exclude<Trend, null>, string> = {
  improving: 'Improving', slipping: 'Slipping', steady: 'Steady',
}

// ---------- lessons for a topic (the catch-up link) ----------
export type TopicLesson = { id: string; title: string; subject: string; topicId: string; done: boolean }

// Reads the compact lessons from my_topic_lessons(); anything malformed is dropped.
export function parseLessons(payload: unknown): TopicLesson[] {
  if (!Array.isArray(payload)) return []
  const out: TopicLesson[] = []
  for (const l of payload) {
    const o = l as Record<string, unknown> | null
    if (!o || typeof o.id !== 'string' || typeof o.title !== 'string' || typeof o.topic_id !== 'string') continue
    out.push({ id: o.id, title: o.title, subject: typeof o.subject === 'string' ? o.subject : '', topicId: o.topic_id, done: o.done === true })
  }
  return out
}

// Lessons the student can open that were written for this topic. Only topics picked from the school's list can match; a topic that
// was typed in as free text has no lessons to link. Unfinished lessons first.
export function lessonsForTopic(topic: Pick<TopicResult, 'topicId'>, lessons: TopicLesson[], max = 3): TopicLesson[] {
  if (!topic.topicId) return []
  return lessons.filter((l) => l.topicId === topic.topicId).sort((a, b) => Number(a.done) - Number(b.done) || a.title.localeCompare(b.title)).slice(0, max)
}

// Topics that get lesson links: the ones that are not yet strong.
export const wantsLessons = (t: Pick<TopicResult, 'level'>): boolean => t.level === 'weak' || t.level === 'getting_there'
