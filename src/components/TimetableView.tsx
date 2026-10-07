'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { jamaicaDate, isoWeekday, shiftDate } from '@/lib/attendance'
import { loadBlocks, loadPeriods, loadSections } from '@/lib/schoolDay'
import { dayBounds, gradesLabel, jamaicaMinutes, range12, toMinutes, weekItems, type BlockRow, type PeriodRow, type SectionLike } from '@/lib/schoolDayPure'
import { gradeFromText } from '@/lib/topics'
import WeekGrid from '@/components/timetable/WeekGrid'
import TodayView from '@/components/timetable/TodayView'

function currentAcademicYear() {
  const now = new Date()
  const y = now.getFullYear()
  return now.getMonth() >= 7 ? `${y}-${y + 1}` : `${y - 1}-${y}`
}

type Section = SectionLike & {
  subject: string; room: string | null
  teacher: { full_name: string } | null
  class_group: { name: string; year_grade?: string | null } | null
}

// A class a substitute is taking on a particular day this week (from student_cover, migration 075).
type Cover = { class_date: string; section_id: string; substitute_name: string; absent_name: string; lesson_label: string | null; lesson_id: string | null }

// The timetable is a weekly pattern with no dates, so cover is shown against this school week: Monday to Friday of
// the current week, or of the coming week once the weekend has arrived.
function schoolWeekDates(): string[] {
  const today = jamaicaDate()
  const wd = isoWeekday(today)
  const monday = wd >= 6 ? shiftDate(today, 8 - wd) : shiftDate(today, 1 - wd)
  return [0, 1, 2, 3, 4].map((i) => shiftDate(monday, i))
}
const shortDate = (d: string) => new Intl.DateTimeFormat('en-JM', { timeZone: 'UTC', day: 'numeric', month: 'short' }).format(new Date(`${d}T12:00:00Z`))

