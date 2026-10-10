'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { loadBlocks, loadSections } from '@/lib/schoolDay'
import { findClashes, range12, sectionTimes, toMinutes, type BlockRow, type SectionLike } from '@/lib/schoolDayPure'
import { gradeFromText } from '@/lib/topics'
import { createSummary, DURATION_OPTIONS, departmentTeachers, groupClassGroups, studentsToOffer, teacherGroups } from '@/lib/timetableFormPure'

const DAYS = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
]

function currentAcademicYear() {
  const now = new Date()
  const y = now.getFullYear()
  return now.getMonth() >= 7 ? `${y}-${y + 1}` : `${y - 1}-${y}`
}

type Period = { id: string; name: string; start_time: string; end_time: string; order_index: number; academic_year: string }
type Department = { id: string; name: string }
type Teacher = { id: string; full_name: string }
type ClassGroup = { id: string; name: string; year_grade: string }
type Section = {
  id: string; department_id: string; subject: string; teacher_id: string
  class_group_id: string | null; day_of_week: number; period_id: string; room: string | null; academic_year: string; span?: number | null
}
type Student = { id: string; full_name: string }

export default function TimetableBuilder() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const [periods, setPeriods] = useState<Period[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [subjectsByDept, setSubjectsByDept] = useState<Record<string, string[]>>({})
  const [teachersByDept, setTeachersByDept] = useState<Record<string, Teacher[]>>({})
  const [subjectTeachers, setSubjectTeachers] = useState<Record<string, Set<string>>>({})
  const [allStaff, setAllStaff] = useState<Teacher[]>([])
  const [classGroups, setClassGroups] = useState<ClassGroup[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [enrollmentCounts, setEnrollmentCounts] = useState<Record<string, number>>({})
  const [allStudents, setAllStudents] = useState<Student[]>([])
  const [rosters, setRosters] = useState<Record<string, string[]>>({})

  const [blocks, setBlocks] = useState<BlockRow[]>([])
  const [schoolDayReady, setSchoolDayReady] = useState(false)
  const [myRole, setMyRole] = useState('')

  const [showSectionForm, setShowSectionForm] = useState(false)
  const [secDept, setSecDept] = useState('')
  const [secSubject, setSecSubject] = useState('')
  const [secTeacher, setSecTeacher] = useState('')
  const [secClassGroup, setSecClassGroup] = useState('')
  const [secDays, setSecDays] = useState<number[]>([1])
  const [secPeriod, setSecPeriod] = useState('')
  const [secSpan, setSecSpan] = useState(1)
  const [secRoom, setSecRoom] = useState('')

  const [expandedSection, setExpandedSection] = useState<string | null>(null)
  const [addStudentIds, setAddStudentIds] = useState<string[]>([])
  const [studentFilter, setStudentFilter] = useState('')

  const academicYear = currentAcademicYear()

  useEffect(() => { loadData() }, [])

  async function loadData() {
    try {
      await loadDataInner()
    } catch (err) {
      console.error('Failed to load timetable data', err)
      setLoading(false)
    }
  }

  async function loadDataInner() {
    const { data: { user } } = await supabase.auth.getUser()
    const [{ data: myProfile }, { data: periodData }, { data: deptData }, { data: subjectData }, { data: teacherSubData }, { data: cgData }, { data: studentData }, { data: staffData }] = await Promise.all([
      user ? supabase.from('profiles').select('role, department_id').eq('id', user.id).single() : Promise.resolve({ data: null }),
      supabase.from('timetable_periods').select('id, name, start_time, end_time, order_index, academic_year').eq('academic_year', academicYear).order('order_index'),
      supabase.from('departments').select('id, name').order('name'),
      supabase.from('department_subjects').select('department_id, subject'),
      supabase.from('teacher_subjects').select('teacher_id, department_id, subject, profiles(id, full_name)'),
      supabase.from('class_groups').select('id, name, year_grade'),
      supabase.from('profiles').select('id, full_name').eq('role', 'student').order('full_name'),
      supabase.from('profiles').select('id, full_name, department_id').in('role', ['teacher', 'supervisor']).order('full_name'),
    ])

    const sectionData = await loadSections<Section>('id, department_id, subject, teacher_id, class_group_id, day_of_week, period_id, room, academic_year', academicYear)
    const blockData = await loadBlocks(academicYear)
    setBlocks(blockData.blocks)
    setSchoolDayReady(blockData.available)
    setMyRole(myProfile?.role || '')
    setPeriods(periodData || [])
    // Supervisors can only create sections for their own department (RLS
    // enforces this server-side; scoping the dropdown here just stops them
    // hitting an RLS error after filling out the rest of the form).
    setDepartments(myProfile?.role === 'supervisor' ? (deptData || []).filter((d) => d.id === myProfile.department_id) : (deptData || []))
    setAllStudents(studentData || [])

    const subjMap: Record<string, string[]> = {}
    ;(subjectData || []).forEach((s: any) => {
      if (!subjMap[s.department_id]) subjMap[s.department_id] = []
      if (!subjMap[s.department_id].includes(s.subject)) subjMap[s.department_id].push(s.subject)
    })
    setSubjectsByDept(subjMap)

    // A teacher is offered for a department when a subject record ties them to it OR their profile sits in it,
    // so a teacher who has no subject record yet still shows up.
    const subjectRows: Record<string, Array<{ teacher_id: string; profile: Teacher | null }>> = {}
    const teaches: Record<string, Set<string>> = {}
    ;(teacherSubData || []).forEach((row: any) => {
      const prof = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
      ;(subjectRows[row.department_id] ||= []).push({ teacher_id: row.teacher_id, profile: prof ? { id: prof.id, full_name: prof.full_name } : null })
      ;(teaches[`${row.department_id}|${row.subject}`] ||= new Set()).add(row.teacher_id)
    })
    const staff = ((staffData || []) as Array<{ id: string; full_name: string; department_id: string | null }>)
    const teachMap: Record<string, Teacher[]> = {}
    for (const d of deptData || []) {
      teachMap[d.id] = departmentTeachers(subjectRows[d.id] || [], staff.filter((t) => t.department_id === d.id).map((t) => ({ id: t.id, full_name: t.full_name })))
    }
    setTeachersByDept(teachMap)
    setSubjectTeachers(teaches)
    setAllStaff(staff.map((t) => ({ id: t.id, full_name: t.full_name })))

    setClassGroups((cgData || []) as ClassGroup[])
    setSections(sectionData)

    const sectionIds = sectionData.map((s) => s.id)
    if (sectionIds.length > 0) {
      const { data: rosterData } = await supabase.from('section_enrollments').select('section_id, student_id').in('section_id', sectionIds)
      const counts: Record<string, number> = {}
      const rosterMap: Record<string, string[]> = {}
      ;(rosterData || []).forEach((r) => {
        counts[r.section_id] = (counts[r.section_id] || 0) + 1
        if (!rosterMap[r.section_id]) rosterMap[r.section_id] = []
        rosterMap[r.section_id].push(r.student_id)
      })
      setEnrollmentCounts(counts)
      setRosters(rosterMap)
    } else {
      setEnrollmentCounts({})
      setRosters({})
    }

    setLoading(false)
  }

  async function handleCreateSection() {
    if (!secDept || !secSubject || !secTeacher || !secPeriod || secDays.length === 0) return
    setSaving(true)
    setErrorMsg('')

    const created: string[] = []
    const failed: Array<{ day: string; reason: string }> = []
    for (const day of [...secDays].sort((x, y) => x - y)) {
      const { data: inserted, error } = await supabase.from('timetable_sections').insert({
        department_id: secDept,
        subject: secSubject,
        teacher_id: secTeacher,
        class_group_id: secClassGroup || null,
        day_of_week: day,
        period_id: secPeriod,
        room: secRoom.trim() || null,
        academic_year: academicYear,
        ...(schoolDayReady && secSpan > 1 ? { span: secSpan } : {}),
      }).select('id').single()
      if (error || !inserted) {
        const dayName = DAYS.find((d) => d.value === day)?.label || `Day ${day}`
        failed.push({
          day: dayName,
          reason: !error ? 'Could not be saved.'
            : error.code === '23505' ? 'That teacher or class is already scheduled for this period.'
            : error.code === '23514' && /enough periods/i.test(error.message) ? 'There are not enough periods left in the day for a lesson that long.'
            : error.message,
        })
      } else {
        created.push(inserted.id)
      }
    }

    // Grade 7-9 style: whole class_group moves together, so auto-enroll
    // everyone currently in it. Grade 10-11 style (no class_group) starts
    // with an empty roster the admin builds by hand below.
    if (secClassGroup && created.length > 0) {
      const { data: enrolled } = await supabase.from('enrollments').select('student_id').eq('class_group_id', secClassGroup)
      if (enrolled && enrolled.length > 0) {
        await supabase.from('section_enrollments').insert(
          created.flatMap((id) => enrolled.map((e) => ({ section_id: id, student_id: e.student_id })))
        )
      }
    }

    const summary = createSummary(created.length, failed)
    if (created.length === 0) {
      setErrorMsg(summary.text)
      setSaving(false)
      return
    }
    // Keep the form's teacher, subject and class; clear only what differs per section so the next day or class is quick to add.
    setSecPeriod(''); setSecRoom(''); setSecSpan(1)
    setShowSectionForm(false); setSaving(false)
    if (summary.ok) { setSuccessMsg(summary.text); setTimeout(() => setSuccessMsg(''), 3000) } else setErrorMsg(summary.text)
    loadData()
  }

  async function handleDeleteSection(id: string) {
    if (!confirm('Delete this section? Its roster will also be removed.')) return
    await supabase.from('timetable_sections').delete().eq('id', id)
    loadData()
  }

  async function handleAddStudents(sectionId: string) {
    if (addStudentIds.length === 0) return
    const { error } = await supabase.from('section_enrollments').insert(addStudentIds.map((student_id) => ({ section_id: sectionId, student_id })))
    if (error) { setErrorMsg(error.message); return }
    setAddStudentIds([]); setStudentFilter('')
    loadData()
  }

  async function handleRemoveStudent(sectionId: string, studentId: string) {
    await supabase.from('section_enrollments').delete().eq('section_id', sectionId).eq('student_id', studentId)
    loadData()
  }

  if (loading) return <div className="page-container">Loading…</div>

  const periodName_ = (id: string) => periods.find((p) => p.id === id)?.name || 'Unknown period'
  const teacherName = (id: string) => {
    for (const list of Object.values(teachersByDept)) {
      const found = list.find((t) => t.id === id)
      if (found) return found.full_name
    }
    return allStaff.find((t) => t.id === id)?.full_name || 'Unknown teacher'
  }
  const classGroupName = (id: string | null) => id ? (classGroups.find((c) => c.id === id)?.name || 'Unknown class') : null
  const departmentName = (id: string) => departments.find((d) => d.id === id)?.name || 'Unknown department'
  const studentName = (id: string) => allStudents.find((s) => s.id === id)?.full_name || 'Unknown student'

  const gradeOfSection = (sec: SectionLike) => gradeFromText(classGroups.find((c) => c.id === sec.class_group_id)?.year_grade)
  const clashBySection: Record<string, string[]> = {}
  for (const c of findClashes(sections, periods, blocks.filter((b) => b.days), gradeOfSection)) (clashBySection[c.sectionId] ||= []).push(c.title)
  const formClashes = secPeriod && secDays.length > 0
    ? findClashes(secDays.map((day) => ({ id: `new-${day}`, day_of_week: day, period_id: secPeriod, span: secSpan, class_group_id: secClassGroup || null })), periods, blocks.filter((b) => b.days), gradeOfSection)
    : []
  const deptTeacherList = teachersByDept[secDept] || []
  const teacherLists = teacherGroups(deptTeacherList, subjectTeachers[`${secDept}|${secSubject}`], secSubject, departmentName(secDept), allStaff)
  const toggleDay = (d: number) => setSecDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]))
  const lengthText = (s: Section) => {
    const t = sectionTimes(s, periods)
    return (s.span ?? 1) > 1 && t ? ` · ${s.span} periods (${range12(t.start, t.end)})` : ''
  }

  return (
    <div className="page-container">
      <p className="portal-page-title" style={{ margin: 0 }}>Timetable</p>
      <p className="portal-page-sub" style={{ margin: '4px 0 20px' }}>{academicYear}</p>

      {successMsg && <div className="banner banner-success" style={{ marginBottom: 16 }}>{successMsg}</div>}
      {errorMsg && <div className="banner banner-danger" style={{ marginBottom: 16 }}>{errorMsg}</div>}

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>Periods</h2>
          {myRole === 'admin'
            ? <Link href="/school-admin/school-day" className="btn btn-secondary">Change bell times, lunch and events</Link>
            : <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>The school admin or principal sets the bell times.</span>}
        </div>
        {periods.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            {periods.map((p) => (
              <span key={p.id} className="badge badge-default">{p.name}: {range12(toMinutes(p.start_time) ?? 0, toMinutes(p.end_time) ?? 0)}</span>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '10px 0 0' }}>No periods have been set up yet. The school admin or principal adds them under School day.</p>
        )}
        {blocks.length > 0 && (
          <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '12px 0 0' }}>
            {blocks.filter((b) => b.kind === 'lunch').length > 0 && <>Lunch is set by grade. </>}
            {blocks.filter((b) => b.kind === 'event').length > 0 && <>School events ({blocks.filter((b) => b.kind === 'event').map((b) => b.title).join(', ')}) take time out of lessons, so avoid placing classes in them.</>}
          </p>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Sections</h2>
        <button className="btn btn-primary" onClick={() => setShowSectionForm(!showSectionForm)} disabled={periods.length === 0}>+ New section</button>
      </div>
      {periods.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>Periods must be set up first (School day).</p>}

      {showSectionForm && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Department</label>
              <select value={secDept} onChange={(e) => { setSecDept(e.target.value); setSecSubject(''); setSecTeacher('') }} style={{ width: '100%', marginTop: 4 }}>
                <option value="">Select department…</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Subject</label>
              <select value={secSubject} onChange={(e) => setSecSubject(e.target.value)} style={{ width: '100%', marginTop: 4 }} disabled={!secDept}>
                <option value="">Select subject…</option>
                {(subjectsByDept[secDept] || []).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Teacher</label>
              <select value={secTeacher} onChange={(e) => setSecTeacher(e.target.value)} style={{ width: '100%', marginTop: 4 }} disabled={!secDept}>
                <option value="">Select teacher…</option>
                {teacherLists.map((g) => (
                  <optgroup key={g.label} label={g.label}>
                    {g.items.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                  </optgroup>
                ))}
              </select>
              {secDept && deptTeacherList.length === 0 && (
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 0' }}>No staff are recorded in this department yet, so other teachers are listed.</p>
              )}
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Class group (leave blank for individual subject enrolment, e.g. grade 10–11)</label>
              <select value={secClassGroup} onChange={(e) => setSecClassGroup(e.target.value)} style={{ width: '100%', marginTop: 4 }}>
                <option value="">No fixed class group</option>
                {groupClassGroups(classGroups).map((g) => (
                  <optgroup key={g.label} label={g.label}>
                    {g.items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Days (pick one or more)</label>
              <div role="group" aria-label="Days" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                {DAYS.map((d) => (
                  <label key={d.value} className="sentence-case" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', background: secDays.includes(d.value) ? 'var(--page-bg)' : 'transparent', textTransform: 'none', fontWeight: secDays.includes(d.value) ? 700 : 400, color: 'var(--text-primary)' }}>
                    <input type="checkbox" checked={secDays.includes(d.value)} onChange={() => toggleDay(d.value)} />
                    {d.label.slice(0, 3)}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Period</label>
              <select value={secPeriod} onChange={(e) => setSecPeriod(e.target.value)} style={{ width: '100%', marginTop: 4 }}>
                <option value="">Select period…</option>
                {periods.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            {schoolDayReady && (
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Duration</label>
                <select value={secSpan} onChange={(e) => setSecSpan(Number(e.target.value))} style={{ width: '100%', marginTop: 4 }} aria-label="Duration in periods">
                  {DURATION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            )}
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Room (optional)</label>
              <input value={secRoom} onChange={(e) => setSecRoom(e.target.value)} style={{ width: '100%', marginTop: 4 }} />
            </div>
          </div>
          {formClashes.length > 0 && (
            <p role="status" className="banner banner-warning" style={{ marginBottom: 12, fontSize: 13 }}>
              This class would run into {formClashes.map((c) => `${c.title} (${c.when})`).join(' and ')}. You can still save it, but that time belongs to the school, so the timetable will show the event instead.
            </p>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleCreateSection} disabled={saving || !secDept || !secSubject || !secTeacher || !secPeriod || secDays.length === 0} className="btn btn-primary sentence-case">
              {saving ? 'Creating…' : secDays.length > 1 ? `Create ${secDays.length} sections` : 'Create section'}
            </button>
            <button onClick={() => setShowSectionForm(false)} className="btn btn-ghost">Cancel</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {DAYS.map((day) => {
          const daySections = sections.filter((s) => s.day_of_week === day.value)
          if (daySections.length === 0) return null
          return (
            <div key={day.value}>
              <div className="section-label" style={{ margin: '12px 0 6px' }}>{day.label}</div>
              {daySections.map((s) => {
                const cgName = classGroupName(s.class_group_id)
                const roster = rosters[s.id] || []
                return (
                  <div key={s.id} className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 8 }}>
                    <div
                      onClick={() => { setExpandedSection(expandedSection === s.id ? null : s.id); setAddStudentIds([]); setStudentFilter('') }}
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', cursor: 'pointer' }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15 }}>{s.subject} · {departmentName(s.department_id)}{clashBySection[s.id] && <span className="badge badge-warning" style={{ marginLeft: 8, fontSize: 11 }}>Clashes with {[...new Set(clashBySection[s.id])].join(', ')}</span>}</div>
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                          {teacherName(s.teacher_id)} · {periodName_(s.period_id)}{lengthText(s)}{s.room ? ` · ${s.room}` : ''} · {cgName ? cgName : `${enrollmentCounts[s.id] || 0} students enrolled`}
                        </div>
                      </div>
                      <span style={{ fontSize: 20, color: 'var(--text-secondary)' }}>{expandedSection === s.id ? '▲' : '▼'}</span>
                    </div>

                    {expandedSection === s.id && (
                      <div style={{ borderTop: '1px solid var(--border)', padding: '14px 16px', background: 'var(--page-bg)' }}>
                        <div className="section-label" style={{ marginBottom: 8 }}>Roster ({roster.length})</div>
                        {roster.length === 0 ? (
                          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>No students yet.</p>
                        ) : (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                            {roster.map((sid) => (
                              <span key={sid} className="badge badge-default" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                {studentName(sid)}
                                <button onClick={() => handleRemoveStudent(s.id, sid)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: 12 }}>✕</button>
                              </span>
                            ))}
                          </div>
                        )}
                        {(() => {
                          const offer = studentsToOffer(allStudents, roster, studentFilter)
                          const allShown = offer.items.length > 0 && offer.items.every((st) => addStudentIds.includes(st.id))
                          return (
                            <div>
                              <input value={studentFilter} onChange={(e) => setStudentFilter(e.target.value)} placeholder="Find students by name" aria-label="Find students by name" style={{ width: '100%', maxWidth: 320 }} />
                              <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, marginTop: 8, padding: '4px 10px', background: 'var(--card-bg, transparent)' }}>
                                {offer.items.length === 0 ? (
                                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '8px 0' }}>{studentFilter ? 'No students match.' : 'Everyone is already on this roster.'}</p>
                                ) : (
                                  <>
                                    <label className="sentence-case" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '6px 0', fontWeight: 700, textTransform: 'none' }}>
                                      <input type="checkbox" checked={allShown} onChange={() => setAddStudentIds((cur) => allShown ? cur.filter((id) => !offer.items.some((st) => st.id === id)) : [...new Set([...cur, ...offer.items.map((st) => st.id)])])} />
                                      Select all shown ({offer.items.length})
                                    </label>
                                    {offer.items.map((st) => (
                                      <label key={st.id} className="sentence-case" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '5px 0', textTransform: 'none', fontWeight: 400 }}>
                                        <input type="checkbox" checked={addStudentIds.includes(st.id)} onChange={() => setAddStudentIds((cur) => cur.includes(st.id) ? cur.filter((id) => id !== st.id) : [...cur, st.id])} />
                                        {st.full_name}
                                      </label>
                                    ))}
                                    {offer.more > 0 && <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '6px 0' }}>{offer.more} more. Type a name to narrow the list.</p>}
                                  </>
                                )}
                              </div>
                              <button onClick={() => handleAddStudents(s.id)} disabled={addStudentIds.length === 0} className="btn btn-secondary sentence-case" style={{ marginTop: 8 }}>
                                {addStudentIds.length > 1 ? `Add ${addStudentIds.length} students` : 'Add student'}
                              </button>
                            </div>
                          )
                        })()}
                        <button onClick={() => handleDeleteSection(s.id)} className="btn btn-ghost" style={{ fontSize: 11, color: 'var(--danger)', marginTop: 14 }}>
                          Delete section
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
        {sections.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>No sections yet.</p>}
      </div>
    </div>
  )
}
