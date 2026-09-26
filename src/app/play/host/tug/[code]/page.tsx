'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useTugState } from '../../../useTugState'
import TugScene, { TEAM_COLORS } from '../../../TugScene'

function clock(ms: number | null): string {
  const s = Math.ceil((ms ?? 0) / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export default function HostTugPage() {
  const { code } = useParams<{ code: string }>()
  const { state, error, msLeft, refresh } = useTugState(code)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')

  async function act(action: string, extra: Record<string, unknown> = {}) {
    setBusy(true)
    setActionError('')
    try {
      const res = await fetch(`/api/play/tug/${code}/host`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...extra }) })
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
        <Link href="/play/host/tug" className="btn btn-secondary">Back to Tug of War</Link>
      </div>
    )
  }
  if (!state) return <div className="page-container">Loading…</div>

  const g = state.game
  const [left, right] = state.teams
  const joinUrl = typeof window !== 'undefined' ? `${window.location.origin}/play/live` : '/play/live'
  const ahead = state.lead === 0 ? null : state.lead < 0 ? left : right
  const winner = g.winnerPosition === null ? null : state.teams[g.winnerPosition]

  return (
    <div className="page-container" style={{ maxWidth: 1040 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
          Tug of War · {g.topic ?? 'Mixed topics'} · {g.subject} · first to a lead of {g.winMargin} per player wins
        </div>
        {g.status !== 'ended' && <button onClick={() => act('end')} disabled={busy} className="btn btn-secondary" style={{ fontSize: 13, padding: '6px 14px' }}>{g.status === 'running' ? 'End game now' : 'Cancel game'}</button>}
      </div>

      {actionError && <p className="banner banner-danger" role="alert" style={{ marginBottom: 12 }}>{actionError}</p>}

      {g.status === 'lobby' && (
        <div className="card" style={{ textAlign: 'center', padding: '22px 16px', marginBottom: 16 }}>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Join at <strong>{joinUrl}</strong> and enter the code</div>
          <div aria-label={`Join code ${g.code.split('').join(' ')}`} style={{ fontSize: 64, fontWeight: 800, letterSpacing: 10, margin: '6px 0', fontVariantNumeric: 'tabular-nums' }}>{g.code}</div>
          <button onClick={() => act('start')} disabled={busy || left.size < 1 || right.size < 1} className="btn btn-primary" style={{ fontSize: 16, padding: '10px 28px' }}>
            {left.size < 1 || right.size < 1 ? 'Waiting for players on both sides…' : `Start: ${left.size} vs ${right.size}`}
          </button>
        </div>
      )}

      {g.status === 'running' && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 10, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 44, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: (msLeft ?? 0) < 15000 ? 'var(--danger)' : 'var(--text-primary)' }} aria-label="Time left">{clock(msLeft)}</div>
          <div style={{ fontSize: 18, fontWeight: 700, textAlign: 'right' }}>
            {ahead ? <span style={{ color: TEAM_COLORS[ahead.position] }}>{ahead.name}</span> : <span>Level</span>}
            {ahead && <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}> lead by {Math.abs(state.lead).toFixed(1)} per player</span>}
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}>{g.winMargin} wins outright</div>
          </div>
        </div>
      )}

      {g.status === 'ended' && (
        <div className="card" style={{ textAlign: 'center', padding: '16px', marginBottom: 12, borderColor: winner ? TEAM_COLORS[winner.position] : 'var(--border)' }}>
          <div style={{ fontSize: 30, fontWeight: 800, color: winner ? TEAM_COLORS[winner.position] : 'var(--text-primary)' }}>
            {winner ? `${winner.name} win!` : "It's a tie!"}
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
            {g.endReason === 'margin' ? `They built a lead of ${g.winMargin} correct answers per player.` : g.endReason === 'time' ? 'Time ran out.' : 'The teacher ended the game.'}
          </div>
        </div>
      )}

      <TugScene teams={state.teams} rope={state.rope} status={g.status} winnerPosition={g.winnerPosition} />

      {g.status === 'lobby' && (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 12, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-secondary)' }}>Teams (students are placed as they join)</div>
            <button onClick={() => act('shuffle')} disabled={busy || left.size + right.size < 2} className="btn btn-secondary" style={{ fontSize: 13, padding: '6px 14px' }}>Shuffle teams</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
            {state.teams.map((team) => (
              <div key={team.position} className="card" style={{ padding: '12px 14px', borderTop: `4px solid ${TEAM_COLORS[team.position]}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, marginBottom: 8 }}>
                  <span>{team.name}</span><span style={{ color: 'var(--text-secondary)' }}>{team.size}</span>
                </div>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {team.members.map((m) => (
                    <li key={m.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, fontSize: 14 }}>
                      <span>{m.label}</span>
                      <select
                        aria-label={`Move ${m.label} to the other team`}
                        value=""
                        disabled={busy}
                        onChange={(e) => { if (e.target.value && m.id) act('move', { playerId: m.id, teamId: e.target.value }) }}
                        style={{ width: 110, flex: '0 0 110px', fontSize: 12, padding: '2px 4px' }}
                      >
                        <option value="">Move…</option>
                        {state.teams.filter((x) => x.position !== team.position).map((x) => <option key={x.position} value={x.id ?? ''}>{x.name}</option>)}
                      </select>
                    </li>
                  ))}
                  {team.size === 0 && <li style={{ fontSize: 13, color: 'var(--text-muted)' }}>No players yet</li>}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {g.status !== 'lobby' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10, marginTop: 14 }}>
          {state.teams.map((team) => (
            <div key={team.position} className="card" style={{ padding: '10px 14px', borderTop: `4px solid ${TEAM_COLORS[team.position]}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontWeight: 800 }}>{team.name}</span>
                <span style={{ fontSize: 22, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{team.correct}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{team.size} players · {team.score.toFixed(1)} correct per player · {team.wrong} misses</div>
            </div>
          ))}
        </div>
      )}

      {g.status === 'ended' && (
        <div style={{ marginTop: 16 }}>
          {state.mvps.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-secondary)', marginBottom: 8 }}>Top pullers</div>
              <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {state.mvps.map((p, i) => (
                  <li key={`${p.label}-${i}`} className="card" style={{ display: 'flex', gap: 12, padding: '8px 14px' }}>
                    <span style={{ width: 24, fontWeight: 800, color: 'var(--text-secondary)' }}>{i + 1}</span>
                    <span style={{ flex: 1, fontWeight: 600 }}>{p.label} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>· {p.teamName}</span></span>
                    <span style={{ fontWeight: 800 }}>{p.correct} correct</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <Link href="/play/host/tug" className="btn btn-primary">Host another game</Link>
            <Link href="/play/home" className="btn btn-secondary">Back to home</Link>
          </div>
        </div>
      )}
    </div>
  )
}
