// A student's own progress, compared only with their own earlier results. This file takes nothing but the student's own results, so it
// cannot show any other student or any school-wide figure. (The staff Support page has its own, separate logic and data.)

export type OwnResult = { subject: string; pct: number; at: string; title?: string }
export type Trend = 'up' | 'down' | 'steady'
export type SubjectProgress = {
  subject: string; count: number; first: number; latest: number; best: number
  recentAvg: number; earlierAvg: number | null      // the latest results against the ones before them
  change: number | null                              // recentAvg - earlierAvg
  trend: Trend | null
  series: number[]                                   // oldest to newest, for the little chart
  message: string
}
export type MyProgress = { subjects: SubjectProgress[]; overall: { count: number; trend: Trend | null; change: number | null; headline: string }; }

const RECENT = 3      // at most this many of the latest results count as "recent"; with fewer results, the latest half does
const recentCount = (n: number) => Math.min(RECENT, Math.ceil(n / 2))
const STEADY = 3      // within this many points counts as steady
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
const r1 = (n: number) => Math.round(n)

function trendOf(change: number | null): Trend | null { return change === null ? null : change >= STEADY ? 'up' : change <= -STEADY ? 'down' : 'steady' }

function messageFor(s: Omit<SubjectProgress, 'message'>): string {
  if (s.count === 1) return `Your first ${s.subject} result is ${r1(s.latest)}%. Each new result shows how you are growing.`
  if (s.change === null) return `You have ${s.count} ${s.subject} results so far, averaging ${r1(s.recentAvg)}%.`
  if (s.trend === 'up') return `Your recent ${s.subject} results average ${r1(s.recentAvg)}%, up ${r1(s.change)} points on before. Keep going.`
  if (s.trend === 'down') return `Your recent ${s.subject} results are a little lower than before (${r1(s.earlierAvg as number)}% to ${r1(s.recentAvg)}%). That happens. A short practice on the topics you found hard can lift it.`
  return `Your ${s.subject} results are steady at about ${r1(s.recentAvg)}%. Steady is a good base to build on.`
}

export function myProgress(results: OwnResult[]): MyProgress {
  const valid = results.filter((r) => Number.isFinite(r.pct) && r.at)
  const by = new Map<string, OwnResult[]>()
  for (const r of valid) by.set(r.subject || 'Other', [...(by.get(r.subject || 'Other') ?? []), r])

  const subjects: SubjectProgress[] = [...by.entries()].map(([subject, rs]) => {
    const sorted = rs.slice().sort((a, b) => a.at.localeCompare(b.at))
    const pcts = sorted.map((r) => r.pct)
    const k = recentCount(pcts.length)
    const recent = pcts.slice(-k)
    const earlier = pcts.slice(0, pcts.length - k)
    const recentAvg = avg(recent)
    const earlierAvg = earlier.length ? avg(earlier) : null
    const change = earlierAvg === null ? null : recentAvg - earlierAvg
    const base = { subject, count: pcts.length, first: pcts[0], latest: pcts[pcts.length - 1], best: Math.max(...pcts), recentAvg, earlierAvg, change, trend: trendOf(change), series: pcts.slice(-12) }
    return { ...base, message: messageFor(base) }
  }).sort((a, b) => a.subject.localeCompare(b.subject))

  // overall: every result in date order, latest 3 against the rest, so one big subject does not hide the picture
  const all = valid.slice().sort((a, b) => a.at.localeCompare(b.at)).map((r) => r.pct)
  const kAll = recentCount(all.length)
  const changeAll = all.length >= 2 ? avg(all.slice(-kAll)) - avg(all.slice(0, all.length - kAll)) : null
  const trend = trendOf(changeAll)
  const headline = all.length === 0 ? 'Your results will show here as your teachers share them.'
    : trend === 'up' ? `Your recent results are ${r1(changeAll as number)} points higher than before. Well done.`
    : trend === 'down' ? 'Your last few results are a little lower than before. Pick one topic to practise this week.'
    : trend === 'steady' ? 'Your results are steady. A little extra practice can move them up.'
    : `You have ${all.length} ${all.length === 1 ? 'result' : 'results'} so far. Keep going.`
  return { subjects, overall: { count: all.length, trend, change: changeAll, headline } }
}
