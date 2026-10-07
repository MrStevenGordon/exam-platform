'use client'

import { useEffect, useMemo, useState } from 'react'
import { loadSupport, openPlan, schoolDayPlus, schoolToday } from '@/lib/support'
import { NO_FILTERS, filterRows, planDefaults, reviewState, summarise, supportRows, type Filters, type ReasonKind, type SupportData, type SupportRow } from '@/lib/supportPure'
import SupportPlans from '@/components/learning/SupportPlans'

// Student support for staff. A teacher sees the students in their classes, a head of department their department's, and the principal team and
// school admin every student. Students never see this page, the school average, or any plan.

const sub = { fontSize: 13, color: 'var(--text-secondary)' } as const
const label = { display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 } as const
const KINDS: { value: ReasonKind; label: string }[] = [
  { value: 'below_average', label: 'Below the school average' }, { value: 'low_marks', label: 'Low marks' }, { value: 'falling', label: 'Results falling' },
  { value: 'absent', label: 'Absences' }, { value: 'late', label: 'Late' }, { value: 'lessons', label: 'Lessons not finished' }, { value: 'not_seen', label: 'Not signed in' }, { value: 'asked_help', label: 'Asked for help' },
]
const PAGE = 40

function StartPlan({ row, data, onDone, onCancel }: { row: SupportRow; data: SupportData; onDone: () => void; onCancel: () => void }) {
  const d = planDefaults(row, data)
  const [subject, setSubject] = useState(d.subject)
  const [reason, setReason] = useState(d.reason)
  const [goal, setGoal] = useState(d.goal)
  const [reviewOn, setReviewOn] = useState(schoolDayPlus(14))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function save() {
    setBusy(true); setError('')
    const r = await openPlan({ studentId: row.student.id, subject, reason, goal, reviewOn: reviewOn || null })
    setBusy(false)
    if (!r.ok) { setError(r.error); return }
    onDone()
  }
  const id = row.student.id
  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
      <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>Start a support plan for {row.student.name}</h4>
      <label style={label} htmlFor={`sub-${id}`}>Subject</label>
      <select id={`sub-${id}`} value={subject} onChange={(e) => setSubject(e.target.value)} style={{ marginBottom: 10 }}>
        <option value="">General support (not one subject)</option>
        {[...new Set([...row.student.subjects.map((s) => s.subject), ...(d.subject && !row.student.subjects.some((s) => s.subject === d.subject) ? [d.subject] : [])])].map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <label style={label} htmlFor={`why-${id}`}>Why does this student need support?</label>
      <textarea id={`why-${id}`} rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} style={{ marginBottom: 10 }} />
      <label style={label} htmlFor={`goal-${id}`}>Goal</label>
      <textarea id={`goal-${id}`} rows={2} maxLength={500} value={goal} onChange={(e) => setGoal(e.target.value)} style={{ marginBottom: 10 }} />
      <label style={label} htmlFor={`rev-${id}`}>Review on</label>
      <input id={`rev-${id}`} type="date" value={reviewOn} min={schoolToday()} onChange={(e) => setReviewOn(e.target.value)} style={{ marginBottom: 10, maxWidth: 200 }} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Start plan'}</button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
      {error && <p role="alert" className="banner banner-danger" style={{ marginTop: 10 }}>{error}</p>}
    </div>
  )
}

function StudentRow({ row, data, onPlan }: { row: SupportRow; data: SupportData; onPlan: () => void }) {
  const [starting, setStarting] = useState(false)
  const s = row.student
  const rs = s.plan ? reviewState(s.plan.review_on, schoolToday()) : 'none'
  return (
    <section className="card" style={{ marginTop: 12 }} aria-label={s.name}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>{s.name}</h3>
          <p style={{ ...sub, margin: '2px 0 0' }}>{[s.grade ? `Grade ${s.grade}` : null, s.classes.join(', ') || null].filter(Boolean).join(' · ')}</p>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span className={`badge ${row.level === 'high' ? 'badge-danger' : 'badge-warning'}`}>{row.level === 'high' ? 'High priority' : 'Keep an eye on'}</span>
          {s.plan && <span className="badge badge-success">{s.plan.status === 'monitoring' ? 'Plan: monitoring' : 'Plan: open'}</span>}
          {s.plan && rs === 'overdue' && <span className="badge badge-danger">Review overdue</span>}
        </div>
      </div>
      <ul style={{ margin: '10px 0 0', paddingLeft: 18 }}>
        {row.reasons.length === 0 ? <li style={{ fontSize: 13 }}>Has a support plan.</li> : row.reasons.map((r, i) => <li key={i} style={{ fontSize: 13, marginBottom: 3 }}>{r.text}</li>)}
      </ul>
      {!s.plan && !starting && <div style={{ marginTop: 12 }}><button type="button" className="btn btn-primary" onClick={() => setStarting(true)}>Start a support plan</button></div>}
      {s.plan && <p style={{ ...sub, marginTop: 10 }}>See this plan on the Plans tab.</p>}
      {starting && <StartPlan row={row} data={data} onDone={() => { setStarting(false); onPlan() }} onCancel={() => setStarting(false)} />}
    </section>
  )
}

