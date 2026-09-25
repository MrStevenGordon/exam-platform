'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import EmptyState from '@/components/EmptyState'
import {
  jamaicaDate, isoWeekday, schoolYear, formatTime, formatDay, MARK_LABEL, attendanceError, type MarkStatus,
} from '@/lib/attendance'

type Student = { id: string; name: string; code: string | null }
type Period = { name: string; start_time: string; end_time: string; order_index: number }
type Section = {
  id: string; subject: string; room: string | null; class_group_id: string | null
  class_groups: { name: string } | null; timetable_periods: Period | null
}
type Session = { section_id: string; started_at: string; roll_taken_at: string | null }
type Group = { id: string; name: string }

const STATUSES: MarkStatus[] = ['present', 'late', 'absent']
const GRACE_MINUTES = 10 // matches the database (attendance_late_minutes)

// School time is Jamaica time, UTC-5 all year (no daylight saving).
const at = (date: string, clock: string) => new Date(`${date}T${clock.slice(0, 8)}-05:00`)
const clockLabel = (clock: string) => formatTime(at('2000-01-01', clock).toISOString())

// Three-way Present / Late / Absent control for one student.
function MarkButtons({ value, onChange, name }: { value: MarkStatus; onChange: (s: MarkStatus) => void; name: string }) {
  return (
    <div role="group" aria-label={`Attendance for ${name}`} style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
      {STATUSES.map((s) => (
        <button
          key={s}
          type="button"
          aria-pressed={value === s}
          onClick={() => onChange(s)}
          className={value === s ? (s === 'absent' ? 'btn btn-danger' : 'btn btn-primary') : 'btn btn-ghost'}
          style={{ fontSize: 12, padding: '6px 4px', width: 66 }}
        >
          {MARK_LABEL[s]}
        </button>
      ))}
    </div>
  )
}

