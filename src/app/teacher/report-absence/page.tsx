'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { jamaicaDate, isoWeekday, schoolYear, shiftDate, formatDay } from '@/lib/attendance'
import { substitutionError, notifyUnfilled } from '@/lib/substitution'

type Period = { id: string; name: string; order_index: number }

// One row per distinct class affected anywhere in the chosen range (grouped by
// subject + period + class, not by day) -- a week of leave means picking a
// lesson once per class, not once per day it repeats.
type AffectedGroup = {
  key: string
  subject: string
  periodId: string
  periodName: string
  orderIndex: number
  className: string | null
  dayLabels: string[]
  sectionIds: string[]
}

type LessonOption = { value: string; label: string }

type ResultRow = {
  class_date: string
  section_id: string
  subject: string
  period_name: string
  status: 'assigned' | 'unfilled'
  substitute_name: string | null
}

type SectionRow = {
  id: string
  subject: string
  period_id: string
  day_of_week: number
  timetable_periods: { name: string; order_index: number } | null
  class_groups: { name: string } | null
}

const labelStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }
const fieldStyle: React.CSSProperties = { width: '100%', fontWeight: 400, textTransform: 'none' }

export default function ReportAbsencePage() {
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [periods, setPeriods] = useState<Period[]>([])
  const [lessonOptions, setLessonOptions] = useState<LessonOption[]>([])

  const [fromDate, setFromDate] = useState(jamaicaDate())
  const [toDate, setToDate] = useState(jamaicaDate())
  const [scope, setScope] = useState<'whole' | 'specific'>('whole')
  const [selectedPeriods, setSelectedPeriods] = useState<Set<string>>(new Set())

  const [groups, setGroups] = useState<AffectedGroup[]>([])
  const [groupsLoading, setGroupsLoading] = useState(false)
  const [lessonChoices, setLessonChoices] = useState<Record<string, string>>({}) // group key -> lesson option value

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [results, setResults] = useState<ResultRow[] | null>(null)

  useEffect(() => {
    async function loadBase() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      setUserId(user.id)

      const year = schoolYear(jamaicaDate())
      const [{ data: periodData }, { data: plans }, { data: lessons }] = await Promise.all([
        supabase.from('timetable_periods').select('id, name, order_index').eq('academic_year', year).order('order_index'),
        supabase.from('lesson_plans').select('id, subject, topic').eq('teacher_id', user.id).order('topic'),
        supabase.from('learning_lessons').select('id, title, subject').eq('teacher_id', user.id).eq('status', 'published').order('title'),
      ])
      setPeriods((periodData || []) as Period[])
      const planOptions = (plans || []).map((p: { id: string; subject: string; topic: string }) => ({
        value: `lp:${p.id}`, label: `${p.topic} (${p.subject}, lesson plan)`,
      }))
      const lessonLessonOptions = (lessons || []).map((l: { id: string; title: string; subject: string }) => ({
        value: `ll:${l.id}`, label: `${l.title} (${l.subject}, Smart Learning)`,
      }))
      setLessonOptions([...planOptions, ...lessonLessonOptions])
      setLoading(false)
    }
    loadBase()
  }, [])

  useEffect(() => {
    let cancelled = false
    async function loadAffected() {
      if (!userId || !fromDate || !toDate || toDate < fromDate) { setGroups([]); return }
      setGroupsLoading(true)
      const days = new Set<number>()
      let d = fromDate
      let guard = 0
      while (d <= toDate && guard < 40) {
        days.add(isoWeekday(d))
        d = shiftDate(d, 1)
        guard++
      }
      const year = schoolYear(fromDate)
      const { data } = await supabase
        .from('timetable_sections')
        .select('id, subject, period_id, day_of_week, timetable_periods(name, order_index), class_groups(name)')
        .eq('teacher_id', userId as string)
        .eq('academic_year', year)
        .in('day_of_week', Array.from(days))
      if (cancelled) return

      const dayName = (n: number) => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'][n - 1] || ''
      const byKey = new Map<string, AffectedGroup>()
      for (const row of (data || []) as unknown as SectionRow[]) {
        if (scope === 'specific' && !selectedPeriods.has(row.period_id)) continue
        const key = `${row.subject}|${row.period_id}|${row.class_groups?.name || ''}`
        const existing = byKey.get(key)
        if (existing) {
          if (!existing.dayLabels.includes(dayName(row.day_of_week))) existing.dayLabels.push(dayName(row.day_of_week))
          existing.sectionIds.push(row.id)
        } else {
          byKey.set(key, {
            key,
            subject: row.subject,
            periodId: row.period_id,
            periodName: row.timetable_periods?.name || '',
            orderIndex: row.timetable_periods?.order_index ?? 0,
            className: row.class_groups?.name || null,
            dayLabels: [dayName(row.day_of_week)],
            sectionIds: [row.id],
          })
        }
      }
      const sorted = Array.from(byKey.values()).sort((a, b) => a.orderIndex - b.orderIndex)
      setGroups(sorted)
      setGroupsLoading(false)
    }
    loadAffected()
    return () => { cancelled = true }
  }, [userId, fromDate, toDate, scope, selectedPeriods])

  function togglePeriod(id: string) {
    setSelectedPeriods((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleSubmit() {
    setSubmitError('')
    const missing = groups.find((g) => !lessonChoices[g.key])
    if (missing) {
      setSubmitError(`Pick a lesson for ${missing.subject} (${missing.periodName}).`)
      return
    }
    setSubmitting(true)

    const lessons: Array<{ section_id: string; lesson_plan_id?: string; learning_lesson_id?: string }> = []
    for (const group of groups) {
      const choice = lessonChoices[group.key]
      const [kind, id] = choice.split(':')
      for (const sectionId of group.sectionIds) {
        lessons.push({
          section_id: sectionId,
          ...(kind === 'lp' ? { lesson_plan_id: id } : { learning_lesson_id: id }),
        })
      }
    }

    const { data, error } = await supabase.rpc('submit_teacher_absence', {
      p_start_date: fromDate,
      p_end_date: toDate,
      p_period_ids: scope === 'specific' ? Array.from(selectedPeriods) : null,
      p_lessons: lessons,
    })
    setSubmitting(false)
    if (error) { setSubmitError(substitutionError(error)); return }
    const out = data as unknown as { absence_id?: string; results: ResultRow[] } | null
    const rows = out?.results || []
    setResults(rows)
    if (out?.absence_id && rows.some((r) => r.status === 'unfilled')) notifyUnfilled(out.absence_id)
  }

  function startOver() {
    setResults(null)
    setSubmitError('')
    setLessonChoices({})
  }

  if (loading) return <div className="page-container">Loading…</div>

  if (results) {
    const assignedCount = results.filter((r) => r.status === 'assigned').length
    return (
      <div className="page-container" style={{ maxWidth: 640 }}>
        <h1 className="portal-page-title">Absence reported</h1>
        <p className="portal-page-sub" style={{ marginBottom: 20 }}>
          {assignedCount} of {results.length} periods covered automatically.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {results.map((r, i) => (
            <div
              key={i}
              className="card"
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                borderColor: r.status === 'assigned' ? 'var(--success)' : 'var(--warning)',
                background: r.status === 'assigned' ? 'var(--success-bg)' : 'var(--warning-bg)',
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{formatDay(r.class_date)} · {r.subject} · {r.period_name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                  {r.status === 'assigned'
                    ? `Covered by ${r.substitute_name}`
                    : 'No free teacher found for this period'}
                </div>
              </div>
            </div>
          ))}
        </div>
        <button className="btn btn-secondary" onClick={startOver}>Report another absence</button>
      </div>
    )
  }

  return (
    <div className="page-container" style={{ maxWidth: 640 }}>
      <h1 className="portal-page-title">Report an Absence</h1>
      <p className="portal-page-sub" style={{ marginBottom: 20 }}>
        Pick the dates you will be out. We will find a substitute for each affected class and show you the result right away.
      </p>

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 16 }}>
          <label style={labelStyle}>From<input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} style={fieldStyle} /></label>
          <label style={labelStyle}>To<input type="date" value={toDate} min={fromDate} onChange={(e) => setToDate(e.target.value)} style={fieldStyle} /></label>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ ...labelStyle, marginBottom: 8 }}>Which periods</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: scope === 'specific' ? 10 : 0 }}>
            <button type="button" className={scope === 'whole' ? 'btn btn-primary' : 'btn btn-ghost'} style={{ fontSize: 12 }} onClick={() => setScope('whole')}>Whole day</button>
            <button type="button" className={scope === 'specific' ? 'btn btn-primary' : 'btn btn-ghost'} style={{ fontSize: 12 }} onClick={() => setScope('specific')}>Specific periods</button>
          </div>
          {scope === 'specific' && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {periods.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => togglePeriod(p.id)}
                  className={selectedPeriods.has(p.id) ? 'btn btn-primary' : 'btn btn-ghost'}
                  style={{ fontSize: 11, padding: '4px 10px' }}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <div style={{ ...labelStyle, marginBottom: 8 }}>Affected classes</div>
          {groupsLoading && <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Checking your timetable…</p>}
          {!groupsLoading && groups.length === 0 && (
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>No classes of yours fall in this range.</p>
          )}
          {!groupsLoading && groups.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {groups.map((g) => (
                <div key={g.key} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px' }}>
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{g.subject}{g.className ? ` · ${g.className}` : ''}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{g.periodName} · {g.dayLabels.join(', ')}</div>
                  </div>
                  <select
                    value={lessonChoices[g.key] || ''}
                    onChange={(e) => setLessonChoices((prev) => ({ ...prev, [g.key]: e.target.value }))}
                    style={{ fontSize: 12, padding: '4px 8px', minWidth: 200 }}
                    aria-label={`Lesson for ${g.subject} ${g.periodName}`}
                  >
                    <option value="">Pick a lesson…</option>
                    {lessonOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              ))}
              {lessonOptions.length === 0 && (
                <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  You have no lesson plans or published Smart Learning lessons yet. Create one first so a substitute has something to run.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {submitError && <div className="banner banner-danger" style={{ marginBottom: 16 }}>{submitError}</div>}

      <button className="btn btn-primary" disabled={submitting || groups.length === 0} onClick={handleSubmit}>
        {submitting ? 'Reporting…' : 'Report absence'}
      </button>
    </div>
  )
}
