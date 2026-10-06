'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { isExamInsightAvailable, loadExamInsightList, type InsightListItem } from '@/lib/examInsight'

const KIND_LABEL: Record<string, string> = {
  pop_quiz: 'Pop quiz', class_test: 'Class test', weekly_test: 'Weekly test', midterm: 'Midterm', end_of_year: 'End of year', monthly: 'Monthly', end_of_term: 'End of term',
  assignment: 'Assignment', homework: 'Homework', group_project: 'Group project', final_exam_submission: 'School exam',
}
const PAGE = 25

type State = { phase: 'loading' } | { phase: 'ready'; items: InsightListItem[] } | { phase: 'error'; message: string }

// The loader: asks the database which exams this person may open Insight for. What they get is decided there.

// A list of the tests and exams a person may open Insight for. basePath is the portal's own Insight address, so the link keeps
// the person inside their own portal and sidebar.
export default function InsightExamList({ basePath }: { basePath: string }) {
  const [state, setState] = useState<State>({ phase: 'loading' })

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!(await isExamInsightAvailable())) { if (!cancelled) setState({ phase: 'error', message: 'Insight is not switched on for your school yet.' }); return }
      const res = await loadExamInsightList()
      if (cancelled) return
      setState(res.ok ? { phase: 'ready', items: res.items } : { phase: 'error', message: res.reason === 'not_allowed' ? 'You do not have access to Insight.' : 'Something went wrong loading your exams. Please try again.' })
    }
    load()
    return () => { cancelled = true }
  }, [])

  if (state.phase === 'loading') return <div role="status" style={{ color: 'var(--text-secondary)' }}>Loading…</div>
  if (state.phase === 'error') return <div className="card" role="alert">{state.message}</div>
  return <InsightListView items={state.items} basePath={basePath} />
}

// The list itself: search, a page of 25 at a time, and a link into the person's own portal.
export function InsightListView({ items, basePath }: { items: InsightListItem[]; basePath: string }) {
  const [q, setQ] = useState('')
  const [limit, setLimit] = useState(PAGE)
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return needle ? items.filter((i) => `${i.title} ${i.subject} ${i.classes}`.toLowerCase().includes(needle)) : items
  }, [items, q])

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', maxWidth: 560 }}>
          Pick a test or exam to see which questions the class missed, the common wrong answers, and which students may need support. Only finished papers you are allowed to see are counted.
        </p>
        <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12, color: 'var(--text-secondary)', gap: 4 }}>
          Search
          <input type="search" value={q} onChange={(e) => { setQ(e.target.value); setLimit(PAGE) }} placeholder="Title, subject or class" style={{ minWidth: 240 }} />
        </label>
      </div>

      {items.length === 0 && <div className="card" style={{ color: 'var(--text-secondary)' }}>No test or exam has any finished papers you can see yet. They appear here once students submit.</div>}
      {items.length > 0 && filtered.length === 0 && <div className="card" style={{ color: 'var(--text-secondary)' }}>Nothing matches that search.</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.slice(0, limit).map((i) => (
          <Link key={`${i.kind}-${i.id}`} href={`${basePath}/${i.kind}/${i.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="card card-clickable" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{i.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                  {[i.subject, i.classes, i.date ? new Date(i.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : ''].filter(Boolean).join(' · ')}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span className="badge badge-default">{i.kind === 'final' ? 'School exam' : (KIND_LABEL[i.exam_kind ?? ''] ?? 'Test')}</span>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{i.sat} paper{i.sat === 1 ? '' : 's'}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
      {filtered.length > limit && <button type="button" className="btn btn-ghost" style={{ marginTop: 10 }} onClick={() => setLimit((n) => n + PAGE)}>Show more</button>}
    </div>
  )
}
