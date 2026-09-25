'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import EmptyState from '@/components/EmptyState'
import { timeAgo } from '@/lib/presence'
import { STEP_KEYS, type LessonRow } from '@/lib/learning'
import { REASON_LABEL, niceDay, type CatchupRow } from '@/lib/learningCatchup'

type Student = { student_id: string; student_name: string; student_code: string | null; class_group_id: string; class_name: string }

// Students who missed the lesson: found from the attendance register when it shows them absent on the
// day it was taught, plus anyone the teacher adds. They drop off the list once they finish the lesson.
export default function LessonCatchupTab({ lesson, onGoAssign }: { lesson: LessonRow; onGoAssign: () => void }) {
  const [rows, setRows] = useState<CatchupRow[]>([])
  const [everyone, setEveryone] = useState<Student[]>([])
  const [anyTaughtOn, setAnyTaughtOn] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [addId, setAddId] = useState('')
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [c, all, asg] = await Promise.all([
        supabase.rpc('learning_catchup', { p_lesson_id: lesson.id }),
        supabase.rpc('learning_results', { p_lesson_id: lesson.id }),
        supabase.from('learning_assignments').select('taught_on').eq('lesson_id', lesson.id),
      ])
      if (cancelled) return
      if (c.error) setError('Could not load the catch-up list. Please try again.')
      else { setRows((c.data as CatchupRow[]) || []); setError('') }
      setEveryone((all.data as Student[]) || [])
      setAnyTaughtOn(((asg.data as { taught_on: string | null }[]) || []).some((a) => a.taught_on))
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [lesson.id, reload])

  const refresh = useCallback(() => setReload((n) => n + 1), [])

  async function choose(studentId: string, action: 'add' | 'remove' | 'clear', done: string) {
    setBusy(true); setError(''); setNotice('')
    const { error: e } = await supabase.rpc('learning_catchup_set', { p_lesson_id: lesson.id, p_student_id: studentId, p_action: action })
    setBusy(false)
    if (e) { setError(e.message && !/^(JWT|fetch|Failed)/i.test(e.message) ? e.message : 'Could not save that. Please try again.'); return }
    setNotice(done); setAddId(''); refresh()
  }

  const needing = rows.filter((r) => !r.dismissed && !r.completed_at)
  const caught = rows.filter((r) => !r.dismissed && r.completed_at)
  const removed = rows.filter((r) => r.dismissed)
  const listed = useMemo(() => new Set(rows.filter((r) => !r.dismissed).map((r) => r.student_id)), [rows])
  const candidates = useMemo(
    () => everyone.filter((s) => !listed.has(s.student_id)).sort((a, b) => a.class_name.localeCompare(b.class_name, undefined, { numeric: true }) || a.student_name.localeCompare(b.student_name)),
    [everyone, listed],
  )

  if (lesson.status !== 'published') {
    return <div className="card"><p style={{ margin: 0, fontSize: 14 }}>Publish the lesson and give it to a class first. Then students who miss it can be listed here.</p></div>
  }
  if (loading) return <div>Loading…</div>

  const row = (r: CatchupRow, actions: React.ReactNode) => (
    <div key={r.student_id} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', padding: '8px 0', borderTop: '1px solid var(--border)' }}>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{r.student_name}{r.student_code ? <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> · {r.student_code}</span> : null} <span style={{ color: 'var(--text-secondary)', fontWeight: 400, fontSize: 13 }}>· {r.class_name}</span></div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
          {REASON_LABEL[r.reason]}{r.reason !== 'added' && r.taught_on ? ` on ${niceDay(r.taught_on)}` : ''} · {r.steps_done} of {STEP_KEYS.length} steps{r.completed_at ? ` · finished ${timeAgo(r.completed_at)}` : ''}
        </div>
      </div>
      {actions}
    </div>
  )

  return (
    <div>
      <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text-secondary)' }}>
        Students who missed this lesson. They appear automatically when the attendance register shows them absent on the day you taught it, and you can add or remove anyone. Each student sees only their own note, and it disappears when they finish the lesson.
      </p>
      {!anyTaughtOn && (
        <p className="banner banner-warning" style={{ fontSize: 13 }}>
          You have not said which day you taught this. Set it on the <button type="button" className="btn btn-ghost" style={{ fontSize: 13, padding: '0 4px', textDecoration: 'underline' }} onClick={onGoAssign}>Assign tab</button> so absent students can be found automatically. You can still add students here by hand.
        </p>
      )}
      {error && <p className="banner banner-danger" role="alert">{error}</p>}
      {notice && <p className="banner banner-success" role="status">{notice}</p>}

      <div className="stat-grid" style={{ marginBottom: 14 }}>
        <div className={`stat-card ${needing.length > 0 ? 'stat-card-accent' : ''}`}><div className="stat-card-value">{needing.length}</div><div className="stat-card-label">Still to catch up</div></div>
        <div className="stat-card"><div className="stat-card-value">{caught.length}</div><div className="stat-card-label">Caught up</div></div>
      </div>

      {needing.length === 0 && caught.length === 0 && (
        <EmptyState icon="✓" title="Nobody to catch up" description="No one was recorded absent on the day you taught it. If someone missed it anyway, add them below." />
      )}

      {needing.length > 0 && (
        <div className="card" style={{ marginBottom: 12, paddingTop: 8, paddingBottom: 8 }}>
          <p style={{ margin: '4px 0', fontSize: 14, fontWeight: 700 }}>Still to catch up</p>
          {needing.map((r) => row(r, (
            <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} disabled={busy}
              onClick={() => choose(r.student_id, r.reason === 'added' ? 'clear' : 'remove', `${r.student_name} taken off the list.`)}>
              {r.reason === 'added' ? 'Take off list' : 'Not needed'}
            </button>
          )))}
        </div>
      )}

      {caught.length > 0 && (
        <div className="card" style={{ marginBottom: 12, paddingTop: 8, paddingBottom: 8 }}>
          <p style={{ margin: '4px 0', fontSize: 14, fontWeight: 700 }}>Caught up</p>
          {caught.map((r) => row(r, <span className="badge badge-success">Done</span>))}
        </div>
      )}

      <div className="card" style={{ marginBottom: 12 }}>
        <p style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 700 }}>Add a student</p>
        {candidates.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>{everyone.length === 0 ? 'Give the lesson to a class first.' : 'Everyone in these classes is already on the list.'}</p>
        ) : (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <select value={addId} onChange={(e) => setAddId(e.target.value)} aria-label="Student to add" style={{ minWidth: 240 }}>
              <option value="">Choose a student…</option>
              {candidates.map((s) => <option key={s.student_id} value={s.student_id}>{s.class_name} · {s.student_name}</option>)}
            </select>
            <button type="button" className="btn btn-secondary" disabled={!addId || busy} onClick={() => choose(addId, 'add', 'Student added to the catch-up list.')}>Add to catch-up</button>
          </div>
        )}
      </div>

      {removed.length > 0 && (
        <details style={{ marginBottom: 12 }}>
          <summary style={{ cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)' }}>{removed.length} taken off the list</summary>
          <div className="card" style={{ marginTop: 8, paddingTop: 8, paddingBottom: 8 }}>
            {removed.map((r) => row(r, (
              <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} disabled={busy} onClick={() => choose(r.student_id, 'clear', 'Put back.')}>Put back</button>
            )))}
          </div>
        </details>
      )}
    </div>
  )
}
