'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { loadTeacherWeek, type TeacherWeekLoad } from '@/lib/weekSummary'

// A teacher's week, class by class. It only shows what the teacher can already see: results of their own students that are fully
// marked, and progress on the lessons they wrote.
export default function TeacherWeekView() {
  const [data, setData] = useState<TeacherWeekLoad | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    loadTeacherWeek().then((d) => { if (!cancelled) { setData(d); setFailed(d === null); setLoading(false) } }).catch(() => { if (!cancelled) { setFailed(true); setLoading(false) } })
    return () => { cancelled = true }
  }, [])

  if (loading) return <div className="page-container">Loading…</div>
  if (failed || !data) return <div className="page-container"><p role="alert" className="banner banner-danger">Could not load your week. Please try again.</p></div>

  const sub = { fontSize: 13, color: 'var(--text-secondary)' } as const
  return (
    <div className="page-container" style={{ maxWidth: 820 }}>
      <h1 className="portal-page-title">This week</h1>
      <p style={{ ...sub, marginTop: 4 }}>How each of your classes did in the last 7 days, who may need support, and what is coming up. Only fully marked results are counted.</p>
      {data.note && <p className="banner banner-warning" style={{ marginTop: 16 }}>{data.note}</p>}

      {data.classes.map((c) => (
        <section key={c.id} className="card" style={{ marginTop: 18 }} aria-label={`Class ${c.name}`}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'baseline' }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>Class {c.name}</h2>
            <span style={sub}>{c.students} student{c.students === 1 ? '' : 's'}</span>
          </div>

          <p style={{ margin: '12px 0 0', fontSize: 14 }}>
            {c.exams.sat === 0
              ? 'No fully marked results came in this week.'
              : <>{c.exams.sat} marked result{c.exams.sat === 1 ? '' : 's'}, class average <strong>{c.exams.avgThis}%</strong>{c.exams.change === null ? '' : c.exams.change === 0 ? ', the same as last week' : `, ${c.exams.change > 0 ? 'up' : 'down'} ${Math.abs(c.exams.change)} point${Math.abs(c.exams.change) === 1 ? '' : 's'} on last week`}.</>}
          </p>

          {c.support.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>May need support ({c.support.length})</div>
              <ul style={{ margin: '6px 0 0', paddingLeft: 20, fontSize: 14 }}>
                {c.support.map((s) => <li key={s.id}><strong>{s.name}</strong>: {s.reasons.join('. ')}</li>)}
              </ul>
            </div>
          )}

          {c.lessons.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Lessons not finished by everyone</div>
              {c.lessons.map((l) => (
                <div key={l.lessonId} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0', fontSize: 14, alignItems: 'center' }}>
                  <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}><Link href={`/learning/lessons/${l.lessonId}`}>{l.title}</Link> <span style={sub}>{l.done} of {l.total} finished</span></span>
                  <span className={`badge ${l.overdue ? 'badge-danger' : 'badge-default'}`} style={{ whiteSpace: 'nowrap' }}>{l.detail}</span>
                </div>
              ))}
            </div>
          )}

          {c.upcoming.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Closing soon</div>
              {c.upcoming.map((u, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0', fontSize: 14 }}>
                  <Link href={u.href}>{u.title}</Link>
                  <span style={sub}>{u.subject ? `${u.subject} · ` : ''}{u.detail}</span>
                </div>
              ))}
            </div>
          )}

          {c.support.length === 0 && c.lessons.length === 0 && c.upcoming.length === 0 && c.exams.sat > 0 && <p style={{ ...sub, margin: '12px 0 0' }}>Nothing needs your attention in this class.</p>}
        </section>
      ))}
    </div>
  )
}
