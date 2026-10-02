'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { jamaicaDate, isoWeekday, shiftDate } from '@/lib/attendance'

const DAYS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
]

function currentAcademicYear() {
  const now = new Date()
  const y = now.getFullYear()
  return now.getMonth() >= 7 ? `${y}-${y + 1}` : `${y - 1}-${y}`
}

type Period = { id: string; name: string; start_time: string; order_index: number }
type Section = {
  id: string; subject: string; day_of_week: number; period_id: string; room: string | null
  class_group_id: string | null
  teacher: { full_name: string } | null
  class_group: { name: string } | null
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
  const [periods, setPeriods] = useState<Period[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [covers, setCovers] = useState<Record<string, Cover>>({})
  const weekDates = viewerRole === 'student' ? schoolWeekDates() : []

  useEffect(() => {
    async function load() {
      const academicYear = currentAcademicYear()
      const [{ data: periodData }, { data: sectionData }] = await Promise.all([
        supabase.from('timetable_periods').select('id, name, start_time, order_index').eq('academic_year', academicYear).order('order_index'),
        supabase
          .from('timetable_sections')
          .select('id, subject, day_of_week, period_id, room, class_group_id, teacher:profiles!teacher_id(full_name), class_group:class_groups(name)')
          .eq('academic_year', academicYear),
      ])
      setPeriods(periodData || [])
      setSections((sectionData as any) || [])
      if (viewerRole === 'student') {
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

  if (loading) return <div className="page-container">Loading…</div>

  function sectionFor(periodId: string, day: number) {
    return sections.find((s) => s.period_id === periodId && s.day_of_week === day)
  }

  return (
    <div className="page-container">
      <p className="portal-page-title" style={{ margin: 0 }}>My Timetable</p>
      <p className="portal-page-sub" style={{ margin: '4px 0 20px' }}>{currentAcademicYear()}</p>
      {Object.keys(covers).length > 0 && (
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '-8px 0 16px' }}>
          A class marked <strong>Covered</strong> has a substitute teacher on that day this week.
        </p>
      )}

      {periods.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>No timetable has been set up yet.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>Period</th>
                {DAYS.map((d) => (
                  <th key={d.value} style={{ textAlign: 'left', padding: '8px 10px', fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>
                    {d.label}
                    {weekDates[d.value - 1] && <div style={{ fontWeight: 400, fontSize: 10, textTransform: 'none' }}>{shortDate(weekDates[d.value - 1])}</div>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {periods.map((p) => (
                <tr key={p.id}>
                  <td style={{ padding: '10px', fontSize: 13, fontWeight: 700, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                    {p.name}<br /><span style={{ fontWeight: 400, color: 'var(--text-secondary)', fontSize: 11 }}>{p.start_time}</span>
                  </td>
                  {DAYS.map((d) => {
                    const s = sectionFor(p.id, d.value)
                    const cover = s ? covers[`${s.id}|${weekDates[d.value - 1]}`] : undefined
                    return (
                      <td key={d.value} style={{ padding: '10px', borderBottom: '1px solid var(--border)', verticalAlign: 'top' }}>
                        {s ? (
                          <div style={{ background: cover ? 'var(--warning-bg)' : 'var(--accent-light)', border: `1px solid ${cover ? 'var(--warning)' : 'var(--border)'}`, borderRadius: 8, padding: '8px 10px' }}>
                            <div style={{ fontWeight: 700, fontSize: 13 }}>{s.subject}</div>
                            {cover ? (
                              <>
                                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: 'var(--warning)', marginTop: 2 }}>Covered</div>
                                <div style={{ fontSize: 12, marginTop: 2 }}>{cover.substitute_name}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>For {cover.absent_name}</div>
                                {cover.lesson_label && (
                                  <div style={{ fontSize: 11, marginTop: 2 }}>
                                    {cover.lesson_id
                                      ? <Link href={`/learning/lesson/${cover.lesson_id}`}>Open lesson: {cover.lesson_label}</Link>
                                      : <>Lesson: {cover.lesson_label}</>}
                                  </div>
                                )}
                              </>
                            ) : (
                              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                                {viewerRole === 'student' ? (s.teacher?.full_name || '') : (s.class_group?.name || 'Individual')}
                              </div>
                            )}
                            {s.room && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{s.room}</div>}
                          </div>
                        ) : (
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
