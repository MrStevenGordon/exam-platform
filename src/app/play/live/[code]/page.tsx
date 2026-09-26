'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useLiveState } from '../../useLiveState'
import { Leaderboard, OptionBlock, OptionState } from '../../liveParts'

export default function LivePlayerPage() {
  const { code } = useParams<{ code: string }>()
  const { state, error, msLeft, refresh } = useLiveState(code)
  const [chosen, setChosen] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [answerError, setAnswerError] = useState('')

  // A new question clears the local pick.
  const questionKey = state ? `${state.game.currentIndex}` : ''
  useEffect(() => { setChosen(null); setAnswerError('') }, [questionKey])

  async function answer(value: string) {
    setSubmitting(true)
    setAnswerError('')
    setChosen(value)
    try {
      const res = await fetch(`/api/play/live/${code}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer: value }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error)
      await refresh()
    } catch (err: any) {
      setAnswerError(err?.message || 'Could not send your answer. Please try again.')
      setChosen(null)
      await refresh()
    } finally {
      setSubmitting(false)
    }
  }

  if (error) {
    return (
      <div className="page-container" style={{ maxWidth: 480 }}>
        <p className="banner banner-danger" role="alert">{error}</p>
        <Link href="/play/live" className="btn btn-secondary">Enter a different code</Link>
      </div>
    )
  }
  if (!state || !state.me) return <div className="page-container">Loading…</div>

  const g = state.game
  const me = state.me
  const q = state.question
  const myPick = me.myAnswer ?? chosen
  const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

  return (
    <div className="page-container" style={{ maxWidth: 560 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
        <span>{g.topic ?? 'Mixed topics'} · {g.subject}</span>
        <span>Score {me.score.toLocaleString()}</span>
      </div>

      {g.status === 'lobby' && (
        <div className="card" style={{ textAlign: 'center', padding: '32px 16px' }}>
          <div style={{ fontSize: 20, fontWeight: 800 }}>You're in!</div>
          <p style={{ color: 'var(--text-secondary)', margin: '8px 0 0' }}>Waiting for your teacher to start the game. {state.playerCount} player{state.playerCount !== 1 ? 's' : ''} joined.</p>
        </div>
      )}

      {g.status === 'question' && q && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>Question {g.currentIndex + 1} of {g.questionCount}</span>
            {msLeft !== null && <span style={{ fontSize: 28, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: msLeft < 5000 ? 'var(--danger)' : 'var(--text-primary)' }}>{Math.ceil(msLeft / 1000)}</span>}
          </div>
          <div className="card" style={{ marginBottom: 14 }}>
            <p style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{q.text}</p>
          </div>
          {answerError && <p className="banner banner-danger" role="alert" style={{ marginBottom: 12 }}>{answerError}</p>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {q.options.map((opt, i) => {
              const locked = me.answered || submitting
              const isMine = !!myPick && same(myPick, opt)
              return (
                <OptionBlock
                  key={opt}
                  index={i}
                  label={opt}
                  state={locked ? (isMine ? 'chosen' : 'dim') : 'neutral'}
                  disabled={locked}
                  onClick={() => answer(q.type === 'true_false' ? opt.toLowerCase() : opt)}
                />
              )
            })}
          </div>
          {(me.answered || submitting) && <p style={{ textAlign: 'center', marginTop: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>Answer locked in. Waiting for everyone else…</p>}
        </div>
      )}

      {g.status === 'reveal' && q && state.reveal && (
        <div>
          <div className="card" style={{ textAlign: 'center', marginBottom: 14, padding: '20px 16px' }}>
            {!me.answered ? (
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-secondary)' }}>Time's up. No answer.</div>
            ) : me.correct ? (
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--success)' }}>Correct! +{me.points}</div>
            ) : (
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--danger)' }}>Not quite</div>
            )}
            <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>You are ranked #{me.rank} with {me.score.toLocaleString()} points</div>
          </div>
          <p style={{ fontSize: 16, fontWeight: 600, margin: '0 0 10px' }}>{q.text}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
            {q.options.map((opt, i) => {
              const isCorrect = same(state.reveal!.correctAnswer, opt)
              const isMine = !!myPick && same(myPick, opt)
              const s: OptionState = isCorrect ? 'correct' : isMine ? 'wrongChosen' : 'dim'
              return <OptionBlock key={opt} index={i} label={opt} state={s} />
            })}
          </div>
          {state.reveal.explanation && <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{state.reveal.explanation}</p>}
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Waiting for your teacher to continue…</p>
        </div>
      )}

      {g.status === 'ended' && (
        <div>
          <div className="card" style={{ textAlign: 'center', marginBottom: 16, padding: '24px 16px' }}>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Game over</div>
            <div style={{ fontSize: 34, fontWeight: 800 }}>You finished #{me.rank}</div>
            <div style={{ fontSize: 15, color: 'var(--text-secondary)' }}>{me.score.toLocaleString()} points out of {state.playerCount} player{state.playerCount !== 1 ? 's' : ''}</div>
          </div>
          <Leaderboard rows={state.leaderboard} />
          <div style={{ marginTop: 16 }}>
            <Link href="/play/home" className="btn btn-primary">Back to games</Link>
          </div>
        </div>
      )}
    </div>
  )
}
