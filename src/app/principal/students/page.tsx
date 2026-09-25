'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import EmptyState from '@/components/EmptyState'
import { jamaicaDate, shiftDate, attendanceError } from '@/lib/attendance'
import { usePresence } from '@/lib/presence'
import PresenceDot from '@/components/PresenceDot'

type Row = {
  student_id: string; student_name: string; student_code: string | null; class_name: string | null
  days_present: number; days_late: number; days_absent: number; class_absences: number; truancy_count: number
}

// Every student and how often they are at school and in class.
export default function PrincipalStudentsPage() {
  const today = jamaicaDate()
  const [days, setDays] = useState(30)
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [cls, setCls] = useState('')
  const [onlyConcerns, setOnlyConcerns] = useState(false)
  const presence = usePresence(rows.map((r) => r.student_id))

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

  const classes = useMemo(() => [...new Set(rows.map((r) => r.class_name).filter((c): c is string => !!c))].sort(), [rows])
  const visible = useMemo(() => rows
    .filter((r) => (!cls || r.class_name === cls) && (!onlyConcerns || r.truancy_count > 0 || r.days_absent > 0)
      && (!search.trim() || r.student_name.toLowerCase().includes(search.toLowerCase()) || (r.student_code || '').toLowerCase().includes(search.toLowerCase())))
    .sort((a, b) => b.truancy_count - a.truancy_count || b.days_absent - a.days_absent || a.student_name.localeCompare(b.student_name)),
  [rows, cls, onlyConcerns, search])

  return (
    <div>
      <p className="portal-page-title">Students</p>
      <p className="portal-page-sub">Attendance by student</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <input type="search" placeholder="Search by name or student ID…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search students" style={{ flex: 1, minWidth: 220 }} />
        <select value={cls} onChange={(e) => setCls(e.target.value)} aria-label="Class">
          <option value="">All classes</option>
          {classes.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Period">
          <option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option>
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <input type="checkbox" checked={onlyConcerns} onChange={(e) => setOnlyConcerns(e.target.checked)} /> Only students with absences or truancy
        </label>
      </div>
      {error && <p className="banner banner-danger" role="alert">{error}</p>}
      {loading && <p style={{ color: 'var(--text-secondary)' }}>Loading…</p>}
      {!loading && !error && visible.length === 0 && <EmptyState icon="🎓" title="No students found" />}
      {!loading && !error && visible.length > 0 && (
        <>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 8px' }}>{visible.length} of {rows.length} students · most concerning first</p>
          <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--text-secondary)' }}>
                  {['Student', 'Class', 'Days present', 'Days late', 'Days absent', 'Classes missed', 'Truancy'].map((h) => <th key={h} style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.student_id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 12px' }}>
                      <PresenceDot info={presence[r.student_id]} /> <Link href={`/principal/students/${r.student_id}`} style={{ fontWeight: 600 }}>{r.student_name}</Link>
                      {r.student_code && <span style={{ color: 'var(--text-muted)' }}> · {r.student_code}</span>}
                    </td>
                    <td style={{ padding: '8px 12px' }}>{r.class_name || '—'}</td>
                    <td style={{ padding: '8px 12px' }}>{r.days_present}</td>
                    <td style={{ padding: '8px 12px' }}>{r.days_late}</td>
                    <td style={{ padding: '8px 12px' }}>{r.days_absent}</td>
                    <td style={{ padding: '8px 12px' }}>{r.class_absences}</td>
                    <td style={{ padding: '8px 12px' }}>{r.truancy_count > 0 ? <span className="badge badge-danger">{r.truancy_count}</span> : '0'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
