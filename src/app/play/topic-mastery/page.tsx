'use client'

import { useEffect, useState } from 'react'
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

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const res = await fetch('/api/play/topics')
      if (res.status === 401) { router.push('/play/login'); return }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setTopics(data.topics)
      const subjects = Array.from(new Set<string>(data.topics.map((t: TopicRow) => t.subject))).sort()
      if (subjects.length > 0) setSubject(subjects.includes('Mathematics') ? 'Mathematics' : subjects[0])
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
      if (res.status === 401) { router.push('/play/login'); return }
      if (!res.ok) throw new Error(data.error)
      router.push(`/play/topic-mastery/${data.sessionId}`)
    } catch (err: any) {
      setError(err?.message || 'Something went wrong starting practice. Please try again.')
      setStarting(null)
    }
  }

  if (loading) return <div className="page-container">Loading…</div>

  const subjects = Array.from(new Set(topics.map((t) => t.subject))).sort()
  const visible = topics.filter((t) => t.subject === subject)

  return (
    <div className="page-container" style={{ maxWidth: 680 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <p className="portal-page-title" style={{ margin: 0 }}>Topic Mastery</p>
        <Link href="/play/home" className="btn btn-secondary" style={{ fontSize: 13, padding: '6px 14px' }}>Back to games</Link>
      </div>
      <p style={{ margin: '4px 0 20px', fontSize: 14, color: 'var(--text-secondary)' }}>
        Practice one topic at a time. Each round is up to 10 questions with instant feedback.
      </p>

      {error && <p className="banner banner-danger" role="alert" style={{ marginBottom: 16 }}>{error}</p>}

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
            <div key={t.topic} className="card">
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
