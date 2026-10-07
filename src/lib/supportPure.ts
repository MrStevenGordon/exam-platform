// Student support: turns the figures from support_students() (migration 092) into the reasons a student may need help, the plan wording
// to start from, and how a plan is going. Pure, so it can be tested. Staff only: nothing here is ever shown to a student, and a student's own
// "My progress" page uses none of it.

export const BELOW_GAP = 10      // points under the school average (in a subject, or overall) that count as "below"
export const LOW_PCT = 50        // an average under this is low whatever the school average is
export const DROP = 8            // points lower than the period before counts as falling
export const MIN_RESULTS = 2     // results needed before an average is compared with the school's or with the past
export const ABSENT_DAYS = 3     // absences in the last 14 days
export const LATE_DAYS = 5       // late arrivals in the last 14 days
export const OVERDUE = 2         // lessons past their date and not finished
export const NOT_SEEN_DAYS = 10  // days since the student last signed in

export type SubjectFigures = { subject: string; avg: number; n: number; prev: number | null }
export type SupportStudent = {
  id: string; name: string; grade: number | null; classes: string[]
  overall: { avg: number | null; n: number; prev: number | null } | null
  subjects: SubjectFigures[]
  absent: number; late: number; marked: number
  lessons_due: number; lessons_done: number
  last_seen: string | null
  help_weeks: number; asked_help: boolean
  plan: { id: string; status: 'open' | 'monitoring'; review_on: string | null; subject: string | null } | null
}
export type SupportData = {
  scope: 'classes' | 'department' | 'school'; days: number
  school_avg: number | null
  subjects: { subject: string; avg: number; n: number }[]
  students: SupportStudent[]
}

export type ReasonKind = 'below_average' | 'low_marks' | 'falling' | 'absent' | 'late' | 'lessons' | 'not_seen' | 'asked_help'
export type Reason = { kind: ReasonKind; text: string; weight: number; subject?: string }
export type Level = 'high' | 'watch'
export type SupportRow = { student: SupportStudent; reasons: Reason[]; score: number; level: Level; subject: string | null; gap: number | null }

const DAY = 86400000
const pct = (n: number) => `${Math.round(n)}%`
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

export function daysSince(iso: string | null, now: Date): number | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  return Number.isFinite(t) ? Math.max(0, Math.floor((now.getTime() - t) / DAY)) : null
}

export function reasonsFor(s: SupportStudent, data: Pick<SupportData, 'school_avg' | 'subjects'>, now: Date): Reason[] {
  const out: Reason[] = []
  const bench = new Map(data.subjects.map((b) => [b.subject.toLowerCase(), b.avg]))

  // marks: against the school average, subject by subject; the biggest two gaps
  const gaps = s.subjects
    .filter((x) => x.n >= MIN_RESULTS && bench.has(x.subject.toLowerCase()))
    .map((x) => ({ x, school: bench.get(x.subject.toLowerCase()) as number, gap: (bench.get(x.subject.toLowerCase()) as number) - x.avg }))
    .filter((g) => g.gap >= BELOW_GAP)
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 2)
  for (const g of gaps) out.push({ kind: 'below_average', subject: g.x.subject, weight: g.gap >= 20 ? 3 : 2, text: `${g.x.subject}: averaging ${pct(g.x.avg)}, ${Math.round(g.gap)} points below the school average (${pct(g.school)})` })
  if (gaps.length === 0 && s.overall && s.overall.avg !== null && s.overall.n >= MIN_RESULTS && data.school_avg !== null && data.school_avg - s.overall.avg >= BELOW_GAP) {
    const gap = data.school_avg - s.overall.avg
    out.push({ kind: 'below_average', weight: gap >= 20 ? 3 : 2, text: `Averaging ${pct(s.overall.avg)} overall, ${Math.round(gap)} points below the school average (${pct(data.school_avg)})` })
  }
  // a low average whatever the school average is (and not already said as a gap in the same subject)
  const low = s.subjects.filter((x) => x.n >= 1 && x.avg < LOW_PCT && !gaps.some((g) => g.x.subject === x.subject)).sort((a, b) => a.avg - b.avg)[0]
  if (low) out.push({ kind: 'low_marks', subject: low.subject, weight: 2, text: `${low.subject}: averaging ${pct(low.avg)}${low.n === 1 ? ' (one result so far)' : ''}` })
  // falling: against the period before
  const fall = s.subjects.filter((x) => x.prev !== null && x.n >= 1 && (x.prev as number) - x.avg >= DROP).sort((a, b) => ((b.prev as number) - b.avg) - ((a.prev as number) - a.avg))[0]
  if (fall) out.push({ kind: 'falling', subject: fall.subject, weight: 2, text: `${fall.subject}: down ${Math.round((fall.prev as number) - fall.avg)} points on the period before (${pct(fall.prev as number)} to ${pct(fall.avg)})` })

  if (s.absent >= ABSENT_DAYS) out.push({ kind: 'absent', weight: s.absent >= 5 ? 3 : 2, text: `Absent ${s.absent} of the last ${plural(s.marked, 'school day', 'school days')} marked` })
  else if (s.late >= LATE_DAYS) out.push({ kind: 'late', weight: 1, text: `Late ${s.late} times in the last 14 days` })

  const behind = s.lessons_due - s.lessons_done
  if (behind >= OVERDUE) out.push({ kind: 'lessons', weight: 1, text: `${plural(behind, 'lesson', 'lessons')} past the due date and not finished` })

  const seen = daysSince(s.last_seen, now)
  if (seen !== null && seen >= NOT_SEEN_DAYS) out.push({ kind: 'not_seen', weight: 1, text: `Has not signed in for ${seen} days` })

  if (s.asked_help) out.push({ kind: 'asked_help', weight: 2, text: 'Asked for help in class feedback' })
  else if (s.help_weeks >= 2) out.push({ kind: 'asked_help', weight: 2, text: 'Said they did not follow the lessons two weeks running (class feedback)' })
  return out
}

