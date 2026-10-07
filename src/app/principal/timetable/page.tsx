'use client'

import { useEffect, useMemo, useState } from 'react'
import EmptyState from '@/components/EmptyState'
import { jamaicaDate, isoWeekday, shiftDate, schoolYear, attendanceError } from '@/lib/attendance'
import { loadBlocks, loadPeriods, loadSections } from '@/lib/schoolDay'
import { dayBounds, gradesLabel, jamaicaMinutes, range12, weekItems, type BlockRow, type PeriodRow, type SectionLike } from '@/lib/schoolDayPure'
import { gradeFromText } from '@/lib/topics'
import WeekGrid from '@/components/timetable/WeekGrid'

type Section = SectionLike & {
  subject: string; room: string | null; teacher_id: string
  teacher: { full_name: string } | null; class_group: { name: string; year_grade?: string | null } | null
}


// The whole school's timetable, read-only, by class or by teacher.
export default function PrincipalTimetablePage() {
  const today = jamaicaDate()
  const [periods, setPeriods] = useState<PeriodRow[]>([])
  const [blocks, setBlocks] = useState<BlockRow[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'class' | 'teacher'>('class')
  const [selected, setSelected] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const year = schoolYear(today)
        const [periodData, sectionData, blockData] = await Promise.all([
          loadPeriods(year),
          loadSections<Section>('id, subject, day_of_week, period_id, room, class_group_id, teacher_id, teacher:profiles!teacher_id(full_name), class_group:class_groups(name, year_grade)', year),
          loadBlocks(year),
        ])
        if (cancelled) return
        setPeriods(periodData)
        setSections(sectionData)
        setBlocks(blockData.blocks)
      } catch (err) {
        if (!cancelled) setError(attendanceError(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [today])

  // Choices for the selector, for whichever way we are viewing.
  const options = useMemo(() => {
    const map = new Map<string, string>()
    for (const s of sections) {
      if (mode === 'class' && s.class_group_id && s.class_group?.name) map.set(s.class_group_id, s.class_group.name)
      if (mode === 'teacher' && s.teacher?.full_name) map.set(s.teacher_id, s.teacher.full_name)
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], undefined, { numeric: true }))
  }, [sections, mode])

  const current = options.some(([id]) => id === selected) ? selected : (options[0]?.[0] ?? '')
  const shown = sections.filter((s) => (mode === 'class' ? s.class_group_id === current : s.teacher_id === current))
  const todayDow = isoWeekday(today)
  const wd = todayDow
  const monday = wd >= 6 ? shiftDate(today, 8 - wd) : shiftDate(today, 1 - wd)
  const weekDates = [0, 1, 2, 3, 4].map((i) => shiftDate(monday, i))
  const shortDate = (d: string) => new Intl.DateTimeFormat('en-JM', { timeZone: 'UTC', day: 'numeric', month: 'short' }).format(new Date(`${d}T12:00:00Z`))
  const classGrade = mode === 'class' ? gradeFromText(shown.find((x) => x.class_group?.year_grade)?.class_group?.year_grade) : null
  const days = weekItems(shown, periods, blocks, { grade: classGrade, dates: weekDates })
  const bounds = dayBounds(periods)

  if (loading) return <div>Loading…</div>

  return (
    <div>
      <h1 className="portal-page-title">Timetable</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: '0 0 16px' }}>Academic year {schoolYear(today)} · read-only</p>
      {error && <p className="banner banner-danger" role="alert">{error}</p>}
      {!error && periods.length === 0 && (
        <EmptyState icon="🗓️" title="No timetable has been set up yet" description="Once periods and classes are added to the timetable, they appear here." />
      )}

      {periods.length > 0 && (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
            <div role="group" aria-label="View by" style={{ display: 'flex', gap: 4 }}>
              {(['class', 'teacher'] as const).map((m) => (
                <button key={m} type="button" aria-pressed={mode === m} className={mode === m ? 'btn btn-primary' : 'btn btn-ghost'} onClick={() => { setMode(m); setSelected('') }}>
                  By {m}
                </button>
              ))}
            </div>
            <select value={current} onChange={(e) => setSelected(e.target.value)} aria-label={mode === 'class' ? 'Class' : 'Teacher'} style={{ minWidth: 200 }}>
              {options.length === 0 && <option value="">{mode === 'class' ? 'No classes yet' : 'No teachers yet'}</option>}
              {options.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          </div>

          {bounds && (
            <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
              <WeekGrid<Section>
                days={days} bounds={bounds} todayDow={todayDow >= 1 && todayDow <= 5 ? todayDow : null} nowMin={todayDow >= 1 && todayDow <= 5 ? jamaicaMinutes(new Date()) : null}
                lunchLabel={(b) => `Lunch · ${gradesLabel(b.grades)}`} dayLabels={weekDates.map(shortDate)}
                renderClass={({ section: x, start, end }) => (
                  <div style={{ fontSize: 11 }}>
                    <div style={{ fontWeight: 700, fontSize: 12.5, lineHeight: 1.2 }}>{x.subject}</div>
                    <div style={{ color: 'var(--text-secondary)', marginTop: 1 }}>{mode === 'class' ? (x.teacher?.full_name || '') : (x.class_group?.name || 'Subject class')}{x.room ? ` · Room ${x.room}` : ''}</div>
                    {end - start > 60 && <div style={{ color: 'var(--text-muted)', marginTop: 1 }}>{range12(start, end)}</div>}
                  </div>
                )}
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}
