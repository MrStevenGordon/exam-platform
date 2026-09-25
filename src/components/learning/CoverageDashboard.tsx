'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import EmptyState from '@/components/EmptyState'
import {
  cellTitle, completionPct, sortedClasses, summarize, toCsv,
  type CoverageData, type CoverageOption,
} from '@/lib/coverage'

type Filter = 'all' | 'gaps' | 'behind'

// Which topics have been taught, to which classes, and how far students got. For heads of
// department (their own subjects), the principal team and school admins (everything).
export default function CoverageDashboard() {
  const [options, setOptions] = useState<CoverageOption[] | null>(null)
  const [installed, setInstalled] = useState(true)
  const [role, setRole] = useState('')
  const [subject, setSubject] = useState('')
  const [grade, setGrade] = useState<number | null>(null)
  const [data, setData] = useState<CoverageData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  // The subjects and years this person may look at.
  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      const [{ data: prof }, res] = await Promise.all([
        user ? supabase.from('profiles').select('role').eq('id', user.id).single() : Promise.resolve({ data: null }),
        supabase.rpc('learning_coverage_subjects'),
      ])
      if (cancelled) return
      setRole((prof as { role?: string } | null)?.role ?? '')
      if (res.error) {
        // Not installed yet (migration 063), or not allowed: say so kindly rather than break.
        setInstalled(res.error.code !== 'PGRST202')
        setError(res.error.code === 'PGRST202' ? '' : 'Could not load the coverage options. Please try again.')
        setOptions([])
        return
      }
      const list = (res.data as CoverageOption[]) || []
      setOptions(list)
      const first = list.find((o) => o.subject === 'Mathematics') ?? list[0]
      if (first) { setSubject(first.subject); setGrade(first.grade) }
    }
    load()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!subject || grade === null) return
    let cancelled = false
    async function load() {
      setLoading(true); setError('')
      const { data: d, error: e } = await supabase.rpc('learning_coverage', { p_subject: subject, p_grade: grade })
      if (cancelled) return
      if (e) { setError('Could not load the coverage. Please try again.'); setData(null) }
      else setData(d as CoverageData)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [subject, grade])

  const subjects = useMemo(() => [...new Set((options ?? []).map((o) => o.subject))], [options])
  const grades = useMemo(() => (options ?? []).filter((o) => o.subject === subject).map((o) => o.grade), [options, subject])
  const classes = useMemo(() => (data ? sortedClasses(data) : []), [data])
  const sum = useMemo(() => (data ? summarize(data) : null), [data])

  function pickSubject(s: string) {
    setSubject(s)
    const g = (options ?? []).filter((o) => o.subject === s).map((o) => o.grade)
    if (!g.includes(grade ?? -1)) setGrade(g[0] ?? null)
  }

  function download() {
    if (!data) return
    const blob = new Blob(['﻿' + toCsv(subject, grade ?? 0, data)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `coverage-${subject.replace(/\W+/g, '-')}-grade-${grade}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (options === null) return <div>Loading…</div>

  if (!installed) {
    return (
      <div>
        <p className="portal-page-title">Curriculum coverage</p>
        <EmptyState icon="📚" title="Coverage isn’t set up yet" description="Your school administrator needs to apply the latest update before this page can show which topics have been taught." />
      </div>
    )
  }

  const topicsLink = role === 'supervisor' ? '/supervisor/topics' : role === 'admin' ? '/school-admin/topics' : null
  if (options.length === 0) {
    return (
      <div>
        <p className="portal-page-title">Curriculum coverage</p>
        {error && <p className="banner banner-danger" role="alert">{error}</p>}
        {!error && (
          <EmptyState
            icon="🗂️"
            title="No topics to measure against yet"
            description="Coverage compares the lessons taught against the school’s topic list. Add the subject’s topics first."
            action={topicsLink ? { label: 'Open the topic list', href: topicsLink } : undefined}
          />
        )}
      </div>
    )
  }

  const visibleTopics = (data?.topics ?? []).filter((t) => {
    if (!sum) return true
    const st = sum.status[t.id]
    return filter === 'all' ? true : filter === 'gaps' ? st === 'none' : st === 'partial'
  })
  // Group by unit, keeping the list's own order.
  const groups: { unit: string; topics: typeof visibleTopics }[] = []
  for (const t of visibleTopics) {
    const unit = t.unit ?? 'Other topics'
    const last = groups[groups.length - 1]
    if (last && last.unit === unit) last.topics.push(t)
    else groups.push({ unit, topics: [t] })
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <p className="portal-page-title" style={{ marginBottom: 2 }}>Curriculum coverage</p>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>Which topics each class has been given a lesson on, and how many students finished.</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={download} disabled={!data || data.topics.length === 0}>Download spreadsheet</button>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '14px 0' }}>
        {subjects.length > 1 ? (
          <select value={subject} onChange={(e) => pickSubject(e.target.value)} aria-label="Subject">{subjects.map((s) => <option key={s} value={s}>{s}</option>)}</select>
        ) : <span className="badge badge-default" style={{ alignSelf: 'center' }}>{subject}</span>}
        <select value={grade ?? ''} onChange={(e) => setGrade(Number(e.target.value))} aria-label="Year">{grades.map((g) => <option key={g} value={g}>Grade {g}</option>)}</select>
        <div role="group" aria-label="Show" style={{ display: 'flex', gap: 4 }}>
          {([['all', 'All topics'], ['gaps', 'Not taught yet'], ['behind', 'Some classes behind']] as [Filter, string][]).map(([f, l]) => (
            <button key={f} type="button" aria-pressed={filter === f} className={filter === f ? 'btn btn-primary' : 'btn btn-ghost'} style={{ fontSize: 12 }} onClick={() => setFilter(f)}>{l}</button>
          ))}
        </div>
      </div>

      {error && <p className="banner banner-danger" role="alert">{error}</p>}
      {loading && !data && <div>Loading…</div>}

      {data && sum && (
        <>
          <div className="stat-grid" style={{ marginBottom: 14, opacity: loading ? 0.6 : 1 }}>
            <div className="stat-card"><div className="stat-card-value">{sum.topicsTotal}</div><div className="stat-card-label">Topics on the list</div></div>
            <div className="stat-card"><div className="stat-card-value">{sum.taughtAny}</div><div className="stat-card-label">Taught to at least one class</div></div>
            <div className="stat-card"><div className="stat-card-value">{sum.taughtAll}</div><div className="stat-card-label">Taught to every class</div></div>
            <div className={`stat-card ${sum.notTaught > 0 ? 'stat-card-accent' : ''}`}><div className="stat-card-value">{sum.notTaught}</div><div className="stat-card-label">Not taught yet</div></div>
          </div>

          {data.unlinked_lessons > 0 && (
            <p className="banner banner-warning" style={{ fontSize: 13 }}>
              {data.unlinked_lessons} lesson{data.unlinked_lessons === 1 ? '' : 's'} for this subject and year {data.unlinked_lessons === 1 ? 'is' : 'are'} not linked to a topic, so {data.unlinked_lessons === 1 ? 'it is' : 'they are'} not counted below. Teachers can pick a topic on the lesson’s Build tab.
            </p>
          )}

          {data.topics.length === 0 ? (
            <EmptyState icon="🗂️" title="No topics for this year yet" description="Add this year’s topics to the topic list to see coverage." action={topicsLink ? { label: 'Open the topic list', href: topicsLink } : undefined} />
          ) : classes.length === 0 ? (
            <EmptyState icon="🏫" title="No classes in this year yet" description="Coverage appears once the year’s classes have been set up." />
          ) : visibleTopics.length === 0 ? (
            <EmptyState icon="✓" title="Nothing to show" description={filter === 'gaps' ? 'Every topic has been taught to at least one class.' : 'No topic has some classes behind others.'} />
          ) : (
            <>
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }} aria-hidden="true">
                <span><span className="badge badge-success">72%</span> given, most students finished</span>
                <span><span className="badge badge-default">25%</span> given, still in progress</span>
                <span><span className="badge badge-warning">Not yet</span> other classes have had it</span>
                <span>— not given to any class</span>
              </div>
              <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ textAlign: 'left', color: 'var(--text-secondary)' }}>
                      <th style={{ padding: '10px 12px', position: 'sticky', left: 0, background: 'var(--card-bg)', minWidth: 200 }}>Topic</th>
                      <th style={{ padding: '10px 8px', whiteSpace: 'nowrap' }}>Classes</th>
                      {classes.map((c) => <th key={c.id} style={{ padding: '10px 8px', textAlign: 'center', whiteSpace: 'nowrap' }} title={`${c.students} student${c.students === 1 ? '' : 's'}`}>{c.name}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((g) => (
                      <UnitRows key={g.unit} unit={g.unit} topics={g.topics} data={data} classes={classes} sum={sum} />
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '2px solid var(--border)', color: 'var(--text-secondary)' }}>
                      <td style={{ padding: '8px 12px', position: 'sticky', left: 0, background: 'var(--card-bg)', fontWeight: 700 }}>Topics given</td>
                      <td />
                      {classes.map((c) => <td key={c.id} style={{ padding: '8px', textAlign: 'center', fontWeight: 600 }}>{sum.perClass[c.id]} of {sum.topicsTotal}</td>)}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

function UnitRows({ unit, topics, data, classes, sum }: { unit: string; topics: CoverageData['topics']; data: CoverageData; classes: ReturnType<typeof sortedClasses>; sum: ReturnType<typeof summarize> }) {
  return (
    <>
      <tr>
        <td colSpan={classes.length + 2} style={{ padding: '8px 12px', background: 'var(--page-bg)', fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>{unit}</td>
      </tr>
      {topics.map((t) => {
        const status = sum.status[t.id]
        const given = sum.classesGiven(t.id)
        return (
          <tr key={t.id} style={{ borderTop: '1px solid var(--border)' }}>
            <td style={{ padding: '8px 12px', position: 'sticky', left: 0, background: 'var(--card-bg)', fontWeight: 600 }}>{t.name}</td>
            <td style={{ padding: '8px', whiteSpace: 'nowrap', color: status === 'none' ? 'var(--danger)' : 'var(--text-secondary)', fontWeight: status === 'none' ? 700 : 400 }}>{given} of {classes.length}</td>
            {classes.map((cls) => {
              const cell = data.cells.find((x) => x.topic_id === t.id && x.class_group_id === cls.id)
              const pct = cell ? completionPct(cell) : null
              return (
                <td key={cls.id} style={{ padding: '6px 8px', textAlign: 'center' }} title={cellTitle(t, cls, cell, status !== 'none')}>
                  {cell ? (
                    <span className={`badge ${pct !== null && pct >= 70 ? 'badge-success' : 'badge-default'}`} aria-label={cellTitle(t, cls, cell, true)}>
                      {pct === null ? `${cell.lessons} given` : `${pct}%`}
                    </span>
                  ) : status === 'partial' ? (
                    <span className="badge badge-warning" aria-label={cellTitle(t, cls, cell, true)}>Not yet</span>
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }} aria-label={cellTitle(t, cls, cell, false)}>—</span>
                  )}
                </td>
              )
            })}
          </tr>
        )
      })}
    </>
  )
}
