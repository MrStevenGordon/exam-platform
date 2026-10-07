// The school day: bell times, lunch by grade, school events, and classes that last more than one period.
// Pure functions only (no database, no screen), so the rules can be tested on their own.
//
// Times are plain "HH:MM" or "HH:MM:SS" strings from the database; inside this file they become minutes after midnight.
// Weekdays use 1 = Monday ... 5 = Friday, as in the timetable tables.

export type PeriodRow = { id: string; name: string; start_time: string; end_time: string; order_index: number }
export type BlockRow = {
  id: string
  kind: 'lunch' | 'event'
  title: string
  grades: number[] | null          // null = every grade
  days: number[] | null            // weekly pattern; null for a one-off
  date_from: string | null         // one-off, "YYYY-MM-DD"
  date_to: string | null
  start_time: string | null        // null (with end_time null) = the whole school day
  end_time: string | null
  note?: string | null
}
export type SectionLike = { id: string; day_of_week: number; period_id: string; span?: number | null; class_group_id?: string | null }

export const SCHOOL_DAYS = [1, 2, 3, 4, 5] as const
export const DAY_NAMES = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
export const DAY_SHORT = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri']

export function toMinutes(t: string | null | undefined): number | null {
  if (!t) return null
  const m = /^(\d{1,2}):(\d{2})/.exec(t)
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2])
}
export function toTimeString(min: number): string {
  const h = Math.floor(min / 60), m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
// 8:00 am, 12:30 pm
export function clock12(min: number): string {
  const h = Math.floor(min / 60), m = min % 60
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'pm' : 'am'}`
}
export function range12(start: number, end: number): string { return `${clock12(start)} to ${clock12(end)}` }

export function sectionSpan(s: { span?: number | null }): number { return Math.max(1, Math.min(4, Number(s.span) || 1)) }

// The school's day: first period start to last period end.
export function dayBounds(periods: PeriodRow[]): { start: number; end: number } | null {
  const starts = periods.map((p) => toMinutes(p.start_time)).filter((v): v is number => v !== null)
  const ends = periods.map((p) => toMinutes(p.end_time)).filter((v): v is number => v !== null)
  if (starts.length === 0 || ends.length === 0) return null
  return { start: Math.min(...starts), end: Math.max(...ends) }
}

// When a class runs: from its first period's start to the end of the last period it covers (a double period covers two).
export function sectionTimes(s: SectionLike, periods: PeriodRow[]): { start: number; end: number } | null {
  const ordered = [...periods].sort((a, b) => a.order_index - b.order_index)
  const i = ordered.findIndex((p) => p.id === s.period_id)
  if (i < 0) return null
  const first = ordered[i]
  const last = ordered[Math.min(ordered.length - 1, i + sectionSpan(s) - 1)]
  const start = toMinutes(first.start_time), end = toMinutes(last.end_time)
  return start === null || end === null ? null : { start, end }
}

// The periods a class covers (its own and the next ones), for drawing and for clash checks.
export function periodsCovered(s: SectionLike, periods: PeriodRow[]): PeriodRow[] {
  const ordered = [...periods].sort((a, b) => a.order_index - b.order_index)
  const i = ordered.findIndex((p) => p.id === s.period_id)
  return i < 0 ? [] : ordered.slice(i, i + sectionSpan(s))
}

export function blockTimes(b: BlockRow, periods: PeriodRow[]): { start: number; end: number } | null {
  const s = toMinutes(b.start_time), e = toMinutes(b.end_time)
  if (s !== null && e !== null) return { start: s, end: e }
  return dayBounds(periods)    // no times = the whole school day
}

export const timesOverlap = (a: { start: number; end: number }, b: { start: number; end: number }) => a.start < b.end && b.start < a.end

function dateInRange(date: string, from: string | null, to: string | null): boolean {
  return !!from && !!to && date >= from && date <= to
}

// The lunch windows and events that apply on a day. Pass the date to include one-off events; without it only weekly ones count.
// A grade of null means "do not filter by grade" (a teacher or the principal sees them all).
export function blocksOn(blocks: BlockRow[], o: { dow: number; date?: string | null; grade?: number | null }): BlockRow[] {
  return blocks.filter((b) => {
    const gradeOk = o.grade == null || b.grades == null || b.grades.includes(o.grade)
    if (!gradeOk) return false
    if (b.days) return b.days.includes(o.dow)
    return !!o.date && dateInRange(o.date, b.date_from, b.date_to)
  })
}

export type Clash = { sectionId: string; blockId: string; title: string; kind: 'lunch' | 'event'; dow: number; when: string }

// Classes that run into lunch or an event for their grade. gradeOf says which grade a class belongs to (null = unknown, so only
// events for every grade are checked). Pass the dates of the days to check to include one-off events.
export function findClashes(
  sections: SectionLike[], periods: PeriodRow[], blocks: BlockRow[],
  gradeOf: (s: SectionLike) => number | null, dates?: Record<number, string>,
): Clash[] {
  const out: Clash[] = []
  for (const s of sections) {
    const t = sectionTimes(s, periods)
    if (!t) continue
    const grade = gradeOf(s)
    for (const b of blocksOn(blocks, { dow: s.day_of_week, date: dates?.[s.day_of_week] ?? null, grade })) {
      // A block for particular grades only matters to a class whose grade we know.
      if (grade === null && b.grades !== null) continue
      const bt = blockTimes(b, periods)
      if (bt && timesOverlap(t, bt)) out.push({ sectionId: s.id, blockId: b.id, title: b.title, kind: b.kind, dow: s.day_of_week, when: range12(Math.max(t.start, bt.start), Math.min(t.end, bt.end)) })
    }
  }
  return out
}

// Hourly (or any length) periods from a start and an end. A last piece shorter than the length is dropped, never invented.
export function generatePeriods(startMin: number, endMin: number, lengthMin: number, prefix = 'Period'): { name: string; start_time: string; end_time: string; order_index: number }[] {
  if (!(lengthMin >= 10) || endMin <= startMin) return []
  const out: { name: string; start_time: string; end_time: string; order_index: number }[] = []
  for (let s = startMin, i = 0; s + lengthMin <= endMin && i < 20; s += lengthMin, i++) {
    out.push({ name: `${prefix} ${i + 1}`, start_time: toTimeString(s), end_time: toTimeString(s + lengthMin), order_index: i })
  }
  return out
}

// What a person's week looks like, ready to draw. classes keep their section; blocks are the lunch and events for that day.
export type WeekDay<T extends SectionLike> = { dow: number; date: string | null; classes: { section: T; start: number; end: number }[]; blocks: { block: BlockRow; start: number; end: number }[] }
export function weekItems<T extends SectionLike>(
  sections: T[], periods: PeriodRow[], blocks: BlockRow[], o: { grade?: number | null; dates?: (string | null)[] } = {},
): WeekDay<T>[] {
  return SCHOOL_DAYS.map((dow) => {
    const date = o.dates?.[dow - 1] ?? null
    const classes = sections.filter((s) => s.day_of_week === dow).flatMap((s) => {
      const t = sectionTimes(s, periods)
      return t ? [{ section: s, start: t.start, end: t.end }] : []
    }).sort((a, b) => a.start - b.start)
    const bl = blocksOn(blocks, { dow, date, grade: o.grade ?? null }).flatMap((b) => {
      const t = blockTimes(b, periods)
      return t ? [{ block: b, start: t.start, end: t.end }] : []
    }).sort((a, b) => a.start - b.start)
    return { dow, date, classes, blocks: bl }
  })
}

// Minutes after midnight in Jamaica (UTC-5, no daylight saving) for a moment in time.
export function jamaicaMinutes(now: Date): number {
  const utc = now.getUTCHours() * 60 + now.getUTCMinutes()
  return (utc - 5 * 60 + 1440) % 1440
}

// For a day's items: the class on now, and the next thing after it.
export type Entry = { kind: 'class' | 'lunch' | 'event'; start: number; end: number; ref: unknown }
export function dayEntries<T extends SectionLike>(day: WeekDay<T>): Entry[] {
  return [
    ...day.classes.map((c) => ({ kind: 'class' as const, start: c.start, end: c.end, ref: c.section })),
    ...day.blocks.map((b) => ({ kind: b.block.kind, start: b.start, end: b.end, ref: b.block })),
  ].sort((a, b) => a.start - b.start || (a.kind === 'class' ? 1 : -1))
}
export function nowAndNext(entries: Entry[], nowMin: number): { now: Entry | null; next: Entry | null } {
  // A school event takes the place of a class that clashes with it.
  const active = entries.filter((e) => nowMin >= e.start && nowMin < e.end)
  const now = active.find((e) => e.kind === 'event') ?? active.find((e) => e.kind === 'class') ?? active[0] ?? null
  const next = entries.find((e) => e.start >= (now ? now.end : nowMin) && e !== now && e.start > nowMin) ?? null
  return { now, next }
}

// "Grades 7 to 9", "Grades 10, 11 and 12", "Grade 9", "Every grade"
export function gradesLabel(grades: number[] | null | undefined): string {
  if (!grades || grades.length === 0) return 'Every grade'
  const g = [...new Set(grades)].sort((a, b) => a - b)
  if (g.length === 1) return `Grade ${g[0]}`
  const consecutive = g.every((v, i) => i === 0 || v === g[i - 1] + 1)
  if (consecutive && g.length >= 3) return `Grades ${g[0]} to ${g[g.length - 1]}`
  return `Grades ${g.slice(0, -1).join(', ')} and ${g[g.length - 1]}`
}

// "Mondays", "Mondays and Wednesdays", "Every school day"
export function daysLabel(days: number[] | null | undefined): string {
  if (!days || days.length === 0) return ''
  const d = [...new Set(days)].sort((a, b) => a - b)
  if (d.length === 5) return 'Every school day'
  const n = d.map((x) => `${DAY_NAMES[x]}s`)
  return n.length === 1 ? n[0] : `${n.slice(0, -1).join(', ')} and ${n[n.length - 1]}`
}
