'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type DuelSummary = {
  id: string
  subject: string
  topic: string | null
  questionCount: number
  status: 'pending' | 'active' | 'declined'
  isCreator: boolean
  opponentName: string
  myFinished: boolean
  opponentFinished: boolean
  myScore: number | null
  maxScore: number
  result: null | { myScore: number; opponentScore: number; maxScore: number; outcome: 'win' | 'loss' | 'tie' }
}
type TopicRow = { subject: string; topic: string; questionCount: number }
type Player = { id: string; name: string }

export default function PlayDuelsPage() {
  const router = useRouter()
  const [duels, setDuels] = useState<DuelSummary[]>([])
  const [topics, setTopics] = useState<TopicRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const [subject, setSubject] = useState('')
  const [topic, setTopic] = useState('')
  const [questionCount, setQuestionCount] = useState(8)
  const [query, setQuery] = useState('')
  const [players, setPlayers] = useState<Player[]>([])
  const [opponent, setOpponent] = useState<Player | null>(null)

  useEffect(() => { load() }, [])

  useEffect(() => {
    if (opponent) return
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/play/players?q=${encodeURIComponent(query)}`)
        if (res.ok) setPlayers((await res.json()).players)
      } catch { /* search is best-effort */ }
    }, 250)
    return () => clearTimeout(t)
  }, [query, opponent])

  async function load() {
    try {
      const [d, t] = await Promise.all([fetch('/api/play/duels'), fetch('/api/play/topics')])
      if (d.status === 401 || t.status === 401) { router.push('/play/login'); return }
      const dj = await d.json()
      const tj = await t.json()
      if (!d.ok) throw new Error(dj.error)
      if (!t.ok) throw new Error(tj.error)
      setDuels(dj.duels)
      setTopics(tj.topics)
      const subjects = Array.from(new Set<string>(tj.topics.map((x: TopicRow) => x.subject))).sort()
      if (subjects.length > 0) setSubject(subjects.includes('Mathematics') ? 'Mathematics' : subjects[0])
    } catch (err: any) {
      setError(err?.message || 'Something went wrong loading Math Duels. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function refreshDuels() {
    const res = await fetch('/api/play/duels')
    if (res.ok) setDuels((await res.json()).duels)
  }

  async function send() {
    if (!opponent || !subject) return
    setBusy('send')
    setError('')
    try {
      const res = await fetch('/api/play/duels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opponentId: opponent.id, subject, topic: topic || null, questionCount }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      router.push(`/play/duels/${data.duelId}`)
    } catch (err: any) {
      setError(err?.message || 'Something went wrong sending that challenge.')
      setBusy(null)
    }
  }

  async function respond(id: string, accept: boolean) {
    setBusy(id)
    setError('')
    try {
      const res = await fetch(`/api/play/duels/${id}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accept }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      if (accept) router.push(`/play/duels/${id}`)
      else { await refreshDuels(); setBusy(null) }
    } catch (err: any) {
      setError(err?.message || 'Something went wrong. Please try again.')
      await refreshDuels()
      setBusy(null)
    }
  }

  if (loading) return <div className="page-container">Loading…</div>

  const subjects = Array.from(new Set(topics.map((t) => t.subject))).sort()
  const subjectTopics = topics.filter((t) => t.subject === subject)
  const incoming = duels.filter((d) => d.status === 'pending' && !d.isCreator)
  const others = duels.filter((d) => !(d.status === 'pending' && !d.isCreator))

  const label = (d: DuelSummary) => `${d.topic ?? 'Mixed topics'} · ${d.subject} · ${d.questionCount} questions`

  return (
    <div className="page-container" style={{ maxWidth: 680 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <p className="portal-page-title" style={{ margin: 0 }}>Math Duels</p>
        <Link href="/play/home" className="btn btn-secondary" style={{ fontSize: 13, padding: '6px 14px' }}>Back to games</Link>
      </div>
      <p style={{ margin: '4px 0 20px', fontSize: 14, color: 'var(--text-secondary)' }}>
        Challenge a student in your grade. You both answer the same questions and compare scores when you have both finished.
      </p>

      {error && <p className="banner banner-danger" role="alert" style={{ marginBottom: 16 }}>{error}</p>}

      {incoming.length > 0 && (
        <Section title="Challenges waiting for you">
          {incoming.map((d) => (
            <div key={d.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{d.opponentName} challenged you</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label(d)}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button onClick={() => respond(d.id, true)} disabled={busy === d.id} className="btn btn-primary" style={{ fontSize: 13, padding: '6px 14px' }}>Accept</button>
                <button onClick={() => respond(d.id, false)} disabled={busy === d.id} className="btn btn-secondary" style={{ fontSize: 13, padding: '6px 14px' }}>Decline</button>
              </div>
            </div>
          ))}
        </Section>
      )}

      <Section title="Challenge a student">
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            <Field label="Subject">
              <select value={subject} onChange={(e) => { setSubject(e.target.value); setTopic('') }} style={{ minWidth: 150 }}>
                {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Topic">
              <select value={topic} onChange={(e) => setTopic(e.target.value)} style={{ minWidth: 150 }}>
                <option value="">Mixed topics</option>
                {subjectTopics.map((t) => <option key={t.topic} value={t.topic}>{t.topic}</option>)}
              </select>
            </Field>
            <Field label="Questions">
              <select value={questionCount} onChange={(e) => setQuestionCount(Number(e.target.value))} style={{ minWidth: 90 }}>
                {[5, 8, 10].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Opponent" group>
            {opponent ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontWeight: 600 }}>{opponent.name}</span>
                <button onClick={() => { setOpponent(null); setQuery('') }} className="btn btn-secondary" style={{ fontSize: 12, padding: '4px 10px' }}>Change</button>
              </div>
            ) : (
              <div>
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name" aria-label="Search for an opponent" style={{ width: '100%', maxWidth: 320 }} />
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 180, overflowY: 'auto' }}>
                  {players.length === 0 && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No students found in your grade.</span>}
                  {players.map((p) => (
                    <button key={p.id} onClick={() => setOpponent(p)} className="btn btn-secondary" style={{ textAlign: 'left', justifyContent: 'flex-start', fontSize: 13, padding: '6px 12px' }}>{p.name}</button>
                  ))}
                </div>
              </div>
            )}
          </Field>

          <div>
            <button onClick={send} disabled={!opponent || !subject || busy === 'send'} className="btn btn-primary" style={{ fontSize: 13, padding: '8px 18px' }}>
              {busy === 'send' ? 'Sending…' : 'Send challenge and start'}
            </button>
          </div>
        </div>
      </Section>

      {others.length > 0 && (
        <Section title="Your duels">
          {others.map((d) => (
            <div key={d.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>You vs {d.opponentName}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label(d)}</div>
                </div>
                <div style={{ flexShrink: 0 }}>
                  {d.status === 'declined' ? (
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Declined</span>
                  ) : d.result ? (
                    <Link href={`/play/duels/${d.id}`} className="btn btn-secondary" style={{ fontSize: 13, padding: '6px 14px' }}>View result</Link>
                  ) : !d.myFinished ? (
                    <Link href={`/play/duels/${d.id}`} className="btn btn-primary" style={{ fontSize: 13, padding: '6px 14px' }}>{d.status === 'pending' && d.isCreator ? 'Play now' : 'Play'}</Link>
                  ) : (
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{d.status === 'pending' ? 'Waiting for reply' : 'Waiting for opponent'}</span>
                  )}
                </div>
              </div>
              {d.result && (
                <div style={{ marginTop: 8, fontSize: 13, fontWeight: 700, color: d.result.outcome === 'win' ? 'var(--success)' : d.result.outcome === 'loss' ? 'var(--danger)' : 'var(--text-secondary)' }}>
                  {d.result.outcome === 'win' ? 'You won' : d.result.outcome === 'loss' ? 'You lost' : 'Tie'} · {d.result.myScore} to {d.result.opponentScore}
                </div>
              )}
            </div>
          ))}
        </Section>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
    </div>
  )
}

function Field({ label, group, children }: { label: string; group?: boolean; children: React.ReactNode }) {
  const style: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--text-secondary)' }
  // A group holds several controls (search box plus result buttons), which a
  // <label> would wrongly forward clicks to, so it is a plain container.
  return group ? (
    <div role="group" aria-label={label} style={style}>{label}{children}</div>
  ) : (
    <label style={style}>{label}{children}</label>
  )
}
