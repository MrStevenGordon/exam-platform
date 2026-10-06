// Every number on the teacher Insight page, worked out from the one document exam_insight_data() returns (migration 080).
// Pure functions only: no database, no screen, no imports, so each rule can be tested on its own with small worked examples
// (scripts/tests/exam-insight/examInsightPure.test.mjs). The wording rules live here too, so the screen cannot drift from them.

// ---------- what the database hands over ----------
export type InsightExam = {
  kind: 'direct' | 'final'; id: string; title: string; subject: string; exam_kind: string | null
  pass_mark: number | null; target_grade: number | null; date: string
  classes: Array<{ id: string; name: string }>; sees_all: boolean; topics_available: boolean
}
export type InsightQuestion = {
  id: string; type: string; text: string; points: number; options: unknown; correct: string | null
  topic_id: string | null; topic_name: string | null; topic_code: string | null; topic_text: string | null
}
export type InsightStudent = {
  id: string; name: string; number: string | null; class: string | null
  status: 'completed' | 'in_progress' | 'not_started'; fully_graded: boolean
  total: number | null; max: number | null; completed_at: string | null
}
// [student_index, question_index, points]; points is null while the answer is still waiting to be marked.
export type InsightMark = [number, number, number | null]
export type InsightAnswers = Array<{ q: number; items: Array<{ a: string; n: number }> }>
// [student_index, exam_id, title, kind, date, total, max]
export type InsightHistoryRow = [number, string, string, 'direct' | 'final', string, number | null, number | null]
export type InsightPayload = {
  version: number; exam: InsightExam; questions: InsightQuestion[]; students: InsightStudent[]
  marks: InsightMark[]; answers: InsightAnswers; history: InsightHistoryRow[]
}

// ---------- the rules (each is a number the teacher could reasonably ask to change later) ----------
export const RULES = {
  minForPercent: 5,            // fewer students than this sat: show counts, not percentages
  minForMostMissed: 8,         // fewer than this: do not call any question "most missed"
  mostMissedBelow: 0.4,        // a question is "most missed" when fewer than 40% did well on it
  minForCheckQuestion: 15,     // the "check this question" flag needs a big enough group
  checkQuestionBelow: 0.6,     // ...and only on questions that were not easy
  groupShare: 0.27,            // top and bottom 27% of students by total score
  wrongAnswerMin: 3,           // a common wrong answer needs at least 3 students...
  wrongAnswerShare: 0.25,      // ...and a quarter of those who sat
  dropPoints: 15,              // percentage points under a student's own earlier average
  minEarlierTests: 2,          // earlier tests needed before "down on their average" can be said
  weakTopicBelow: 0.4,         // a student's score on a topic, under which it is "weak"
  weakTopicMinQuestions: 3,    // a topic needs at least this many questions to judge a student on it
  historyMax: 6,               // earlier tests used per student
  trendMax: 5,                 // tests shown in "class over time", including this one
  trendMinStudents: 3,         // an earlier test needs this many of the same students to be drawn
} as const

export type SupportReason =
  | { kind: 'below_pass'; pct: number; passMark: number }
  | { kind: 'dropped'; points: number; average: number }
  | { kind: 'did_not_sit' }
  | { kind: 'weak_topic'; topic: string; pct: number }

export type QuestionInsight = {
  id: string; number: number; type: string; text: string; points: number
  sat: number                       // students who sat the test
  graded: number                    // of those, answers already marked
  waiting: number                   // answers still waiting to be marked
  metric: 'right' | 'marks'         // right = share with full marks; marks = average share of the marks
  difficulty: number | null         // 0 to 1, higher is easier; null when nothing is marked yet
  fullMarks: number
  mostMissed: boolean
  checkQuestion: boolean
  wrongAnswer: { text: string; n: number } | null
  topic: string | null
}
export type TopicInsight = { key: string; name: string; pct: number; questions: number }
export type StudentInsight = {
  id: string; name: string; number: string | null; class: string | null
  status: InsightStudent['status']
  pct: number | null                // null until the paper is fully marked
  waitingForMarking: boolean
  earlier: Array<{ title: string; pct: number }>   // oldest to newest, up to the last 3
  earlierAverage: number | null
  reasons: SupportReason[]
}
export type TrendPoint = { examId: string; title: string; date: string; averagePct: number; students: number; isThis: boolean }
export type Insight = {
  summary: {
    expected: number; sat: number; inProgress: number; notStarted: number
    fullyMarked: number; waitingForMarking: number
    averagePct: number | null; belowPass: number; passMark: number
    previousAveragePct: number | null; deltaVsPrevious: number | null
    showPercent: boolean            // false for a very small group
  }
  questions: QuestionInsight[]      // hardest first
  topics: TopicInsight[]            // weakest first
  untaggedQuestions: number
  students: StudentInsight[]
  support: StudentInsight[]         // students with at least one reason, most reasons then lowest score first
  trend: TrendPoint[]               // oldest to newest, ends with this test
}

