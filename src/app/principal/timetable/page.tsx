'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import EmptyState from '@/components/EmptyState'
import { jamaicaDate, isoWeekday, schoolYear, attendanceError } from '@/lib/attendance'

type Period = { id: string; name: string; start_time: string; end_time: string; order_index: number }
type Section = {
  id: string; subject: string; day_of_week: number; period_id: string; room: string | null
  class_group_id: string | null; teacher_id: string
  teacher: { full_name: string } | null; class_group: { name: string } | null
}

const DAYS = [{ value: 1, label: 'Mon' }, { value: 2, label: 'Tue' }, { value: 3, label: 'Wed' }, { value: 4, label: 'Thu' }, { value: 5, label: 'Fri' }]

const clock = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'pm' : 'am'}`
}

// The whole school's timetable, read-only, by class or by teacher.
export default function PrincipalTimetablePage() {
  const today = jamaicaDate()
  const [periods, setPeriods] = useState<Period[]>([])
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
        const [periodRes, sectionRes] = await Promise.all([
          supabase.from('timetable_periods').select('id, name, start_time, end_time, order_index').eq('academic_year', year).order('order_index'),
          supabase.from('timetable_sections')
            .select('id, subject, day_of_week, period_id, room, class_group_id, teacher_id, teacher:profiles!teacher_id(full_name), class_group:class_groups(name)')
            .eq('academic_year', year),
        ])
        if (periodRes.error) throw periodRes.error
        if (sectionRes.error) throw sectionRes.error
        if (cancelled) return
        setPeriods((periodRes.data as Period[]) || [])
        setSections((sectionRes.data as unknown as Section[]) || [])
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
  const cell = (periodId: string, day: number) => shown.find((s) => s.period_id === periodId && s.day_of_week === day)
  const todayDow = isoWeekday(today)

  if (loading) return <div>Loading…</div>

  return (
    <div>
      <p className="portal-page-title">Timetable</p>
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

          <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '10px', fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>Period</th>
                  {DAYS.map((d) => (
                    <th key={d.value} style={{ textAlign: 'left', padding: '10px', fontSize: 12, textTransform: 'uppercase', borderBottom: '1px solid var(--border)', color: d.value === todayDow ? 'var(--accent-dark)' : 'var(--text-secondary)' }}>
                      {d.label}{d.value === todayDow ? ' · today' : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {periods.map((p) => (
                  <tr key={p.id}>
                    <td style={{ padding: '10px', fontSize: 13, fontWeight: 700, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                      {p.name}<br /><span style={{ fontWeight: 400, color: 'var(--text-secondary)', fontSize: 11 }}>{clock(p.start_time)}–{clock(p.end_time)}</span>
                    </td>
                    {DAYS.map((d) => {
                      const s = cell(p.id, d.value)
                      return (
                        <td key={d.value} style={{ padding: '8px', borderBottom: '1px solid var(--border)', verticalAlign: 'top', background: d.value === todayDow ? 'var(--accent-light)' : undefined }}>
                          {s ? (
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 13 }}>{s.subject}</div>
                              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                                {mode === 'class' ? (s.teacher?.full_name || '') : (s.class_group?.name || 'Subject class')}
                              </div>
                              {s.room && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Room {s.room}</div>}
                            </div>
                          ) : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
