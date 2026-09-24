'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import EmptyState from '@/components/EmptyState'
import { jamaicaDate, shiftDate, attendanceError } from '@/lib/attendance'

export type PunctualityRow = {
  teacher_id: string; teacher_name: string; department_name: string | null
  scheduled: number; on_time: number; late: number; missed: number; avg_minutes_late: number | null
}

export const onTimePercent = (r: Pick<PunctualityRow, 'scheduled' | 'on_time'>) => (r.scheduled > 0 ? Math.round((r.on_time / r.scheduled) * 100) : null)

// How reliably each teacher gets to class.
export default function PunctualityView() {
  const today = jamaicaDate()
  const [from, setFrom] = useState(shiftDate(today, -29))
  const [to, setTo] = useState(today)
  const [rows, setRows] = useState<PunctualityRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const { data, error: rpcError } = await supabase.rpc('teacher_punctuality', { p_from: from, p_to: to })
        if (rpcError) throw rpcError
        if (!cancelled) { setRows((data as PunctualityRow[]) || []); setError('') }
      } catch (err) {
        if (!cancelled) setError(attendanceError(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [from, to])

  // Least punctual first.
  const sorted = [...rows].sort((a, b) => (onTimePercent(a) ?? 101) - (onTimePercent(b) ?? 101) || a.teacher_name.localeCompare(b.teacher_name))

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <label style={{ fontSize: 13, color: 'var(--text-secondary)' }} htmlFor="pu-from">From</label>
        <input id="pu-from" type="date" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} />
        <label style={{ fontSize: 13, color: 'var(--text-secondary)' }} htmlFor="pu-to">To</label>
        <input id="pu-to" type="date" value={to} min={from} max={today} onChange={(e) => e.target.value && setTo(e.target.value)} />
        <button type="button" className="btn btn-ghost" onClick={() => { setFrom(shiftDate(today, -6)); setTo(today) }}>Last 7 days</button>
        <button type="button" className="btn btn-ghost" onClick={() => { setFrom(shiftDate(today, -29)); setTo(today) }}>Last 30 days</button>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-secondary)', maxWidth: 680, margin: '0 0 16px' }}>
        A teacher is on time if they tapped Start class within 10 minutes of the period starting. Only days when attendance was
        recorded are counted, so weekends and holidays never count against anyone, and a class is only counted once its 10-minute
        window has passed. &ldquo;No class recorded&rdquo; means nobody started that class.
      </p>

      {error && <p className="banner banner-danger" role="alert">{error}</p>}
      {loading && <p style={{ color: 'var(--text-secondary)' }}>Loading…</p>}
      {!loading && !error && sorted.length === 0 && (
        <EmptyState icon="🕘" title="Nothing to report yet" description="Punctuality appears once teachers start recording classes on days the school ran." />
      )}
      {!loading && !error && sorted.length > 0 && (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--text-secondary)' }}>
                {['Teacher', 'Department', 'Classes', 'On time', 'Late', 'No class recorded', 'Avg. late', 'On-time rate'].map((h) => <th key={h} style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => {
                const pct = onTimePercent(r)
                return (
                  <tr key={r.teacher_id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600 }}>{r.teacher_name}</td>
                    <td style={{ padding: '8px 12px' }}>{r.department_name || '—'}</td>
                    <td style={{ padding: '8px 12px' }}>{r.scheduled}</td>
                    <td style={{ padding: '8px 12px' }}>{r.on_time}</td>
                    <td style={{ padding: '8px 12px' }}>{r.late}</td>
                    <td style={{ padding: '8px 12px' }}>{r.missed}</td>
                    <td style={{ padding: '8px 12px' }}>{r.avg_minutes_late ? `${r.avg_minutes_late} min` : '—'}</td>
                    <td style={{ padding: '8px 12px' }}>
                      {pct === null ? '—' : <span className={`badge ${pct >= 90 ? 'badge-success' : pct >= 70 ? 'badge-warning' : 'badge-danger'}`}>{pct}%</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
