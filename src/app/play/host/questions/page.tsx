'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Facet, QuestionType, TYPE_LABELS } from './QuestionForm'

type Status = 'draft' | 'approved' | 'archived'
type Row = {
  id: string
  subject: string
  topic: string
  questionType: QuestionType
  questionText: string
  options: string[] | null
  correctAnswer: string
  points: number
  status: Status
  createdBy: string
  timesAnswered: number
}

const filterStyle: React.CSSProperties = { flex: '1 1 140px', width: 'auto', minWidth: 0 }

const STATUS_STYLE: Record<Status, { label: string; color: string; bg: string }> = {
  approved: { label: 'Approved', color: 'var(--success)', bg: 'var(--success-bg)' },
  draft: { label: 'Draft', color: 'var(--warning)', bg: 'var(--warning-bg)' },
  archived: { label: 'Archived', color: 'var(--text-muted)', bg: 'var(--page-bg)' },
}

export default function ManageQuestionsPage() {
  const router = useRouter()
  const [rows, setRows] = useState<Row[]>([])
  const [facets, setFacets] = useState<Facet[]>([])
  const [truncated, setTruncated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const [subject, setSubject] = useState('')
  const [topic, setTopic] = useState('')
  const [status, setStatus] = useState('')
  const [type, setType] = useState('')
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  // Only the newest request may update the list, so a slow earlier response
  // (for example the unfiltered one fired before a URL filter applied) cannot
  // overwrite a newer, filtered one.
  const latestRequest = useRef(0)

  useEffect(() => {
    const initial = new URLSearchParams(window.location.search).get('status')
    if (initial && ['draft', 'approved', 'archived'].includes(initial)) setStatus(initial)
  }, [])

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 250)
    return () => clearTimeout(t)
  }, [search])

  const load = useCallback(async () => {
    const requestId = ++latestRequest.current
    try {
      const params = new URLSearchParams()
      if (subject) params.set('subject', subject)
      if (topic) params.set('topic', topic)
      if (status) params.set('status', status)
      if (type) params.set('type', type)
      if (debounced) params.set('q', debounced)
      const res = await fetch(`/api/play/host/questions?${params}`)
      if (res.status === 401) { router.push('/play/login'); return }
      const data = await res.json()
      if (requestId !== latestRequest.current) return
      if (!res.ok) throw new Error(data.error)
      setRows(data.questions)
      setFacets(data.facets)
      setTruncated(data.truncated)
      setError('')
    } catch (err: any) {
      if (requestId === latestRequest.current) setError(err?.message || 'Something went wrong loading questions.')
    } finally {
      if (requestId === latestRequest.current) setLoading(false)
    }
  }, [subject, topic, status, type, debounced, router])

  useEffect(() => { load() }, [load])

  async function setQuestionStatus(id: string, next: Status) {
    setBusyId(id)
    setError('')
    try {
      const res = await fetch(`/api/play/host/questions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error)
      await load()
    } catch (err: any) {
      setError(err?.message || 'Something went wrong. Please try again.')
    } finally {
      setBusyId(null)
    }
  }

  const subjects = Array.from(new Set(facets.map((f) => f.subject))).sort()
  const topicsForSubject = Array.from(new Set(facets.filter((f) => !subject || f.subject === subject).map((f) => f.topic))).sort()

  return (
    <div className="page-container" style={{ maxWidth: 820 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
        <h1 className="portal-page-title" style={{ margin: 0 }}>Game questions</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/play/host" className="btn btn-secondary" style={{ fontSize: 13, padding: '6px 14px' }}>Back</Link>
          <Link href="/play/host/questions/import" className="btn btn-secondary" style={{ fontSize: 13, padding: '6px 14px' }}>Import from spreadsheet</Link>
          <Link href="/play/host/questions/new" className="btn btn-primary" style={{ fontSize: 13, padding: '6px 16px' }}>Add question</Link>
        </div>
      </div>
      <p style={{ margin: '4px 0 16px', fontSize: 14, color: 'var(--text-secondary)' }}>
        These questions power live games, Topic Mastery and Math Duels. Only approved questions ever reach students.
      </p>

      {error && <p className="banner banner-danger" role="alert" style={{ marginBottom: 12 }}>{error}</p>}

      <div className="card" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
        <select aria-label="Subject" style={filterStyle} value={subject} onChange={(e) => { setSubject(e.target.value); setTopic('') }}>
          <option value="">All subjects</option>
          {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select aria-label="Topic" style={filterStyle} value={topic} onChange={(e) => setTopic(e.target.value)}>
          <option value="">All topics</option>
          {topicsForSubject.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select aria-label="Status" style={filterStyle} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="approved">Approved</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>
        <select aria-label="Type" style={filterStyle} value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All types</option>
          {(Object.keys(TYPE_LABELS) as QuestionType[]).map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
        </select>
        <input aria-label="Search questions" placeholder="Search question text" value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: '1 1 100%', width: 'auto' }} />
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : rows.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '28px 16px' }}>
          <div style={{ fontWeight: 700 }}>No questions match</div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '6px 0 0' }}>Try clearing a filter, or add a new question.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {rows.length} question{rows.length !== 1 ? 's' : ''}{truncated ? ' shown (narrow the filters to see others)' : ''}
          </div>
          {rows.map((r) => {
            const st = STATUS_STYLE[r.status]
            const choices = r.questionType === 'multiple_choice' ? r.options ?? [] : []
            return (
              <div key={r.id} className="card" style={{ opacity: r.status === 'archived' ? 0.7 : 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>{r.questionText}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 100, color: st.color, background: st.bg }}>{st.label}</span>
                      <Tag>{r.subject} · {r.topic}</Tag>
                      <Tag>{TYPE_LABELS[r.questionType]}</Tag>
                      <Tag>{r.points} pt{r.points !== 1 ? 's' : ''}</Tag>
                      {(r.questionType === 'multiple_choice' || r.questionType === 'true_false') && <Tag>Live-ready</Tag>}
                    </div>
                    {choices.length > 0 ? (
                      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--text-secondary)' }}>
                        {choices.map((c, i) => (
                          <li key={`${i}-${c}`} style={c === r.correctAnswer ? { color: 'var(--success)', fontWeight: 700 } : undefined}>{c}{c === r.correctAnswer ? ' (correct)' : ''}</li>
                        ))}
                      </ul>
                    ) : (
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Answer: <strong>{r.correctAnswer}</strong></div>
                    )}
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                      {r.createdBy} · answered {r.timesAnswered} time{r.timesAnswered !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                    <Link href={`/play/host/questions/${r.id}`} className="btn btn-secondary" style={{ fontSize: 12, padding: '4px 12px', textAlign: 'center' }}>Edit</Link>
                    {r.status === 'draft' && <button disabled={busyId === r.id} onClick={() => setQuestionStatus(r.id, 'approved')} className="btn btn-primary" style={{ fontSize: 12, padding: '4px 12px' }}>Approve</button>}
                    {r.status === 'archived' ? (
                      <button disabled={busyId === r.id} onClick={() => setQuestionStatus(r.id, 'approved')} className="btn btn-secondary" style={{ fontSize: 12, padding: '4px 12px' }}>Restore</button>
                    ) : (
                      <button disabled={busyId === r.id} onClick={() => setQuestionStatus(r.id, 'archived')} className="btn btn-secondary" style={{ fontSize: 12, padding: '4px 12px' }}>Archive</button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 100, background: 'var(--page-bg)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>{children}</span>
}
