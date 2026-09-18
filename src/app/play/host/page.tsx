'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type TopicRow = { subject: string; topic: string; questionCount: number }
type PastGame = { code: string; subject: string; topic: string | null; status: string; question_count: number; created_at: string; players: number }

export default function HostLandingPage() {
  const router = useRouter()
  const [topics, setTopics] = useState<TopicRow[]>([])
  const [games, setGames] = useState<PastGame[]>([])
  const [subject, setSubject] = useState('')
  const [topic, setTopic] = useState('')
  const [questionCount, setQuestionCount] = useState(10)
  const [seconds, setSeconds] = useState(20)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const [t, g] = await Promise.all([fetch('/api/play/host/topics'), fetch('/api/play/live')])
      if (t.status === 401 || g.status === 401) { router.push('/play/login'); return }
      const tj = await t.json()
      const gj = await g.json()
      if (!t.ok) throw new Error(tj.error)
      if (!g.ok) throw new Error(gj.error)
      setTopics(tj.topics)
      setGames(gj.games)
      const subjects = Array.from(new Set<string>(tj.topics.map((x: TopicRow) => x.subject))).sort()
      if (subjects.length > 0) setSubject(subjects.includes('Mathematics') ? 'Mathematics' : subjects[0])
    } catch (err: any) {
      setError(err?.message || 'Something went wrong loading your games.')
    } finally {
      setLoading(false)
    }
  }

  async function create() {
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/play/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, topic: topic || null, questionCount, secondsPerQuestion: seconds }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      router.push(`/play/host/${data.code}`)
    } catch (err: any) {
      setError(err?.message || 'Something went wrong creating the game.')
      setBusy(false)
    }
  }

  if (loading) return <div className="page-container">Loading…</div>

  const subjects = Array.from(new Set(topics.map((t) => t.subject))).sort()
  const subjectTopics = topics.filter((t) => t.subject === subject)
  const open = games.filter((g) => g.status !== 'ended')

  return (
    <div className="page-container" style={{ maxWidth: 680 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <p className="portal-page-title" style={{ margin: 0 }}>Host a live game</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/play/host/board" className="btn btn-secondary" style={{ fontSize: 13, padding: '6px 14px' }}>Jeopardy board</Link>
          <Link href="/play/host/questions" className="btn btn-secondary" style={{ fontSize: 13, padding: '6px 14px' }}>Game questions</Link>
          <Link href="/play/home" className="btn btn-secondary" style={{ fontSize: 13, padding: '6px 14px' }}>Back</Link>
        </div>
      </div>
      <p style={{ margin: '4px 0 20px', fontSize: 14, color: 'var(--text-secondary)' }}>
        Students join with a code on their own devices. Everyone answers the same question against the clock, and faster correct answers score more.
      </p>

      {error && <p className="banner banner-danger" role="alert" style={{ marginBottom: 16 }}>{error}</p>}

      {open.length > 0 && (
        <div className="card" style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>You have a game in progress</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Code {open[0].code} · {open[0].players} player{open[0].players !== 1 ? 's' : ''}</div>
          </div>
          <Link href={`/play/host/${open[0].code}`} className="btn btn-primary" style={{ fontSize: 13, padding: '6px 16px' }}>Resume hosting</Link>
        </div>
      )}

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>New game</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <Field label="Subject">
            <select value={subject} onChange={(e) => { setSubject(e.target.value); setTopic('') }} style={{ minWidth: 150 }}>
              {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Topic">
            <select value={topic} onChange={(e) => setTopic(e.target.value)} style={{ minWidth: 150 }}>
              <option value="">Mixed topics</option>
              {subjectTopics.map((t) => <option key={t.topic} value={t.topic}>{t.topic} ({t.questionCount})</option>)}
            </select>
          </Field>
          <Field label="Questions">
            <select value={questionCount} onChange={(e) => setQuestionCount(Number(e.target.value))}>
              {[5, 10, 15].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </Field>
          <Field label="Seconds each">
            <select value={seconds} onChange={(e) => setSeconds(Number(e.target.value))}>
              {[10, 20, 30, 45].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </Field>
        </div>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
          Live games use tap-to-answer questions (multiple choice and true/false). Starting a new game closes any unfinished one.
        </p>
        <div>
          <button onClick={create} disabled={busy || !subject} className="btn btn-primary" style={{ fontSize: 13, padding: '8px 18px' }}>
            {busy ? 'Creating…' : 'Create game'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--text-secondary)' }}>
      {label}
      {children}
    </label>
  )
}
