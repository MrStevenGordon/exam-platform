'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type ClassInfo = { id: string; name: string; gradeLabel: string | null }
type Row = { rank: number | null; name: string; xp: number; streak: number; isMe: boolean }
type Board = { className: string; classSize: number; rankedCount: number; top: Row[]; me: Row | null }

export default function ClassLeaderboardPage() {
  const router = useRouter()
  const [classes, setClasses] = useState<ClassInfo[]>([])
  const [classId, setClassId] = useState('')
  const [period, setPeriod] = useState<'week' | 'all'>('week')
  const [board, setBoard] = useState<Board | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/play/progress')
      .then(async (res) => {
        if (res.status === 401) { router.push('/play/login'); return }
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        setClasses(data.classes)
        if (data.classes[0]) setClassId(data.classes[0].id)
        else setLoading(false)
      })
      .catch((err) => { setError(err?.message || 'Something went wrong.'); setLoading(false) })
  }, [router])

  useEffect(() => {
    if (!classId) return
    let cancelled = false
    setLoading(true)
    fetch(`/api/play/leaderboard?classId=${classId}&period=${period}`)
      .then(async (res) => {
        if (res.status === 401) { router.push('/play/login'); return }
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        if (!cancelled) { setBoard(data); setError('') }
      })
      .catch((err) => { if (!cancelled) setError(err?.message || 'Something went wrong loading the leaderboard.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [classId, period, router])

  const tab = (value: 'week' | 'all', label: string) => (
    <button
      onClick={() => setPeriod(value)}
      aria-pressed={period === value}
      className={period === value ? 'btn btn-primary' : 'btn btn-secondary'}
      style={{ fontSize: 13, padding: '6px 16px' }}
    >
      {label}
    </button>
  )

  const showMeSeparately = board?.me && !board.top.some((r) => r.isMe)

  return (
    <div className="page-container" style={{ maxWidth: 560 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <h1 className="portal-page-title" style={{ margin: 0 }}>Class leaderboard</h1>
        <Link href="/play/home" className="btn btn-secondary" style={{ fontSize: 13, padding: '6px 14px' }}>Back</Link>
      </div>
      <p style={{ margin: '4px 0 16px', fontSize: 14, color: 'var(--text-secondary)' }}>
        Earn XP in Topic Mastery, Math Duels and live games. Play a little every day to build a streak.
      </p>

      {error && <p className="banner banner-danger" role="alert" style={{ marginBottom: 12 }}>{error}</p>}

      {!loading && classes.length === 0 && !error && (
        <p className="card" style={{ fontSize: 14 }}>You are not in a class on Smart Assess Play yet. Ask your teacher.</p>
      )}

      {classes.length > 0 && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
          {classes.length > 1 && (
            <select aria-label="Class" value={classId} onChange={(e) => setClassId(e.target.value)} style={{ width: 'auto', minWidth: 120 }}>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          {tab('week', 'This week')}
          {tab('all', 'All time')}
        </div>
      )}

      {board && (
        <div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
            {board.className} · {board.rankedCount} of {board.classSize} students have earned XP {period === 'week' ? 'this week' : 'so far'}
          </div>
          {board.top.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '24px 16px' }}>
              <div style={{ fontWeight: 700 }}>Nobody has earned XP yet</div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '6px 0 0' }}>Play a game to be the first on the board.</p>
            </div>
          ) : (
            <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {board.top.map((r) => <BoardRow key={`${r.rank}-${r.name}`} row={r} />)}
            </ol>
          )}
          {showMeSeparately && board.me && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 6px' }}>Your place</div>
              <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}><BoardRow row={board.me} /></ol>
              {board.me.rank === null && <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '6px 0 0' }}>Earn some XP to get ranked.</p>}
            </div>
          )}
          <details style={{ marginTop: 20, fontSize: 13, color: 'var(--text-secondary)' }}>
            <summary style={{ cursor: 'pointer' }}>How XP and streaks work</summary>
            <ul style={{ margin: '8px 0 0', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <li>Topic Mastery and Math Duels: 10 XP for each question point you earn. Topic Mastery counts up to 300 XP a day.</li>
              <li>Live quizzes: about 10 XP for a fast correct answer.</li>
              <li>Jeopardy boards: 10 XP per 100 points on the clue.</li>
              <li>A streak is the number of days in a row you played anything. Miss a whole day and it starts again. The week starts on Monday.</li>
            </ul>
          </details>
        </div>
      )}
    </div>
  )
}

function BoardRow({ row }: { row: Row }) {
  return (
    <li className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderColor: row.isMe ? 'var(--accent)' : undefined }}>
      <span style={{ width: 28, fontWeight: 800, color: 'var(--text-secondary)' }}>{row.rank ?? '–'}</span>
      <span style={{ flex: 1, fontWeight: 600 }}>{row.name}{row.isMe ? ' (you)' : ''}</span>
      {row.streak > 0 && <span style={{ fontSize: 12, color: 'var(--accent-dark)', fontWeight: 700, whiteSpace: 'nowrap' }}>{row.streak}-day streak</span>}
      <span style={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums', minWidth: 56, textAlign: 'right' }}>{row.xp.toLocaleString()} XP</span>
    </li>
  )
}
