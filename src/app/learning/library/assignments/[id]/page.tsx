'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { jamaicaDate } from '@/lib/attendance'
import BookCover from '@/components/library/BookCover'
import { libraryErrorText } from '@/lib/library'
import {
  dueLabel, loadAssignmentProgress, loadAssignmentSummaries, STATUS_BADGE, STATUS_LABEL,
  type AssignmentSummary, type StudentProgressRow,
} from '@/lib/libraryAssignments'

function ago(iso: string | null): string {
  if (!iso) return '-'
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  return days <= 0 ? 'Today' : days === 1 ? 'Yesterday' : `${days} days ago`
}

export default function AssignmentProgressPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [summary, setSummary] = useState<AssignmentSummary | null>(null)
  const [rows, setRows] = useState<StudentProgressRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [mine, setMine] = useState(false)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [all, progress, { data: { user } }] = await Promise.all([loadAssignmentSummaries(), loadAssignmentProgress(id), supabase.auth.getUser()])
        if (cancelled) return
        const found = all.find((a) => a.assignment_id === id) ?? null
        setSummary(found)
        setRows(progress)
        if (found && user) {
          const { data } = await supabase.from('library_assignments').select('id').eq('id', id).eq('assigned_by', user.id).maybeSingle()
          if (!cancelled) setMine(!!data)
        }
      } catch (err) {
        if (!cancelled) setError(libraryErrorText(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [id, tick])

  async function changeDue(value: string) {
    if (value && value < jamaicaDate()) { setError('That date has already passed.'); return }
    setError(''); setNotice('')
    const { error: e } = await supabase.from('library_assignments').update({ due_date: value || null }).eq('id', id)
    if (e) { setError('Could not change the due date.'); return }
    setNotice('Due date changed.'); setTick((n) => n + 1)
  }

  async function remove() {
    if (!confirm('Take this reading away from the class? Students keep their place in the book.')) return
    const { error: e } = await supabase.from('library_assignments').delete().eq('id', id)
    if (e) { setError('Could not remove it.'); return }
    router.push('/learning/library/assignments')
  }

  if (loading) return <div className="page-container">Loading…</div>
  if (error && !summary) {
    return (
      <div className="page-container" style={{ maxWidth: 560 }}>
        <div className="banner banner-danger" style={{ marginBottom: 16 }}>{error}</div>
        <Link href="/learning/library/assignments" className="btn btn-secondary">Back to reading assignments</Link>
      </div>
    )
  }

  const due = dueLabel(summary?.due_date ?? null)
  const started = rows.filter((r) => r.status !== 'not_started').length
  const done = rows.filter((r) => r.status === 'done').length

  return (
    <div className="page-container" style={{ maxWidth: 980 }}>
      <Link href="/learning/library/assignments" style={{ fontSize: 12, color: 'var(--text-secondary)', textDecoration: 'none' }}><i className="ti ti-arrow-left" aria-hidden="true" /> Reading assignments</Link>
      <div style={{ display: 'flex', gap: 18, alignItems: 'center', margin: '14px 0 20px', flexWrap: 'wrap' }}>
        {summary && <BookCover title={summary.book_title} author={summary.book_author} bg={summary.cover_bg} fg={summary.cover_fg} width={64} />}
        <div style={{ flex: 1, minWidth: 220 }}>
          <h1 className="portal-page-title" style={{ textTransform: 'none' }}>{summary?.book_title}{summary?.part_label ? ` · ${summary.part_label}` : ''}</h1>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{summary?.class_name} · {summary?.teacher_name} · <span style={{ color: due.late ? 'var(--danger)' : undefined }}>{due.text}</span></div>
        </div>
        {mine && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', gap: 6, alignItems: 'center' }}>Due <input type="date" value={summary?.due_date ?? ''} min={jamaicaDate()} onChange={(e) => changeDue(e.target.value)} style={{ padding: '5px 8px' }} /></label>
            <button className="btn btn-danger" onClick={remove}>Remove</button>
          </div>
        )}
      </div>
      {error && <div className="banner banner-danger" style={{ marginBottom: 12 }}>{error}</div>}
      {notice && <div className="banner banner-success" style={{ marginBottom: 12 }}>{notice}</div>}

      <div className="stat-grid" style={{ maxWidth: 640 }}>
        <div className="stat-card"><div className="stat-card-value">{rows.length}</div><div className="stat-card-label">In the class</div></div>
        <div className="stat-card stat-card-accent"><div className="stat-card-value">{started}</div><div className="stat-card-label">Started</div></div>
        <div className="stat-card stat-card-success"><div className="stat-card-value">{done}</div><div className="stat-card-label">Done</div></div>
        <div className="stat-card stat-card-danger"><div className="stat-card-value">{rows.length - started}</div><div className="stat-card-label">Not started</div></div>
      </div>

      <div className="card" style={{ padding: '6px 8px', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr>{['Student', 'Status', 'Progress', 'Last used', 'Last opened'].map((h) => <th key={h} style={{ textAlign: 'left', fontSize: 11, textTransform: 'uppercase', color: 'var(--text-muted)', padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.student_id}>
                <td style={{ padding: 10, borderBottom: '1px solid var(--border)', fontWeight: 600 }}>{r.student_name}</td>
                <td style={{ padding: 10, borderBottom: '1px solid var(--border)' }}><span className={`badge ${STATUS_BADGE[r.status]}`}>{STATUS_LABEL[r.status]}</span></td>
                <td style={{ padding: 10, borderBottom: '1px solid var(--border)', width: 200 }}>
                  <div className="lib-prog" style={{ marginTop: 0 }} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={r.percent} aria-label={`${r.student_name}'s progress`}><span style={{ width: `${r.percent}%` }} /></div>
                </td>
                <td style={{ padding: 10, borderBottom: '1px solid var(--border)' }}>{r.last_format === 'listen' ? 'Listened' : r.last_format === 'read' ? 'Read' : '-'}</td>
                <td style={{ padding: 10, borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>{ago(r.last_opened_at)}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} style={{ padding: 16, color: 'var(--text-secondary)' }}>No students are enrolled in this class yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 12 }}>Only the class teacher, the head of department and school admins can see this. Students see only their own progress.</p>
    </div>
  )
}
