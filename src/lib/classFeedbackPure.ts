// Weekly class feedback: the questions, week arithmetic, and the plain-language reading of a class's report. Pure, so it can be tested.
// The database (migration 091) decides who may see what; nothing here widens that.

export const MIN_RESPONSES = 5      // the same number the database uses before it shows anonymous answers

export const UNDERSTANDING = [
  { value: 1, label: 'Not at all' }, { value: 2, label: 'A little' }, { value: 3, label: 'Mostly' }, { value: 4, label: 'Very well' },
]
export const PACE = [{ value: 1, label: 'Too slow' }, { value: 2, label: 'Just right' }, { value: 3, label: 'Too fast' }]
export const FREQUENCY = [{ value: 1, label: 'Never' }, { value: 2, label: 'Sometimes' }, { value: 3, label: 'Often' }, { value: 4, label: 'Always' }]
export const CLARITY = [{ value: 1, label: 'Not clear' }, { value: 2, label: 'A bit unclear' }, { value: 3, label: 'Mostly clear' }, { value: 4, label: 'Very clear' }]
export const PACE_VS_PLAN = [{ value: 'ahead', label: 'Ahead of plan' }, { value: 'on_track', label: 'On track' }, { value: 'behind', label: 'Behind plan' }]

// ---------- weeks (Monday to Friday, as dates "YYYY-MM-DD") ----------
const toUtc = (d: string) => new Date(`${d}T12:00:00Z`)
const fmt = (dt: Date) => dt.toISOString().slice(0, 10)
export function mondayOf(date: string): string {
  const dt = toUtc(date)
  const dow = dt.getUTCDay() || 7          // Monday = 1 ... Sunday = 7
  dt.setUTCDate(dt.getUTCDate() - (dow - 1))
  return fmt(dt)
}
export function addWeeks(monday: string, n: number): string { const dt = toUtc(monday); dt.setUTCDate(dt.getUTCDate() + 7 * n); return fmt(dt) }
export function weekLabel(monday: string): string {
  const f = (d: string) => new Intl.DateTimeFormat('en-JM', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }).format(toUtc(d))
  const friday = fmt(new Date(toUtc(monday).getTime() + 4 * 86400000))
  return `${f(monday)} to ${f(friday)}`
}
// Students and teachers can answer for this week and last week.
export function isOpenWeek(weekStart: string, today: string): boolean {
  const thisWeek = mondayOf(today)
  return weekStart <= thisWeek && weekStart >= addWeeks(thisWeek, -1)
}

// ---------- the report ----------
export type ReportRow = {
  week_start: string; teacher_id: string; teacher_name: string; department_id: string | null
  subject: string; class_group_id: string | null; class_name: string | null
  enrolled: number; responded: number; hidden: boolean
  understanding_avg: number | null; engagement_avg: number | null; clarity_avg: number | null; support_avg: number | null
  pace: { too_slow: number; just_right: number; too_fast: number } | null
  hardest_topics: { topic: string; count: number }[] | null
  helped: string[] | null; improve: string[] | null
  needs_attention: { student_id: string; name: string; understanding: number; needs_help: boolean; topic: string | null }[] | null
  reflection: { pace_vs_plan: string | null; covered: string | null; went_well: string | null; difficult: string | null; support_needed: string | null; next_steps: string | null } | null
  lessons_taught: string[] | null
}

export const classKey = (r: Pick<ReportRow, 'teacher_id' | 'subject' | 'class_group_id'>) => `${r.teacher_id}|${r.subject.toLowerCase()}|${r.class_group_id ?? ''}`
export const classTitle = (r: Pick<ReportRow, 'subject' | 'class_name'>) => (r.class_name ? `${r.subject}, ${r.class_name}` : r.subject)
export const responseRate = (r: Pick<ReportRow, 'responded' | 'enrolled'>): number | null => (r.enrolled > 0 ? Math.round((r.responded / r.enrolled) * 100) : null)

export function reflectionWritten(r: Pick<ReportRow, 'reflection'>): boolean {
  const x = r.reflection
  return !!x && !!(x.pace_vs_plan || x.covered || x.went_well || x.difficult || x.support_needed || x.next_steps)
}

export type Advice = { tone: 'concern' | 'good' | 'info'; text: string }

