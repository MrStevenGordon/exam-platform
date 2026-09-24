'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import EmptyState from '@/components/EmptyState'
import { jamaicaDate, formatDay, formatTime, teacherStatusLabel, TEACHER_STATUS, attendanceError } from '@/lib/attendance'
import type { BoardRow } from '@/components/principal/TodayBoardView'

type TruantRow = { student_id: string; student_name: string; student_code: string | null; subject: string; period_name: string; starts_at: string; teacher_name: string }

export default function PrincipalHome() {
  const today = jamaicaDate()
  const [board, setBoard] = useState<BoardRow[]>([])
  const [truants, setTruants] = useState<TruantRow[]>([])
  const [title, setTitle] = useState('')
  const [counts, setCounts] = useState({ teachers: 0, hods: 0, students: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        const [boardRes, truancyRes, teachers, hods, students, me] = await Promise.all([
          supabase.rpc('attendance_board', { p_date: today }),
          supabase.rpc('truancy_report', { p_from: today, p_to: today }),
          supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'teacher'),
          supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'supervisor'),
          supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'student'),
          user ? supabase.from('profiles').select('leadership_title').eq('id', user.id).single() : Promise.resolve({ data: null }),
        ])
        if (boardRes.error) throw boardRes.error
        if (truancyRes.error) throw truancyRes.error
        if (cancelled) return
        setBoard((boardRes.data as BoardRow[]) || [])
        setTruants((truancyRes.data as TruantRow[]) || [])
        setCounts({ teachers: teachers.count || 0, hods: hods.count || 0, students: students.count || 0 })
        setTitle(me.data?.leadership_title || '')
      } catch (err) {
        if (!cancelled) setError(attendanceError(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [today])

  if (loading) return <div>Loading…</div>

  const attention = board.filter((r) => ['late', 'not_started', 'missed'].includes(r.teacher_status))
  const onTime = board.filter((r) => r.teacher_status === 'on_time').length

  return (
    <div>
      <p className="portal-page-title">School overview</p>
      <p className="portal-page-sub">{formatDay(today)}</p>
      <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: '0 0 20px' }}>{formatDay(today)}</p>

      {error && <p className="banner banner-danger" role="alert">{error}</p>}

      <div className="stat-grid">
        <div className="stat-card"><div className="stat-card-value">{counts.teachers}</div><div className="stat-card-label">Teachers</div></div>
        <div className="stat-card"><div className="stat-card-value">{counts.hods}</div><div className="stat-card-label">Heads of department</div></div>
        <div className="stat-card"><div className="stat-card-value">{counts.students}</div><div className="stat-card-label">Students</div></div>
      </div>

      <div className="stat-grid">
        <div className="stat-card"><div className="stat-card-value">{board.length}</div><div className="stat-card-label">Classes today</div></div>
        <div className="stat-card"><div className="stat-card-value">{onTime}</div><div className="stat-card-label">Teacher on time</div></div>
        <div className={`stat-card ${attention.length > 0 ? 'stat-card-accent' : ''}`}><div className="stat-card-value">{attention.length}</div><div className="stat-card-label">Late / not started</div></div>
        <div className={`stat-card ${truants.length > 0 ? 'stat-card-accent' : ''}`}><div className="stat-card-value">{truants.length}</div><div className="stat-card-label">Truant today</div></div>
      </div>

      {board.length === 0 && !error && (
        <EmptyState icon="🗓️" title="No classes scheduled today" description="Once the timetable is built and teachers start recording attendance, today's picture appears here." />
      )}

      {attention.length > 0 && (
        <section style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div className="section-label">Teachers needing attention</div>
            <Link href="/principal/attendance" style={{ fontSize: 13, fontWeight: 700 }}>Open the live board →</Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {attention.map((r) => (
              <div key={r.section_id} className="card" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{r.teacher_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{r.subject}{r.class_name ? ` · ${r.class_name}` : ''} · {r.period_name}, {formatTime(r.starts_at)}</div>
                </div>
                <span className={`badge ${TEACHER_STATUS[r.teacher_status].badge}`} style={{ alignSelf: 'center' }}>{teacherStatusLabel(r.teacher_status, r.minutes_late)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {truants.length > 0 && (
        <section style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div className="section-label">Truant today (at school, missing from class)</div>
            <Link href="/principal/attendance?tab=truancy" style={{ fontSize: 13, fontWeight: 700 }}>Full truancy report →</Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {truants.map((t) => (
              <div key={`${t.student_id}-${t.starts_at}`} className="card" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <Link href={`/principal/students/${t.student_id}`} style={{ fontWeight: 700, fontSize: 14 }}>{t.student_name}</Link>
                  {t.student_code && <span style={{ color: 'var(--text-muted)', fontSize: 12 }}> · {t.student_code}</span>}
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Missed {t.subject} · {t.period_name}, {formatTime(t.starts_at)} · {t.teacher_name}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