export default function SupportView({ role }: { role: 'teacher' | 'supervisor' | 'principal' | 'admin' }) {
  const [tab, setTab] = useState<'students' | 'plans' | 'closed'>('students')
  const [data, setData] = useState<SupportData | null>(null)
  const [error, setError] = useState('')
  const [reloads, setReloads] = useState(0)
  const [filters, setFilters] = useState<Filters>(NO_FILTERS)
  const [shown, setShown] = useState(PAGE)

  useEffect(() => {
    let cancelled = false
    loadSupport(60).then((r) => { if (cancelled) return; if (r.ok) { setData(r.data); setError('') } else { setData(null); setError(r.error) } })
    return () => { cancelled = true }
  }, [reloads])
  const reload = () => setReloads((n) => n + 1)

  const rows = useMemo(() => (data ? supportRows(data) : []), [data])
  const filtered = useMemo(() => filterRows(rows, filters), [rows, filters])
  const sum = summarise(rows)
  const grades = [...new Set(rows.map((r) => r.student.grade).filter((g): g is number => g !== null))].sort((a, b) => a - b)
  const classes = [...new Set(rows.flatMap((r) => r.student.classes))].sort()
  const set = (p: Partial<Filters>) => { setFilters({ ...filters, ...p }); setShown(PAGE) }
  const scope = role === 'teacher' ? 'the students in your classes' : role === 'supervisor' ? 'the students taught by your department' : 'every student in the school'
  const tabBtn = (t: typeof tab, text: string) => <button type="button" role="tab" aria-selected={tab === t} className={`btn ${tab === t ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab(t)}>{text}</button>

  return (
    <div className="page-container sentence-case" style={{ maxWidth: 860 }}>
      <h1 className="portal-page-title">Student support</h1>
      <p style={{ ...sub, marginTop: 4 }}>Students who may need extra help, from {scope}: results below the school average or falling, absences, unfinished lessons and requests for help. Only staff see this page. Students never see it, the school average or a support plan.</p>

      <div role="tablist" style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
        {tabBtn('students', 'Students')}{tabBtn('plans', 'Plans')}{tabBtn('closed', 'Finished')}
      </div>

      {error && <p role="alert" className="banner banner-danger" style={{ marginTop: 14 }}>{error}</p>}

      {tab === 'students' && !error && (data === null ? <p style={{ marginTop: 18 }}>Loading…</p> : (
        <>
          <div className="card" style={{ marginTop: 14, display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {([[sum.listed, 'may need support'], [sum.high, 'high priority'], [sum.withoutPlan, 'without a plan'], [sum.withPlan, 'with a plan']] as const).map(([n, t]) => (
              <div key={t}><div style={{ fontSize: 24, fontWeight: 700 }}>{n}</div><div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t}</div></div>
            ))}
            <div style={{ ...sub, flex: '1 1 220px', alignSelf: 'center' }}>
              {data.school_avg !== null ? `School average over the last ${data.days} days: ${Math.round(data.school_avg)}%.` : 'The school average appears once at least 5 students have results.'}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
            <input type="search" aria-label="Search by name" placeholder="Search by name" value={filters.query} onChange={(e) => set({ query: e.target.value })} style={{ flex: '1 1 180px', minWidth: 140 }} />
            {grades.length > 1 && <select aria-label="Grade" value={filters.grade} onChange={(e) => set({ grade: e.target.value })} style={{ width: 'auto' }}><option value="">All grades</option>{grades.map((g) => <option key={g} value={String(g)}>Grade {g}</option>)}</select>}
            {classes.length > 1 && <select aria-label="Class" value={filters.cls} onChange={(e) => set({ cls: e.target.value })} style={{ width: 'auto' }}><option value="">All classes</option>{classes.map((c) => <option key={c} value={c}>{c}</option>)}</select>}
            <select aria-label="Reason" value={filters.kind} onChange={(e) => set({ kind: e.target.value as ReasonKind | '' })} style={{ width: 'auto' }}><option value="">Any reason</option>{KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}</select>
            <select aria-label="Priority" value={filters.level} onChange={(e) => set({ level: e.target.value as Filters['level'] })} style={{ width: 'auto' }}><option value="">Any priority</option><option value="high">High priority</option><option value="watch">Keep an eye on</option></select>
            <select aria-label="Plan" value={filters.plan} onChange={(e) => set({ plan: e.target.value as Filters['plan'] })} style={{ width: 'auto' }}><option value="all">With or without a plan</option><option value="without">Without a plan</option><option value="with">With a plan</option></select>
          </div>

          {rows.length === 0 ? (
            <div className="card" style={{ marginTop: 14 }}><p style={{ margin: 0, fontSize: 14 }}>No students stand out right now. That is good news. This list updates as results, attendance and lessons come in.</p></div>
          ) : filtered.length === 0 ? (
            <div className="card" style={{ marginTop: 14 }}><p style={{ margin: 0, fontSize: 14 }}>No one matches those filters.</p></div>
          ) : (
            <>
              {filtered.slice(0, shown).map((r) => <StudentRow key={r.student.id + (r.student.plan?.id ?? '')} row={r} data={data} onPlan={reload} />)}
              {filtered.length > shown && <div style={{ marginTop: 14 }}><button type="button" className="btn btn-secondary" onClick={() => setShown(shown + PAGE)}>Show {Math.min(PAGE, filtered.length - shown)} more ({filtered.length - shown} left)</button></div>}
            </>
          )}
        </>
      ))}

      {tab === 'plans' && <SupportPlans scope="active" reloadKey={reloads} onChanged={reload} />}
      {tab === 'closed' && <SupportPlans scope="closed" reloadKey={reloads} onChanged={reload} />}
    </div>
  )
}
