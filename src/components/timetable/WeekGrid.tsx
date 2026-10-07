'use client'

import type { ReactNode } from 'react'
import { clock12, DAY_NAMES, SCHOOL_DAYS, type BlockRow, type SectionLike, type WeekDay } from '@/lib/schoolDayPure'
import { subjectColor } from '@/lib/subjectColors'

// The week as columns on a time axis: a lesson sits at its real time and a double period is one tall block. Lunch and school
// events (devotion, clubs, a sports day) sit in their place too, so the picture matches the bell. Today is outlined, and a red
// line marks the time now. Used for students, teachers and the principal.

const HEADER = 40
const PX_PER_MIN = 1.45

export type GridClass<T extends SectionLike> = { section: T; start: number; end: number }

export default function WeekGrid<T extends SectionLike & { subject: string }>({
  days, bounds, todayDow, nowMin, renderClass, lunchLabel, dayLabels,
}: {
  days: WeekDay<T>[]
  bounds: { start: number; end: number }
  todayDow: number | null
  nowMin: number | null
  renderClass: (c: GridClass<T>) => ReactNode
  lunchLabel: (b: BlockRow) => string
  dayLabels?: (string | null)[]          // for example "Mon 12 Oct"
}) {
  const height = (bounds.end - bounds.start) * PX_PER_MIN
  const y = (min: number) => HEADER + (min - bounds.start) * PX_PER_MIN
  const hours: number[] = []
  for (let m = Math.ceil(bounds.start / 60) * 60; m <= bounds.end; m += 60) hours.push(m)
  const showNow = nowMin !== null && nowMin >= bounds.start && nowMin <= bounds.end

  return (
    <div role="group" aria-label="Weekly timetable" style={{ display: 'grid', gridTemplateColumns: '54px repeat(5, minmax(120px, 1fr))', columnGap: 8, minWidth: 760 }}>
      <div style={{ position: 'relative', height: HEADER + height }} aria-hidden="true">
        {hours.map((m) => (
          <span key={m} style={{ position: 'absolute', right: 6, top: y(m) - 7, fontSize: 11, color: 'var(--text-muted)' }}>{clock12(m).replace(':00', '')}</span>
        ))}
      </div>
      {SCHOOL_DAYS.map((dow, i) => {
        const day = days[i]
        const isToday = dow === todayDow
        return (
          <section key={dow} aria-label={DAY_NAMES[dow]} style={{ position: 'relative', height: HEADER + height, background: 'var(--card-bg)', borderRadius: 14, border: isToday ? '2px solid var(--accent)' : '1px solid var(--border)', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: HEADER, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: isToday ? 'var(--accent)' : 'var(--accent-light)', color: isToday ? '#fff' : 'var(--text-primary)', fontWeight: 800, fontSize: 13, lineHeight: 1.15 }}>
              {DAY_NAMES[dow]}
              {dayLabels?.[i] && <span style={{ fontWeight: 500, fontSize: 10.5, opacity: 0.9 }}>{dayLabels[i]}</span>}
            </div>
            {hours.map((m) => <div key={m} style={{ position: 'absolute', left: 0, right: 0, top: y(m), borderTop: '1px solid var(--border)', opacity: 0.55 }} />)}

            {day.blocks.map(({ block, start, end }) => {
              const wholeDay = start <= bounds.start && end >= bounds.end
              const lunch = block.kind === 'lunch'
              const tone = lunch ? 'var(--success)' : '#6B4F35'
              return (
                <div key={block.id + start} title={block.note || undefined} style={{ position: 'absolute', left: 5, right: 5, top: y(start) + 2, height: Math.max(22, (end - start) * PX_PER_MIN - 4), borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '2px 6px', fontWeight: 700, fontSize: 11.5, lineHeight: 1.2, zIndex: 1,
                  color: tone, border: lunch ? '1.5px solid #9BD2CD' : `1.5px dashed ${tone}`,
                  background: lunch ? '#DDF0EE' : `repeating-linear-gradient(135deg, rgba(107,79,53,.10) 0 6px, transparent 6px 12px), var(--card-bg)` }}>
                  {lunch ? lunchLabel(block) : block.title}{wholeDay ? ' (all day)' : ''}
                </div>
              )
            })}

            {day.classes.map((c) => {
              const sw = subjectColor(c.section.subject)
              const clashing = day.blocks.some((b) => b.start < c.end && c.start < b.end)
              return (
                <div key={c.section.id} style={{ position: 'absolute', left: 5, right: 5, top: y(c.start) + 2, height: (c.end - c.start) * PX_PER_MIN - 4, borderRadius: 9, padding: '5px 8px', borderLeft: `4px solid ${sw.fg}`, background: sw.bg, overflow: 'hidden', zIndex: clashing ? 0 : 2, opacity: clashing ? 0.45 : 1 }}
                  title={clashing ? 'This class runs into lunch or a school event' : undefined}>
                  {renderClass(c)}
                </div>
              )
            })}

            {isToday && showNow && (
              <div aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, top: y(nowMin as number), borderTop: '2px solid var(--danger)', zIndex: 4 }}>
                <span style={{ position: 'absolute', left: 2, top: -9, background: 'var(--danger)', color: '#fff', fontSize: 9.5, fontWeight: 700, padding: '1px 5px', borderRadius: 4 }}>{clock12(nowMin as number).replace(' am', '').replace(' pm', '')}</span>
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
