'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { planPromotion, type HeldStudent } from '@/lib/promotion'
import { compareClassNames } from '@/lib/classNames'

type Person = { id: string; full_name: string; student_id: string | null }
type GraduatingStudent = Person & { grade_level: number | null; class_name: string | null }

// Year promotion (moving every class up a year each September) and the graduation review (removing students who
// have left). Lives in School Settings. Only a school admin should ever see this: the page that shows it checks that.
export default function YearPromotionPanel() {
  const [graduatingStudents, setGraduatingStudents] = useState<GraduatingStudent[]>([])
  const [promoting, setPromoting] = useState(false)
  const [promotionResult, setPromotionResult] = useState('')
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set())
  const [promotionOk, setPromotionOk] = useState(true)
  const [previewing, setPreviewing] = useState(false)
  // What the promotion would do, worked out and shown before anything is changed.
  const [plan, setPlan] = useState<ReturnType<typeof planPromotion> | null>(null)
  // Names for the students in the plan, so the preview can list who is moving and who is not.
  const [people, setPeople] = useState<Record<string, Person>>({})
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set())

  // Graduation review
  const [showGrad, setShowGrad] = useState(false)
  const [gradSearch, setGradSearch] = useState('')
  const [openClasses, setOpenClasses] = useState<Set<string>>(new Set())

  useEffect(() => { loadGraduatingStudents() }, [])

  async function loadGraduatingStudents() {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, student_id, grade_level, enrollments(class_groups(name))')
      .eq('role', 'student')
      .eq('grade_level', 11)
      .order('full_name')
    setGraduatingStudents(((data || []) as any[]).map((s) => ({
      id: s.id, full_name: s.full_name, student_id: s.student_id, grade_level: s.grade_level,
      class_name: s.enrollments?.[0]?.class_groups?.name ?? null,
    })))
  }

  // The database returns at most 1000 rows per request, so read a big school in pages.
  async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[] | null> {
    const out: T[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await page(from, from + 999)
      if (error || !data) return null
      out.push(...data)
      if (data.length < 1000) return out
    }
  }

  // Step 1: work out who would move where, and show it. Nothing is changed yet.
  async function handlePreviewPromotion() {
    setPreviewing(true)
    setPromotionResult('')
    setOpenGroups(new Set())
    const [students, groups, enrollments] = await Promise.all([
      fetchAll<{ id: string; grade_level: number | null }>((a, b) => supabase.from('profiles').select('id, grade_level').eq('role', 'student').in('grade_level', [7, 8, 9, 10]).order('id').range(a, b)),
      fetchAll<{ id: string; name: string }>((a, b) => supabase.from('class_groups').select('id, name').order('id').range(a, b)),
      fetchAll<{ student_id: string; class_group_id: string }>((a, b) => supabase.from('enrollments').select('student_id, class_group_id').order('id').range(a, b)),
    ])
    if (!students || !groups || !enrollments) {
      setPreviewing(false)
      setPromotionOk(false)
      setPromotionResult('Could not read the school\'s students and classes. Nothing was changed. Please try again.')
      return
    }
    const next = planPromotion(students, groups, enrollments)

    // Names, so the preview can say who. A failure here only means names are missing; the plan itself is unaffected.
    const ids = [...new Set([...next.moves.flatMap((m) => m.studentIds), ...next.held.map((h) => h.studentId)])]
    const found: Record<string, Person> = {}
    for (let i = 0; i < ids.length; i += 100) {
      const { data } = await supabase.from('profiles').select('id, full_name, student_id').in('id', ids.slice(i, i + 100))
      for (const p of (data || []) as Person[]) found[p.id] = p
    }
    setPeople(found)
    setPlan(next)
    setPreviewing(false)
  }

  // Step 2: apply exactly the plan that was shown. Each student moves once, from the class
  // they are in now to the same-numbered class a year up (1-3 to 2-3). Anyone the plan held
  // back is left alone.
  async function handleYearPromotion() {
    if (!plan) return
    setPromoting(true)
    setPromotionResult('')

    let moved = 0
    let failed = 0
    for (const m of plan.moves) {
      const { error: enrollError } = await supabase
        .from('enrollments')
        .update({ class_group_id: m.toGroupId })
        .eq('class_group_id', m.fromGroupId)
        .in('student_id', m.studentIds)
      if (enrollError) { failed += m.studentIds.length; continue }

      const { error: gradeError } = await supabase
        .from('profiles')
        .update({ grade_level: m.toGrade })
        .in('id', m.studentIds)
      if (gradeError) {
        // Put the class back so these students' class and grade still agree.
        await supabase.from('enrollments').update({ class_group_id: m.fromGroupId }).eq('class_group_id', m.toGroupId).in('student_id', m.studentIds)
        failed += m.studentIds.length
        continue
      }
      moved += m.studentIds.length
    }

    await loadGraduatingStudents()
    const heldNote = plan.held.length ? ` ${plan.held.length} student${plan.held.length === 1 ? ' was' : 's were'} not moved and need placing by hand.` : ''
    setPromotionOk(failed === 0)
    setPromotionResult(failed === 0
      ? `Year promotion complete. ${moved} student${moved === 1 ? '' : 's'} moved up.${heldNote}`
      : `${moved} student${moved === 1 ? '' : 's'} moved up, but ${failed} could not be moved and were left as they were. Run the preview again to see who is left.${heldNote}`)
    setPromoting(false)
    setPlan(null)
  }

  async function handleDeleteStudent(studentId: string) {
    setDeletingIds((prev) => new Set(prev).add(studentId))

    // Delete in order: responses → sessions → enrollments → profile
    const { data: sessions } = await supabase
      .from('exam_sessions')
      .select('id')
      .eq('student_id', studentId)

    if (sessions && sessions.length > 0) {
      await supabase.from('responses').delete().in('session_id', sessions.map((s) => s.id))
      await supabase.from('exam_sessions').delete().eq('student_id', studentId)
    }

    await supabase.from('self_mock_questions').delete().in('self_mock_id',
      (await supabase.from('self_mocks').select('id').eq('student_id', studentId)).data?.map((s) => s.id) || []
    )
    await supabase.from('self_mocks').delete().eq('student_id', studentId)
    await supabase.from('enrollments').delete().eq('student_id', studentId)
    await supabase.from('profiles').delete().eq('id', studentId)

    setGraduatingStudents((prev) => prev.filter((s) => s.id !== studentId))
    setDeletingIds((prev) => { const next = new Set(prev); next.delete(studentId); return next })
  }

  function toggle(set: Set<string>, key: string): Set<string> {
    const next = new Set(set)
    if (next.has(key)) next.delete(key); else next.add(key)
    return next
  }

  const moveCount = plan ? plan.moves.reduce((n, m) => n + m.studentIds.length, 0) : 0
  const nameOf = (id: string) => people[id]?.full_name ?? 'Unknown student'
  const idOf = (id: string) => people[id]?.student_id ?? ''

  // Students who will not move, grouped by why, with what to do about it.
  const heldGroups = useMemo(() => {
    const groups = new Map<string, { key: string; title: string; fix: string; students: HeldStudent[] }>()
    for (const h of plan?.held ?? []) {
      let key: string, title: string, fix: string
      if (h.reason === 'no_matching_class') {
        key = `nomatch:${h.className}:${h.wantedClass}`
        title = h.wantedClass ? `In ${h.className}: there is no class ${h.wantedClass} to move them into` : `In ${h.className}: this class has no next-year class`
        fix = h.wantedClass ? `Create class ${h.wantedClass} (or place them yourself), then run the preview again.` : 'Place them by hand.'
      } else if (h.reason === 'several_classes') {
        key = `several:${h.className}`
        title = `In more than one class this year (${h.className})`
        fix = 'A student should be in one class only. Remove the extra enrolment, then run the preview again.'
      } else {
        key = 'noclass'
        title = 'Not in a class that matches their grade'
        fix = 'They have no class, or their class and grade disagree. Place them in the right class first.'
      }
      const g = groups.get(key) ?? { key, title, fix, students: [] }
      g.students.push(h)
      groups.set(key, g)
    }
    return [...groups.values()]
  }, [plan])

  const gradByClass = useMemo(() => {
    const q = gradSearch.trim().toLowerCase()
    const filtered = graduatingStudents.filter((s) => !q || s.full_name.toLowerCase().includes(q) || (s.student_id || '').toLowerCase().includes(q))
    const map = new Map<string, GraduatingStudent[]>()
    for (const s of filtered) {
      const k = s.class_name ?? 'No class'
      map.set(k, [...(map.get(k) ?? []), s])
    }
    return [...map.entries()].sort(([a], [b]) => (a === 'No class' ? 1 : b === 'No class' ? -1 : compareClassNames(a, b)))
  }, [graduatingStudents, gradSearch])

  return (
    <>
      {/* Year promotion */}
      <div className="card" style={{ marginTop: 12 }}>
        <h2 style={{ marginBottom: 4 }}>Year promotion</h2>
        <p style={{ color: 'var(--text-secondary)', margin: '0 0 12px', fontSize: 14 }}>
          Run once at the start of each school year (September 1). You see exactly who moves where before anything changes.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 16 }}>
          <Point title="Moves up" body="Forms 1 to 4 (Grades 7 to 10), each into the class with the same number: 1-3 goes to 2-3." />
          <Point title="Left for you" body="Fifth form and sixth form are not moved automatically, because not everyone continues. Place them by hand." />
          <Point title="Never deleted here" body="Grade 11 students stay until you remove them in the graduation review below." />
        </div>

        {promotionResult && (
          <div className={`banner ${promotionOk ? 'banner-success' : 'banner-danger'}`} style={{ marginBottom: 12 }}>{promotionResult}</div>
        )}

        {!plan ? (
          <button onClick={handlePreviewPromotion} disabled={previewing} className="btn btn-primary">
            {previewing ? 'Checking…' : 'Preview year promotion'}
          </button>
        ) : (
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 14, background: 'var(--page-bg)' }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
              <span className="badge badge-success" style={{ fontSize: 13 }}>{moveCount} will move up</span>
              <span className={`badge ${plan.held.length ? 'badge-warning' : 'badge-default'}`} style={{ fontSize: 13 }}>{plan.held.length} will not move</span>
            </div>

            {plan.moves.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div className="section-label" style={{ marginBottom: 6 }}>Will move up</div>
                {[...plan.moves].sort((a, b) => compareClassNames(a.fromName, b.fromName)).map((m) => {
                  const key = `move:${m.fromGroupId}>${m.toGroupId}`
                  const open = openGroups.has(key)
                  return (
                    <div key={key} style={groupBox}>
                      <button type="button" onClick={() => setOpenGroups((prev) => toggle(prev, key))} aria-expanded={open} style={groupHead}>
                        <span><strong>{m.fromName}</strong> &rarr; <strong>{m.toName}</strong></span>
                        <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{m.studentIds.length} student{m.studentIds.length === 1 ? '' : 's'} {open ? '▲' : '▼'}</span>
                      </button>
                      {open && (
                        <ul style={nameList}>
                          {[...m.studentIds].sort((a, b) => nameOf(a).localeCompare(nameOf(b))).map((id) => (
                            <li key={id}>{nameOf(id)}{idOf(id) && <span style={{ color: 'var(--text-muted)' }}> · {idOf(id)}</span>}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {heldGroups.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div className="section-label" style={{ marginBottom: 6 }}>Will not move, and why</div>
                {heldGroups.map((g) => {
                  const key = `held:${g.key}`
                  const open = openGroups.has(key)
                  return (
                    <div key={key} style={{ ...groupBox, borderColor: 'var(--warning)' }}>
                      <button type="button" onClick={() => setOpenGroups((prev) => toggle(prev, key))} aria-expanded={open} style={groupHead}>
                        <span style={{ textAlign: 'left' }}>{g.title}</span>
                        <span style={{ color: 'var(--text-secondary)', fontSize: 13, whiteSpace: 'nowrap' }}>{g.students.length} student{g.students.length === 1 ? '' : 's'} {open ? '▲' : '▼'}</span>
                      </button>
                      <p style={{ margin: '0 12px 8px', fontSize: 12, color: 'var(--text-secondary)' }}>{g.fix}</p>
                      {open && (
                        <ul style={nameList}>
                          {[...g.students].sort((a, b) => nameOf(a.studentId).localeCompare(nameOf(b.studentId))).map((h) => (
                            <li key={h.studentId}>{nameOf(h.studentId)}{idOf(h.studentId) && <span style={{ color: 'var(--text-muted)' }}> · {idOf(h.studentId)}</span>}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )
                })}
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '6px 0 0' }}>These students are left exactly as they are.</p>
              </div>
            )}

            <p style={{ fontSize: 13, margin: '0 0 12px' }}><strong>This cannot be undone.</strong> Move {moveCount} student{moveCount === 1 ? '' : 's'} up a year?</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleYearPromotion} disabled={promoting || plan.moves.length === 0} className="btn btn-primary">
                {promoting ? 'Promoting…' : 'Yes, run promotion'}
              </button>
              <button onClick={() => setPlan(null)} disabled={promoting} className="btn btn-ghost">Cancel</button>
            </div>
          </div>
        )}
      </div>

      {/* Graduation review */}
      <div className="card" style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ margin: 0 }}>Graduation review</h2>
            <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0', fontSize: 14 }}>
              {graduatingStudents.length === 0 ? 'No Grade 11 students found.' : `${graduatingStudents.length} Grade 11 student${graduatingStudents.length === 1 ? '' : 's'}. Run this review before July 30 each year.`}
            </p>
          </div>
          {graduatingStudents.length > 0 && (
            <button className="btn btn-secondary" onClick={() => setShowGrad(!showGrad)} aria-expanded={showGrad}>
              {showGrad ? 'Hide students' : 'Show students'}
            </button>
          )}
        </div>

        {showGrad && (
          <div style={{ marginTop: 14 }}>
            <p className="banner banner-warning" style={{ marginBottom: 12, fontSize: 13 }}>
              Removing a student permanently deletes their account and all their data, including exam results. This cannot be undone.
            </p>
            <input type="search" value={gradSearch} onChange={(e) => setGradSearch(e.target.value)} placeholder="Search by name or student ID…" aria-label="Search graduating students" style={{ width: '100%', maxWidth: 380, marginBottom: 12 }} />
            {gradByClass.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>No students match.</p>}
            {gradByClass.map(([cls, list]) => {
              const key = `grad:${cls}`
              const open = openClasses.has(key) || gradSearch.trim() !== ''
              return (
                <div key={cls} style={groupBox}>
                  <button type="button" onClick={() => setOpenClasses((prev) => toggle(prev, key))} aria-expanded={open} style={groupHead}>
                    <strong>{cls === 'No class' ? 'No class' : `Class ${cls}`}</strong>
                    <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{list.length} student{list.length === 1 ? '' : 's'} {open ? '▲' : '▼'}</span>
                  </button>
                  {open && (
                    <div>
                      {list.map((s) => (
                        <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '6px 12px', borderTop: '1px solid var(--border)', fontSize: 13 }}>
                          <span>{s.full_name}{s.student_id && <span style={{ color: 'var(--text-muted)' }}> · {s.student_id}</span>}</span>
                          <button
                            onClick={() => {
                              if (confirm(`Permanently delete ${s.full_name}? This removes all their data, including exam results, and cannot be undone.`)) handleDeleteStudent(s.id)
                            }}
                            disabled={deletingIds.has(s.id)}
                            className="btn btn-danger"
                            style={{ fontSize: 11, padding: '3px 10px' }}
                          >
                            {deletingIds.has(s.id) ? 'Removing…' : 'Remove'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}

function Point({ title, body }: { title: string; body: string }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', background: 'var(--page-bg)' }}>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{title}</div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{body}</div>
    </div>
  )
}

const groupBox: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 8, marginBottom: 6, background: 'var(--card-bg)', overflow: 'hidden' }
const groupHead: React.CSSProperties = { width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '9px 12px', background: 'transparent', border: 'none', cursor: 'pointer', font: 'inherit', color: 'inherit' }
const nameList: React.CSSProperties = { margin: 0, padding: '4px 12px 10px 30px', columns: 2, fontSize: 13, lineHeight: 1.7 }