const round1 = (n: number) => Math.round(n * 10) / 10
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase()
export const pctOf = (total: number | null, max: number | null): number | null => (total === null || max === null || max <= 0 ? null : round1((total / max) * 100))

// ---------- the calculation ----------
export function computeInsight(p: InsightPayload): Insight {
  const passMark = p.exam.pass_mark ?? 50
  const completed = p.students.map((s, i) => ({ s, i })).filter(({ s }) => s.status === 'completed')
  const sat = completed.length

  // marks[studentIndex][questionIndex]: points, null = waiting to be marked; a missing entry = no answer saved (counts as 0)
  const cell = new Map<number, Map<number, number | null>>()
  for (const [si, qi, pts] of p.marks) {
    if (!cell.has(si)) cell.set(si, new Map())
    cell.get(si)!.set(qi, pts)
  }
  const pointsFor = (si: number, qi: number): number | null => {
    const m = cell.get(si)
    return m && m.has(qi) ? m.get(qi)! : 0
  }

  // each student's overall percent (fully marked papers only) and earlier tests
  const earlierBy = new Map<number, Array<{ examId: string; title: string; date: string; pct: number }>>()
  for (const [si, examId, title, , date, total, max] of p.history) {
    const pct = pctOf(total, max)
    if (pct === null) continue
    if (!earlierBy.has(si)) earlierBy.set(si, [])
    earlierBy.get(si)!.push({ examId, title, date, pct })
  }
  for (const list of earlierBy.values()) list.sort((a, b) => a.date.localeCompare(b.date))

  const overall = (s: InsightStudent): number | null => (s.status === 'completed' && s.fully_graded ? pctOf(s.total, s.max) : null)

  // ---------- questions ----------
  const answersByQ = new Map<number, Array<{ a: string; n: number }>>()
  for (const a of p.answers) answersByQ.set(a.q, a.items)
  const rankedFull = completed.filter(({ s }) => overall(s) !== null).sort((a, b) => overall(b.s)! - overall(a.s)! || a.i - b.i)

  const questions: QuestionInsight[] = p.questions.map((q, qi) => {
    let graded = 0, waiting = 0, fullMarks = 0
    const shares: number[] = []
    for (const { i } of completed) {
      const pts = pointsFor(i, qi)
      if (pts === null) { waiting++; continue }
      graded++
      shares.push(q.points > 0 ? Math.min(pts / q.points, 1) : 0)
      if (pts >= q.points) fullMarks++
    }
    const metric: 'right' | 'marks' = (q.type === 'multiple_choice' || q.type === 'true_false' || q.points <= 1) ? 'right' : 'marks'
    const difficulty = graded === 0 ? null : metric === 'right' ? fullMarks / graded : (mean(shares) as number)
    const mostMissed = graded >= RULES.minForMostMissed && difficulty !== null && difficulty < RULES.mostMissedBelow

    // students at the top and bottom of the class, among those with this answer marked
    let checkQuestion = false
    const ranked = rankedFull.filter(({ i }) => pointsFor(i, qi) !== null)
    if (ranked.length >= RULES.minForCheckQuestion && difficulty !== null && difficulty < RULES.checkQuestionBelow) {
      const k = Math.max(1, Math.round(ranked.length * RULES.groupShare))
      const share = (arr: typeof ranked) => (mean(arr.map(({ i }) => (q.points > 0 ? Math.min((pointsFor(i, qi) as number) / q.points, 1) : 0))) as number)
      checkQuestion = share(ranked.slice(0, k)) <= share(ranked.slice(-k))
    }

    // the wrong answer most students chose, for choice questions only
    let wrongAnswer: QuestionInsight['wrongAnswer'] = null
    if (q.type === 'multiple_choice' || q.type === 'true_false') {
      const key = norm(q.correct)
      const wrong = (answersByQ.get(qi) ?? []).filter((it) => norm(it.a) !== '' && norm(it.a) !== key).sort((a, b) => b.n - a.n)
      if (wrong.length && wrong[0].n >= RULES.wrongAnswerMin && sat > 0 && wrong[0].n / sat >= RULES.wrongAnswerShare) wrongAnswer = { text: wrong[0].a, n: wrong[0].n }
    }

    return {
      id: q.id, number: qi + 1, type: q.type, text: q.text, points: q.points, sat, graded, waiting, metric,
      difficulty: difficulty === null ? null : Math.round(difficulty * 100) / 100, fullMarks, mostMissed, checkQuestion, wrongAnswer,
      topic: q.topic_name || (q.topic_text && q.topic_text.trim()) || null,
    }
  })

  // ---------- topics ----------
  const topicKey = (q: InsightQuestion): { key: string; name: string } | null => {
    if (q.topic_id) return { key: 'id:' + q.topic_id, name: q.topic_name || q.topic_text || 'Topic' }
    if (q.topic_text && q.topic_text.trim()) return { key: 'text:' + norm(q.topic_text), name: q.topic_text.trim() }
    return null
  }
  const topicQuestions = new Map<string, { name: string; qs: number[] }>()
  let untaggedQuestions = 0
  p.questions.forEach((q, qi) => {
    const t = topicKey(q)
    if (!t) { untaggedQuestions++; return }
    if (!topicQuestions.has(t.key)) topicQuestions.set(t.key, { name: t.name, qs: [] })
    topicQuestions.get(t.key)!.qs.push(qi)
  })
  const topicScore = (si: number, qs: number[]): { earned: number; available: number } => {
    let earned = 0, available = 0
    for (const qi of qs) {
      const pts = pointsFor(si, qi)
      if (pts === null) continue
      earned += Math.min(pts, p.questions[qi].points)
      available += p.questions[qi].points
    }
    return { earned, available }
  }
  const topics: TopicInsight[] = []
  for (const [key, t] of topicQuestions) {
    let earned = 0, available = 0
    for (const { i } of completed) { const r = topicScore(i, t.qs); earned += r.earned; available += r.available }
    if (available > 0) topics.push({ key, name: t.name, pct: round1((earned / available) * 100), questions: t.qs.length })
  }
  topics.sort((a, b) => a.pct - b.pct || a.name.localeCompare(b.name))

  // ---------- students ----------
  const students: StudentInsight[] = p.students.map((s, i) => {
    const pct = overall(s)
    const earlier = (earlierBy.get(i) ?? []).slice(-RULES.historyMax)
    const earlierPcts = earlier.map((e) => e.pct)
    const earlierAverage = earlierPcts.length ? round1(mean(earlierPcts) as number) : null
    const reasons: SupportReason[] = []
    const waitingForMarking = s.status === 'completed' && !s.fully_graded
    if (s.status === 'not_started') reasons.push({ kind: 'did_not_sit' })
    if (pct !== null) {
      if (pct < passMark) reasons.push({ kind: 'below_pass', pct, passMark })
      if (earlierAverage !== null && earlierPcts.length >= RULES.minEarlierTests && earlierAverage - pct >= RULES.dropPoints) {
        reasons.push({ kind: 'dropped', points: Math.round(earlierAverage - pct), average: Math.round(earlierAverage) })
      }
      for (const t of topicQuestions.values()) {
        if (t.qs.length < RULES.weakTopicMinQuestions) continue
        const r = topicScore(i, t.qs)
        if (r.available > 0 && r.earned / r.available < RULES.weakTopicBelow) reasons.push({ kind: 'weak_topic', topic: t.name, pct: Math.round((r.earned / r.available) * 100) })
      }
    }
    return {
      id: s.id, name: s.name, number: s.number, class: s.class, status: s.status, pct, waitingForMarking,
      earlier: earlier.slice(-3).map((e) => ({ title: e.title, pct: e.pct })), earlierAverage, reasons,
    }
  })
  const support = students.filter((s) => s.reasons.length > 0)
    .sort((a, b) => b.reasons.length - a.reasons.length || (a.pct ?? 101) - (b.pct ?? 101) || a.name.localeCompare(b.name))

  // ---------- summary and trend ----------
  const marked = students.filter((s) => s.pct !== null)
  const averagePct = marked.length ? round1(mean(marked.map((s) => s.pct as number)) as number) : null
  const trendMap = new Map<string, { title: string; date: string; pcts: number[] }>()
  for (const [si, list] of earlierBy) {
    if (p.students[si]?.status === 'not_started') continue
    for (const e of list) {
      if (!trendMap.has(e.examId)) trendMap.set(e.examId, { title: e.title, date: e.date, pcts: [] })
      trendMap.get(e.examId)!.pcts.push(e.pct)
    }
  }
  const earlierPoints: TrendPoint[] = [...trendMap.entries()]
    .map(([examId, t]) => ({ examId, title: t.title, date: t.date, averagePct: round1(mean(t.pcts) as number), students: t.pcts.length, isThis: false }))
    .filter((t) => t.students >= RULES.trendMinStudents)
    .sort((a, b) => a.date.localeCompare(b.date))
  const trend: TrendPoint[] = averagePct === null ? earlierPoints.slice(-RULES.trendMax)
    : [...earlierPoints, { examId: p.exam.id, title: p.exam.title, date: p.exam.date, averagePct, students: marked.length, isThis: true }].slice(-RULES.trendMax)
  const last = earlierPoints.length ? earlierPoints[earlierPoints.length - 1] : null

  return {
    summary: {
      expected: p.students.length, sat, inProgress: students.filter((s) => s.status === 'in_progress').length,
      notStarted: students.filter((s) => s.status === 'not_started').length,
      fullyMarked: marked.length, waitingForMarking: students.filter((s) => s.waitingForMarking).length,
      averagePct, belowPass: marked.filter((s) => (s.pct as number) < passMark).length, passMark,
      previousAveragePct: last ? last.averagePct : null,
      deltaVsPrevious: last && averagePct !== null ? Math.round(averagePct - last.averagePct) : null,
      showPercent: sat >= RULES.minForPercent,
    },
    questions: [...questions].sort((a, b) => (a.difficulty ?? 2) - (b.difficulty ?? 2) || a.number - b.number),
    topics, untaggedQuestions, students, support, trend,
  }
}

