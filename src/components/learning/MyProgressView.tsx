'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { loadMyProgress, type MyProgressLoad } from '@/lib/myProgress'
import type { SubjectProgress } from '@/lib/myProgressPure'

// "My progress": a student's results compared only with their own earlier results, plus a few gentle nudges. Nobody else's figures appear here.

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null
  const w = 160, h = 44, pad = 4
  const lo = Math.min(...values, 0), hi = Math.max(...values, 100)
  const x = (i: number) => pad + (i * (w - 2 * pad)) / (values.length - 1)
  const y = (v: number) => h - pad - ((v - lo) / (hi - lo)) * (h - 2 * pad)
  const pts = values.map((v, i) => `${x(i)},${y(v)}`).join(' ')
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Your results over time, from ${Math.round(values[0])}% to ${Math.round(values[values.length - 1])}%`} style={{ maxWidth: '100%' }}>
      <polyline points={pts} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r="3.5" fill="var(--accent)" />
    </svg>
  )
}

const TREND = { up: { label: 'Going up', cls: 'badge-success' }, down: { label: 'A little lower', cls: 'badge-warning' }, steady: { label: 'Steady', cls: 'badge-default' } } as const

function SubjectCard({ s }: { s: SubjectProgress }) {
  const stat = (label: string, v: number) => <div style={{ minWidth: 70 }}><div style={{ fontSize: 20, fontWeight: 700 }}>{Math.round(v)}%</div><div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</div></div>
  return (
    <section className="card" style={{ marginTop: 14 }} aria-label={s.subject}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 17 }}>{s.subject}</h2>
        {s.trend && <span className={`badge ${TREND[s.trend].cls}`}>{TREND[s.trend].label}</span>}
      </div>
      <p style={{ margin: '8px 0 12px', fontSize: 14 }}>{s.message}</p>
      <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', alignItems: 'center' }}>
        {s.count > 1 && stat('First result', s.first)}
        {stat(s.count > 1 ? 'Latest' : 'Result', s.latest)}
        {s.count > 1 && stat('Your best', s.best)}
        <Sparkline values={s.series} />
      </div>
    </section>
  )
}

export default function MyProgressView() {
  const [load, setLoad] = useState<MyProgressLoad | undefined>(undefined)
  useEffect(() => {
    let cancelled = false
    loadMyProgress().then((l) => { if (!cancelled) setLoad(l) }).catch(() => { if (!cancelled) setLoad(null) })
    return () => { cancelled = true }
  }, [])

  if (load === undefined) return <div className="page-container">Loading…</div>
  if (load === null) return <div className="page-container"><p role="alert" className="banner banner-danger">Could not load your progress. Please try again.</p></div>
  const { progress, nudges } = load
  return (
    <div className="page-container sentence-case" style={{ maxWidth: 760 }}>
      <h1 className="portal-page-title">My progress</h1>
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>Your results compared with your own earlier results. This is about how you are growing, not about anyone else.</p>

      <div className="card" style={{ marginTop: 18 }}>
        <p style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{progress.overall.headline}</p>
      </div>

      {nudges.length > 0 && (
        <section style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }} aria-label="A few things that could help">
          {nudges.map((n) => (
            <div key={n.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 14, flex: '1 1 260px' }}>{n.text}</span>
              <Link href={n.href} className="btn btn-secondary">{n.action}</Link>
            </div>
          ))}
        </section>
      )}

      {progress.subjects.length === 0
        ? <div className="card" style={{ marginTop: 14 }}><p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)' }}>Once your teachers share results, each subject will show how you are growing.</p></div>
        : progress.subjects.map((s) => <SubjectCard key={s.subject} s={s} />)}
    </div>
  )
}
