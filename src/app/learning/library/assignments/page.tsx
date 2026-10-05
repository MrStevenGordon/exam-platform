'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import BookCover from '@/components/library/BookCover'
import { libraryErrorText } from '@/lib/library'
import { dueLabel, loadAssignmentSummaries, type AssignmentSummary } from '@/lib/libraryAssignments'

export default function ReadingAssignmentsPage() {
  const [rows, setRows] = useState<AssignmentSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const data = await loadAssignmentSummaries()
        if (!cancelled) setRows(data)
      } catch (err) {
        if (!cancelled) setError(libraryErrorText(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  return (
    <div className="page-container" style={{ maxWidth: 980 }}>
      <Link href="/learning/library" style={{ fontSize: 12, color: 'var(--text-secondary)', textDecoration: 'none' }}><i className="ti ti-arrow-left" aria-hidden="true" /> Library</Link>
      <h1 className="portal-page-title" style={{ marginTop: 10 }}>Reading assignments</h1>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 20px' }}>Open a book in the Library and choose <b>Assign to a class</b> to add one. Heads of department also see their department&rsquo;s.</p>
      {error && <div className="banner banner-danger" style={{ marginBottom: 16 }}>{error}</div>}
      {loading && <p style={{ color: 'var(--text-secondary)' }}>Loading…</p>}
      {!loading && !error && rows.length === 0 && (
        <div className="card" style={{ padding: 24, maxWidth: 520 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Nothing assigned yet</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>Pick a book and give it to a class.</div>
          <Link href="/learning/library" className="btn btn-primary">Browse the Library</Link>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rows.map((r) => {
          const due = dueLabel(r.due_date)
          const pct = r.students > 0 ? Math.round((r.done / r.students) * 100) : 0
          return (
            <Link key={r.assignment_id} href={`/learning/library/assignments/${r.assignment_id}`} className="card card-clickable" style={{ display: 'flex', gap: 16, alignItems: 'center', padding: 14, textDecoration: 'none', color: 'inherit', flexWrap: 'wrap' }}>
              <BookCover title={r.book_title} author={r.book_author} bg={r.cover_bg} fg={r.cover_fg} width={54} />
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontWeight: 700 }}>{r.book_title}{r.part_label ? <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}> · {r.part_label}</span> : null}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{r.class_name} · {r.teacher_name}</div>
                <div style={{ fontSize: 12, marginTop: 2, color: due.late ? 'var(--danger)' : 'var(--text-muted)' }}>{due.text}</div>
              </div>
              <div style={{ width: 220 }}>
                <div className="lib-prog" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Students who have finished"><span style={{ width: `${pct}%`, background: 'var(--success)' }} /></div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{r.done} done · {r.started} started · {r.students} in class</div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
