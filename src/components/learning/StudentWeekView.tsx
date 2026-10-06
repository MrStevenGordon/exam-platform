'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { loadStudentWeek } from '@/lib/weekSummary'
import type { StudentWeek } from '@/lib/weekSummaryPure'

// A student's own week: what changed in the last 7 days and what is coming up. It only summarises what they can already see.
export default function StudentWeekView() {
  const [week, setWeek] = useState<StudentWeek | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    loadStudentWeek().then((w) => { if (!cancelled) { setWeek(w); setFailed(w === null); setLoading(false) } }).catch(() => { if (!cancelled) { setFailed(true); setLoading(false) } })
    return () => { cancelled = true }
  }, [])

  if (loading) return <div className="page-container">Loading…</div>
  if (failed || !week) return <div className="page-container"><p role="alert" className="banner banner-danger">Could not load your week. Please try again.</p></div>

  const sub = { fontSize: 13, color: 'var(--text-secondary)' } as const
  const h = { marginBottom: 10, fontSize: 16 } as const
  return (
    <div className="page-container" style={{ maxWidth: 760 }}>
      <h1 className="portal-page-title">My week</h1>
      <p style={{ ...sub, marginTop: 4 }}>The last 7 days, and what is coming up in the next 7.</p>

      <div className="card" style={{ marginTop: 18 }}>
        <p style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{week.quiet ? 'A quiet week so far. A little practice goes a long way.' : week.headline}</p>
        {!week.quiet && (
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 12 }}>
            <Stat n={week.results.thisWeek.length} label={week.results.thisWeek.length === 1 ? 'result shared' : 'results shared'} />
            <Stat n={week.lessonsDone.length} label={week.lessonsDone.length === 1 ? 'lesson finished' : 'lessons finished'} />
            <Stat n={week.flashcards.reviewed} label={week.flashcards.reviewed === 1 ? 'flashcard studied' : 'flashcards studied'} />
            <Stat n={week.flashcards.daysStudied} label={week.flashcards.daysStudied === 1 ? 'day studying cards' : 'days studying cards'} />
          </div>
        )}
      </div>

      {week.nextSteps.length > 0 && (
        <section className="card" style={{ marginTop: 16 }} aria-label="What to do next">
          <h2 style={h}>What to do next</h2>
          <ol style={{ margin: 0, paddingLeft: 20 }}>
            {week.nextSteps.map((s, i) => <li key={i} style={{ fontSize: 14, marginBottom: 6 }}>{s}</li>)}
          </ol>
        </section>
      )}

      <section className="card" style={{ marginTop: 16 }} aria-label="Coming up">
        <h2 style={h}>Coming up</h2>
        {week.reminders.length === 0 ? <p style={{ ...sub, margin: 0 }}>Nothing is due in the next 7 days.</p> : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {week.reminders.map((r, i) => (
              <Link key={i} href={r.href} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', padding: '10px 0', borderTop: i ? '1px solid var(--border)' : 'none', textDecoration: 'none', color: 'inherit' }}>
                <span style={{ fontSize: 14, fontWeight: 600, minWidth: 0, overflowWrap: 'anywhere' }}>{r.title}<span style={{ ...sub, fontWeight: 400 }}> · {r.kind === 'lesson' ? 'Lesson' : r.kind === 'test' ? 'Test' : r.kind === 'task' ? 'Task' : 'Exam'}</span></span>
                <span className={`badge ${r.urgent ? 'badge-danger' : 'badge-default'}`} style={{ whiteSpace: 'nowrap' }}>{r.detail}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {week.results.thisWeek.length > 0 && (
        <section className="card" style={{ marginTop: 16 }} aria-label="Results this week">
          <h2 style={h}>Results shared this week</h2>
          {week.results.thisWeek.map((r, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderTop: i ? '1px solid var(--border)' : 'none', fontSize: 14 }}>
              <span style={{ overflowWrap: 'anywhere' }}>{r.title}{r.subject ? <span style={sub}> · {r.subject}</span> : null}</span>
              <span className={`badge ${r.pct >= 50 ? 'badge-success' : 'badge-danger'}`}>{r.pct}%</span>
            </div>
          ))}
        </section>
      )}

      {(week.improvedTopics.length > 0 || week.workOnTopics.length > 0) && (
        <section className="card" style={{ marginTop: 16 }} aria-label="Topics">
          <h2 style={h}>Topics</h2>
          {week.improvedTopics.length > 0 && <p style={{ margin: '0 0 8px', fontSize: 14 }}><strong>Getting better:</strong> {week.improvedTopics.map((t) => `${t.name} (${t.pct}%)`).join(', ')}</p>}
          {week.workOnTopics.length > 0 && <p style={{ margin: 0, fontSize: 14 }}><strong>Needs work:</strong> {week.workOnTopics.map((t) => `${t.name} (${t.pct}%)`).join(', ')}</p>}
          <p style={{ margin: '10px 0 0', fontSize: 13 }}><Link href="/student/topics">See all my topics and practise</Link></p>
        </section>
      )}

      <section className="card" style={{ marginTop: 16, marginBottom: 24 }} aria-label="Learning and flashcards">
        <h2 style={h}>Lessons and flashcards</h2>
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14 }}>
          <li>Lessons finished this week: <strong>{week.lessonsDone.length}</strong>{week.lessonsDone.length > 0 ? ` (${week.lessonsDone.slice(0, 3).map((l) => l.title).join(', ')}${week.lessonsDone.length > 3 ? ', and more' : ''})` : ''}</li>
          <li>Lesson checks tried: <strong>{week.checks.count}</strong>{week.checks.avgPct !== null ? `, first tries averaging ${week.checks.avgPct}%` : ''}</li>
          <li>Flashcards studied: <strong>{week.flashcards.reviewed}</strong> on <strong>{week.flashcards.daysStudied}</strong> day{week.flashcards.daysStudied === 1 ? '' : 's'}; {week.flashcards.dueNow} due now. <Link href="/learning/flashcards">Open my flashcards</Link></li>
        </ul>
      </section>
    </div>
  )
}

function Stat({ n, label }: { n: number; label: string }) {
  return <div><strong style={{ fontSize: 22 }}>{n}</strong><div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</div></div>
}
