'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import EmptyState from '@/components/EmptyState'
import {
  jamaicaDate, shiftDate, formatTime, formatDay, teacherStatusLabel, TEACHER_STATUS, MARK_LABEL,
  attendanceError, type TeacherStatus, type MarkStatus,
} from '@/lib/attendance'

export type BoardRow = {
  section_id: string; subject: string; room: string | null; class_name: string | null; teacher_id: string; teacher_name: string
  department_name: string | null; period_name: string; period_order: number; starts_at: string; ends_at: string
  started_at: string | null; teacher_status: TeacherStatus; minutes_late: number | null; roll_taken: boolean
  enrolled: number; present: number; late: number; absent: number; truant: number
}
type RosterRow = { student_id: string; student_name: string; student_code: string | null; class_status: MarkStatus | null; morning_status: MarkStatus | null; is_truant: boolean }

const NEEDS_ATTENTION: TeacherStatus[] = ['late', 'not_started', 'missed']

// Every timetabled class on a day: who is teaching, whether they arrived, how the roll came out.
export default function TodayBoardView() {
  const today = jamaicaDate()
  const [date, setDate] = useState(today)
  const [rows, setRows] = useState<BoardRow[]>([])
  // The date the rows on screen belong to: the spinner shows until they match.
  const [loadedFor, setLoadedFor] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<'all' | 'attention'>('all')
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const [roster, setRoster] = useState<RosterRow[] | null>(null)
  const [rosterError, setRosterError] = useState('')
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const { data, error: rpcError } = await supabase.rpc('attendance_board', { p_date: date })
        if (rpcError) throw rpcError
        if (!cancelled) { setRows((data as BoardRow[]) || []); setError('') }
      } catch (err) {
        if (!cancelled) setError(attendanceError(err))
      } finally {
        if (!cancelled) setLoadedFor(date)
      }
    }
    load()
    return () => { cancelled = true }
  }, [date, refresh])

  // Today's board stays current on its own.
  useEffect(() => {
    if (date !== today) return
    const t = setInterval(() => setRefresh((n) => n + 1), 60000)
    return () => clearInterval(t)
  }, [date, today])

  async function toggle(sectionId: string) {
    if (open === sectionId) { setOpen(null); return }
    setOpen(sectionId); setRoster(null); setRosterError('')
    const { data, error: rpcError } = await supabase.rpc('section_attendance', { p_section_id: sectionId, p_date: date })
    if (rpcError) { setRosterError(attendanceError(rpcError)); return }
    setRoster((data as RosterRow[]) || [])
  }

  const loading = loadedFor !== date

  const counts = useMemo(() => {
    const c = { classes: rows.length, on_time: 0, late: 0, waiting: 0, missed: 0, truant: 0 }
    for (const r of rows) {
      if (r.teacher_status === 'on_time') c.on_time++
      else if (r.teacher_status === 'late') c.late++
      else if (r.teacher_status === 'not_started' || r.teacher_status === 'due') c.waiting++
      else if (r.teacher_status === 'missed') c.missed++
      c.truant += r.truant
    }
    return c
  }, [rows])

  const visible = (loading ? [] : rows).filter((r) =>
    (filter === 'all' || NEEDS_ATTENTION.includes(r.teacher_status)) &&
    (!search.trim() || r.teacher_name.toLowerCase().includes(search.toLowerCase()) || r.subject.toLowerCase().includes(search.toLowerCase()) || (r.class_name || '').toLowerCase().includes(search.toLowerCase())))

  const periods = new Map<number, { name: string; starts: string; ends: string; items: BoardRow[] }>()
  for (const r of visible) {
    if (!periods.has(r.period_order)) periods.set(r.period_order, { name: r.period_name, starts: r.starts_at, ends: r.ends_at, items: [] })
    periods.get(r.period_order)!.items.push(r)
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        <button type="button" className="btn btn-ghost" onClick={() => setDate(shiftDate(date, -1))} aria-label="Previous day">←</button>
        <input type="date" value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Date" />
        <button type="button" className="btn btn-ghost" onClick={() => setDate(shiftDate(date, 1))} disabled={date >= today} aria-label="Next day">→</button>
        {date !== today && <button type="button" className="btn btn-secondary" onClick={() => setDate(today)}>Today</button>}
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{formatDay(date)}</span>
        <div style={{ flex: 1 }} />
        <input type="search" placeholder="Teacher, subject or class…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search" style={{ minWidth: 200 }} />
        <select value={filter} onChange={(e) => setFilter(e.target.value as 'all' | 'attention')} aria-label="Show">
          <option value="all">All classes</option>
          <option value="attention">Needs attention</option>
        </select>
      </div>

      {error && <p className="banner banner-danger" role="alert">{error}</p>}

      {!loading && !error && (
        <div className="stat-grid" style={{ marginBottom: 20 }}>
          <div className="stat-card"><div className="stat-card-value">{counts.classes}</div><div className="stat-card-label">Classes</div></div>
          <div className="stat-card"><div className="stat-card-value">{counts.on_time}</div><div className="stat-card-label">Teacher on time</div></div>
          <div className={`stat-card ${counts.late + counts.waiting + counts.missed > 0 ? 'stat-card-accent' : ''}`}>
            <div className="stat-card-value">{counts.late + counts.waiting + counts.missed}</div>
            <div className="stat-card-label">Late / not started</div>
          </div>
          <div className={`stat-card ${counts.truant > 0 ? 'stat-card-accent' : ''}`}><div className="stat-card-value">{counts.truant}</div><div className="stat-card-label">Truant students</div></div>
        </div>
      )}

      {loading && <p style={{ color: 'var(--text-secondary)' }}>Loading…</p>}

      {!loading && !error && rows.length === 0 && (
        <EmptyState icon="🗓️" title="No classes scheduled this day" description="Classes appear here once the timetable has been built for this academic year and this weekday." />
      )}
      {!loading && !error && rows.length > 0 && visible.length === 0 && (
        <EmptyState icon="✓" title="Nothing needs attention" description="Every class shown is on track." />
      )}

      {[...periods.entries()].sort(([a], [b]) => a - b).map(([order, period]) => (
        <section key={order} style={{ marginBottom: 20 }}>
          <div className="section-label" style={{ marginBottom: 8 }}>{period.name} · {formatTime(period.starts)}–{formatTime(period.ends)}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {period.items.map((r) => {
              const status = TEACHER_STATUS[r.teacher_status]
              const isOpen = open === r.section_id
              return (
                <div key={r.section_id} className="card" style={{ padding: 0 }}>
                  <button
                    type="button"
                    onClick={() => toggle(r.section_id)}
                    aria-expanded={isOpen}
                    style={{ all: 'unset', boxSizing: 'border-box', width: '100%', cursor: 'pointer', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{r.subject}{r.class_name ? ` · ${r.class_name}` : ''}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                        {r.teacher_name}{r.room ? ` · Room ${r.room}` : ''}{r.department_name ? ` · ${r.department_name}` : ''}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                        {r.roll_taken
                          ? `Present ${r.present} · Late ${r.late} · Absent ${r.absent} of ${r.enrolled}${r.truant ? ` · ${r.truant} truant` : ''}`
                          : `Roll not taken · ${r.enrolled} enrolled`}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span className={`badge ${status.badge}`}>{teacherStatusLabel(r.teacher_status, r.minutes_late)}</span>
                      {r.started_at && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>Started {formatTime(r.started_at)}</div>}
                      {r.truant > 0 && <div style={{ marginTop: 4 }}><span className="badge badge-danger">{r.truant} truant</span></div>}
                    </div>
                  </button>
                  {isOpen && (
                    <div style={{ borderTop: '1px solid var(--border)', padding: '12px 16px' }}>
                      {rosterError && <p className="banner banner-danger" role="alert">{rosterError}</p>}
                      {!roster && !rosterError && <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Loading class list…</p>}
                      {roster && roster.length === 0 && <p style={{ color: 'var(--text-secondary)', margin: 0 }}>No students are enrolled in this class.</p>}
                      {roster && roster.length > 0 && (
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                            <thead>
                              <tr style={{ textAlign: 'left', color: 'var(--text-secondary)' }}>
                                <th style={{ padding: '4px 8px' }}>Student</th><th style={{ padding: '4px 8px' }}>This morning</th><th style={{ padding: '4px 8px' }}>In class</th>
                              </tr>
                            </thead>
                            <tbody>
                              {roster.map((s) => (
                                <tr key={s.student_id} style={{ borderTop: '1px solid var(--border)' }}>
                                  <td style={{ padding: '6px 8px' }}>{s.student_name}{s.student_code ? <span style={{ color: 'var(--text-muted)' }}> · {s.student_code}</span> : null}</td>
                                  <td style={{ padding: '6px 8px' }}>{s.morning_status ? MARK_LABEL[s.morning_status] : <span style={{ color: 'var(--text-muted)' }}>Not registered</span>}</td>
                                  <td style={{ padding: '6px 8px' }}>
                                    {s.class_status ? <span className={`badge ${s.is_truant ? 'badge-danger' : s.class_status === 'present' ? 'badge-success' : s.class_status === 'late' ? 'badge-warning' : 'badge-default'}`}>{s.is_truant ? 'Truant' : MARK_LABEL[s.class_status]}</span> : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
