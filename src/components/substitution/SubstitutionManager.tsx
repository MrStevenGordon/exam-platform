'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { jamaicaDate, schoolYear, shiftDate, formatDay } from '@/lib/attendance'
import { substitutionError, notifyUnfilled, notifyCover, SUBSTITUTION_CHANGED_EVENT } from '@/lib/substitution'

type Staff = { staff_id: string; staff_name: string; staff_role: string; department_name: string | null }
type Period = { id: string; name: string; order_index: number }
type Section = { section_id: string; subject: string; period_id: string; period_name: string; period_order: number; class_name: string | null; day_of_week: number }
type BoardRow = {
  assignment_id: string; absence_id: string; class_date: string; subject: string; period_name: string; period_order: number
  class_name: string | null; absent_id: string; absent_name: string; substitute_id: string | null; substitute_name: string | null
  status: 'assigned' | 'unfilled'; lesson_label: string | null; department_name: string | null
}
type Option = { teacher_id: string; teacher_name: string; day_load: number }
type ResultRow = { class_date: string; section_id: string; subject: string; period_name: string; status: 'assigned' | 'unfilled'; substitute_name: string | null }
type Plan = { id: string; subject: string; topic: string; grade: string | null; teacher_id: string }
type OwnLesson = { id: string; title: string; subject: string }

// One row per distinct class in the chosen dates (subject + period + class), so a week of leave means picking a
// lesson once per class, not once per day it repeats.
type Group = { key: string; subject: string; periodName: string; periodOrder: number; className: string | null; days: string[]; sectionIds: string[] }

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
const labelStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }
const fieldStyle: React.CSSProperties = { width: '100%', fontWeight: 400, textTransform: 'none' }

function classLine(subject: string, className: string | null) {
  return className ? `${subject} · ${className}` : subject
}