// What the figures mean, in words a teacher can act on. `previous` is the same class the week before, when there is one.
export function adviceFor(row: ReportRow, previous?: ReportRow | null): Advice[] {
  const out: Advice[] = []
  if (row.hidden) return []                   // too few answers to say anything without identifying someone
  const n = row.responded
  if (row.enrolled > 0 && n === 0) return [{ tone: 'info', text: 'Nobody has answered yet. Remind the class to give their feedback; it takes about a minute.' }]
  if (n === 0) return []
  const rate = responseRate(row)
  if (rate !== null && rate < 50) out.push({ tone: 'info', text: `Only ${n} of ${row.enrolled} students answered (${rate}%), so read these figures with care.` })

  const u = row.understanding_avg
  if (u !== null) {
    if (u < 2.5) out.push({ tone: 'concern', text: 'Many students said they did not follow this week. Consider going back over the main idea with a worked example before moving on.' })
    else if (u >= 3.3) out.push({ tone: 'good', text: 'Most students said they understood this week well.' })
    else out.push({ tone: 'info', text: 'Students said they mostly understood. Check the list of students who need help.' })
  }
  if (previous && previous.understanding_avg !== null && u !== null) {
    const d = Math.round((u - previous.understanding_avg) * 100) / 100
    if (d <= -0.4) out.push({ tone: 'concern', text: `Understanding fell compared with last week (${previous.understanding_avg.toFixed(1)} to ${u.toFixed(1)} out of 4).` })
    else if (d >= 0.4) out.push({ tone: 'good', text: `Understanding rose compared with last week (${previous.understanding_avg.toFixed(1)} to ${u.toFixed(1)} out of 4).` })
  }
  if (row.pace) {
    const total = row.pace.too_slow + row.pace.just_right + row.pace.too_fast
    if (total > 0 && row.pace.too_fast / total >= 0.4) out.push({ tone: 'concern', text: `${row.pace.too_fast} of ${total} students said the lessons went too fast. Try slowing down, adding a worked example, or pausing to check understanding.` })
    else if (total > 0 && row.pace.too_slow / total >= 0.4) out.push({ tone: 'info', text: `${row.pace.too_slow} of ${total} students said the lessons were too slow. Stretch work could help them.` })
  }
  if (row.clarity_avg !== null && row.clarity_avg < 2.5) out.push({ tone: 'concern', text: 'Students found the explanations unclear. Try a different way of explaining, with an example from everyday Jamaican life.' })
  if (row.support_avg !== null && row.support_avg < 2.5) out.push({ tone: 'concern', text: 'Students said they could not always ask for help. Invite questions in a low-pressure way, such as writing them on paper or asking a partner first.' })
  if (row.engagement_avg !== null && row.engagement_avg < 2.5) out.push({ tone: 'concern', text: 'Students said they were not very involved. Try more talk in pairs, short quizzes or a game.' })
  const top = row.hardest_topics?.[0]
  if (top && top.count >= 2) out.push({ tone: 'info', text: `${top.count} students named ${top.topic} as the hardest topic.` })
  const attention = row.needs_attention?.length ?? 0
  if (attention > 0) out.push({ tone: 'info', text: `${attention} student${attention === 1 ? '' : 's'} asked for help or understood little. Their names are in the list below, for you and your head of department only.` })
  if (row.reflection?.pace_vs_plan === 'behind' && u !== null && u < 3) out.push({ tone: 'concern', text: 'You are behind plan and students are finding it hard. A short support session may help more than covering new ground.' })
  return out
}

export type Trend = 'up' | 'down' | 'same'
export function trendOf(current: number | null, previous: number | null, threshold = 0.3): Trend | null {
  if (current === null || previous === null) return null
  const d = current - previous
  return d >= threshold ? 'up' : d <= -threshold ? 'down' : 'same'
}

// Groups the rows by class, newest week first inside each class; classes that need the most attention come first.
export function groupByClass(rows: ReportRow[]): { key: string; title: string; weeks: ReportRow[] }[] {
  const by = new Map<string, ReportRow[]>()
  for (const r of rows) by.set(classKey(r), [...(by.get(classKey(r)) ?? []), r])
  const groups = [...by.entries()].map(([key, weeks]) => ({ key, title: `${classTitle(weeks[0])}`, weeks: weeks.slice().sort((a, b) => b.week_start.localeCompare(a.week_start)) }))
  const score = (g: { weeks: ReportRow[] }) => {
    const w = g.weeks.find((x) => x.understanding_avg !== null)
    return w ? (w.understanding_avg as number) : 99      // classes with no figures yet go last
  }
  return groups.sort((a, b) => score(a) - score(b) || a.title.localeCompare(b.title))
}
