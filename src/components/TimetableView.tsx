'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

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

export default function TimetableView({ viewerRole }: { viewerRole: 'teacher' | 'student' }) {
  const [loading, setLoading] = useState(true)
  const [periods, setPeriods] = useState<Period[]>([])
  const [sections, setSections] = useState<Section[]>([])

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
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="page-container">Loading…</div>

  function sectionFor(periodId: string, day: number) {
    return sections.find((s) => s.period_id === periodId && s.day_of_week === day)
  }

  return (
    <div className="page-container">
      <p className="portal-page-title" style={{ margin: 0 }}>My Timetable</p>
      <p className="portal-page-sub" style={{ margin: '4px 0 20px' }}>{currentAcademicYear()}</p>

      {periods.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>No timetable has been set up yet.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>Period</th>
                {DAYS.map((d) => (
                  <th key={d.value} style={{ textAlign: 'left', padding: '8px 10px', fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>{d.label}</th>
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
                    return (
                      <td key={d.value} style={{ padding: '10px', borderBottom: '1px solid var(--border)', verticalAlign: 'top' }}>
                        {s ? (
                          <div style={{ background: 'var(--accent-light)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px' }}>
                            <div style={{ fontWeight: 700, fontSize: 13 }}>{s.subject}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                              {viewerRole === 'student' ? (s.teacher?.full_name || '') : (s.class_group?.name || 'Individual')}
                            </div>
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
