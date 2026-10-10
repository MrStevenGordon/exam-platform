// Small rules behind the timetable "New section" form. Nothing here talks to the database.

export type ClassGroupLite = { id: string; name: string; year_grade: string }
export type TeacherLite = { id: string; full_name: string }

// "Grade 10" -> 10, "Form 4" -> 4. null when there is no number.
export function gradeNumber(yearGrade: string | null | undefined): number | null {
  const m = /\d+/.exec(yearGrade ?? '')
  return m ? Number(m[0]) : null
}

const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' })

// Grade 7 first up to Grade 12 (13), then classes with no grade number; inside a grade by class name, counting 2 before 10.
export function sortClassGroups<T extends ClassGroupLite>(groups: T[]): T[] {
  return [...groups].sort((a, b) => {
    const ga = gradeNumber(a.year_grade), gb = gradeNumber(b.year_grade)
    if (ga !== gb) return ga === null ? 1 : gb === null ? -1 : ga - gb
    return collator.compare(a.name, b.name) || a.id.localeCompare(b.id)
  })
}

export function groupClassGroups<T extends ClassGroupLite>(groups: T[]): Array<{ label: string; items: T[] }> {
  const out: Array<{ label: string; items: T[] }> = []
  for (const g of sortClassGroups(groups)) {
    const n = gradeNumber(g.year_grade)
    const label = n === null ? (g.year_grade?.trim() || 'Other classes') : `Grade ${n}`
    const last = out[out.length - 1]
    if (last && last.label === label) last.items.push(g)
    else out.push({ label, items: [g] })
  }
  return out
}

const byName = (a: TeacherLite, b: TeacherLite) => collator.compare(a.full_name, b.full_name)

// Everyone who can be given a class in a department: people recorded as teaching one of its subjects, and people whose profile is in the
// department, without repeats.
export function departmentTeachers(subjectRows: Array<{ teacher_id: string; profile: TeacherLite | null }>, staffInDepartment: TeacherLite[]): TeacherLite[] {
  const seen = new Map<string, TeacherLite>()
  for (const r of subjectRows) if (r.profile && !seen.has(r.profile.id)) seen.set(r.profile.id, r.profile)
  for (const t of staffInDepartment) if (!seen.has(t.id)) seen.set(t.id, t)
  return [...seen.values()].sort(byName)
}

export type TeacherGroup = { label: string; items: TeacherLite[] }

// How the Teacher list is laid out: people who teach the chosen subject first, then the rest of the department, then (only when the
// person building the timetable may use them) everyone else.
export function teacherGroups(deptTeachers: TeacherLite[], teachesSubject: Set<string> | undefined, subject: string, deptName: string, others: TeacherLite[] = []): TeacherGroup[] {
  const groups: TeacherGroup[] = []
  const teaches = subject && teachesSubject ? deptTeachers.filter((t) => teachesSubject.has(t.id)) : []
  if (teaches.length > 0) {
    groups.push({ label: `Teaches ${subject}`, items: teaches })
    const rest = deptTeachers.filter((t) => !teachesSubject!.has(t.id))
    if (rest.length > 0) groups.push({ label: `Other ${deptName} staff`, items: rest })
  } else if (deptTeachers.length > 0) {
    groups.push({ label: deptName ? `${deptName} staff` : 'Staff', items: deptTeachers })
  }
  const inDept = new Set(deptTeachers.map((t) => t.id))
  const rest = others.filter((t) => !inDept.has(t.id)).sort(byName)
  if (rest.length > 0) groups.push({ label: 'Other teachers', items: rest })
  return groups
}

// The students to offer, filtered by what was typed, never showing someone already on the roster.
export function studentsToOffer<T extends { id: string; full_name: string }>(all: T[], roster: string[], filter: string, limit = 60): { items: T[]; more: number } {
  const have = new Set(roster)
  const q = filter.trim().toLowerCase()
  const match = all.filter((s) => !have.has(s.id) && (!q || s.full_name.toLowerCase().includes(q)))
  return { items: match.slice(0, limit), more: Math.max(0, match.length - limit) }
}

export const DURATION_OPTIONS = [
  { value: 1, label: '1 period' },
  { value: 2, label: '2 periods (double)' },
  { value: 3, label: '3 periods' },
] as const

// One message for a run that created some days and not others.
export function createSummary(created: number, failed: Array<{ day: string; reason: string }>): { ok: boolean; text: string } {
  if (failed.length === 0) return { ok: true, text: created === 1 ? 'Section created.' : `${created} sections created.` }
  const bad = failed.map((f) => `${f.day}: ${f.reason}`).join(' ')
  return { ok: false, text: created > 0 ? `${created} section${created === 1 ? '' : 's'} created, but not all. ${bad}` : bad }
}
