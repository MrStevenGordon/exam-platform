'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type TopicRow = { subject: string; topic: string; questionCount: number }
type PastGame = { code: string; status: string; players: number }

const label: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--text-secondary)' }

export default function TugSetupPage() {
  const router = useRouter()
  const [topics, setTopics] = useState<TopicRow[]>([])
  const [games, setGames] = useState<PastGame[]>([])
  const [subject, setSubject] = useState('')
  const [topic, setTopic] = useState('')
  const [duration, setDuration] = useState(180)
  const [margin, setMargin] = useState(5)
  const [names, setNames] = useState(['Red Rockets', 'Blue Jays'])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const [t, g] = await Promise.all([fetch('/api/play/host/topics'), fetch('/api/play/tug')])
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
        setError(err?.message || 'Something went wrong loading the setup.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [router])

  const subjects = useMemo(() => Array.from(new Set(topics.map((t) => t.subject))).sort(), [topics])
  const subjectTopics = topics.filter((t) => t.subject === subject)
  const poolSize = topic ? subjectTopics.find((t) => t.topic === topic)?.questionCount ?? 0 : subjectTopics.reduce((n, t) => n + t.questionCount, 0)

  async function create() {
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/play/tug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, topic: topic || null, durationSeconds: duration, winMargin: margin, teamNames: names }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      router.push(`/play/host/tug/${data.code}`)
    } catch (err: any) {
      setError(err?.message || 'Something went wrong creating the game.')
      setBusy(false)
    }
  }

  if (loading) return <div className="page-container">Loading…</div>
  const open = games.filter((g) => g.status !== 'ended')

  return (
    <div className="page-container" style={{ maxWidth: 680 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <p className="portal-page-title" style={{ margin: 0 }}>Tug of War</p>
        <Link href="/play/host" className="btn btn-secondary" style={{ fontSize: 13, padding: '6px 14px' }}>Back</Link>
      </div>
      <p style={{ margin: '4px 0 20px', fontSize: 14, color: 'var(--text-secondary)' }}>
        Two teams race through quick questions. Every correct answer pulls the rope toward that team, and each student appears on the field pulling for their side.
      </p>

      {error && <p className="banner banner-danger" role="alert" style={{ marginBottom: 16 }}>{error}</p>}

      {open.length > 0 && (
        <div className="card" style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>You have a tug of war in progress</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Code {open[0].code} · {open[0].players} player{open[0].players !== 1 ? 's' : ''}</div>
          </div>
          <Link href={`/play/host/tug/${open[0].code}`} className="btn btn-primary" style={{ fontSize: 13, padding: '6px 16px' }}>Resume hosting</Link>
        </div>
      )}

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <label style={label}>
            Subject
            <select value={subject} onChange={(e) => { setSubject(e.target.value); setTopic('') }} style={{ minWidth: 150 }}>
              {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label style={label}>
            Topic
            <select value={topic} onChange={(e) => setTopic(e.target.value)} style={{ minWidth: 170 }}>
              <option value="">Mixed topics ({subjectTopics.reduce((n, t) => n + t.questionCount, 0)})</option>
              {subjectTopics.map((t) => <option key={t.topic} value={t.topic}>{t.topic} ({t.questionCount})</option>)}
            </select>
          </label>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <label style={label}>
            Time limit
            <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
              {[[60, '1 minute'], [120, '2 minutes'], [180, '3 minutes'], [300, '5 minutes']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <label style={label}>
            A team wins outright with a lead of
            <select value={margin} onChange={(e) => setMargin(Number(e.target.value))}>
              {[[3, '3 correct answers per player'], [5, '5 correct answers per player'], [8, '8 correct answers per player']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
        </div>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
          Scores are per player, so a side with one extra student is not favoured. If nobody reaches the lead, the team ahead when time runs out wins. There are {poolSize} tap-to-answer questions in this pool (at least 6 are needed); students see them in their own random order.
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {[0, 1].map((i) => (
            <label key={i} style={{ ...label, flex: '1 1 200px' }}>
              {i === 0 ? 'Left team' : 'Right team'}
              <input value={names[i]} maxLength={20} onChange={(e) => setNames((prev) => prev.map((n, idx) => (idx === i ? e.target.value : n)))} />
            </label>
          ))}
        </div>

        <div>
          <button onClick={create} disabled={busy || !subject} className="btn btn-primary" style={{ fontSize: 13, padding: '8px 18px' }}>
            {busy ? 'Creating…' : 'Create game'}
          </button>
        </div>
      </div>
    </div>
  )
}