// An HOD sees their own department; a school admin sees the whole school. The database decides what comes back,
// so `scope` only changes wording and whether Smart Learning lessons can be picked (admins can read them).
export default function SubstitutionManager({ scope }: { scope: 'department' | 'school' }) {
  const isAdmin = scope === 'school'
  const today = jamaicaDate()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [staff, setStaff] = useState<Staff[]>([])
  const [periods, setPeriods] = useState<Period[]>([])
  const [search, setSearch] = useState('')

  const [board, setBoard] = useState<BoardRow[]>([])
  const [boardFrom, setBoardFrom] = useState(today)
  const [boardTo, setBoardTo] = useState(shiftDate(today, 14))

  // Marking someone absent
  const [target, setTarget] = useState<Staff | null>(null)
  const [markFrom, setMarkFrom] = useState(today)
  const [markTo, setMarkTo] = useState(today)
  const [markScope, setMarkScope] = useState<'whole' | 'specific'>('whole')
  const [selectedPeriods, setSelectedPeriods] = useState<Set<string>>(new Set())
  const [sections, setSections] = useState<Section[]>([])
  const [sectionsLoading, setSectionsLoading] = useState(false)
  const [ownPlans, setOwnPlans] = useState<Plan[]>([])
  const [otherPlans, setOtherPlans] = useState<Plan[]>([])
  const [ownLessons, setOwnLessons] = useState<OwnLesson[]>([])
  const [lessonChoices, setLessonChoices] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [markError, setMarkError] = useState('')
  const [results, setResults] = useState<ResultRow[] | null>(null)

  // Swapping or retrying one class
  const [swapId, setSwapId] = useState<string | null>(null)
  const [swapOptions, setSwapOptions] = useState<Option[]>([])
  const [swapChoice, setSwapChoice] = useState('')
  const [rowBusy, setRowBusy] = useState<string | null>(null)
  const [rowMessage, setRowMessage] = useState<Record<string, string>>({})

  const tellBadge = () => window.dispatchEvent(new Event(SUBSTITUTION_CHANGED_EVENT))

  // Bumping this re-reads the board (after marking someone absent, swapping, or retrying).
  const [boardTick, setBoardTick] = useState(0)
  const reloadBoard = () => setBoardTick((n) => n + 1)

  useEffect(() => {
    let cancelled = false
    async function loadBase() {
      const [staffRes, periodRes] = await Promise.all([
        supabase.rpc('substitution_staff_list'),
        supabase.from('timetable_periods').select('id, name, order_index').eq('academic_year', schoolYear(jamaicaDate())).order('order_index'),
      ])
      if (cancelled) return
      if (staffRes.error) setError(substitutionError(staffRes.error))
      setStaff((staffRes.data || []) as Staff[])
      setPeriods((periodRes.data || []) as Period[])
      setLoading(false)
    }
    loadBase()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function loadBoard() {
      const { data, error: boardError } = await supabase.rpc('substitution_board', { p_from: boardFrom, p_to: boardTo })
      if (cancelled) return
      if (boardError) { setError(substitutionError(boardError)); return }
      setBoard((data || []) as BoardRow[])
    }
    loadBoard()
    return () => { cancelled = true }
  }, [boardFrom, boardTo, boardTick])

  // The classes the chosen teacher has in the chosen dates (and periods).
  useEffect(() => {
    let cancelled = false
    async function loadSections() {
      if (!target || !markFrom || !markTo || markTo < markFrom) { setSections([]); return }
      setSectionsLoading(true)
      const { data, error: sectionError } = await supabase.rpc('substitution_teacher_sections', {
        p_teacher_id: target.staff_id,
        p_start_date: markFrom,
        p_end_date: markTo,
        p_period_ids: markScope === 'specific' ? Array.from(selectedPeriods) : null,
      })
      if (cancelled) return
      if (sectionError) setMarkError(substitutionError(sectionError))
      setSections((data || []) as Section[])
      setSectionsLoading(false)
    }
    loadSections()
    return () => { cancelled = true }
  }, [target, markFrom, markTo, markScope, selectedPeriods])

  const groups = useMemo<Group[]>(() => {
    const byKey = new Map<string, Group>()
    for (const s of sections) {
      const key = `${s.subject}|${s.period_id}|${s.class_name || ''}`
      const day = DAY_NAMES[s.day_of_week - 1] || ''
      const existing = byKey.get(key)
      if (existing) {
        if (!existing.days.includes(day)) existing.days.push(day)
        existing.sectionIds.push(s.section_id)
      } else {
        byKey.set(key, { key, subject: s.subject, periodName: s.period_name, periodOrder: s.period_order, className: s.class_name, days: [day], sectionIds: [s.section_id] })
      }
    }
    return Array.from(byKey.values()).sort((a, b) => a.periodOrder - b.periodOrder)
  }, [sections])

  // Lessons the caller can attach: the teacher's own plans first, then other teachers' plans in the same subject.
  // A school admin can also attach the teacher's published Smart Learning lessons.
  useEffect(() => {
    let cancelled = false
    async function loadOwn() {
      if (!target) return
      const plans = await supabase.from('lesson_plans').select('id, subject, topic, grade, teacher_id').eq('teacher_id', target.staff_id).order('topic')
      const lessons = isAdmin
        ? await supabase.from('learning_lessons').select('id, title, subject').eq('teacher_id', target.staff_id).eq('status', 'published').order('title')
        : { data: [] as OwnLesson[] }
      if (cancelled) return
      setOwnPlans((plans.data || []) as Plan[])
      setOwnLessons((lessons.data || []) as OwnLesson[])
    }
    loadOwn()
    return () => { cancelled = true }
  }, [target, isAdmin])

  const subjectsKey = Array.from(new Set(groups.map((g) => g.subject))).sort().join('|')
  useEffect(() => {
    let cancelled = false
    async function loadOthers() {
      if (!target || !subjectsKey) return
      const { data } = await supabase
        .from('lesson_plans')
        .select('id, subject, topic, grade, teacher_id')
        .in('subject', subjectsKey.split('|'))
        .neq('teacher_id', target.staff_id)
        .order('created_at', { ascending: false })
        .limit(200)
      if (!cancelled) setOtherPlans((data || []) as Plan[])
    }
    loadOthers()
    return () => { cancelled = true }
  }, [target, subjectsKey])

  function openMark(person: Staff) {
    setTarget(person)
    setMarkFrom(today)
    setMarkTo(today)
    setMarkScope('whole')
    setSelectedPeriods(new Set())
    setLessonChoices({})
    setMarkError('')
    setResults(null)
    setOwnPlans([])
    setOtherPlans([])
    setOwnLessons([])
  }

  function closeMark() {
    setTarget(null)
    setResults(null)
    setMarkError('')
  }

  function togglePeriod(id: string) {
    setSelectedPeriods((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const planLabel = (p: Plan) => `${p.topic} (${p.subject}${p.grade ? `, grade ${p.grade}` : ''})`

  async function handleSubmit() {
    if (!target) return
    setMarkError('')
    const missing = groups.find((g) => !lessonChoices[g.key])
    if (missing) { setMarkError(`Pick a lesson for ${missing.subject} (${missing.periodName}).`); return }
    setSubmitting(true)
    const lessons: Array<{ section_id: string; lesson_plan_id?: string; learning_lesson_id?: string }> = []
    for (const g of groups) {
      const [kind, id] = lessonChoices[g.key].split(':')
      for (const sectionId of g.sectionIds) {
        lessons.push({ section_id: sectionId, ...(kind === 'lp' ? { lesson_plan_id: id } : { learning_lesson_id: id }) })
      }
    }
    const { data, error: submitError } = await supabase.rpc('submit_absence_for_teacher', {
      p_teacher_id: target.staff_id,
      p_start_date: markFrom,
      p_end_date: markTo,
      p_period_ids: markScope === 'specific' ? Array.from(selectedPeriods) : null,
      p_lessons: lessons,
    })
    setSubmitting(false)
    if (submitError) { setMarkError(substitutionError(submitError)); return }
    const out = data as unknown as { absence_id: string; results: ResultRow[] } | null
    const rows = out?.results || []
    setResults(rows)
    if (out?.absence_id && rows.some((r) => r.status === 'unfilled')) notifyUnfilled(out.absence_id)
    if (out?.absence_id) notifyCover(out.absence_id)
    tellBadge()
    reloadBoard()
  }

  async function openSwap(row: BoardRow) {
    setSwapId(row.assignment_id)
    setSwapChoice('')
    setSwapOptions([])
    setRowMessage((m) => ({ ...m, [row.assignment_id]: '' }))
    const { data, error: optionError } = await supabase.rpc('substitution_options', { p_assignment_id: row.assignment_id })
    if (optionError) { setRowMessage((m) => ({ ...m, [row.assignment_id]: substitutionError(optionError) })); return }
    setSwapOptions((data || []) as Option[])
  }

  async function confirmSwap(row: BoardRow) {
    if (!swapChoice) return
    setRowBusy(row.assignment_id)
    const { data, error: swapError } = await supabase.rpc('reassign_substitute', { p_assignment_id: row.assignment_id, p_teacher_id: swapChoice })
    setRowBusy(null)
    if (swapError) { setRowMessage((m) => ({ ...m, [row.assignment_id]: substitutionError(swapError) })); return }
    const name = (data as unknown as { substitute_name?: string } | null)?.substitute_name
    setSwapId(null)
    setNotice(`${row.subject} (${row.period_name}) is now covered by ${name || 'the new substitute'}.`)
    notifyCover(row.absence_id)
    tellBadge()
    reloadBoard()
  }

  async function retry(row: BoardRow) {
    setRowBusy(row.assignment_id)
    setRowMessage((m) => ({ ...m, [row.assignment_id]: '' }))
    const { data, error: retryError } = await supabase.rpc('reassign_substitute', { p_assignment_id: row.assignment_id })
    setRowBusy(null)
    if (retryError) { setRowMessage((m) => ({ ...m, [row.assignment_id]: substitutionError(retryError) })); return }
    const out = data as unknown as { status: string; substitute_name?: string | null } | null
    if (out?.status === 'assigned') {
      setNotice(`${row.subject} (${row.period_name}) is now covered by ${out.substitute_name}.`)
      notifyCover(row.absence_id)
      tellBadge()
      reloadBoard()
    } else {
      setRowMessage((m) => ({ ...m, [row.assignment_id]: 'Still nobody free at that time.' }))
    }
  }

  const visibleStaff = staff.filter((p) => !search || p.staff_name.toLowerCase().includes(search.toLowerCase()))
  const upcoming = board.filter((r) => r.class_date >= today)
  const needsCover = upcoming.filter((r) => r.status === 'unfilled')
  const dates = Array.from(new Set(board.map((r) => r.class_date)))

  function renderRow(r: BoardRow) {
    const canChange = r.class_date >= today
    const busy = rowBusy === r.assignment_id
    return (
      <div key={r.assignment_id} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', padding: '10px 12px', border: `1px solid ${r.status === 'unfilled' && canChange ? 'var(--warning)' : 'var(--border)'}`, background: r.status === 'unfilled' && canChange ? 'var(--warning-bg)' : 'var(--card-bg)', borderRadius: 8 }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontWeight: 700, fontSize: 13 }}>{r.period_name} · {classLine(r.subject, r.class_name)}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
            Absent: {r.absent_name}{r.lesson_label ? ` · Lesson: ${r.lesson_label}` : ''}
          </div>
          {rowMessage[r.assignment_id] && <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>{rowMessage[r.assignment_id]}</div>}
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: r.status === 'assigned' ? 'var(--success)' : 'var(--warning)' }}>
          {r.status === 'assigned' ? `Covered by ${r.substitute_name}` : 'No substitute'}
        </div>
        {canChange && swapId !== r.assignment_id && (
          <div style={{ display: 'flex', gap: 6 }}>
            {r.status === 'unfilled' && <button className="btn btn-secondary" style={{ fontSize: 11 }} disabled={busy} onClick={() => retry(r)}>{busy ? 'Trying…' : 'Retry'}</button>}
            <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => openSwap(r)}>{r.status === 'assigned' ? 'Swap' : 'Choose someone'}</button>
          </div>
        )}
        {swapId === r.assignment_id && (
          <div style={{ flexBasis: '100%', display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            {swapOptions.length === 0 ? (
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>No teacher is free at that time.</span>
            ) : (
              <select value={swapChoice} onChange={(e) => setSwapChoice(e.target.value)} aria-label="Free teacher" style={{ fontSize: 12, padding: '4px 8px', maxWidth: 280 }}>
                <option value="">Choose a free teacher…</option>
                {swapOptions.map((o) => <option key={o.teacher_id} value={o.teacher_id}>{o.teacher_name} ({o.day_load === 0 ? 'nothing else that day' : `${o.day_load} that day`})</option>)}
              </select>
            )}
            {swapOptions.length > 0 && <button className="btn btn-primary" style={{ fontSize: 11 }} disabled={!swapChoice || busy} onClick={() => confirmSwap(r)}>{busy ? 'Saving…' : 'Confirm'}</button>}
            <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => setSwapId(null)}>Cancel</button>
          </div>
        )}
      </div>
    )
  }

  if (loading) return <div className="page-container">Loading…</div>

  return (
    <div className="page-container" style={{ maxWidth: 880 }}>
      <h1 className="portal-page-title">Substitution</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: '0 0 20px', maxWidth: 640 }}>
        {isAdmin
          ? 'Mark any teacher absent and the system finds a free teacher for each of their classes. Review who is covering what, swap someone in, or retry a class nobody could take.'
          : 'Mark a teacher in your department absent and the system finds a free teacher for each of their classes. Review who is covering what, swap someone in, or retry a class nobody could take.'}
      </p>

      {error && <div className="banner banner-danger" style={{ marginBottom: 16 }}>{error}</div>}
      {notice && <div className="banner banner-success" style={{ marginBottom: 16 }}>{notice}</div>}

      <div className="card" style={{ marginBottom: 20 }}>
        {!target && (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h2 style={{ margin: 0 }}>Mark a teacher absent</h2>
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name…" aria-label="Search teachers" style={{ maxWidth: 220 }} />
            </div>
            {visibleStaff.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{staff.length === 0 ? 'No teachers found.' : 'No teacher matches that search.'}</p>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {visibleStaff.map((p) => (
                <div key={p.staff_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{p.staff_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{p.staff_role === 'supervisor' ? 'HOD' : 'Teacher'}{p.department_name ? ` · ${p.department_name}` : ''}</div>
                  </div>
                  <button className="btn btn-secondary" style={{ fontSize: 11 }} onClick={() => openMark(p)}>Mark absent</button>
                </div>
              ))}
            </div>
          </>
        )}

        {target && !results && (
          <>
            <h2 style={{ margin: '0 0 12px' }}>Mark {target.staff_name} absent</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 16 }}>
              <label style={labelStyle}>From<input type="date" value={markFrom} onChange={(e) => setMarkFrom(e.target.value)} style={fieldStyle} /></label>
              <label style={labelStyle}>To<input type="date" value={markTo} min={markFrom} onChange={(e) => setMarkTo(e.target.value)} style={fieldStyle} /></label>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ ...labelStyle, marginBottom: 8 }}>Which periods</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: markScope === 'specific' ? 10 : 0 }}>
                <button type="button" className={markScope === 'whole' ? 'btn btn-primary' : 'btn btn-ghost'} style={{ fontSize: 12 }} onClick={() => setMarkScope('whole')}>Whole day</button>
                <button type="button" className={markScope === 'specific' ? 'btn btn-primary' : 'btn btn-ghost'} style={{ fontSize: 12 }} onClick={() => setMarkScope('specific')}>Specific periods</button>
              </div>
              {markScope === 'specific' && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {periods.map((p) => (
                    <button key={p.id} type="button" onClick={() => togglePeriod(p.id)} className={selectedPeriods.has(p.id) ? 'btn btn-primary' : 'btn btn-ghost'} style={{ fontSize: 11, padding: '4px 10px' }}>{p.name}</button>
                  ))}
                </div>
              )}
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ ...labelStyle, marginBottom: 8 }}>Their classes</div>
              {sectionsLoading && <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Checking their timetable…</p>}
              {!sectionsLoading && groups.length === 0 && (
                <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{markScope === 'specific' && selectedPeriods.size === 0 ? 'Choose at least one period.' : 'They have no classes in these dates.'}</p>
              )}
              {!sectionsLoading && groups.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {groups.map((g) => {
                    const own = ownPlans.filter((p) => p.subject === g.subject)
                    const others = otherPlans.filter((p) => p.subject === g.subject)
                    return (
                      <div key={g.key} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px' }}>
                        <div style={{ flex: 1, minWidth: 160 }}>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>{classLine(g.subject, g.className)}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{g.periodName} · {g.days.join(', ')}</div>
                        </div>
                        <select value={lessonChoices[g.key] || ''} onChange={(e) => setLessonChoices((prev) => ({ ...prev, [g.key]: e.target.value }))} aria-label={`Lesson for ${g.subject} ${g.periodName}`} style={{ fontSize: 12, padding: '4px 8px', minWidth: 220, maxWidth: 300 }}>
                          <option value="">Pick a lesson…</option>
                          {own.length > 0 && <optgroup label="Their lesson plans">{own.map((p) => <option key={p.id} value={`lp:${p.id}`}>{planLabel(p)}</option>)}</optgroup>}
                          {isAdmin && ownLessons.length > 0 && <optgroup label="Their Smart Learning lessons">{ownLessons.filter((l) => l.subject === g.subject).map((l) => <option key={l.id} value={`ll:${l.id}`}>{l.title} ({l.subject}, Smart Learning)</option>)}</optgroup>}
                          {others.length > 0 && <optgroup label={`Other teachers' ${g.subject} plans`}>{others.map((p) => <option key={p.id} value={`lp:${p.id}`}>{planLabel(p)}</option>)}</optgroup>}
                        </select>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            {markError && <div className="banner banner-danger" style={{ marginBottom: 12 }}>{markError}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" disabled={submitting || groups.length === 0} onClick={handleSubmit}>{submitting ? 'Marking…' : 'Mark absent'}</button>
              <button className="btn btn-ghost" onClick={closeMark}>Cancel</button>
            </div>
          </>
        )}

        {target && results && (
          <>
            <h2 style={{ margin: '0 0 4px' }}>{target.staff_name} marked absent</h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 12px' }}>{results.filter((r) => r.status === 'assigned').length} of {results.length} classes covered automatically.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
              {results.map((r, i) => (
                <div key={i} style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${r.status === 'assigned' ? 'var(--success)' : 'var(--warning)'}`, background: r.status === 'assigned' ? 'var(--success-bg)' : 'var(--warning-bg)' }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{formatDay(r.class_date)} · {r.subject} · {r.period_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{r.status === 'assigned' ? `Covered by ${r.substitute_name}` : 'No free teacher found. You can choose someone below.'}</div>
                </div>
              ))}
            </div>
            <button className="btn btn-secondary" onClick={closeMark}>Done</button>
          </>
        )}
      </div>

      <div className="card">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 14 }}>
          <h2 style={{ margin: 0 }}>Who is covering</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <label style={{ ...labelStyle, fontSize: 11 }}>From<input type="date" value={boardFrom} onChange={(e) => setBoardFrom(e.target.value)} style={{ ...fieldStyle, padding: '5px 8px' }} /></label>
            <label style={{ ...labelStyle, fontSize: 11 }}>To<input type="date" value={boardTo} min={boardFrom} onChange={(e) => setBoardTo(e.target.value)} style={{ ...fieldStyle, padding: '5px 8px' }} /></label>
          </div>
        </div>

        {needsCover.length > 0 && (
          <div className="banner banner-warning" style={{ marginBottom: 14 }}>
            {needsCover.length} upcoming {needsCover.length === 1 ? 'class has' : 'classes have'} no substitute. They are marked below.
          </div>
        )}
        {board.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>No cover arranged between these dates.</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {dates.map((d) => (
            <div key={d}>
              <div className="section-label" style={{ marginBottom: 6 }}>{formatDay(d)}{d < today ? ' · past' : d === today ? ' · today' : ''}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {board.filter((r) => r.class_date === d).map(renderRow)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
