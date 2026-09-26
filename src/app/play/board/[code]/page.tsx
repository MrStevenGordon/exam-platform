'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useBoardState } from '../../useBoardState'
import { Leaderboard } from '../../liveParts'

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']

export default function BoardPlayerPage() {
  const { code } = useParams<{ code: string }>()
  const { state, error, msLeft, refresh } = useBoardState(code)
  const [buzzing, setBuzzing] = useState(false)
  const [buzzError, setBuzzError] = useState('')

  async function buzz() {
    setBuzzing(true)
    setBuzzError('')
    try {
      const res = await fetch(`/api/play/board/${code}/buzz`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error)
    } catch (err: any) {
      setBuzzError(err?.message || 'Could not buzz in. Please try again.')
    } finally {
      await refresh()
      setBuzzing(false)
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

  return (
    <div className="page-container" style={{ maxWidth: 560 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
        <span>Jeopardy · {g.subject}{me.team ? ` · ${me.team.name}` : ''}</span>
        <span>{me.team ? 'Team score' : 'Score'} {me.score.toLocaleString()} · #{me.rank}</span>
      </div>

      {g.status === 'lobby' && (
        <div className="card" style={{ textAlign: 'center', padding: '32px 16px' }}>
          <div style={{ fontSize: 20, fontWeight: 800 }}>You're in!</div>
          {me.team && (
            <div style={{ margin: '12px 0 4px', fontSize: 18, fontWeight: 800, color: 'var(--accent-dark)' }}>You are on {me.team.name}</div>
          )}
          {me.team && me.teamMates.length > 0 && <p style={{ margin: '0 0 6px', fontSize: 14 }}>With {me.teamMates.join(', ')}</p>}
          <p style={{ color: 'var(--text-secondary)', margin: '8px 0 0' }}>Waiting for your teacher to start the board. {state.playerCount} player{state.playerCount !== 1 ? 's' : ''} joined. Your team may change until the game starts.</p>
        </div>
      )}

      {g.status === 'board' && (
        <div>
          <div className="card" style={{ textAlign: 'center', padding: '24px 16px', marginBottom: 16 }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>Your teacher is picking a clue</div>
            <p style={{ color: 'var(--text-secondary)', margin: '6px 0 0', fontSize: 14 }}>Get your finger ready on the buzzer.</p>
          </div>
          <Leaderboard rows={state.scoreboard} />
        </div>
      )}

      {(g.status === 'clue' || g.status === 'answering') && state.clue && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--accent-dark)' }}>{state.clue.category} for {state.clue.value}</span>
            {g.status === 'clue' && msLeft !== null && (
              <span style={{ fontSize: 28, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: msLeft < 5000 ? 'var(--danger)' : 'var(--text-primary)' }}>{Math.ceil(msLeft / 1000)}</span>
            )}
          </div>
          <div className="card" style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{state.clue.text}</p>
            {state.clue.options && (
              <ul style={{ listStyle: 'none', margin: '12px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {state.clue.options.map((o, i) => (
                  <li key={`${i}-${o}`} style={{ fontSize: 16 }}><strong style={{ color: 'var(--accent)', marginRight: 8 }}>{LETTERS[i]}</strong>{o}</li>
                ))}
              </ul>
            )}
          </div>

          {buzzError && <p className="banner banner-danger" role="alert" style={{ marginBottom: 12 }}>{buzzError}</p>}

          {g.status === 'clue' && me.canBuzz && (
            <button
              onClick={buzz}
              disabled={buzzing}
              aria-label="Buzz in"
              style={{ width: '100%', minHeight: 140, fontSize: 36, fontWeight: 800, borderRadius: 16, border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer' }}
            >
              BUZZ
            </button>
          )}
          {g.status === 'clue' && me.lockedOut && (
            <div className="card" style={{ textAlign: 'center', padding: '20px 16px', color: 'var(--danger)', fontWeight: 700 }}>{me.team ? 'Not quite. Your team is out for this clue while others try.' : 'Not quite. You are out for this clue while others try.'}</div>
          )}
          {g.status === 'answering' && me.isBuzzer && (
            <div className="card" style={{ textAlign: 'center', padding: '24px 16px', borderColor: 'var(--accent)' }}>
              <div style={{ fontSize: 26, fontWeight: 800 }}>You buzzed first!</div>
              <p style={{ margin: '6px 0 0', color: 'var(--text-secondary)' }}>{me.team ? `Say your answer out loud for ${me.team.name}.` : 'Say your answer out loud.'}</p>
            </div>
          )}
          {g.status === 'answering' && !me.isBuzzer && state.buzzer && (
            <div className="card" style={{ textAlign: 'center', padding: '24px 16px' }}>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{state.buzzer.name}{state.buzzer.teamName ? ` (${state.buzzer.teamName})` : ''} buzzed in first</div>
              <p style={{ margin: '6px 0 0', color: 'var(--text-secondary)' }}>{state.buzzer.isMyTeam ? 'Your teammate is answering. Waiting to see if they are right…' : 'Waiting to see if they are right…'}</p>
            </div>
          )}
          {g.status === 'clue' && !me.canBuzz && !me.lockedOut && (
            <div className="card" style={{ textAlign: 'center', padding: '20px 16px', fontWeight: 700 }}>Buzzed in!</div>
          )}
        </div>
      )}

      {g.status === 'reveal' && state.reveal && (
        <div>
          <div className="card" style={{ padding: '20px 16px', marginBottom: 14, borderColor: 'var(--success)', background: 'var(--success-bg)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--success)' }}>Answer</div>
            <div style={{ fontSize: 26, fontWeight: 800 }}>{state.reveal.correctAnswer}</div>
            {state.reveal.explanation && <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--text-secondary)' }}>{state.reveal.explanation}</p>}
          </div>
          <p style={{ fontSize: 16, fontWeight: 700 }}>{state.reveal.winnerName ? `${state.reveal.winnerTeamName ? `${state.reveal.winnerTeamName} (${state.reveal.winnerName})` : state.reveal.winnerName} won ${state.reveal.winnerPoints} points.` : 'Nobody got it this time.'}</p>
          <Leaderboard rows={state.scoreboard.slice(0, 5)} />
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 10 }}>Waiting for your teacher to go back to the board…</p>
        </div>
      )}

      {g.status === 'ended' && (
        <div>
          <div className="card" style={{ textAlign: 'center', marginBottom: 16, padding: '24px 16px' }}>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Game over</div>
            <div style={{ fontSize: 34, fontWeight: 800 }}>{me.team ? `${me.team.name} finished #${me.rank}` : `You finished #${me.rank}`}</div>
            <div style={{ fontSize: 15, color: 'var(--text-secondary)' }}>{me.score.toLocaleString()} points{me.team ? ' for your team' : ''}</div>
          </div>
          <Leaderboard rows={state.scoreboard} />
          {state.individuals.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-secondary)', marginBottom: 8 }}>Top players</div>
              <Leaderboard rows={state.individuals.map((p) => ({ name: `${p.name} (${p.teamName})`, score: p.score, isMe: p.isMe }))} />
            </div>
          )}
          <div style={{ marginTop: 16 }}><Link href="/play/home" className="btn btn-primary">Back to games</Link></div>
        </div>
      )}
    </div>
  )
}
