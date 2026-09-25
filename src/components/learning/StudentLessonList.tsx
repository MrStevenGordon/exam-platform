'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import EmptyState from '@/components/EmptyState'
import { jamaicaDate } from '@/lib/attendance'
import { STATE_INFO, STEP_KEYS, dueLabel, lessonState, type StudentLessonRow } from '@/lib/learning'

// A student's lessons: what their teachers have assigned, what is due, and how far they have got.
export default function StudentLessonList() {
  const [rows, setRows] = useState<StudentLessonRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const today = jamaicaDate()

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data, error: e } = await supabase.rpc('learning_student_lessons')
      if (cancelled) return
      if (e) setError('Could not load your lessons. Please try again.')
      else setRows((data as StudentLessonRow[]) || [])
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [])

  if (loading) return <div>Loading…</div>

  const open = rows.filter((r) => !r.completed_at && !r.closed).sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999'))
  const done = rows.filter((r) => r.completed_at)
  const closed = rows.filter((r) => !r.completed_at && r.closed)

  const card = (r: StudentLessonRow) => {
    const state = lessonState(r)
    const due = dueLabel(r.due_date, today)
    const body = (
      <div className={`card ${r.closed && !r.completed_at ? '' : 'card-clickable'}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center', opacity: r.closed && !r.completed_at ? 0.6 : 1 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{r.title}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{r.subject} · {r.teacher_name}</div>
          <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ width: 120, height: 6, borderRadius: 3, background: 'var(--border)' }} aria-hidden="true">
              <div style={{ width: `${(r.steps_done / STEP_KEYS.length) * 100}%`, height: 6, borderRadius: 3, background: 'var(--accent)' }} />
            </div>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{r.steps_done} of {STEP_KEYS.length} steps</span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span className={`badge ${STATE_INFO[state].badge}`}>{r.closed && !r.completed_at ? 'Closed' : STATE_INFO[state].label}</span>
          {due && <div style={{ fontSize: 12, marginTop: 4, color: due.overdue && !r.completed_at ? 'var(--danger)' : 'var(--text-secondary)', fontWeight: due.overdue && !r.completed_at ? 700 : 400 }}>{due.text}</div>}
        </div>
      </div>
    )
    return r.closed && !r.completed_at
      ? <div key={r.lesson_id}>{body}</div>
      : <Link key={r.lesson_id} href={`/learning/lesson/${r.lesson_id}`} style={{ textDecoration: 'none', color: 'inherit' }}>{body}</Link>
  }

  return (
    <div>
      <p className="portal-page-title">My lessons</p>
      {error && <p className="banner banner-danger" role="alert">{error}</p>}
      {!error && rows.length === 0 && (
        <EmptyState icon="📚" title="No lessons yet" description="When a teacher gives your class a lesson, it appears here." />
      )}
      {open.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <div className="section-label" style={{ marginBottom: 8 }}>To do</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{open.map(card)}</div>
        </section>
      )}
      {done.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <div className="section-label" style={{ marginBottom: 8 }}>Finished</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{done.map(card)}</div>
        </section>
      )}
      {closed.length > 0 && (
        <section>
          <div className="section-label" style={{ marginBottom: 8 }}>Closed</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{closed.map(card)}</div>
        </section>
      )}
    </div>
  )
}
