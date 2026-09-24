'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import EmptyState from '@/components/EmptyState'
import { jamaicaDate, shiftDate, formatDay, formatTime, attendanceError } from '@/lib/attendance'

type TruancyRow = {
  class_date: string; student_id: string; student_name: string; student_code: string | null; home_class: string | null
  section_id: string; subject: string; period_name: string; starts_at: string; teacher_name: string; room: string | null
}

// Students who were at school (present at the morning register) but absent from a class.
export default function TruancyView() {
  const today = jamaicaDate()
  const [from, setFrom] = useState(shiftDate(today, -6))
  const [to, setTo] = useState(today)
  const [rows, setRows] = useState<TruancyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const { data, error: rpcError } = await supabase.rpc('truancy_report', { p_from: from, p_to: to })
        if (rpcError) throw rpcError
        if (!cancelled) { setRows((data as TruancyRow[]) || []); setError('') }
      } catch (err) {
        if (!cancelled) setError(attendanceError(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [from, to])

  const students = new Set(rows.map((r) => r.student_id)).size

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <label style={{ fontSize: 13, color: 'var(--text-secondary)' }} htmlFor="tr-from">From</label>
        <input id="tr-from" type="date" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} />
        <label style={{ fontSize: 13, color: 'var(--text-secondary)' }} htmlFor="tr-to">To</label>
        <input id="tr-to" type="date" value={to} min={from} max={today} onChange={(e) => e.target.value && setTo(e.target.value)} />
        <button type="button" className="btn btn-ghost" onClick={() => { setFrom(shiftDate(today, -6)); setTo(today) }}>Last 7 days</button>
        <button type="button" className="btn btn-ghost" onClick={() => { setFrom(shiftDate(today, -29)); setTo(today) }}>Last 30 days</button>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-secondary)', maxWidth: 680, margin: '0 0 16px' }}>
        A student appears here when the morning register marked them present but a teacher marked them absent from a class.
        Students marked late in the morning are left out, because the register does not record when they arrived.
      </p>

      {error && <p className="banner banner-danger" role="alert">{error}</p>}
      {loading && <p style={{ color: 'var(--text-secondary)' }}>Loading…</p>}
      {!loading && !error && rows.length === 0 && (
        <EmptyState icon="✓" title="No truancy recorded" description="No student was marked absent from a class after being registered present, in this period." />
      )}
      {!loading && !error && rows.length > 0 && (
        <>
          <p style={{ fontWeight: 700, margin: '0 0 8px' }}>{rows.length} missed class{rows.length !== 1 ? 'es' : ''} by {students} student{students !== 1 ? 's' : ''}</p>
          <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--text-secondary)' }}>
                  {['Date', 'Student', 'Class', 'Missed', 'Teacher'].map((h) => <th key={h} style={{ padding: '10px 12px' }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={`${r.class_date}-${r.student_id}-${r.section_id}`} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>{formatDay(r.class_date)}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <Link href={`/principal/students/${r.student_id}`} style={{ fontWeight: 600 }}>{r.student_name}</Link>
                      {r.student_code && <span style={{ color: 'var(--text-muted)' }}> · {r.student_code}</span>}
                    </td>
                    <td style={{ padding: '8px 12px' }}>{r.home_class || '—'}</td>
                    <td style={{ padding: '8px 12px' }}>{r.subject} <span style={{ color: 'var(--text-muted)' }}>· {r.period_name}, {formatTime(r.starts_at)}</span></td>
                    <td style={{ padding: '8px 12px' }}>{r.teacher_name}</td>
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