export default function TeacherAttendancePage() {
  const [today, setToday] = useState(jamaicaDate())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [sections, setSections] = useState<Section[]>([])
  const [rosters, setRosters] = useState<Record<string, Student[]>>({})
  const [sessions, setSessions] = useState<Record<string, Session>>({})
  const [classMarks, setClassMarks] = useState<Record<string, Record<string, MarkStatus>>>({}) // saved marks: section -> student -> status
  const [morning, setMorning] = useState<Record<string, MarkStatus>>({}) // student -> status this morning
  const [groups, setGroups] = useState<Group[]>([])
  const [groupRosters, setGroupRosters] = useState<Record<string, Student[]>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [draftClass, setDraftClass] = useState<Record<string, Record<string, MarkStatus>>>({})
  const [draftMorning, setDraftMorning] = useState<Record<string, Record<string, MarkStatus>>>({})
  const [openRoll, setOpenRoll] = useState<string | null>(null)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const uid = session?.user?.id
        if (!uid) { setError('Please sign in again.'); return }

        // Opening this page also runs the "has every class started?" check that
        // feeds the principal's alerts (safe to repeat; ignored if it fails).
        void supabase.rpc('refresh_attendance_alerts').then(() => {}, () => {})

        // The database decides what "today" is; fall back to this device only if that fails.
        const { data: serverDay } = await supabase.rpc('school_today')
        const day: string = typeof serverDay === 'string' ? serverDay : jamaicaDate()
        setToday(day)

        const [secRes, grpRes] = await Promise.all([
          supabase.from('timetable_sections')
            .select('id, subject, room, class_group_id, class_groups(name), timetable_periods(name, start_time, end_time, order_index)')
            .eq('teacher_id', uid).eq('day_of_week', isoWeekday(day)).eq('academic_year', schoolYear(day)),
          supabase.from('teacher_class_groups').select('class_groups(id, name)').eq('teacher_id', uid),
        ])
        if (secRes.error) throw secRes.error
        const secs = ((secRes.data || []) as unknown as Section[]).sort((a, b) => (a.timetable_periods?.order_index ?? 0) - (b.timetable_periods?.order_index ?? 0))
        const grps = ((grpRes.data || []) as unknown as { class_groups: Group | null }[]).map((g) => g.class_groups).filter((g): g is Group => !!g).sort((a, b) => a.name.localeCompare(b.name))

        const sectionIds = secs.map((s) => s.id)
        const [enrolRes, sessRes, markRes, memberRes] = await Promise.all([
          sectionIds.length ? supabase.from('section_enrollments').select('section_id, student_id').in('section_id', sectionIds) : Promise.resolve({ data: [] as { section_id: string; student_id: string }[] }),
          sectionIds.length ? supabase.from('class_sessions').select('section_id, started_at, roll_taken_at').in('section_id', sectionIds).eq('class_date', day) : Promise.resolve({ data: [] as Session[] }),
          sectionIds.length ? supabase.from('class_attendance').select('section_id, student_id, status').in('section_id', sectionIds).eq('class_date', day) : Promise.resolve({ data: [] as { section_id: string; student_id: string; status: MarkStatus }[] }),
          grps.length ? supabase.from('enrollments').select('class_group_id, student_id').in('class_group_id', grps.map((g) => g.id)) : Promise.resolve({ data: [] as { class_group_id: string; student_id: string }[] }),
        ])

        const studentIds = [...new Set([...(enrolRes.data || []).map((e) => e.student_id), ...(memberRes.data || []).map((m) => m.student_id)])]
        const [profRes, dailyRes] = await Promise.all([
          studentIds.length ? supabase.from('profiles').select('id, full_name, student_id').in('id', studentIds) : Promise.resolve({ data: [] as { id: string; full_name: string; student_id: string | null }[] }),
          studentIds.length ? supabase.from('daily_attendance').select('student_id, status').in('student_id', studentIds).eq('att_date', day) : Promise.resolve({ data: [] as { student_id: string; status: MarkStatus }[] }),
        ])
        const people = new Map((profRes.data || []).map((p) => [p.id, { id: p.id, name: p.full_name, code: p.student_id } as Student]))
        const byName = (a: Student, b: Student) => a.name.localeCompare(b.name)

        const rs: Record<string, Student[]> = {}
        for (const e of enrolRes.data || []) { const s = people.get(e.student_id); if (s) (rs[e.section_id] ??= []).push(s) }
        for (const k of Object.keys(rs)) rs[k].sort(byName)
        const gr: Record<string, Student[]> = {}
        for (const m of memberRes.data || []) { const s = people.get(m.student_id); if (s) (gr[m.class_group_id] ??= []).push(s) }
        for (const k of Object.keys(gr)) gr[k].sort(byName)
        const cm: Record<string, Record<string, MarkStatus>> = {}
        for (const m of markRes.data || []) (cm[m.section_id] ??= {})[m.student_id] = m.status
        const mm: Record<string, MarkStatus> = {}
        for (const d of dailyRes.data || []) mm[d.student_id] = d.status

        if (cancelled) return
        setSections(secs); setGroups(grps); setRosters(rs); setGroupRosters(gr); setClassMarks(cm); setMorning(mm)
        setSessions(Object.fromEntries((sessRes.data || []).map((s) => [s.section_id, s])))
        setError('')
      } catch (err) {
        if (!cancelled) setError(attendanceError(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [reload])

  async function run<T>(key: string, action: () => PromiseLike<{ error: unknown; data: T | null }>, success: string) {
    setBusy(key); setError(''); setNotice('')
    const { error: rpcError } = await action()
    setBusy(null)
    if (rpcError) { setError(attendanceError(rpcError)); return false }
    setNotice(success)
    setReload((n) => n + 1)
    return true
  }

  const startClass = (id: string) => run('start-' + id, () => supabase.rpc('start_class', { p_section_id: id }), 'Class started. Your arrival time has been recorded.').then((ok) => { if (ok) setOpenRoll(id) })

  function saveRoll(section: Section) {
    const roster = rosters[section.id] || []
    const marks = roster.map((s) => ({ student_id: s.id, status: draftClass[section.id]?.[s.id] ?? classMarks[section.id]?.[s.id] ?? 'present' }))
    return run('roll-' + section.id, () => supabase.rpc('mark_class_attendance', { p_section_id: section.id, p_marks: marks }), `Roll saved for ${section.subject}.`).then((ok) => { if (ok) setOpenRoll(null) })
  }

  function saveRegister(group: Group) {
    const roster = groupRosters[group.id] || []
    const marks = roster.map((s) => ({ student_id: s.id, status: draftMorning[group.id]?.[s.id] ?? morning[s.id] ?? 'present' }))
    return run('reg-' + group.id, () => supabase.rpc('mark_morning_register', { p_class_group_id: group.id, p_marks: marks }), `Register saved for ${group.name}.`)
  }

  const setDraft = (setter: typeof setDraftClass, scope: string, student: string, status: MarkStatus) =>
    setter((prev) => ({ ...prev, [scope]: { ...prev[scope], [student]: status } }))

  const now = new Date()
  const morningChip = (studentId: string) => {
    const m = morning[studentId]
    return m === 'present' ? { text: 'At school', cls: 'badge-success' } : m === 'late' ? { text: 'Late this morning', cls: 'badge-warning' } : m === 'absent' ? { text: 'Absent this morning', cls: 'badge-danger' } : { text: 'Not registered', cls: 'badge-default' }
  }

  if (loading) return <div>Loading…</div>

  return (
    <div>
      <p className="portal-page-title">Attendance</p>
      <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: '0 0 16px' }}>{formatDay(today)}</p>
      {error && <p className="banner banner-danger" role="alert">{error}</p>}
      {notice && <p className="banner banner-success" role="status">{notice}</p>}

      {groups.length > 0 && (
        <section style={{ marginBottom: 28 }}>
          <div className="section-label" style={{ marginBottom: 8 }}>Morning register</div>
          {groups.map((g) => {
            const roster = groupRosters[g.id] || []
            const taken = roster.filter((s) => morning[s.id]).length
            return (
              <details key={g.id} className="card" style={{ marginBottom: 8 }}>
                <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>
                  {g.name} <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>· {roster.length} students · {taken === 0 ? 'not taken yet' : `${taken} recorded`}</span>
                </summary>
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {roster.length === 0 && <p style={{ color: 'var(--text-secondary)' }}>No students are enrolled in this class.</p>}
                  {roster.map((s) => (
                    <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 14 }}>{s.name}</span>
                      <MarkButtons name={s.name} value={draftMorning[g.id]?.[s.id] ?? morning[s.id] ?? 'present'} onChange={(st) => setDraft(setDraftMorning, g.id, s.id, st)} />
                    </div>
                  ))}
                  {roster.length > 0 && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <button type="button" className="btn btn-primary" disabled={busy === 'reg-' + g.id} onClick={() => saveRegister(g)}>
                        {busy === 'reg-' + g.id ? 'Saving…' : 'Save register'}
                      </button>
                      <button type="button" className="btn btn-ghost" onClick={() => setDraftMorning((p) => ({ ...p, [g.id]: {} }))}>Reset to present</button>
                    </div>
                  )}
                </div>
              </details>
            )
          })}
        </section>
      )}

      <section>
        <div className="section-label" style={{ marginBottom: 8 }}>Today&rsquo;s classes</div>
        {sections.length === 0 && (
          <EmptyState icon="🗓️" title="No classes on your timetable today" description="If you expected classes here, ask your HOD or the school admin to check the timetable." />
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sections.map((s) => {
            const p = s.timetable_periods
            const started = sessions[s.id]
            const starts = p ? at(today, p.start_time) : null
            const ends = p ? at(today, p.end_time) : null
            const tooEarly = !!starts && now.getTime() < starts.getTime() - 15 * 60000
            const over = !!ends && now.getTime() > ends.getTime()
            const late = !!(started && starts && new Date(started.started_at).getTime() > starts.getTime() + GRACE_MINUTES * 60000)
            const roster = rosters[s.id] || []
            const isOpen = openRoll === s.id
            return (
              <div key={s.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{s.subject}{s.class_groups ? ` · ${s.class_groups.name}` : ''}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                      {p ? `${p.name} · ${clockLabel(p.start_time)}–${clockLabel(p.end_time)}` : ''}{s.room ? ` · Room ${s.room}` : ''} · {roster.length} students
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {started ? (
                      <>
                        <span className={`badge ${late ? 'badge-warning' : 'badge-success'}`}>{late ? 'Started late' : 'Started on time'} · {formatTime(started.started_at)}</span>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{started.roll_taken_at ? `Roll taken ${formatTime(started.roll_taken_at)}` : 'Roll not taken yet'}</div>
                      </>
                    ) : (
                      <button type="button" className="btn btn-primary" disabled={tooEarly || over || busy === 'start-' + s.id} onClick={() => startClass(s.id)}>
                        {busy === 'start-' + s.id ? 'Starting…' : 'Start class'}
                      </button>
                    )}
                    {!started && tooEarly && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Opens 15 minutes before the period</div>}
                    {!started && over && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>This period has ended</div>}
                  </div>
                </div>

                {started && (
                  <div style={{ marginTop: 12 }}>
                    <button type="button" className="btn btn-secondary" aria-expanded={isOpen} onClick={() => setOpenRoll(isOpen ? null : s.id)}>
                      {isOpen ? 'Hide roll call' : started.roll_taken_at ? 'Edit roll call' : 'Take roll call'}
                    </button>
                  </div>
                )}

                {started && isOpen && (
                  <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {roster.length === 0 && <p style={{ color: 'var(--text-secondary)' }}>No students are on this class list yet.</p>}
                    {roster.map((st) => {
                      const chip = morningChip(st.id)
                      return (
                        <div key={st.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 14 }}>{st.name} <span className={`badge ${chip.cls}`} style={{ marginLeft: 6 }}>{chip.text}</span></span>
                          <MarkButtons name={st.name} value={draftClass[s.id]?.[st.id] ?? classMarks[s.id]?.[st.id] ?? 'present'} onChange={(m) => setDraft(setDraftClass, s.id, st.id, m)} />
                        </div>
                      )
                    })}
                    {roster.length > 0 && (
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <button type="button" className="btn btn-primary" disabled={busy === 'roll-' + s.id} onClick={() => saveRoll(s)}>
                          {busy === 'roll-' + s.id ? 'Saving…' : 'Save roll call'}
                        </button>
                        <button type="button" className="btn btn-ghost" onClick={() => setDraftClass((p) => ({ ...p, [s.id]: Object.fromEntries(roster.map((r) => [r.id, 'present' as MarkStatus])) }))}>Mark everyone present</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
