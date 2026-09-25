import { supabase } from '@/lib/supabase'
import { compareClassNames } from '@/lib/classNames'

export type CoverageTopic = { id: string; unit: string | null; name: string }
export type CoverageClass = { id: string; name: string; students: number }
export type CoverageCell = {
  topic_id: string
  class_group_id: string
  lessons: number
  students: number
  finished: number
  possible: number
  last_given: string | null
  check_pct: number | null
}
export type CoverageData = { topics: CoverageTopic[]; classes: CoverageClass[]; cells: CoverageCell[]; unlinked_lessons: number }
export type CoverageOption = { subject: string; grade: number; topics: number }

// none = no class has had it; partial = some classes have, some have not (the gap to chase); all = every class.
export type RowStatus = 'none' | 'partial' | 'all'

export function completionPct(c: CoverageCell): number | null {
  return c.possible > 0 ? Math.round((c.finished / c.possible) * 100) : null
}

export function sortedClasses(d: CoverageData): CoverageClass[] {
  return [...d.classes].sort((a, b) => compareClassNames(a.name, b.name))
}

// Everything the screen needs to say about the grid, worked out once.
export function summarize(d: CoverageData) {
  const byTopic = new Map<string, Set<string>>()
  for (const c of d.cells) {
    const set = byTopic.get(c.topic_id) ?? new Set<string>()
    set.add(c.class_group_id)
    byTopic.set(c.topic_id, set)
  }
  const classCount = d.classes.length
  const status: Record<string, RowStatus> = {}
  for (const t of d.topics) {
    const n = byTopic.get(t.id)?.size ?? 0
    status[t.id] = n === 0 ? 'none' : n >= classCount ? 'all' : 'partial'
  }
  const rows = Object.values(status)
  const perClass: Record<string, number> = {}
  for (const c of d.classes) perClass[c.id] = d.cells.filter((x) => x.class_group_id === c.id).length
  return {
    topicsTotal: d.topics.length,
    taughtAny: rows.filter((s) => s !== 'none').length,
    taughtAll: rows.filter((s) => s === 'all').length,
    notTaught: rows.filter((s) => s === 'none').length,
    classesTotal: classCount,
    status,
    perClass,
    classesGiven: (topicId: string) => byTopic.get(topicId)?.size ?? 0,
  }
}

export function cellTitle(t: CoverageTopic, cls: CoverageClass, c: CoverageCell | undefined, someoneHasIt: boolean): string {
  if (!c) return `${cls.name} · ${t.name}: ${someoneHasIt ? 'not given yet, though other classes have had it' : 'not given yet'}`
  const pct = completionPct(c)
  return `${cls.name} · ${t.name}: ${c.lessons} lesson${c.lessons === 1 ? '' : 's'} given to ${c.students} student${c.students === 1 ? '' : 's'}`
    + (pct === null ? '' : `, ${c.finished} of ${c.possible} finished (${pct}%)`)
    + (c.check_pct === null ? '' : `, check average ${c.check_pct}%`)
}

// A spreadsheet-friendly version of the grid, for meetings and reports.
export function toCsv(subject: string, grade: number, d: CoverageData): string {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
  const classes = sortedClasses(d)
  const sum = summarize(d)
  const lines = [[`Subject`, subject, `Grade`, grade].map(esc).join(',')]
  lines.push(['Unit', 'Topic', 'Classes given', ...classes.map((c) => c.name)].map(esc).join(','))
  for (const t of d.topics) {
    const cells = classes.map((cls) => {
      const c = d.cells.find((x) => x.topic_id === t.id && x.class_group_id === cls.id)
      if (!c) return 'Not given'
      const pct = completionPct(c)
      return `${c.lessons} lesson${c.lessons === 1 ? '' : 's'}${pct === null ? '' : `, ${pct}% finished`}${c.check_pct === null ? '' : `, check ${c.check_pct}%`}`
    })
    lines.push([t.unit ?? '', t.name, `${sum.classesGiven(t.id)} of ${classes.length}`, ...cells].map(esc).join(','))
  }
  lines.push(['', 'Lessons not linked to a topic', d.unlinked_lessons].map(esc).join(','))
  return lines.join('\r\n')
}

let availability: Promise<boolean> | null = null

// Coverage needs migration 063. Until it is applied it is not offered anywhere.
export function isCoverageAvailable(): Promise<boolean> {
  if (!availability) {
    availability = (async () => {
      try {
        const { error } = await supabase.rpc('learning_coverage_subjects')
        return !error
      } catch {
        return false
      }
    })()
  }
  return availability
}
