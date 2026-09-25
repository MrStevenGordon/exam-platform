'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { timeAgo } from '@/lib/presence'
import { compareClassNames } from '@/lib/classNames'
import { isChecksAvailable, percent, type CheckResultRow, type ItemStat } from '@/lib/learningChecks'

// How the class did on the check: each student's first try, and which questions were hardest.
// Renders nothing until check questions exist (and migration 060 is applied).
export default function LessonCheckResults({ lessonId }: { lessonId: string }) {
  const [state, setState] = useState<'loading' | 'hidden' | 'ready' | 'error'>('loading')
  const [rows, setRows] = useState<CheckResultRow[]>([])
  const [items, setItems] = useState<ItemStat[]>([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!(await isChecksAvailable())) { if (!cancelled) setState('hidden'); return }
      const [res, stats] = await Promise.all([
        supabase.rpc('learning_check_results', { p_lesson_id: lessonId }),
        supabase.rpc('learning_check_item_stats', { p_lesson_id: lessonId }),
      ])
      if (cancelled) return
      if (res.error || stats.error) { setState('error'); return }
      const itemRows = (stats.data as ItemStat[]) || []
      if (itemRows.length === 0) { setState('hidden'); return }
      setRows((res.data as CheckResultRow[]) || [])
      setItems(itemRows)
      setState('ready')
    }
    load()
    return () => { cancelled = true }
  }, [lessonId])

  const tried = useMemo(() => rows.filter((r) => r.attempts > 0), [rows])
  const average = useMemo(() => {
    const scored = tried.filter((r) => r.first_score !== null && r.first_max)
    if (scored.length === 0) return null
    return Math.round(scored.reduce((sum, r) => sum + percent(r.first_score ?? 0, r.first_max ?? 1), 0) / scored.length)
  }, [tried])

  // Lowest first-try scores first, so the students who need help are at the top; those who
  // have not tried follow, then by class and name.
  const sorted = useMemo(() => [...rows].sort((a, b) => {
    const ta = a.attempts > 0, tb = b.attempts > 0
    if (ta !== tb) return ta ? -1 : 1
    if (ta && tb) {
      const d = percent(a.first_score ?? 0, a.first_max ?? 1) - percent(b.first_score ?? 0, b.first_max ?? 1)
      if (d) return d
    }
    return compareClassNames(a.class_name, b.class_name) || a.student_name.localeCompare(b.student_name)
  }), [rows])

  const hardest = useMemo(() => items.filter((i) => i.answered > 0).sort((a, b) => percent(a.correct, a.answered) - percent(b.correct, b.answered)), [items])

  if (state === 'loading' || state === 'hidden') return null
  if (state === 'error') return <p className="banner banner-danger" role="alert" style={{ marginTop: 16 }}>Could not load the check results. Please try again.</p>

  return (
    <div style={{ marginTop: 28 }}>
      <p style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700 }}>Check results</p>
      <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text-secondary)' }}>Scores are each student’s first try. Later tries are practice and are not counted here.</p>

      <div className="stat-grid" style={{ marginBottom: 14 }}>
        <div className="stat-card"><div className="stat-card-value">{tried.length} of {rows.length}</div><div className="stat-card-label">Have tried it</div></div>
        <div className="stat-card"><div className="stat-card-value">{average === null ? '—' : `${average}%`}</div><div className="stat-card-label">Average first try</div></div>
      </div>

      {hardest.length > 0 && (
        <div className="card" style={{ marginBottom: 14 }}>
          <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700 }}>Questions, hardest first</p>
          {hardest.map((i) => {
            const pct = percent(i.correct, i.answered)
            return (
              <div key={i.question_id} style={{ padding: '6px 0', borderTop: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13 }}>
                  <span style={{ overflowWrap: 'anywhere' }}>{i.prompt.length > 110 ? `${i.prompt.slice(0, 110)}…` : i.prompt}</span>
                  <span style={{ whiteSpace: 'nowrap', color: pct < 50 ? 'var(--danger)' : 'var(--text-secondary)', fontWeight: pct < 50 ? 700 : 400 }}>{i.correct} of {i.answered} · {pct}%</span>
                </div>
                <div style={{ height: 5, borderRadius: 3, background: 'var(--border)', marginTop: 4 }} role="img" aria-label={`${pct}% got this right first time`}>
                  <div style={{ width: `${pct}%`, height: 5, borderRadius: 3, background: pct < 50 ? 'var(--danger)' : 'var(--accent)' }} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--text-secondary)' }}>
              {['Student', 'Class', 'First try', 'Best', 'Tries', 'Last'].map((h) => <th key={h} style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const pct = r.first_score !== null && r.first_max ? percent(r.first_score, r.first_max) : null
              return (
                <tr key={`${r.class_group_id}-${r.student_id}`} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 600 }}>{r.student_name}{r.student_code ? <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> · {r.student_code}</span> : null}</td>
                  <td style={{ padding: '8px 12px' }}>{r.class_name}</td>
                  <td style={{ padding: '8px 12px' }}>
                    {pct === null ? <span className="badge badge-default">Not tried</span> : <span className={`badge ${pct >= 70 ? 'badge-success' : pct >= 50 ? 'badge-warning' : 'badge-danger'}`}>{r.first_score}/{r.first_max} · {pct}%</span>}
                  </td>
                  <td style={{ padding: '8px 12px' }}>{r.best_score === null ? '—' : `${r.best_score}/${r.first_max}`}</td>
                  <td style={{ padding: '8px 12px' }}>{r.attempts}</td>
                  <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>{r.last_at ? timeAgo(r.last_at) : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
