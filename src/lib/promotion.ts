import { gradeLevelFromClassName } from '@/lib/classNames'

export type PromoStudent = { id: string; grade_level: number | null }
export type PromoGroup = { id: string; name: string }
export type PromoEnrollment = { student_id: string; class_group_id: string }

export type PromotionMove = {
  fromGroupId: string
  toGroupId: string
  fromName: string
  toName: string
  toGrade: number
  studentIds: string[]
}

export type HeldReason = 'no_class' | 'several_classes' | 'no_matching_class'
export type HeldStudent = { studentId: string; reason: HeldReason; className: string | null; wantedClass: string | null }

// 1-3 becomes 2-3, 2-3 becomes 3-3, up to 4-3 becoming 5-3. Fifth form and the sixth form
// are not moved automatically: not every fifth former continues, so the school places them.
export function nextClassName(name: string): string | null {
  const m = /^([1-4])-(\d+)$/.exec(name.trim())
  return m ? `${Number(m[1]) + 1}-${m[2]}` : null
}

// Works out who moves where from a snapshot of the school, before anything is changed, so
// nobody can be promoted twice. Anyone who cannot be placed automatically (their class has
// no partner in the next year, they have no class, or several) is held for manual placement
// and left completely untouched.
export function planPromotion(students: PromoStudent[], groups: PromoGroup[], enrollments: PromoEnrollment[]) {
  const byId = new Map(groups.map((g) => [g.id, g]))
  const byName = new Map(groups.map((g) => [g.name.trim(), g]))
  const enrolled = new Map<string, string[]>()
  for (const e of enrollments) enrolled.set(e.student_id, [...(enrolled.get(e.student_id) ?? []), e.class_group_id])

  const moves = new Map<string, PromotionMove>()
  const held: HeldStudent[] = []

  for (const s of students) {
    if (s.grade_level === null || s.grade_level < 7 || s.grade_level > 10) continue
    const inGrade = (enrolled.get(s.id) ?? [])
      .map((id) => byId.get(id))
      .filter((g): g is PromoGroup => !!g && gradeLevelFromClassName(g.name) === s.grade_level)

    if (inGrade.length === 0) { held.push({ studentId: s.id, reason: 'no_class', className: null, wantedClass: null }); continue }
    if (inGrade.length > 1) { held.push({ studentId: s.id, reason: 'several_classes', className: inGrade.map((g) => g.name).join(', '), wantedClass: null }); continue }

    const from = inGrade[0]
    const wanted = nextClassName(from.name)
    const to = wanted ? byName.get(wanted) : undefined
    if (!wanted || !to) { held.push({ studentId: s.id, reason: 'no_matching_class', className: from.name, wantedClass: wanted }); continue }

    const key = `${from.id}>${to.id}`
    const move = moves.get(key) ?? { fromGroupId: from.id, toGroupId: to.id, fromName: from.name, toName: to.name, toGrade: s.grade_level + 1, studentIds: [] }
    move.studentIds.push(s.id)
    moves.set(key, move)
  }

  return { moves: [...moves.values()], held }
}
