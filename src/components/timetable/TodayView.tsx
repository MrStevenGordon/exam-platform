'use client'

import type { ReactNode } from 'react'
import { clock12, dayEntries, nowAndNext, type BlockRow, type Entry, type SectionLike, type WeekDay } from '@/lib/schoolDayPure'
import { subjectColor } from '@/lib/subjectColors'

// "Today first" for a phone: what is on now (with minutes left), what is next, and the rest of the day in order, with lunch and
// school events in their place. The week is one tap away in the parent screen.

export default function TodayView<T extends SectionLike & { subject: string }>({
  day, nowMin, renderLine, lunchLabel, emptyText,
}: {
  day: WeekDay<T>
  nowMin: number | null
  renderLine: (s: T) => ReactNode              // teacher and room, or class and room
  lunchLabel: (b: BlockRow) => string
  emptyText: string
}) {
  const entries = dayEntries(day)
  const { now, next } = nowMin === null ? { now: null, next: null } : nowAndNext(entries, nowMin)
  const nowClass = now?.kind === 'class' ? (now.ref as T) : null
  const left = now && nowMin !== null ? Math.max(0, now.end - nowMin) : 0
  const progress = now && nowMin !== null ? Math.min(100, Math.max(0, Math.round(((nowMin - now.start) / (now.end - now.start)) * 100))) : 0

  const label = (e: Entry): string => e.kind === 'class' ? (e.ref as T).subject : e.kind === 'lunch' ? lunchLabel(e.ref as BlockRow) : (e.ref as BlockRow).title
  if (entries.length === 0) return <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{emptyText}</p>

  return (
    <div>
      {now && (
        <div role="status" style={{ borderRadius: 18, padding: '14px 16px', color: '#fff', marginBottom: 12, background: nowClass ? subjectColor(nowClass.subject).fg : now.kind === 'lunch' ? 'var(--success)' : '#6B4F35' }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 1, opacity: 0.9 }}>ON NOW · {clock12(now.start).toUpperCase()} TO {clock12(now.end).toUpperCase()}</div>
          <div style={{ fontSize: 22, fontWeight: 800, margin: '3px 0 2px' }}>{label(now)}</div>
          {nowClass && <div style={{ fontSize: 13, opacity: 0.95 }}>{renderLine(nowClass)}</div>}
          <div aria-hidden="true" style={{ height: 6, borderRadius: 6, background: 'rgba(255,255,255,.35)', marginTop: 10 }}><div style={{ width: `${progress}%`, height: '100%', background: '#fff', borderRadius: 6 }} /></div>
          <div style={{ fontSize: 12, marginTop: 6 }}>{left} minute{left === 1 ? '' : 's'} left{next ? `. Next: ${label(next)} at ${clock12(next.start)}` : ''}</div>
        </div>
      )}
      {!now && next && nowMin !== null && (
        <div role="status" style={{ borderRadius: 14, padding: '12px 14px', background: 'var(--accent-light)', marginBottom: 12, fontSize: 14 }}>
          <strong>Next:</strong> {label(next)} at {clock12(next.start)}
        </div>
      )}
      {!now && !next && nowMin !== null && (
        <div role="status" style={{ borderRadius: 14, padding: '12px 14px', background: 'var(--success-bg)', marginBottom: 12, fontSize: 14 }}>That is the end of the lessons for today.</div>
      )}
      <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {entries.map((e, i) => {
          const past = nowMin !== null && e.end <= nowMin
          const cls = e.kind === 'class' ? (e.ref as T) : null
          const sw = cls ? subjectColor(cls.subject) : null
          return (
            <li key={i} style={{ display: 'flex', gap: 10, opacity: past ? 0.55 : 1 }}>
              <div style={{ width: 54, textAlign: 'right', fontSize: 11, color: 'var(--text-muted)', paddingTop: 9, fontWeight: 600 }}>{clock12(e.start).replace(' ', '')}</div>
              <div style={{ flex: 1, borderRadius: 12, padding: '8px 11px',
                ...(cls ? { background: sw!.bg, borderLeft: `4px solid ${sw!.fg}` }
                  : e.kind === 'lunch' ? { background: '#DDF0EE', color: 'var(--success)', fontWeight: 800 }
                  : { border: '1.5px dashed #6B4F35', color: '#6B4F35', fontWeight: 700, background: 'repeating-linear-gradient(135deg, rgba(107,79,53,.10) 0 6px, transparent 6px 12px)' }) }}>
                <div style={{ fontSize: 13.5, fontWeight: cls ? 700 : undefined }}>{label(e)}</div>
                {cls && <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2 }}>{renderLine(cls)}</div>}
                {e.end - e.start > 60 && cls && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{clock12(e.start)} to {clock12(e.end)}</div>}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
