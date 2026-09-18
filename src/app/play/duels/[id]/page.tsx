'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import QuestionCard, { AnswerFeedback, PlayQuestion } from '../../QuestionCard'

type Result = { myScore: number; opponentScore: number; maxScore: number; outcome: 'win' | 'loss' | 'tie' }
type Duel = {
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
  result: Result | null
}
type DuelQuestion = PlayQuestion & { answered: boolean }

export default function PlayDuelPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [duel, setDuel] = useState<Duel | null>(null)
  const [questions, setQuestions] = useState<DuelQuestion[]>([])
  const [index, setIndex] = useState(0)
  // Only true once the player has seen feedback for their last question and
  // clicked Finish, or when they open a duel they already completed.
  const [finishedView, setFinishedView] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async (initial: boolean) => {
    try {
      const res = await fetch(`/api/play/duels/${id}`)
      if (res.status === 401) { router.push('/play/login'); return }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setDuel(data.duel)
      if (initial) {
        setQuestions(data.questions)
        const firstOpen = data.questions.findIndex((q: DuelQuestion) => !q.answered)
        setIndex(firstOpen === -1 ? data.questions.length : firstOpen)
        setFinishedView(data.duel.myFinished || firstOpen === -1)
      }
    } catch (err: any) {
      if (initial) setError(err?.message || 'Something went wrong loading this duel.')
    } finally {
      if (initial) setLoading(false)
    }
  }, [id, router])

  useEffect(() => { load(true) }, [load])

  // While waiting for the other player to finish, check back every few seconds.
  const waiting = !!duel && duel.status !== 'declined' && duel.myFinished && !duel.result
  useEffect(() => {
    if (!waiting) return
    const t = setInterval(() => load(false), 5000)
    return () => clearInterval(t)
  }, [waiting, load])

  async function submit(questionId: string, value: string): Promise<AnswerFeedback> {
    const res = await fetch(`/api/play/duels/${id}/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId, answer: value }),
    })
    if (res.status === 401) { router.push('/play/login'); throw new Error('Please sign in again.') }
    const data = await res.json()
    if (!res.ok) throw new Error(data.error)
    if (data.completed) load(false)
    return data
  }

  async function respond(accept: boolean) {
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/play/duels/${id}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accept }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      if (accept) { setLoading(true); await load(true) } else router.push('/play/duels')
    } catch (err: any) {
      setError(err?.message || 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <div className="page-container">Loading…</div>

  const back = <Link href="/play/duels" className="btn btn-secondary">Back to duels</Link>

  if (!duel) {
    return (
      <div className="page-container" style={{ maxWidth: 560 }}>
        <p className="banner banner-danger" role="alert">{error || 'Duel not found.'}</p>
        {back}
      </div>
    )
  }

  const heading = `You vs ${duel.opponentName}`
  const sub = `${duel.topic ?? 'Mixed topics'} · ${duel.subject}`

  if (duel.status === 'declined') {
    return (
      <div className="page-container" style={{ maxWidth: 560 }}>
        <p className="portal-page-title" style={{ margin: 0 }}>{heading}</p>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{duel.isCreator ? `${duel.opponentName} declined this challenge.` : 'You declined this challenge.'}</p>
        {back}
      </div>
    )
  }

  if (duel.status === 'pending' && !duel.isCreator) {
    return (
      <div className="page-container" style={{ maxWidth: 560 }}>
        <p className="portal-page-title" style={{ margin: 0 }}>{duel.opponentName} challenged you</p>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '4px 0 16px' }}>{sub} · {duel.questionCount} questions</p>
        {error && <p className="banner banner-danger" role="alert" style={{ marginBottom: 12 }}>{error}</p>}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => respond(true)} disabled={busy} className="btn btn-primary">Accept and play</button>
          <button onClick={() => respond(false)} disabled={busy} className="btn btn-secondary">Decline</button>
        </div>
      </div>
    )
  }

  if (duel.result && finishedView) {
    const r = duel.result
    const color = r.outcome === 'win' ? 'var(--success)' : r.outcome === 'loss' ? 'var(--danger)' : 'var(--text-secondary)'
    return (
      <div className="page-container" style={{ maxWidth: 560 }}>
        <p className="portal-page-title" style={{ margin: 0 }}>{heading}</p>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '4px 0 16px' }}>{sub}</p>
        <div className="card" style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 30, fontWeight: 800, color }}>{r.outcome === 'win' ? 'You won!' : r.outcome === 'loss' ? 'You lost this one' : 'It is a tie'}</div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 40, marginTop: 14 }}>
            <Score name="You" score={r.myScore} max={r.maxScore} />
            <Score name={duel.opponentName} score={r.opponentScore} max={r.maxScore} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {back}
          <Link href="/play/home" className="btn btn-secondary">All games</Link>
        </div>
      </div>
    )
  }

  if (duel.myFinished && finishedView) {
    return (
      <div className="page-container" style={{ maxWidth: 560 }}>
        <p className="portal-page-title" style={{ margin: 0 }}>{heading}</p>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '4px 0 16px' }}>{sub}</p>
        <div className="card" style={{ marginBottom: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>You finished!</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
            {duel.status === 'pending' ? `Waiting for ${duel.opponentName} to accept and play.` : `Waiting for ${duel.opponentName} to finish. This page updates on its own.`}
          </div>
        </div>
        {back}
      </div>
    )
  }

  const total = questions.length
  const q = questions[index]
  if (!q) {
    return (
      <div className="page-container" style={{ maxWidth: 560 }}>
        <p className="banner banner-danger" role="alert">{error || 'No questions available for this duel.'}</p>
        {back}
      </div>
    )
  }

  return (
    <div className="page-container" style={{ maxWidth: 560 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
        <span>{heading}</span>
        <span>Question {index + 1} of {total}</span>
      </div>
      <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden', marginBottom: 20 }}>
        <div style={{ height: '100%', width: `${(index / total) * 100}%`, background: 'var(--accent)', transition: 'width 0.3s ease' }} />
      </div>
      <QuestionCard
        key={q.id}
        question={q}
        submit={(value) => submit(q.id, value)}
        onNext={() => { if (index + 1 >= total) setFinishedView(true); setIndex(index + 1) }}
        nextLabel={index + 1 >= total ? 'Finish duel' : 'Next question'}
      />
    </div>
  )
}

function Score({ name, score, max }: { name: string; score: number; max: number }) {
  return (
    <div>
      <div style={{ fontSize: 28, fontWeight: 800 }}>{score}<span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)' }}> / {max}</span></div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{name}</div>
    </div>
  )
}
