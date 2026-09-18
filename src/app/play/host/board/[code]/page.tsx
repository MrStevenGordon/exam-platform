'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useBoardState } from '../../../useBoardState'
import { Leaderboard } from '../../../liveParts'

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']

export default function HostBoardPage() {
  const { code } = useParams<{ code: string }>()
  const { state, error, msLeft, refresh } = useBoardState(code)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const [peek, setPeek] = useState(false)

  async function act(action: string, extra: Record<string, unknown> = {}) {
    setBusy(true)
    setActionError('')
    try {
      const res = await fetch(`/api/play/board/${code}/host`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setPeek(false)
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
        <Link href="/play/host/board" className="btn btn-secondary">Back to boards</Link>
      </div>
    )
  }
  if (!state) return <div className="page-container">Loading…</div>

  const g = state.game
  const joinUrl = typeof window !== 'undefined' ? `${window.location.origin}/play/live` : '/play/live'
  const cols = state.categories.length

  return (
    <div className="page-container" style={{ maxWidth: 1000 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
          Jeopardy · {g.subject} · {cols} categories × {g.rows} rows{g.teamMode ? ` · ${state.teams?.length ?? 0} teams` : ''}{g.deductWrong ? ' · points lost for wrong answers' : ''}
        </div>
        {g.status !== 'ended' && <button onClick={() => act('end')} disabled={busy} className="btn btn-secondary" style={{ fontSize: 13, padding: '6px 14px' }}>End game</button>}
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
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-secondary)', marginBottom: 8 }}>Categories</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {state.categories.map((c) => <span key={c} className="card" style={{ padding: '6px 14px', fontWeight: 700 }}>{c}</span>)}
          </div>
          {g.teamMode && state.teams ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 12, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-secondary)' }}>Teams (students are placed as they join)</div>
                <button onClick={() => act('shuffle')} disabled={busy || state.playerCount < 2} className="btn btn-secondary" style={{ fontSize: 13, padding: '6px 14px' }}>Shuffle teams</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 10 }}>
                {state.teams.map((team) => (
                  <div key={team.id} className="card" style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, marginBottom: 8 }}>
                      <span>{team.name}</span>
                      <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{team.memberCount}</span>
                    </div>
                    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {(team.members ?? []).map((m) => (
                        <li key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, fontSize: 14 }}>
                          <span>{m.name}</span>
                          <select
                            aria-label={`Move ${m.name} to another team`}
                            value=""
                            disabled={busy}
                            onChange={(e) => { if (e.target.value) act('move', { playerId: m.id, teamId: e.target.value }) }}
                            style={{ width: 96, flex: '0 0 96px', fontSize: 12, padding: '2px 4px' }}
                          >
                            <option value="">Move…</option>
                            {state.teams!.filter((x) => x.id !== team.id).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                          </select>
                        </li>
                      ))}
                      {team.memberCount === 0 && <li style={{ fontSize: 13, color: 'var(--text-muted)' }}>No players yet</li>}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {(state.playerNames ?? []).map((n) => <span key={n} className="card" style={{ padding: '6px 12px', fontSize: 14, fontWeight: 600 }}>{n}</span>)}
            </div>
          )}
        </div>
      )}

      {g.status === 'board' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
          <div style={{ flex: '3 1 420px', minWidth: 0, display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: 8 }}>
            {state.categories.map((c) => (
              <div key={c} style={{ background: 'var(--accent)', color: '#fff', fontWeight: 800, textAlign: 'center', padding: '14px 4px', borderRadius: 'var(--radius)', fontSize: 'clamp(13px, 1.9vw, 18px)', overflowWrap: 'anywhere', hyphens: 'auto', minHeight: 56, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{c}</div>
            ))}
            {Array.from({ length: g.rows }).flatMap((_, r) =>
              state.categories.map((_, c) => {
                const clue = state.clues.find((x) => x.category === c && x.row === r)
                if (!clue) return <div key={`${c}-${r}`} />
                return (
                  <button
                    key={clue.id}
                    disabled={busy || clue.used}
                    onClick={() => act('open', { clueId: clue.id })}
                    aria-label={clue.used ? `${state.categories[c]} ${clue.value}, already played` : `${state.categories[c]} for ${clue.value}`}
                    style={{
                      minHeight: 72, fontSize: 'clamp(18px, 3vw, 28px)', fontWeight: 800, borderRadius: 'var(--radius)', fontVariantNumeric: 'tabular-nums',
                      border: '2px solid var(--border-strong)', background: clue.used ? 'var(--page-bg)' : 'var(--card-bg)',
                      color: clue.used ? 'var(--border)' : 'var(--accent-dark)', cursor: clue.used ? 'default' : 'pointer',
                    }}
                  >
                    {clue.used ? '' : clue.value}
                  </button>
                )
              })
            )}
          </div>
          <div style={{ flex: '1 1 240px', minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-secondary)', marginBottom: 8 }}>{g.teamMode ? 'Team scores' : 'Scores'}</div>
            <Leaderboard rows={state.scoreboard} />
          </div>
        </div>
      )}

      {(g.status === 'clue' || g.status === 'answering' || g.status === 'reveal') && state.clue && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--accent-dark)' }}>{state.clue.category} for {state.clue.value}</span>
            {g.status === 'clue' && msLeft !== null && (
              <span style={{ fontSize: 40, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: msLeft < 5000 ? 'var(--danger)' : 'var(--text-primary)' }}>{Math.ceil(msLeft / 1000)}</span>
            )}
          </div>

          <div className="card" style={{ padding: '28px 22px', marginBottom: 16 }}>
            <p style={{ fontSize: 30, fontWeight: 700, margin: 0, lineHeight: 1.3 }}>{state.clue.text}</p>
            {state.clue.options && (
              <ul style={{ listStyle: 'none', margin: '16px 0 0', padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
                {state.clue.options.map((o, i) => (
                  <li key={`${i}-${o}`} style={{ fontSize: 20, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
                    <strong style={{ color: 'var(--accent)', marginRight: 8 }}>{LETTERS[i]}</strong>{o}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {g.status === 'clue' && (
            <div>
              <p style={{ fontSize: 16, margin: '0 0 12px', color: 'var(--text-secondary)' }}>
                Waiting for a student to buzz in…{state.lockedOutNames.length > 0 && ` Already tried: ${state.lockedOutNames.join(', ')}.`}
              </p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <button onClick={() => act('reveal')} disabled={busy} className="btn btn-secondary">Give up and show the answer</button>
                <PeekButton peek={peek} setPeek={setPeek} answer={state.hostAnswer} />
              </div>
            </div>
          )}

          {g.status === 'answering' && state.buzzer && (
            <div>
              <div className="card" style={{ textAlign: 'center', padding: '22px 16px', marginBottom: 14, borderColor: 'var(--accent)' }}>
                <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Buzzed in first{state.buzzer.teamName ? ` for ${state.buzzer.teamName}` : ''}</div>
                <div style={{ fontSize: 40, fontWeight: 800 }}>{state.buzzer.teamName ?? state.buzzer.name}</div>
                {state.buzzer.teamName && <div style={{ fontSize: 18, color: 'var(--text-secondary)' }}>{state.buzzer.name} buzzed in</div>}
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <button onClick={() => act('correct')} disabled={busy} className="btn btn-primary" style={{ fontSize: 16, padding: '10px 26px' }}>Correct (+{state.clue.value})</button>
                <button onClick={() => act('wrong')} disabled={busy} className="btn btn-secondary" style={{ fontSize: 16, padding: '10px 26px' }}>Wrong{g.deductWrong ? ` (−${state.clue.value})` : ''}</button>
                <PeekButton peek={peek} setPeek={setPeek} answer={state.hostAnswer} />
              </div>
            </div>
          )}

          {g.status === 'reveal' && state.reveal && (
            <div>
              <div className="card" style={{ padding: '20px 22px', marginBottom: 14, borderColor: 'var(--success)', background: 'var(--success-bg)' }}>
                <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--success)' }}>Answer</div>
                <div style={{ fontSize: 34, fontWeight: 800 }}>{state.reveal.correctAnswer}</div>
                {state.reveal.explanation && <p style={{ margin: '8px 0 0', fontSize: 16, color: 'var(--text-secondary)' }}>{state.reveal.explanation}</p>}
              </div>
              <p style={{ fontSize: 18, fontWeight: 700, margin: '0 0 14px' }}>
                {state.reveal.winnerName ? `${state.reveal.winnerTeamName ? `${state.reveal.winnerTeamName} (${state.reveal.winnerName})` : state.reveal.winnerName} wins ${state.reveal.winnerPoints} points!` : 'Nobody got it this time.'}
              </p>
              <div style={{ marginBottom: 14 }}>
                <Leaderboard rows={state.scoreboard.slice(0, 5)} />
              </div>
              <button onClick={() => act('board')} disabled={busy} className="btn btn-primary" style={{ fontSize: 16, padding: '10px 26px' }}>Back to the board</button>
            </div>
          )}
        </div>
      )}

      {g.status === 'ended' && (
        <div>
          <p className="portal-page-title" style={{ margin: '0 0 12px' }}>{g.teamMode ? 'Final team scores' : 'Final scores'}</p>
          <Leaderboard rows={state.scoreboard} big />
          {state.individuals.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-secondary)', marginBottom: 8 }}>Top players</div>
              <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {state.individuals.map((p, i) => (
                  <li key={`${p.name}-${i}`} className="card" style={{ display: 'flex', gap: 12, padding: '8px 14px' }}>
                    <span style={{ flex: 1, fontWeight: 600 }}>{p.name} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>· {p.teamName}</span></span>
                    <span style={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{p.score.toLocaleString()}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <Link href="/play/host/board" className="btn btn-primary">Host another board</Link>
            <Link href="/play/home" className="btn btn-secondary">Back to home</Link>
          </div>
        </div>
      )}
    </div>
  )
}

// The teacher can check the answer without it being on the projector until they choose.
function PeekButton({ peek, setPeek, answer }: { peek: boolean; setPeek: (v: boolean) => void; answer: string | null }) {
  if (answer === null) return null
  return peek ? (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px', border: '1px dashed var(--border-strong)', borderRadius: 'var(--radius)', fontSize: 14 }}>
      Answer: <strong>{answer}</strong>
      <button onClick={() => setPeek(false)} className="btn btn-secondary" style={{ fontSize: 12, padding: '2px 8px' }}>Hide</button>
    </span>
  ) : (
    <button onClick={() => setPeek(true)} className="btn btn-secondary" style={{ fontSize: 13, padding: '6px 14px' }}>Peek at the answer (only you)</button>
  )
}