export default function TimetableView({ viewerRole }: { viewerRole: 'teacher' | 'student' }) {
  const [loading, setLoading] = useState(true)
  const [periods, setPeriods] = useState<PeriodRow[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [blocks, setBlocks] = useState<BlockRow[]>([])
  const [grade, setGrade] = useState<number | null>(null)
  const [covers, setCovers] = useState<Record<string, Cover>>({})
  const [tab, setTab] = useState<'today' | 'tomorrow' | 'week' | null>(null)
  const [narrow, setNarrow] = useState(false)
  const [now, setNow] = useState<Date>(() => new Date())
  const weekDates = schoolWeekDates()

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 760px)')
    const sync = () => setNarrow(mq.matches)
    sync(); mq.addEventListener('change', sync)
    const tick = setInterval(() => setNow(new Date()), 30000)
    return () => { mq.removeEventListener('change', sync); clearInterval(tick) }
  }, [])

  useEffect(() => {
    async function load() {
      const academicYear = currentAcademicYear()
      const [periodData, sectionData, blockData] = await Promise.all([
        loadPeriods(academicYear),
        loadSections<Section>('id, subject, day_of_week, period_id, room, class_group_id, teacher:profiles!teacher_id(full_name), class_group:class_groups(name, year_grade)', academicYear),
        loadBlocks(academicYear),
      ])
      setPeriods(periodData)
      setSections(sectionData)
      setBlocks(blockData.blocks)
      if (viewerRole === 'student') {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: me } = await supabase.from('profiles').select('grade_level').eq('id', user.id).single()
          const g = gradeFromText(me?.grade_level) ?? gradeFromText(sectionData.find((s) => s.class_group?.year_grade)?.class_group?.year_grade)
          setGrade(g)
        }
        // Before migration 075 this simply errors and no cover is shown.
        const week = schoolWeekDates()
        const { data: coverData, error: coverError } = await supabase.rpc('student_cover', { p_from: week[0], p_to: week[4] })
        if (!coverError) {
          const byKey: Record<string, Cover> = {}
          for (const c of (coverData || []) as Cover[]) byKey[`${c.section_id}|${c.class_date}`] = c
          setCovers(byKey)
        }
      }
      setLoading(false)
    }
    load()
  }, [viewerRole])

  const days = useMemo(() => weekItems(sections, periods, blocks, { grade: viewerRole === 'student' ? grade : null, dates: weekDates }), [sections, periods, blocks, grade, viewerRole]) // eslint-disable-line react-hooks/exhaustive-deps
  const bounds = dayBounds(periods)
  const today = jamaicaDate(now)
  const todayDow = isoWeekday(today)
  const isSchoolDay = todayDow >= 1 && todayDow <= 5
  const nowMin = jamaicaMinutes(now)
  const nextSchoolDow = (from: number) => { let d = from + 1; if (d > 5 || d < 1) d = 1; return d }
  const activeTab = tab ?? (narrow ? 'today' : 'week')
  const myLunch = viewerRole === 'student' ? blocks.find((b) => b.kind === 'lunch' && (!b.grades || b.grades.includes(grade ?? -1))) : undefined
  const lunchStart = toMinutes(myLunch?.start_time), lunchEnd = toMinutes(myLunch?.end_time)
  const lunchText = lunchStart !== null && lunchEnd !== null ? ` · lunch ${range12(lunchStart, lunchEnd)}` : ''
  const lunchLabel = (b: BlockRow) => viewerRole === 'student' ? 'Lunch' : `Lunch · ${gradesLabel(b.grades)}`

  if (loading) return <div className="page-container">Loading…</div>

  const line = (s: Section) => {
    const parts = [viewerRole === 'student' ? (s.teacher?.full_name || '') : (s.class_group?.name || 'Individual'), s.room ? `Room ${s.room}` : ''].filter(Boolean)
    return parts.join(' · ')
  }
  const tabBtn = (id: 'today' | 'tomorrow' | 'week', label: string) => (
    <button key={id} type="button" aria-pressed={activeTab === id} onClick={() => setTab(id)} className={activeTab === id ? 'btn btn-primary' : 'btn btn-ghost'} style={{ padding: '6px 16px', fontSize: 13 }}>{label}</button>
  )
  const dayFor = (dow: number) => days[dow - 1]
  const dayShown = activeTab === 'tomorrow' ? nextSchoolDow(todayDow) : (isSchoolDay ? todayDow : 1)
  const dayName = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'][dayShown]

  return (
    <div className="page-container" style={{ maxWidth: activeTab === 'week' ? 1180 : 640 }}>
      <p className="portal-page-title" style={{ margin: 0 }}>My Timetable</p>
      <p className="portal-page-sub" style={{ margin: '4px 0 14px' }}>
        {currentAcademicYear()}
        {viewerRole === 'student' && grade ? ` · Grade ${grade}` : ''}
        {lunchText}
      </p>
      {Object.keys(covers).length > 0 && (
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '-6px 0 14px' }}>
          A class marked <strong>Covered</strong> has a substitute teacher on that day this week.
        </p>
      )}

      {periods.length === 0 || !bounds ? (
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>No timetable has been set up yet.</p>
      ) : (
        <>
          <div role="group" aria-label="View" style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
            {tabBtn('today', isSchoolDay ? 'Today' : 'Next school day')}
            {tabBtn('tomorrow', 'Tomorrow')}
            {tabBtn('week', 'Week')}
          </div>

          {activeTab === 'week' ? (
            <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
              <WeekGrid<Section>
                days={days} bounds={bounds} todayDow={isSchoolDay ? todayDow : null} nowMin={isSchoolDay ? nowMin : null} lunchLabel={lunchLabel}
                dayLabels={weekDates.map(shortDate)}
                renderClass={({ section: s, start, end }) => {
                  const cover = viewerRole === 'student' ? covers[`${s.id}|${weekDates[s.day_of_week - 1]}`] : undefined
                  return (
                    <div style={{ fontSize: 11 }}>
                      <div style={{ fontWeight: 700, fontSize: 12.5, lineHeight: 1.2 }}>{s.subject}</div>
                      {cover ? (
                        <>
                          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: 'var(--warning)', marginTop: 2 }}>Covered</div>
                          <div>{cover.substitute_name}</div>
                          <div style={{ color: 'var(--text-secondary)' }}>For {cover.absent_name}</div>
                          {cover.lesson_label && (cover.lesson_id ? <Link href={`/learning/lesson/${cover.lesson_id}`}>Lesson: {cover.lesson_label}</Link> : <>Lesson: {cover.lesson_label}</>)}
                        </>
                      ) : (
                        <div style={{ color: 'var(--text-secondary)', marginTop: 1 }}>{line(s)}</div>
                      )}
                      {end - start > 60 && <div style={{ color: 'var(--text-muted)', marginTop: 1 }}>{range12(start, end)}</div>}
                    </div>
                  )
                }}
              />
            </div>
          ) : (
            <>
              <h2 style={{ fontSize: 16, margin: '0 0 10px' }}>{activeTab === 'tomorrow' ? 'Tomorrow' : (isSchoolDay ? 'Today' : 'Next school day')}, {dayName}</h2>
              <TodayView<Section>
                day={dayFor(dayShown)} nowMin={activeTab === 'today' && isSchoolDay ? nowMin : null} renderLine={line} lunchLabel={lunchLabel}
                emptyText="Nothing is on the timetable for this day."
              />
            </>
          )}
        </>
      )}
    </div>
  )
}