// ---------- words ----------
export function reasonText(r: SupportReason): string {
  switch (r.kind) {
    case 'below_pass': return `Below the pass mark (${Math.round(r.pct)}% against ${r.passMark}%)`
    case 'dropped': return `Down ${r.points} points on their average (${r.average}%)`
    case 'did_not_sit': return 'Did not sit this test'
    case 'weak_topic': return `Weak on ${r.topic} (${r.pct}%)`
  }
}
export function questionNote(q: QuestionInsight): string {
  if (q.graded === 0) return q.waiting > 0 ? 'Waiting to be marked' : 'No answers yet'
  if (q.checkQuestion) return 'Check this question: students who did best overall did no better on it than those who did worst. The answer key or the wording may be at fault.'
  if (q.wrongAnswer) return `Most common wrong answer: ${q.wrongAnswer.text} (${q.wrongAnswer.n} students)`
  return ''
}

// ---------- spreadsheet export ----------
// A cell that starts with = + - or @ would be run as a formula by a spreadsheet, so it is prefixed with an apostrophe.
export function csvCell(v: string | number | null | undefined): string {
  let s = v === null || v === undefined ? '' : String(v)
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s
  return `"${s.replace(/"/g, '""')}"`
}
export function insightToCsv(p: InsightPayload, ins: Insight): string {
  const lines: string[] = []
  lines.push([`Test`, p.exam.title, `Subject`, p.exam.subject].map(csvCell).join(','))
  lines.push([`Students who sat`, ins.summary.sat, `Class average %`, ins.summary.averagePct ?? 'n/a', `Pass mark %`, ins.summary.passMark].map(csvCell).join(','))
  lines.push('')
  lines.push(['Question', 'Text', 'Marks', 'Students marked', 'Got it right or average of marks %', 'Most common wrong answer', 'Topic'].map(csvCell).join(','))
  for (const q of [...ins.questions].sort((a, b) => a.number - b.number)) {
    lines.push([q.number, q.text, q.points, q.graded, q.difficulty === null ? 'waiting' : Math.round(q.difficulty * 100), q.wrongAnswer ? `${q.wrongAnswer.text} (${q.wrongAnswer.n})` : '', q.topic ?? ''].map(csvCell).join(','))
  }
  lines.push('')
  lines.push(['Student', 'Number', 'Class', 'Status', 'Score %', 'Average of earlier tests %', 'Why listed'].map(csvCell).join(','))
  for (const s of ins.students) {
    lines.push([s.name, s.number ?? '', s.class ?? '', s.status === 'completed' ? (s.waitingForMarking ? 'Waiting for marking' : 'Sat') : s.status === 'in_progress' ? 'Still sitting' : 'Did not sit',
      s.pct ?? '', s.earlierAverage ?? '', s.reasons.map(reasonText).join('; ')].map(csvCell).join(','))
  }
  return lines.join('\r\n')
}