export const LIST_FROM = 2        // a student is listed when the reasons add up to at least this
export const HIGH_FROM = 4

export function supportRows(data: SupportData, now: Date = new Date()): SupportRow[] {
  const rows: SupportRow[] = []
  for (const s of data.students) {
    const reasons = reasonsFor(s, data, now)
    const score = reasons.reduce((n, r) => n + r.weight, 0)
    if (score < LIST_FROM && !s.plan) continue
    const worst = reasons.filter((r) => r.kind === 'below_average' || r.kind === 'low_marks' || r.kind === 'falling').find((r) => r.subject)
    const bench = worst?.subject ? data.subjects.find((b) => b.subject.toLowerCase() === worst.subject?.toLowerCase())?.avg : undefined
    const fig = worst?.subject ? s.subjects.find((x) => x.subject === worst.subject)?.avg : undefined
    rows.push({ student: s, reasons, score, level: score >= HIGH_FROM ? 'high' : 'watch', subject: worst?.subject ?? null, gap: bench !== undefined && fig !== undefined ? Math.round(bench - fig) : null })
  }
  // those who need it most first; students who already have a plan after those who do not (they are being looked after)
  return rows.sort((a, b) => Number(!!a.student.plan) - Number(!!b.student.plan) || b.score - a.score || (b.gap ?? -99) - (a.gap ?? -99) || a.student.name.localeCompare(b.student.name))
}

export type Filters = { query: string; grade: string; cls: string; kind: ReasonKind | ''; level: Level | ''; plan: 'all' | 'without' | 'with' }
export const NO_FILTERS: Filters = { query: '', grade: '', cls: '', kind: '', level: '', plan: 'all' }

export function filterRows(rows: SupportRow[], f: Filters): SupportRow[] {
  const q = f.query.trim().toLowerCase()
  return rows.filter((r) =>
    (!q || r.student.name.toLowerCase().includes(q)) &&
    (!f.grade || String(r.student.grade ?? '') === f.grade) &&
    (!f.cls || r.student.classes.includes(f.cls)) &&
    (!f.kind || r.reasons.some((x) => x.kind === f.kind)) &&
    (!f.level || r.level === f.level) &&
    (f.plan === 'all' || (f.plan === 'with') === !!r.student.plan))
}

export type Summary = { listed: number; high: number; withPlan: number; withoutPlan: number }
export function summarise(rows: SupportRow[]): Summary {
  return { listed: rows.length, high: rows.filter((r) => r.level === 'high').length, withPlan: rows.filter((r) => r.student.plan).length, withoutPlan: rows.filter((r) => !r.student.plan).length }
}

