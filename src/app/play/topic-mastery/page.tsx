'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type TopicRow = {
  subject: string
  topic: string
  questionCount: number
  attempts: number
  masteryPct: number | null
}

export default function PlayTopicMasteryPage() {
  const router = useRouter()
  const [topics, setTopics] = useState<TopicRow[]>([])
  const [subject, setSubject] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [starting, setStarting] = useState<string | null>(null)
  // A topic asked for by a link (for example from a Smart Learning lesson).
  const [asked, setAsked] = useState<{ topic: string; matched: string | null; fromLearning: boolean } | null>(null)
  const focusRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const res = await fetch('/api/play/topics')
      if (res.status === 401) { router.push(`/play/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`); return }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setTopics(data.topics)
      const subjects = Array.from(new Set<string>(data.topics.map((t: TopicRow) => t.subject))).sort()
      if (subjects.length > 0) setSubject(subjects.includes('Mathematics') ? 'Mathematics' : subjects[0])

      // Matched by name, ignoring capitals and extra spaces. Prefer the subject the link named.
      const params = new URLSearchParams(window.location.search)
      const wantTopic = (params.get('topic') || '').trim().slice(0, 100)
      if (wantTopic) {
        const norm = (v: string) => v.trim().toLowerCase().replace(/\s+/g, ' ')
        const wantSubject = norm(params.get('subject') || '')
        const rows: TopicRow[] = data.topics
        const hit = rows.find((t) => norm(t.topic) === norm(wantTopic) && norm(t.subject) === wantSubject) || rows.find((t) => norm(t.topic) === norm(wantTopic))
        const subjectHit = rows.find((t) => norm(t.subject) === wantSubject)
        if (hit) setSubject(hit.subject)
        else if (subjectHit) setSubject(subjectHit.subject)
        setAsked({ topic: wantTopic, matched: hit ? hit.topic : null, fromLearning: params.get('from') === 'learning' })
      }
    } catch (err: any) {
      setError(err?.message || 'Something went wrong loading topics. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function start(topic: string) {
    setStarting(topic)
    setError('')
    try {
      const res = await fetch('/api/play/practice/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, topic }),
      })
      const data = await res.json()
      if (res.status === 401) { router.push(`/play/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`); return }
      if (!res.ok) throw new Error(data.error)
      router.push(`/play/topic-mastery/${data.sessionId}`)
    } catch (err: any) {
      setError(err?.message || 'Something went wrong starting practice. Please try again.')
      setStarting(null)
    }
  }

  useEffect(() => {
    if (!loading && asked?.matched) focusRef.current?.scrollIntoView({ block: 'center' })
  }, [loading, asked])

  if (loading) return <div className="page-container">Loading…</div>

  const subjects = Array.from(new Set(topics.map((t) => t.subject))).sort()
  // The topic the link asked for goes first so it is the first thing they see.
  const visible = topics.filter((t) => t.subject === subject).sort((a, b) => Number(b.topic === asked?.matched) - Number(a.topic === asked?.matched))

  return (
    <div className="page-container" style={{ maxWidth: 680 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <h1 className="portal-page-title" style={{ margin: 0 }}>Topic Mastery</h1>
        <Link href="/play/home" className="btn btn-secondary" style={{ fontSize: 13, padding: '6px 14px' }}>Back to games</Link>
      </div>
      <p style={{ margin: '4px 0 20px', fontSize: 14, color: 'var(--text-secondary)' }}>
        Practice one topic at a time. Each round is up to 10 questions with instant feedback.
      </p>

      {error && <p className="banner banner-danger" role="alert" style={{ marginBottom: 16 }}>{error}</p>}

      {asked && asked.matched && (
        <p className="banner banner-success" role="status" style={{ marginBottom: 16 }}>
          {asked.fromLearning ? 'From your lesson: ' : 'Ready: '}<strong>{asked.matched}</strong>. Press the button on that topic to start.
        </p>
      )}
      {asked && !asked.matched && !error && (
        <p className="banner banner-warning" role="status" style={{ marginBottom: 16 }}>
          Smart Play does not have questions for “{asked.topic}” yet. You can practise these topics instead.
        </p>
      )}
      {asked?.fromLearning && (
        <p style={{ margin: '0 0 12px', fontSize: 13 }}><Link href="/learning">&larr; Back to Smart Learning</Link></p>
      )}

      {subjects.length === 0 && !error && (
        <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>No practice topics are available yet.</p>
      )}

      {subjects.length > 1 && (
        <select value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Subject" style={{ marginBottom: 20, minWidth: 220 }}>
          {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {visible.map((t) => {
          const pct = t.masteryPct
          const barColor = pct === null ? 'var(--border-strong)' : pct >= 80 ? 'var(--success)' : pct >= 50 ? 'var(--accent)' : 'var(--danger)'
          return (
            <div key={t.topic} className="card" ref={t.topic === asked?.matched ? focusRef : undefined} style={t.topic === asked?.matched ? { borderColor: 'var(--accent)', borderWidth: 2 } : undefined}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{t.topic}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                    {t.questionCount} question{t.questionCount !== 1 ? 's' : ''} available
                    {t.attempts > 0 && ` · ${t.attempts} answered so far`}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: barColor }}>{pct === null ? '—' : `${pct}%`}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{pct === null ? 'Not started' : 'Mastery'}</div>
                </div>
              </div>
              <div style={{ height: 6, background: 'var(--page-bg)', borderRadius: 3, overflow: 'hidden', marginBottom: 12 }}>
                <div style={{ height: '100%', width: `${pct ?? 0}%`, background: barColor, transition: 'width 0.3s ease' }} />
              </div>
              <button onClick={() => start(t.topic)} disabled={starting !== null} className="btn btn-primary" style={{ fontSize: 13, padding: '8px 16px' }}>
                {starting === t.topic ? 'Starting…' : pct === null ? 'Start practicing' : 'Practice again'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
