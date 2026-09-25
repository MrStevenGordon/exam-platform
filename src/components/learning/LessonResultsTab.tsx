'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import EmptyState from '@/components/EmptyState'
import { jamaicaDate } from '@/lib/attendance'
import { timeAgo } from '@/lib/presence'
import { STATE_INFO, STEP_KEYS, lessonState, type LessonRow } from '@/lib/learning'

type Row = {
  student_id: string; student_name: string; student_code: string | null; class_group_id: string; class_name: string
  due_date: string | null; steps_done: number; started_at: string | null; last_activity_at: string | null; completed_at: string | null
}
type Filter = 'all' | 'nudge' | 'done'

// Who has finished, who has started, and who has not opened it yet.
export default function LessonResultsTab({ lesson }: { lesson: LessonRow }) {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [cls, setCls] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const today = jamaicaDate()

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data, error: e } = await supabase.rpc('learning_results', { p_lesson_id: lesson.id })
      if (cancelled) return
      if (e) setError('Could not load the results. Please try again.')
      else setRows((data as Row[]) || [])
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [lesson.id])

  const classes = useMemo(() => [...new Map(rows.map((r) => [r.class_group_id, r.class_name])).entries()].sort((a, b) => a[1].localeCompare(b[1], undefined, { numeric: true })), [rows])
  const scoped = rows.filter((r) => !cls || r.class_group_id === cls)
  const counts = { done: scoped.filter((r) => lessonState(r) === 'done').length, progress: scoped.filter((r) => lessonState(r) === 'in_progress').length, none: scoped.filter((r) => lessonState(r) === 'not_started').length }
  // "Needs a nudge": not started, or still unfinished after the due date.
  const needsNudge = (r: Row) => lessonState(r) !== 'done' && (lessonState(r) === 'not_started' || (!!r.due_date && r.due_date < today))
  const visible = scoped.filter((r) => filter === 'all' || (filter === 'done' ? lessonState(r) === 'done' : needsNudge(r)))
    .sort((a, b) => Number(lessonState(a) === 'done') - Number(lessonState(b) === 'done') || a.steps_done - b.steps_done || a.student_name.localeCompare(b.student_name))

  if (loading) return <div>Loading…</div>
  if (error) return <p className="banner banner-danger" role="alert">{error}</p>
  if (rows.length === 0) {
    return <EmptyState icon="📊" title="No results yet" description={lesson.status === 'published' ? 'Give the lesson to a class on the Assign tab, and results appear here as students work through it.' : 'Publish the lesson and give it to a class first.'} />
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        {classes.length > 1 && (
          <select value={cls} onChange={(e) => setCls(e.target.value)} aria-label="Class"><option value="">All classes</option>{classes.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select>
        )}
        <div role="group" aria-label="Show" style={{ display: 'flex', gap: 4 }}>
          {([['all', 'Everyone'], ['nudge', 'Needs a nudge'], ['done', 'Finished']] as [Filter, string][]).map(([f, l]) => (
            <button key={f} type="button" aria-pressed={filter === f} className={filter === f ? 'btn btn-primary' : 'btn btn-ghost'} style={{ fontSize: 12 }} onClick={() => setFilter(f)}>{l}</button>
          ))}
        </div>
      </div>

      <div className="stat-grid" style={{ marginBottom: 14 }}>
        <div className="stat-card"><div className="stat-card-value">{counts.done}</div><div className="stat-card-label">Finished</div></div>
        <div className="stat-card"><div className="stat-card-value">{counts.progress}</div><div className="stat-card-label">In progress</div></div>
        <div className={`stat-card ${counts.none > 0 ? 'stat-card-accent' : ''}`}><div className="stat-card-value">{counts.none}</div><div className="stat-card-label">Not started</div></div>
      </div>

      {visible.length === 0 ? (
        <EmptyState icon="✓" title="Nobody here" description={filter === 'nudge' ? 'Everyone has started, and nobody is overdue.' : 'No students match this view.'} />
      ) : (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--text-secondary)' }}>
                {['Student', 'Class', 'Status', 'Steps', 'Last activity'].map((h) => <th key={h} style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => {
                const state = lessonState(r)
                return (
                  <tr key={`${r.class_group_id}-${r.student_id}`} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600 }}>{r.student_name}{r.student_code ? <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> · {r.student_code}</span> : null}</td>
                    <td style={{ padding: '8px 12px' }}>{r.class_name}</td>
                    <td style={{ padding: '8px 12px' }}><span className={`badge ${STATE_INFO[state].badge}`}>{STATE_INFO[state].label}</span></td>
                    <td style={{ padding: '8px 12px' }}>
                      <span style={{ display: 'inline-block', width: 70, height: 6, borderRadius: 3, background: 'var(--border)', verticalAlign: 'middle', marginRight: 8 }} aria-hidden="true">
                        <span style={{ display: 'block', width: `${(r.steps_done / STEP_KEYS.length) * 100}%`, height: 6, borderRadius: 3, background: 'var(--accent)' }} />
                      </span>{r.steps_done}/{STEP_KEYS.length}
                    </td>
                    <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>{r.last_activity_at ? timeAgo(r.last_activity_at) : '—'}</td>
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
