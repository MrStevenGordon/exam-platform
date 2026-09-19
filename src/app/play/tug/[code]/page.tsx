'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useTugState } from '../../useTugState'
import TugScene, { TEAM_COLORS } from '../../TugScene'
import type { TugQuestion } from '@/lib/playTug'

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']

function clock(ms: number | null): string {
  const s = Math.ceil((ms ?? 0) / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export default function TugPlayerPage() {
  const { code } = useParams<{ code: string }>()
  const { state, error, msLeft, refresh } = useTugState(code)

  // The question in front of this student. The server hands out the next one
  // with every answer, so play never waits on the poll; the poll only fills it
  // in the first time (or after a page reload).
  const [question, setQuestion] = useState<TugQuestion | null>(null)
  const [lockUntil, setLockUntil] = useState(0)
  const [now, setNow] = useState(Date.now())
  const [flash, setFlash] = useState<null | { correct: boolean; correctAnswer: string | null }>(null)
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState('')
  const hydrated = useRef(false)

  useEffect(() => {
    if (hydrated.current || !state?.me) return
    if (state.game.status === 'running' && state.me.question) {
      hydrated.current = true
      setQuestion(state.me.question)
      if (state.me.lockedMs > 0) setLockUntil(Date.now() + state.me.lockedMs)
    }
  }, [state])

  useEffect(() => {
    if (lockUntil <= Date.now()) return
    const t = setInterval(() => { setNow(Date.now()); if (Date.now() >= lockUntil) clearInterval(t) }, 100)
    return () => clearInterval(t)
  }, [lockUntil])

  async function pick(option: string, type: string) {
    if (sending) return
    setSending(true)
    setMessage('')
    try {
      const res = await fetch(`/api/play/tug/${code}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer: type === 'true_false' ? option.toLowerCase() : option }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 409 && data.lockMs) { setLockUntil(Date.now() + data.lockMs); setNow(Date.now()); return }
      if (res.status === 409 || res.status === 404) { await refresh(); return }
      if (!res.ok) throw new Error(data.error)
      setFlash({ correct: data.correct, correctAnswer: data.correctAnswer })
      setTimeout(() => setFlash(null), data.correct ? 450 : 1800)
      setQuestion(data.next)
      if (data.lockMs > 0) { setLockUntil(Date.now() + data.lockMs); setNow(Date.now()) }
      refresh()
    } catch (err: any) {
      setMessage(err?.message || 'Could not send your answer. Try again.')
    } finally {
      setSending(false)
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
  const myColor = TEAM_COLORS[me.teamPosition]
  const locked = lockUntil > now
  const lockLeft = Math.max(0, Math.ceil((lockUntil - now) / 100) / 10)
  const winner = g.winnerPosition === null ? null : state.teams[g.winnerPosition]
  const iWon = winner !== null && winner.position === me.teamPosition
  const [left, right] = state.teams

  return (
    <div className="page-container" style={{ maxWidth: 600, padding: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, fontSize: 13 }}>
        <span style={{ fontWeight: 800, color: myColor }}>{me.teamName}</span>
        {g.status === 'running' && <span style={{ fontSize: 22, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: (msLeft ?? 0) < 15000 ? 'var(--danger)' : 'var(--text-primary)' }} aria-label="Time left">{clock(msLeft)}</span>}
        <span style={{ color: 'var(--text-secondary)' }}>You: {me.correct} correct</span>
      </div>

      <TugScene teams={state.teams} rope={state.rope} status={g.status} winnerPosition={g.winnerPosition} myKey={me.key} compact />

      {g.status === 'lobby' && (
        <div className="card" style={{ textAlign: 'center', padding: '22px 16px', marginTop: 12 }}>
          <div style={{ fontSize: 20, fontWeight: 800 }}>You're on {me.teamName}!</div>
          <p style={{ color: 'var(--text-secondary)', margin: '6px 0 0', fontSize: 14 }}>
            {left.size} vs {right.size}. Your teacher will start the game. Answer questions quickly and correctly to pull the rope your way.
          </p>
        </div>
      )}

      {g.status === 'running' && (
        <div style={{ marginTop: 12, position: 'relative' }}>
          {flash && flash.correct && (
            <div role="status" style={{ textAlign: 'center', fontWeight: 800, fontSize: 18, color: 'var(--success)', marginBottom: 6 }}>Pull!</div>
          )}
          {flash && !flash.correct && (
            <div role="status" className="banner banner-danger" style={{ marginBottom: 8, textAlign: 'center' }}>
              Stumble! The answer was <strong>{flash.correctAnswer === 'true' || flash.correctAnswer === 'false' ? flash.correctAnswer[0].toUpperCase() + flash.correctAnswer.slice(1) : flash.correctAnswer}</strong>
            </div>
          )}

          {question ? (
            <div className="card" style={{ padding: '14px' }}>
              <p style={{ fontSize: 19, fontWeight: 700, margin: '0 0 12px' }}>{question.text}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {question.options.map((opt, i) => (
                  <button
                    key={`${i}-${opt}`}
                    onClick={() => pick(opt, question.type)}
                    disabled={locked || sending}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 'var(--radius)', minHeight: 52,
                      border: `2px solid ${locked ? 'var(--border)' : myColor}`, background: 'var(--card-bg)', color: 'var(--text-primary)',
                      font: 'inherit', fontSize: 17, fontWeight: 600, textAlign: 'left', opacity: locked ? 0.45 : 1, cursor: locked ? 'default' : 'pointer', width: '100%',
                    }}
                  >
                    <span style={{ width: 28, height: 28, borderRadius: 6, background: myColor, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, flexShrink: 0 }}>{LETTERS[i]}</span>
                    {opt}
                  </button>
                ))}
              </div>
              {locked && <p style={{ textAlign: 'center', margin: '10px 0 0', fontWeight: 700, color: 'var(--danger)' }}>Getting back up… {lockLeft.toFixed(1)}s</p>}
              {message && <p className="banner banner-danger" role="alert" style={{ marginTop: 10 }}>{message}</p>}
            </div>
          ) : (
            <div className="card" style={{ textAlign: 'center', padding: '20px' }}>Getting your next question…</div>
          )}
        </div>
      )}

      {g.status === 'ended' && (
        <div style={{ marginTop: 12 }}>
          <div className="card" style={{ textAlign: 'center', padding: '18px 14px', borderColor: winner ? TEAM_COLORS[winner.position] : 'var(--border)' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: winner ? TEAM_COLORS[winner.position] : 'var(--text-primary)' }}>
              {winner === null ? "It's a tie!" : iWon ? 'Your team won!' : `${winner.name} won`}
            </div>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>
              You pulled {me.correct} time{me.correct !== 1 ? 's' : ''}{me.wrong > 0 ? ` and stumbled ${me.wrong}` : ''}.
            </div>
          </div>
          {state.mvps.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-secondary)', marginBottom: 8 }}>Top pullers</div>
              <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {state.mvps.map((p, i) => (
                  <li key={`${p.label}-${i}`} className="card" style={{ display: 'flex', gap: 10, padding: '8px 12px' }}>
                    <span style={{ width: 22, fontWeight: 800, color: 'var(--text-secondary)' }}>{i + 1}</span>
                    <span style={{ flex: 1, fontWeight: 600 }}>{p.label} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>· {p.teamName}</span></span>
                    <span style={{ fontWeight: 800 }}>{p.correct}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
          <div style={{ marginTop: 16 }}><Link href="/play/home" className="btn btn-primary">Back to games</Link></div>
        </div>
      )}
    </div>
  )
}
