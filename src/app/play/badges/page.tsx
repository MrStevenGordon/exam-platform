'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import BadgeSeal from '../BadgeSeal'
import type { BadgeCategory } from '@/lib/playBadges'

type Progress = { current: number; target: number } | null
type Badge = { key: string; name: string; description: string; category: BadgeCategory; mark: string }
type Earned = Badge & { earnedAt: string; isNew: boolean }
type Locked = Badge & { progress: Progress }

const ORDER: BadgeCategory[] = ['streak', 'xp', 'first', 'skill']
const LABELS: Record<BadgeCategory, string> = { streak: 'Streaks', xp: 'XP milestones', first: 'Firsts', skill: 'Skills' }

export default function BadgesPage() {
  const router = useRouter()
  const [earned, setEarned] = useState<Earned[]>([])
  const [locked, setLocked] = useState<Locked[]>([])
  const [newCount, setNewCount] = useState(0)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  // Loading marks the new badges as seen, so it must happen exactly once; a
  // second load would come back with the markers already cleared.
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    async function load() {
      try {
        const res = await fetch('/api/play/badges')
        if (res.status === 401) { router.push('/play/login'); return }
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        setEarned(data.earned)
        setLocked(data.locked)
        setNewCount(data.newCount)
        setTotal(data.total)
        // The "new" markers stay on this view; opening the page counts as seeing them.
        if (data.newCount > 0) fetch('/api/play/badges/seen', { method: 'POST' }).catch(() => {})
      } catch (err: any) {
        setError(err?.message || 'Something went wrong loading your badges.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [router])

  if (loading) return <div className="page-container">Loading…</div>

  return (
    <div className="page-container" style={{ maxWidth: 680 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <p className="portal-page-title" style={{ margin: 0 }}>Badges</p>
        <Link href="/play/home" className="btn btn-secondary" style={{ fontSize: 13, padding: '6px 14px' }}>Back</Link>
      </div>
      <p style={{ margin: '4px 0 16px', fontSize: 14, color: 'var(--text-secondary)' }}>
        {earned.length} of {total} earned. Badges come from playing, and once you have one it is yours to keep.
      </p>

      {error && <p className="banner banner-danger" role="alert" style={{ marginBottom: 12 }}>{error}</p>}

      {newCount > 0 && (
        <div className="card" style={{ marginBottom: 20, borderColor: 'var(--accent)', background: 'var(--accent-light)' }}>
          <div style={{ fontWeight: 800, marginBottom: 4 }}>You earned {newCount} new badge{newCount !== 1 ? 's' : ''}!</div>
          <div style={{ fontSize: 14 }}>{earned.filter((e) => e.isNew).map((e) => e.name).join(', ')}</div>
        </div>
      )}

      {ORDER.map((cat) => {
        const mine = earned.filter((b) => b.category === cat)
        const todo = locked.filter((b) => b.category === cat)
        if (mine.length + todo.length === 0) return null
        return (
          <section key={cat} style={{ marginBottom: 24 }} aria-label={LABELS[cat]}>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-secondary)', marginBottom: 10 }}>
              {LABELS[cat]} · {mine.length} of {mine.length + todo.length}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
              {mine.map((b) => (
                <div key={b.key} className="card" style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 14px', borderColor: b.isNew ? 'var(--accent)' : undefined }}>
                  <BadgeSeal mark={b.mark} category={b.category} label={`${b.name}, earned`} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700 }}>
                      {b.name}
                      {b.isNew && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 800, color: '#fff', background: 'var(--accent)', padding: '2px 7px', borderRadius: 100 }}>NEW</span>}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{b.description}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Earned {new Date(b.earnedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                  </div>
                </div>
              ))}
              {todo.map((b) => {
                const pct = b.progress ? Math.min(100, Math.round((b.progress.current / b.progress.target) * 100)) : null
                return (
                  <div key={b.key} className="card" style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 14px', background: 'var(--page-bg)' }}>
                    <BadgeSeal mark={b.mark} category={b.category} locked label={`${b.name}, not earned yet`} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>{b.name}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{b.description}</div>
                      {b.progress && pct !== null && (
                        <div style={{ marginTop: 6 }}>
                          <div style={{ height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }} role="progressbar" aria-valuenow={b.progress.current} aria-valuemin={0} aria-valuemax={b.progress.target}>
                            <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent)' }} />
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{b.progress.current.toLocaleString()} of {b.progress.target.toLocaleString()}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
