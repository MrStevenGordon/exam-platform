'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useLiveState } from '../../useLiveState'
import { Leaderboard, OptionBlock } from '../../liveParts'

export default function HostGamePage() {
  const { code } = useParams<{ code: string }>()
  const { state, error, msLeft, refresh } = useLiveState(code)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')

  async function act(action: 'start' | 'skip' | 'next' | 'end') {
    setBusy(true)
    setActionError('')
    try {
      const res = await fetch(`/api/play/live/${code}/host`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      await refresh()
    } catch (err: any) {
      setActionError(err?.message || 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  if (error) {
    return (
      <div className="page-container" style={{ maxWidth: 560 }}>
        <p className="banner banner-danger" role="alert">{error}</p>
        <Link href="/play/host" className="btn btn-secondary">Back to hosting</Link>
      </div>
    )
  }
  if (!state) return <div className="page-container">Loading…</div>

  const g = state.game
  const joinUrl = typeof window !== 'undefined' ? `${window.location.origin}/play/live` : '/play/live'
  const topicLabel = g.topic ?? 'Mixed topics'

  return (
    <div className="page-container" style={{ maxWidth: 900 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
          {topicLabel} · {g.subject} · {g.questionCount} questions · {g.secondsPerQuestion}s each
        </div>
        {g.status !== 'ended' && (
          <button onClick={() => act('end')} disabled={busy} className="btn btn-secondary" style={{ fontSize: 13, padding: '6px 14px' }}>End game</button>
        )}
      </div>

      {actionError && <p className="banner banner-danger" role="alert" style={{ marginBottom: 16 }}>{actionError}</p>}

      {g.status === 'lobby' && (
        <div>
          <div className="card" style={{ textAlign: 'center', padding: '28px 16px', marginBottom: 20 }}>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Join at <strong>{joinUrl}</strong> and enter the code</div>
            <div aria-label={`Join code ${g.code.split('').join(' ')}`} style={{ fontSize: 72, fontWeight: 800, letterSpacing: 10, margin: '8px 0', fontVariantNumeric: 'tabular-nums' }}>{g.code}</div>
            <button onClick={() => act('start')} disabled={busy || state.playerCount < 1} className="btn btn-primary" style={{ fontSize: 16, padding: '10px 28px' }}>
              {state.playerCount < 1 ? 'Waiting for players…' : `Start game with ${state.playerCount} player${state.playerCount !== 1 ? 's' : ''}`}
            </button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {(state.playerNames ?? []).map((n) => (
              <span key={n} className="card" style={{ padding: '6px 12px', fontSize: 14, fontWeight: 600 }}>{n}</span>
            ))}
          </div>
        </div>
      )}

      {(g.status === 'question' || g.status === 'reveal') && state.question && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)' }}>Question {g.currentIndex + 1} of {g.questionCount}</span>
            {g.status === 'question' && msLeft !== null && (
              <span aria-live="off" style={{ fontSize: 40, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: msLeft < 5000 ? 'var(--danger)' : 'var(--text-primary)' }}>
                {Math.ceil(msLeft / 1000)}
              </span>
            )}
          </div>

          <div className="card" style={{ marginBottom: 16, padding: '24px 20px' }}>
            <p style={{ fontSize: 28, fontWeight: 700, margin: 0, lineHeight: 1.3 }}>{state.question.text}</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, marginBottom: 20 }}>
            {state.question.options.map((opt, i) => {
              const count = state.reveal?.counts.find((c) => c.option === opt)?.count
              const isCorrect = state.reveal ? state.reveal.correctAnswer.trim().toLowerCase() === opt.trim().toLowerCase() : false
              return <OptionBlock key={opt} index={i} label={opt} state={state.reveal ? (isCorrect ? 'correct' : 'dim') : 'neutral'} count={count} total={state.playerCount} />
            })}
          </div>

          {g.status === 'question' ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 16, fontWeight: 600 }}>{state.answeredCount ?? 0} of {state.playerCount} answered</span>
              <button onClick={() => act('skip')} disabled={busy} className="btn btn-secondary">Show answer now</button>
            </div>
          ) : (
            <div>
              {state.reveal?.explanation && <p style={{ fontSize: 15, color: 'var(--text-secondary)', marginTop: 0 }}>{state.reveal.explanation}</p>}
              <div style={{ margin: '16px 0' }}>
                <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-secondary)', marginBottom: 8 }}>Leaderboard</div>
                <Leaderboard rows={state.leaderboard} />
              </div>
              <button onClick={() => act('next')} disabled={busy} className="btn btn-primary" style={{ fontSize: 15, padding: '10px 24px' }}>
                {g.currentIndex + 1 >= g.questionCount ? 'Finish game' : 'Next question'}
              </button>
            </div>
          )}
        </div>
      )}

      {g.status === 'ended' && (
        <div>
          <h1 className="portal-page-title" style={{ margin: '0 0 12px' }}>Final leaderboard</h1>
          <Leaderboard rows={state.leaderboard} big />
          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <Link href="/play/host" className="btn btn-primary">Host another game</Link>
            <Link href="/play/home" className="btn btn-secondary">Back to home</Link>
          </div>
        </div>
      )}
    </div>
  )
}