// What to put in the plan form to start with. The teacher edits it.
export function planDefaults(row: SupportRow, data: Pick<SupportData, 'subjects'>): { subject: string; reason: string; goal: string } {
  const reason = row.reasons.map((r) => r.text).join('; ').slice(0, 500)
  const subject = row.subject ?? ''
  const fig = subject ? row.student.subjects.find((x) => x.subject === subject)?.avg : undefined
  const bench = subject ? data.subjects.find((b) => b.subject.toLowerCase() === subject.toLowerCase())?.avg : undefined
  let goal = ''
  if (subject && fig !== undefined) {
    const target = Math.max(50, Math.min(Math.round(fig + 10), bench !== undefined ? Math.round(bench) : 100))
    goal = `Raise the ${subject} average from ${pct(fig)} to ${pct(target)} by the next test`
  } else if (row.reasons.some((r) => r.kind === 'absent' || r.kind === 'late')) goal = 'Be in school and on time every day this month'
  else if (row.reasons.some((r) => r.kind === 'lessons')) goal = 'Finish the lessons that are past their date'
  return { subject, reason, goal }
}

// ---------- plans ----------
export const ACTION_KINDS = [
  { value: 'extra_practice', label: 'Extra practice set' }, { value: 'one_to_one', label: 'One-to-one help' }, { value: 'small_group', label: 'Small group session' },
  { value: 'peer_tutor', label: 'Peer tutor' }, { value: 'parent_contact', label: 'Spoke to parent or guardian' }, { value: 'counsellor', label: 'Guidance counsellor' },
  { value: 'attendance_follow_up', label: 'Attendance follow-up' }, { value: 'other', label: 'Other' },
] as const
export const OUTCOMES = [
  { value: 'improved', label: 'Improved' }, { value: 'no_change', label: 'No change' }, { value: 'referred', label: 'Referred for more help' },
  { value: 'moved', label: 'Student moved or left' }, { value: 'other', label: 'Other' },
] as const
export const kindLabel = (v: string) => ACTION_KINDS.find((k) => k.value === v)?.label ?? v
export const outcomeLabel = (v: string | null) => OUTCOMES.find((o) => o.value === v)?.label ?? ''

export type SupportCase = {
  id: string; student_id: string; student: string; grade: number | null; classes: string[]; subject: string | null; reason: string; goal: string
  status: 'open' | 'monitoring' | 'closed'; review_on: string | null; owner_id: string; owner: string; opened_by: string; opened_at: string; closed_at: string | null
  outcome: string | null; outcome_note: string | null; baseline_pct: number | null; baseline_school_pct: number | null; since_pct: number | null; can_edit: boolean
  actions: { id: string; kind: string; note: string | null; done_on: string; by: string }[]
}

export type ReviewState = 'overdue' | 'soon' | 'later' | 'none'
// today is a YYYY-MM-DD date at the school
export function reviewState(reviewOn: string | null, today: string): ReviewState {
  if (!reviewOn) return 'none'
  if (reviewOn < today) return 'overdue'
  const days = Math.round((new Date(`${reviewOn}T12:00:00Z`).getTime() - new Date(`${today}T12:00:00Z`).getTime()) / DAY)
  return days <= 7 ? 'soon' : 'later'
}

export type Progress = { tone: 'up' | 'down' | 'same' | 'unknown'; delta: number | null; text: string }
// How results moved since the plan began: the student's average on results after it started against the starting line.
export function caseProgress(c: Pick<SupportCase, 'baseline_pct' | 'since_pct' | 'subject'>): Progress {
  const where = c.subject ? ` in ${c.subject}` : ''
  if (c.since_pct === null) return { tone: 'unknown', delta: null, text: `No new results${where} since the plan began.` }
  if (c.baseline_pct === null) return { tone: 'unknown', delta: null, text: `Averaging ${pct(c.since_pct)}${where} since the plan began (no starting figure to compare).` }
  const delta = Math.round((c.since_pct - c.baseline_pct) * 10) / 10
  if (delta >= 3) return { tone: 'up', delta, text: `Up ${Math.abs(Math.round(delta))} points${where}: ${pct(c.baseline_pct)} to ${pct(c.since_pct)} since the plan began.` }
  if (delta <= -3) return { tone: 'down', delta, text: `Down ${Math.abs(Math.round(delta))} points${where}: ${pct(c.baseline_pct)} to ${pct(c.since_pct)} since the plan began.` }
  return { tone: 'same', delta, text: `About the same${where}: ${pct(c.baseline_pct)} to ${pct(c.since_pct)} since the plan began.` }
}

export type Outlook = { total: number; improved: number; noChange: number; other: number }
export function outcomeSummary(closed: Pick<SupportCase, 'outcome'>[]): Outlook {
  const improved = closed.filter((c) => c.outcome === 'improved').length
  const noChange = closed.filter((c) => c.outcome === 'no_change').length
  return { total: closed.length, improved, noChange, other: closed.length - improved - noChange }
}
