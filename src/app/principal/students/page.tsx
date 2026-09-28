'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import EmptyState from '@/components/EmptyState'
import { jamaicaDate, shiftDate, attendanceError } from '@/lib/attendance'
import { compareClassNames, gradeLevelFromClassName } from '@/lib/classNames'
import { usePresence } from '@/lib/presence'
import PresenceDot from '@/components/PresenceDot'

type Row = {
  student_id: string; student_name: string; student_code: string | null; class_name: string | null
  days_present: number; days_late: number; days_absent: number; class_absences: number; truancy_count: number
}

const NO_CLASS = 'No class'
const concern = (r: Row) => r.truancy_count > 0 || r.days_absent > 0

// Every student and how often they are at school and in class, grouped by class. Each class opens to its students.
// The school overview links here with ?online=1.
export default function PrincipalStudentsPage() {
  const today = jamaicaDate()
  const [days, setDays] = useState(30)
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [cls, setCls] = useState('')
  const [onlyConcerns, setOnlyConcerns] = useState(false)
  const [onlineOnly, setOnlineOnly] = useState(false)
  const [open, setOpen] = useState<Set<string>>(new Set())
  const presence = usePresence(rows.map((r) => r.student_id))
  const presenceOn = Object.keys(presence).length > 0

  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    if (q.get('online') === '1') setOnlineOnly(true)
    const c = q.get('class')
    if (c) { setCls(c); setOpen(new Set([c])) }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const { data, error: rpcError } = await supabase.rpc('student_attendance_summary', { p_from: shiftDate(today, -(days - 1)), p_to: today })
        if (rpcError) throw rpcError
        if (!cancelled) { setRows((data as Row[]) || []); setError('') }
      } catch (err) {
        if (!cancelled) setError(attendanceError(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [days, today])

  const classes = useMemo(() => [...new Set(rows.map((r) => r.class_name).filter((c): c is string => !!c))].sort(compareClassNames), [rows])
  // The online filter only means something once online status is available; without it everyone is shown.
  const onlineFilter = onlineOnly && presenceOn
  const filtering = search.trim() !== '' || onlineFilter || onlyConcerns || cls !== ''

  const visible = useMemo(() => rows.filter((r) =>
    (!cls || r.class_name === cls) && (!onlyConcerns || concern(r)) &&
    (!onlineFilter || (presence[r.student_id] && presence[r.student_id].state !== 'offline')) &&
    (!search.trim() || r.student_name.toLowerCase().includes(search.toLowerCase()) || (r.student_code || '').toLowerCase().includes(search.toLowerCase()))
  ), [rows, cls, onlyConcerns, onlineFilter, search, presence])

  // Classes in order (1-1, 1-2 ... 5-7, 6B1 ... 6A3, then anyone without a class); students by name inside each.
  const groups = useMemo(() => {
    const map = new Map<string, Row[]>()
    for (const r of visible) map.set(r.class_name || NO_CLASS, [...(map.get(r.class_name || NO_CLASS) ?? []), r])
    for (const list of map.values()) list.sort((a, b) => a.student_name.localeCompare(b.student_name))
    return [...map.entries()].sort(([a], [b]) => (a === NO_CLASS ? 1 : b === NO_CLASS ? -1 : compareClassNames(a, b)))
  }, [visible])

  const toggle = (key: string) => setOpen((prev) => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next })
  // Searching or filtering shows the matching students straight away.
  const isOpen = (key: string) => (search.trim() !== '' || onlineFilter) || open.has(key)

  return (
    <div>
      <h1 className="portal-page-title">Students</h1>
      <p className="portal-page-sub">Attendance by student, grouped by class</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <input type="search" placeholder="Search by name or student ID…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search students" style={{ flex: 1, minWidth: 220 }} />
        <select value={cls} onChange={(e) => { setCls(e.target.value); if (e.target.value) setOpen((prev) => new Set(prev).add(e.target.value)) }} aria-label="Class">
          <option value="">All classes</option>
          {classes.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Period">
          <option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option>
        </select>
      </div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <input type="checkbox" checked={onlyConcerns} onChange={(e) => setOnlyConcerns(e.target.checked)} /> Only students with absences or truancy
        </label>
        {presenceOn && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <input type="checkbox" checked={onlineOnly} onChange={(e) => setOnlineOnly(e.target.checked)} /> Online now
          </label>
        )}
        {groups.length > 1 && !(search.trim() || onlineFilter) && (
          <>
            <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setOpen(new Set(groups.map(([k]) => k)))}>Expand all</button>
            <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setOpen(new Set())}>Collapse all</button>
          </>
        )}
      </div>
      {error && <p className="banner banner-danger" role="alert">{error}</p>}
      {loading && <p style={{ color: 'var(--text-secondary)' }}>Loading…</p>}
      {!loading && !error && visible.length === 0 && <EmptyState icon="🎓" title={onlineFilter ? 'No students are online right now' : 'No students found'} />}
      {!loading && !error && visible.length > 0 && (
        <>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 8px' }}>{visible.length}{filtering ? ` of ${rows.length}` : ''} students in {groups.length} class{groups.length === 1 ? '' : 'es'}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {groups.map(([name, list], gi) => {
              const expanded = isOpen(name)
              const concerns = list.filter(concern).length
              const online = list.filter((r) => presence[r.student_id]?.state === 'online').length
              const grade = gradeLevelFromClassName(name)
              const prevGrade = gi > 0 ? gradeLevelFromClassName(groups[gi - 1][0]) : null
              return (
                <div key={name}>
                  {grade !== null && grade !== prevGrade && (
                    <div className="section-label" style={{ margin: gi === 0 ? '0 0 6px' : '12px 0 6px' }}>Grade {grade}</div>
                  )}
                  <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--card-bg)', overflow: 'hidden' }}>
                    <button
                      type="button"
                      onClick={() => toggle(name)}
                      aria-expanded={expanded}
                      style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '10px 16px', background: 'transparent', border: 'none', cursor: 'pointer', font: 'inherit', color: 'inherit' }}
                    >
                      <span style={{ fontWeight: 700, fontSize: 15 }}>{name === NO_CLASS ? NO_CLASS : `Class ${name}`}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        {online > 0 && <span className="badge badge-success">{online} online</span>}
                        {concerns > 0 && <span className="badge badge-danger">{concerns} with absences</span>}
                        <span>{list.length} student{list.length === 1 ? '' : 's'}</span>
                        <span aria-hidden="true">{expanded ? '▲' : '▼'}</span>
                      </span>
                    </button>
                    {expanded && (
                      <div style={{ borderTop: '1px solid var(--border)', overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                          <thead>
                            <tr style={{ textAlign: 'left', color: 'var(--text-secondary)' }}>
                              {['Student', 'Days present', 'Days late', 'Days absent', 'Classes missed', 'Truancy'].map((h) => <th key={h} style={{ padding: '8px 12px', whiteSpace: 'nowrap', fontSize: 12 }}>{h}</th>)}
                            </tr>
                          </thead>
                          <tbody>
                            {list.map((r) => (
                              <tr key={r.student_id} style={{ borderTop: '1px solid var(--border)' }}>
                                <td style={{ padding: '7px 12px' }}>
                                  <PresenceDot info={presence[r.student_id]} /> <Link href={`/principal/students/${r.student_id}`} style={{ fontWeight: 600 }}>{r.student_name}</Link>
                                  {r.student_code && <span style={{ color: 'var(--text-muted)' }}> · {r.student_code}</span>}
                                </td>
                                <td style={{ padding: '7px 12px' }}>{r.days_present}</td>
                                <td style={{ padding: '7px 12px' }}>{r.days_late}</td>
                                <td style={{ padding: '7px 12px' }}>{r.days_absent}</td>
                                <td style={{ padding: '7px 12px' }}>{r.class_absences}</td>
                                <td style={{ padding: '7px 12px' }}>{r.truancy_count > 0 ? <span className="badge badge-danger">{r.truancy_count}</span> : '0'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
