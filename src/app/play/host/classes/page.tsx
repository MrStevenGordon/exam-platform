'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import BadgeSeal from '../../BadgeSeal'
import { BADGES } from '@/lib/playBadgeCatalog'

type ClassInfo = { id: string; name: string; gradeLabel: string | null; students: number }
type Row = {
  rank: number | null
  name: string
  xp: number
  weekXp: number
  totalXp: number
  streak: number
  bestStreak: number
  playedToday: boolean
  lastPlayed: string | null
  // Badge keys, newest first.
  badges: string[]
}

const BADGE_BY_KEY = new Map(BADGES.map((b) => [b.key, b]))
const SEALS_SHOWN = 5

function lastPlayedLabel(iso: string | null): string {
  if (!iso) return 'Never'
  const days = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(iso).setHours(0, 0, 0, 0)) / 86_400_000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return `${days} days ago`
}

export default function ClassProgressPage() {
  const router = useRouter()
  const [classes, setClasses] = useState<ClassInfo[]>([])
  const [classId, setClassId] = useState('')
  const [period, setPeriod] = useState<'week' | 'all'>('week')
  const [rows, setRows] = useState<Row[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/play/host/classes')
      .then(async (res) => {
        if (res.status === 401) { router.push('/play/login'); return }
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        setClasses(data.classes)
        if (data.classes[0]) setClassId(data.classes[0].id)
        else setLoading(false)
      })
      .catch((err) => { setError(err?.message || 'Something went wrong loading your classes.'); setLoading(false) })
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
        if (!cancelled) { setRows(data.rows); setError('') }
      })
      .catch((err) => { if (!cancelled) setError(err?.message || 'Something went wrong loading the class.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [classId, period, router])

  const tab = (value: 'week' | 'all', label: string) => (
    <button onClick={() => setPeriod(value)} aria-pressed={period === value} className={period === value ? 'btn btn-primary' : 'btn btn-secondary'} style={{ fontSize: 13, padding: '6px 16px' }}>
      {label}
    </button>
  )

  const notPlayedEver = rows?.filter((r) => r.lastPlayed === null) ?? []
  const noXp = rows?.filter((r) => r.xp === 0 && r.lastPlayed !== null) ?? []
  const active = rows?.filter((r) => r.xp > 0).length ?? 0
  const streaking = rows?.filter((r) => r.streak >= 3).length ?? 0
  const badgeTotal = rows?.reduce((n, r) => n + r.badges.length, 0) ?? 0
  const withBadges = rows?.filter((r) => r.badges.length > 0).length ?? 0

  return (
    <div className="page-container" style={{ maxWidth: 860 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <h1 className="portal-page-title" style={{ margin: 0 }}>Class progress</h1>
        <Link href="/play/home" className="btn btn-secondary" style={{ fontSize: 13, padding: '6px 14px' }}>Back</Link>
      </div>
      <p style={{ margin: '4px 0 16px', fontSize: 14, color: 'var(--text-secondary)' }}>
        XP and day streaks from Topic Mastery, Math Duels, live games and Jeopardy boards, for the classes you teach.
      </p>

      {error && <p className="banner banner-danger" role="alert" style={{ marginBottom: 12 }}>{error}</p>}
      {!loading && classes.length === 0 && !error && <p className="card" style={{ fontSize: 14 }}>You are not assigned to any classes yet.</p>}

      {classes.length > 0 && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
          <select aria-label="Class" value={classId} onChange={(e) => setClassId(e.target.value)} style={{ width: 'auto', minWidth: 200 }}>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}{c.gradeLabel ? ` (${c.gradeLabel})` : ''} · {c.students} students</option>)}
          </select>
          {tab('week', 'This week')}
          {tab('all', 'All time')}
        </div>
      )}

      {rows && (
        <div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
            <Stat label={`Earned XP ${period === 'week' ? 'this week' : 'in total'}`} value={`${active} of ${rows.length}`} />
            <Stat label="On a 3+ day streak" value={String(streaking)} />
            <Stat label={`Badges earned (${withBadges} student${withBadges !== 1 ? 's' : ''})`} value={String(badgeTotal)} />
            <Stat label="Never played" value={String(notPlayedEver.length)} />
          </div>

          <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, minWidth: 720 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--text-secondary)', fontSize: 12 }}>
                  <th style={{ padding: '10px 12px', width: 44 }}>Rank</th>
                  <th style={{ padding: '10px 12px' }}>Student</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>{period === 'week' ? 'XP this week' : 'XP all time'}</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>{period === 'week' ? 'XP all time' : 'XP this week'}</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Streak</th>
                  <th style={{ padding: '10px 12px' }}>Badges</th>
                  <th style={{ padding: '10px 12px' }}>Last played</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.name} style={{ borderTop: '1px solid var(--border)', opacity: r.lastPlayed === null ? 0.65 : 1 }}>
                    <td style={{ padding: '8px 12px', fontWeight: 800, color: 'var(--text-secondary)' }}>{r.rank ?? '–'}</td>
                    <td style={{ padding: '8px 12px', fontWeight: 600 }}>{r.name}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{r.xp.toLocaleString()}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{(period === 'week' ? r.totalXp : r.weekXp).toLocaleString()}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {r.streak > 0 ? <span style={{ fontWeight: 700, color: 'var(--accent-dark)' }}>{r.streak} day{r.streak !== 1 ? 's' : ''}</span> : <span style={{ color: 'var(--text-muted)' }}>none</span>}
                      {r.bestStreak > r.streak && <span style={{ color: 'var(--text-muted)', fontSize: 12 }}> (best {r.bestStreak})</span>}
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      {r.badges.length === 0 ? (
                        <span style={{ color: 'var(--text-muted)' }}>none</span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontWeight: 700, marginRight: 4 }}>{r.badges.length}</span>
                          {r.badges.slice(0, SEALS_SHOWN).map((key) => {
                            const b = BADGE_BY_KEY.get(key)
                            return b ? <span key={key} title={`${b.name}: ${b.description}`}><BadgeSeal mark={b.mark} category={b.category} size={26} label={b.name} /></span> : null
                          })}
                          {r.badges.length > SEALS_SHOWN && (
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }} title={r.badges.slice(SEALS_SHOWN).map((k) => BADGE_BY_KEY.get(k)?.name).filter(Boolean).join(', ')}>+{r.badges.length - SEALS_SHOWN}</span>
                          )}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '8px 12px', color: r.lastPlayed === null ? 'var(--danger)' : 'var(--text-secondary)' }}>{lastPlayedLabel(r.lastPlayed)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {(notPlayedEver.length > 0 || noXp.length > 0) && (
            <div style={{ marginTop: 16, fontSize: 13, color: 'var(--text-secondary)' }}>
              {notPlayedEver.length > 0 && <p style={{ margin: '0 0 6px' }}><strong>Have not played yet ({notPlayedEver.length}):</strong> {notPlayedEver.map((r) => r.name).join(', ')}</p>}
              {noXp.length > 0 && <p style={{ margin: 0 }}><strong>No XP {period === 'week' ? 'this week' : 'yet'} ({noXp.length}):</strong> {noXp.map((r) => r.name).join(', ')}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card" style={{ padding: '10px 16px' }}>
      <div style={{ fontSize: 20, fontWeight: 800 }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</div>
    </div>
  )
}
