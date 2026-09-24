'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import EmptyState from '@/components/EmptyState'
import { jamaicaDate, shiftDate, formatDay, formatTime, MARK_LABEL, attendanceError, type MarkStatus } from '@/lib/attendance'

type Row = {
  att_date: string; morning_status: MarkStatus | null; section_id: string | null; subject: string | null
  period_name: string | null; starts_at: string | null; class_status: MarkStatus | null; is_truant: boolean | null
}

const badgeFor = (s: MarkStatus) => (s === 'present' ? 'badge-success' : s === 'late' ? 'badge-warning' : 'badge-default')

export default function PrincipalStudentDetail() {
  const { id } = useParams<{ id: string }>()
  const today = jamaicaDate()
  const [days, setDays] = useState(30)
  const [name, setName] = useState('')
  const [code, setCode] = useState<string | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const [who, detail] = await Promise.all([
          supabase.from('profiles').select('full_name, student_id').eq('id', id).single(),
          supabase.rpc('student_attendance_detail', { p_student: id, p_from: shiftDate(today, -(days - 1)), p_to: today }),
        ])
        if (detail.error) throw detail.error
        if (cancelled) return
        setName(who.data?.full_name || '')
        setCode(who.data?.student_id || null)
        setRows((detail.data as Row[]) || [])
        setError('')
      } catch (err) {
        if (!cancelled) setError(attendanceError(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [id, days, today])

  // One entry per calendar day: the morning register, then each class.
  const byDay = new Map<string, Row[]>()
  for (const r of rows) (byDay.get(r.att_date) ?? byDay.set(r.att_date, []).get(r.att_date)!).push(r)
  const morning = [...byDay.values()].map((list) => list[0].morning_status)
  const totals = {
    present: morning.filter((m) => m === 'present').length,
    late: morning.filter((m) => m === 'late').length,
    absent: morning.filter((m) => m === 'absent').length,
    classesMissed: rows.filter((r) => r.class_status === 'absent').length,
    truant: rows.filter((r) => r.is_truant).length,
  }

  return (
    <div>
      <Link href="/principal/students" style={{ color: 'var(--text-secondary)', fontSize: 14 }}>&larr; All students</Link>
      <p className="portal-page-title" style={{ marginTop: 8 }}>{name || 'Student'}</p>
      <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: '0 0 16px' }}>{code ? `ID ${code}` : ''}</p>
      <div style={{ marginBottom: 16 }}>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Period">
          <option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option>
        </select>
      </div>
      {error && <p className="banner banner-danger" role="alert">{error}</p>}
      {loading && <p style={{ color: 'var(--text-secondary)' }}>Loading…</p>}
      {!loading && !error && (
        <>
          <div className="stat-grid">
            <div className="stat-card"><div className="stat-card-value">{totals.present}</div><div className="stat-card-label">Days present</div></div>
            <div className="stat-card"><div className="stat-card-value">{totals.late}</div><div className="stat-card-label">Days late</div></div>
            <div className="stat-card"><div className="stat-card-value">{totals.absent}</div><div className="stat-card-label">Days absent</div></div>
            <div className="stat-card"><div className="stat-card-value">{totals.classesMissed}</div><div className="stat-card-label">Classes missed</div></div>
            <div className={`stat-card ${totals.truant ? 'stat-card-accent' : ''}`}><div className="stat-card-value">{totals.truant}</div><div className="stat-card-label">Truancy</div></div>
          </div>
          {byDay.size === 0 && <EmptyState icon="🗓️" title="No attendance recorded" description="Nothing has been recorded for this student in this period." />}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[...byDay.entries()].map(([date, list]) => (
              <div key={date} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: list.some((r) => r.section_id) ? 8 : 0 }}>
                  <div style={{ fontWeight: 700 }}>{formatDay(date)}</div>
                  {list[0].morning_status ? <span className={`badge ${badgeFor(list[0].morning_status)}`}>Morning: {MARK_LABEL[list[0].morning_status]}</span> : <span className="badge badge-default">Morning: not registered</span>}
                </div>
                {list.filter((r) => r.section_id).map((r) => (
                  <div key={`${date}-${r.section_id}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13, padding: '4px 0', borderTop: '1px solid var(--border)' }}>
                    <span>{r.subject} <span style={{ color: 'var(--text-muted)' }}>· {r.period_name}{r.starts_at ? `, ${formatTime(r.starts_at)}` : ''}</span></span>
                    {r.class_status && <span className={`badge ${r.is_truant ? 'badge-danger' : badgeFor(r.class_status)}`}>{r.is_truant ? 'Truant' : MARK_LABEL[r.class_status]}</span>}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
