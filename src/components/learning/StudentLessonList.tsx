'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import EmptyState from '@/components/EmptyState'
import { jamaicaDate } from '@/lib/attendance'
import { STATE_INFO, STEP_KEYS, dueLabel, lessonState, type StudentLessonRow } from '@/lib/learning'
import { catchupMessage, loadStudentCatchup, type StudentCatchup } from '@/lib/learningCatchup'
import { currentUserId } from '@/lib/offline/flashcardsOffline'
import { idbKv } from '@/lib/offline/kv'
import { isNetworkFailure } from '@/lib/offline/network'
import { cachedLessonIds, getLessonList, saveLessonList } from '@/lib/offline/offlineCache'

// A student's lessons: what their teachers have assigned, what is due, and how far they have got.
export default function StudentLessonList() {
  const [rows, setRows] = useState<StudentLessonRow[]>([])
  // Lessons the student was away for. Empty if catch-up is not installed.
  const [catchup, setCatchup] = useState<Record<string, StudentCatchup>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  // With no connection the list is the copy saved on this device, and only lessons already opened can be read.
  const [fromCache, setFromCache] = useState(false)
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const today = jamaicaDate()

  useEffect(() => {
    let cancelled = false
    async function load() {
      const kv = idbKv(); const uid = await currentUserId()
      const [{ data, error: e }, missed] = await Promise.all([supabase.rpc('learning_student_lessons'), loadStudentCatchup().catch(() => ({} as Record<string, StudentCatchup>))])
      if (cancelled) return
      if (!e) {
        setRows((data as StudentLessonRow[]) || [])
        if (kv && uid) await saveLessonList(kv, uid, (data as unknown[]) || [])
      } else if (isNetworkFailure(e) && kv && uid) {
        const cached = await getLessonList(kv, uid)
        if (cancelled) return
        if (cached) { setRows(cached.rows as StudentLessonRow[]); setSavedIds(new Set(await cachedLessonIds(kv, uid))); setFromCache(true) }
        else setError('You are offline and no lessons are saved on this device yet. Open your lessons once while online.')
      } else setError('Could not load your lessons. Please try again.')
      setCatchup(missed)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [])

  if (loading) return <div>Loading…</div>

  // Lessons they were away for come first, then by due date.
  const open = rows.filter((r) => !r.completed_at && !r.closed).sort((a, b) => Number(!!catchup[b.lesson_id]) - Number(!!catchup[a.lesson_id]) || (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999'))
  const done = rows.filter((r) => r.completed_at)
  const closed = rows.filter((r) => !r.completed_at && r.closed)

  const card = (r: StudentLessonRow) => {
    const state = lessonState(r)
    const due = dueLabel(r.due_date, today, !!r.completed_at)
    const notSaved = fromCache && !savedIds.has(r.lesson_id)   // offline, and this lesson was never opened here
    const body = (
      <div className={`card ${r.closed && !r.completed_at ? '' : 'card-clickable'}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center', opacity: (r.closed && !r.completed_at) || notSaved ? 0.6 : 1 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{r.title}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{r.subject} · {r.teacher_name}</div>
          {notSaved && <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-secondary)' }}>Open this lesson once while you are online to read it offline.</div>}
          {catchup[r.lesson_id] && !r.completed_at && (
            <div style={{ marginTop: 6 }}><span className="badge badge-warning">Catch up</span> <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{catchupMessage(catchup[r.lesson_id])}</span></div>
          )}
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
    return (r.closed && !r.completed_at) || notSaved
      ? <div key={r.lesson_id}>{body}</div>
      : <Link key={r.lesson_id} href={`/learning/lesson/${r.lesson_id}`} style={{ textDecoration: 'none', color: 'inherit' }}>{body}</Link>
  }

  return (
    <div>
      <p className="portal-page-title">My lessons</p>
      {error && <p className="banner banner-danger" role="alert">{error}</p>}
      {fromCache && <p className="banner banner-warning" style={{ fontSize: 13 }}>Showing the copy saved on this device. Lessons you have opened before can be read offline.</p>}
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
