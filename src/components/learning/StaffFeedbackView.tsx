'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { EMPTY_REFLECTION, loadReport, saveReflection, thisMonday, type Reflection } from '@/lib/classFeedback'
import { addWeeks, adviceFor, classKey, classTitle, groupByClass, PACE_VS_PLAN, reflectionWritten, responseRate, weekLabel, MIN_RESPONSES, type ReportRow } from '@/lib/classFeedbackPure'
import type { Summary } from '@/lib/classFeedbackPrompt'

// Class feedback for the people who teach and oversee. A teacher sees their own classes, a head of department their department's, and the
// principal team and school admin every class (without names, and only once at least 5 students have answered). The page prints cleanly.

const sub = { fontSize: 13, color: 'var(--text-secondary)' } as const
const label = { display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 } as const

function Figure({ name, value, of = 4 }: { name: string; value: number | null; of?: number }) {
  return (
    <div style={{ minWidth: 92 }}>
      <div style={{ fontSize: 22, fontWeight: 700 }}>{value === null ? 'Not shown' : value.toFixed(1)}{value !== null && <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)' }}> / {of}</span>}</div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{name}</div>
    </div>
  )
}

function ReflectionForm({ week, row, onSaved }: { week: string; row: ReportRow; onSaved: () => void }) {
  const r0 = row.reflection
  const [f, setF] = useState<Reflection>(r0 ? { pace_vs_plan: r0.pace_vs_plan, covered: r0.covered ?? '', went_well: r0.went_well ?? '', difficult: r0.difficult ?? '', support_needed: r0.support_needed ?? '', next_steps: r0.next_steps ?? '' } : EMPTY_REFLECTION)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const text = (k: 'covered' | 'went_well' | 'difficult' | 'support_needed' | 'next_steps', q: string) => (
    <div style={{ marginBottom: 10 }}>
      <label style={label} htmlFor={`${k}-${classKey(row)}`}>{q}</label>
      <textarea id={`${k}-${classKey(row)}`} rows={2} maxLength={1000} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
    </div>
  )
  async function save() {
    setSaving(true); setMsg(null)
    const res = await saveReflection(week, row, f)
    setSaving(false)
    if (!res.ok) { setMsg({ ok: false, text: res.error }); return }
    setMsg({ ok: true, text: 'Reflection saved.' }); setOpen(false); onSaved()
  }
  if (!open) {
    return (
      <div className="no-print" style={{ marginTop: 12 }}>
        <button type="button" className="btn btn-secondary" onClick={() => { setOpen(true); setMsg(null) }}>{reflectionWritten(row) ? 'Edit my reflection' : 'Write my end-of-week reflection'}</button>
        {msg && <p role="status" className="banner banner-success" style={{ marginTop: 10 }}>{msg.text}</p>}
      </div>
    )
  }
  return (
    <div className="no-print" style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
      <h3 style={{ fontSize: 15, margin: '0 0 10px' }}>My end-of-week reflection</h3>
      <fieldset style={{ border: 'none', padding: 0, margin: '0 0 10px' }}>
        <legend style={label}>Where are you against your plan?</legend>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {PACE_VS_PLAN.map((o) => <button key={o.value} type="button" aria-pressed={f.pace_vs_plan === o.value} className={`btn ${f.pace_vs_plan === o.value ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setF({ ...f, pace_vs_plan: f.pace_vs_plan === o.value ? null : o.value })}>{o.label}</button>)}
        </div>
      </fieldset>
      {text('covered', 'What did you cover this week?')}
      {text('went_well', 'What went well?')}
      {text('difficult', 'What was difficult for the class?')}
      {text('support_needed', 'What support do you need, or which students need support?')}
      {text('next_steps', 'What will you do next week?')}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-primary" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save reflection'}</button>
        <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
      </div>
      {msg && <p role="alert" className={`banner ${msg.ok ? 'banner-success' : 'banner-danger'}`} style={{ marginTop: 10 }}>{msg.text}</p>}
    </div>
  )
}

function Words({ title, items }: { title: string; items: string[] | null }) {
  if (!items || items.length === 0) return null
  return (
    <div style={{ marginTop: 12 }}>
      <h4 style={{ fontSize: 13, margin: '0 0 4px' }}>{title}</h4>
      <ul style={{ margin: 0, paddingLeft: 18 }}>{items.map((x, i) => <li key={i} style={{ fontSize: 13, marginBottom: 3, overflowWrap: 'anywhere' }}>{x}</li>)}</ul>
    </div>
  )
}

function SummaryBox({ week, row }: { week: string; row: ReportRow }) {
  const [busy, setBusy] = useState(false)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [error, setError] = useState('')
  async function run() {
    setBusy(true); setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/class-feedback/summary', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ week, teacherId: row.teacher_id, subject: row.subject, classGroupId: row.class_group_id, accessToken: session?.access_token ?? '' }) })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) setError(body.error || 'Could not write the summary. Please try again.')
      else setSummary(body.summary as Summary)
    } catch { setError('Could not reach the server. Check your connection and try again.') }
    setBusy(false)
  }
  return (
    <div style={{ marginTop: 14 }}>
      {!summary && <button type="button" className="btn btn-secondary no-print" disabled={busy} onClick={run}>{busy ? 'Writing…' : 'Write a progress summary with AI'}</button>}
      {error && <p role="alert" className="banner banner-danger" style={{ marginTop: 10 }}>{error}</p>}
      {summary && (
        <div style={{ background: 'var(--bg-secondary, transparent)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 14 }}>
          <h4 style={{ margin: '0 0 6px', fontSize: 14 }}>Progress summary <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(AI draft, please check it)</span></h4>
          <p style={{ margin: 0, fontSize: 14 }}>{summary.overview}</p>
          <Words title="Going well" items={summary.going_well} />
          <Words title="To watch" items={summary.concerns} />
          <Words title="Next week" items={summary.next_steps} />
          <button type="button" className="btn btn-ghost no-print" style={{ marginTop: 8 }} onClick={() => setSummary(null)}>Remove summary</button>
        </div>
      )}
    </div>
  )
}

function ClassCard({ week, row, previous, canReflect, onSaved }: { week: string; row: ReportRow; previous: ReportRow | null; canReflect: boolean; onSaved: () => void }) {
  const rate = responseRate(row)
  const advice = adviceFor(row, previous)
  const r = row.reflection
  const tone = { concern: 'banner-warning', good: 'banner-success', info: '' } as const
  return (
    <section className="card class-report" style={{ marginTop: 14 }} aria-label={classTitle(row)}>
      <h2 style={{ margin: 0, fontSize: 17 }}>{classTitle(row)}</h2>
      <p style={{ ...sub, margin: '2px 0 12px' }}>{row.teacher_name} · {weekLabel(week)}</p>

      <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 92 }}><div style={{ fontSize: 22, fontWeight: 700 }}>{row.responded}<span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)' }}> of {row.enrolled}</span></div><div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>answered{rate !== null ? ` (${rate}%)` : ''}</div></div>
        <Figure name="understood" value={row.understanding_avg} />
        <Figure name="involved" value={row.engagement_avg} />
        <Figure name="clear explanations" value={row.clarity_avg} />
        <Figure name="able to ask for help" value={row.support_avg} />
      </div>
      {row.hidden && <p style={{ ...sub, marginTop: 10 }}>Fewer than {MIN_RESPONSES} students have answered, so the figures are kept private to protect them.</p>}
      {row.pace && (row.pace.too_slow + row.pace.just_right + row.pace.too_fast) > 0 && (
        <p style={{ ...sub, marginTop: 10 }}>Pace: {row.pace.too_slow} too slow, {row.pace.just_right} just right, {row.pace.too_fast} too fast.</p>
      )}

      {advice.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
          {advice.map((a, i) => <p key={i} className={`banner ${tone[a.tone]}`} style={{ margin: 0 }}>{a.text}</p>)}
        </div>
      )}

      {row.hardest_topics && row.hardest_topics.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <h4 style={{ fontSize: 13, margin: '0 0 4px' }}>Hardest topics named</h4>
          <p style={{ margin: 0, fontSize: 13 }}>{row.hardest_topics.map((t) => `${t.topic} (${t.count})`).join(', ')}</p>
        </div>
      )}
      {row.needs_attention && row.needs_attention.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <h4 style={{ fontSize: 13, margin: '0 0 4px' }}>Students who may need help</h4>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {row.needs_attention.map((s) => <li key={s.student_id} style={{ fontSize: 13, marginBottom: 3 }}>{s.name}: understood {['not at all', 'a little', 'mostly', 'very well'][s.understanding - 1]}{s.needs_help ? ', asked for help' : ''}{s.topic ? `, hardest: ${s.topic}` : ''}</li>)}
          </ul>
        </div>
      )}
      <Words title="What helped students" items={row.helped} />
      <Words title="What students would change" items={row.improve} />
      {row.lessons_taught && row.lessons_taught.length > 0 && <p style={{ ...sub, marginTop: 12 }}>Lessons taught: {row.lessons_taught.join('; ')}</p>}

      {r && reflectionWritten(row) && (
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
          <h4 style={{ fontSize: 13, margin: '0 0 6px' }}>Teacher&rsquo;s reflection{r.pace_vs_plan ? ` · ${PACE_VS_PLAN.find((p) => p.value === r.pace_vs_plan)?.label}` : ''}</h4>
          {([['Covered', r.covered], ['Went well', r.went_well], ['Difficult', r.difficult], ['Support needed', r.support_needed], ['Next week', r.next_steps]] as const).filter(([, v]) => v).map(([k, v]) => (
            <p key={k} style={{ margin: '0 0 4px', fontSize: 13, overflowWrap: 'anywhere' }}><strong>{k}:</strong> {v}</p>
          ))}
        </div>
      )}
      {canReflect && <ReflectionForm key={`${week}${classKey(row)}${row.reflection ? 'y' : 'n'}`} week={week} row={row} onSaved={onSaved} />}
      {(row.responded > 0 || reflectionWritten(row)) && <SummaryBox key={`${week}${classKey(row)}`} week={week} row={row} />}
    </section>
  )
}

export default function StaffFeedbackView({ role }: { role: 'teacher' | 'supervisor' | 'principal' | 'admin' }) {
  const current = thisMonday()
  const [week, setWeek] = useState(current)
  const [rows, setRows] = useState<ReportRow[] | null>(null)
  const [error, setError] = useState('')
  const [who, setWho] = useState('')
  const canReflect = role === 'teacher' || role === 'supervisor'

  const [reloads, setReloads] = useState(0)
  const load = useCallback(() => setReloads((n) => n + 1), [])
  useEffect(() => {
    let cancelled = false
    loadReport(addWeeks(current, -11), current).then((r) => {      // up to twelve weeks, so a class's earlier weeks can be compared
      if (cancelled) return
      if (r.ok) { setRows(r.rows); setError('') } else { setRows([]); setError(r.error) }
    })
    return () => { cancelled = true }
  }, [current, reloads])
  useEffect(() => { supabase.auth.getUser().then(({ data: { user } }) => user && supabase.from('profiles').select('full_name').eq('id', user.id).single().then(({ data }) => setWho(data?.full_name ?? ''))) }, [])

  const weekRows = useMemo(() => (rows ?? []).filter((r) => r.week_start === week), [rows, week])
  const previousOf = useMemo(() => {
    const m = new Map<string, ReportRow>()
    for (const r of rows ?? []) if (r.week_start === addWeeks(week, -1)) m.set(classKey(r), r)
    return m
  }, [rows, week])
  const groups = groupByClass(weekRows)
  const weeks = Array.from({ length: 12 }, (_, i) => addWeeks(current, -i))
  const written = weekRows.filter(reflectionWritten).length
  const scope = role === 'teacher' ? 'your classes' : role === 'supervisor' ? 'your department' : 'the whole school'

  return (
    <div className="page-container sentence-case" style={{ maxWidth: 860 }}>
      <h1 className="portal-page-title">Class feedback</h1>
      <p className="no-print" style={{ ...sub, marginTop: 4 }}>
        {canReflect ? 'What students said about each class this week, and your own end-of-week reflection.' : 'What students said about each class.'} Showing {scope}.
        {!canReflect && ` Student names are never shown here, and a class's figures appear only once ${MIN_RESPONSES} students have answered.`}
      </p>
      <p className="print-only" style={{ margin: 0, fontSize: 13 }}>Class progress report · {who} · {weekLabel(week)}</p>

      <div className="no-print" style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 14, flexWrap: 'wrap' }}>
        <label htmlFor="fb-week" style={{ fontSize: 13, fontWeight: 600 }}>Week</label>
        <select id="fb-week" value={week} onChange={(e) => setWeek(e.target.value)} style={{ width: 'auto', minWidth: 220 }}>
          {weeks.map((w) => <option key={w} value={w}>{weekLabel(w)}{w === current ? ' (this week)' : ''}</option>)}
        </select>
        <button type="button" className="btn btn-secondary" onClick={() => window.print()} disabled={groups.length === 0}>Print report</button>
      </div>
      {canReflect && groups.length > 0 && <p className="no-print" style={{ ...sub, marginTop: 10 }}>{written} of {groups.length} reflections written for this week.</p>}

      {error && <p role="alert" className="banner banner-danger" style={{ marginTop: 14 }}>{error}</p>}
      {rows === null ? <p style={{ marginTop: 18 }}>Loading…</p> : groups.length === 0 && !error ? (
        <div className="card" style={{ marginTop: 18 }}><p style={{ margin: 0 }}>No classes were found for this week. Classes appear here once they are on the timetable.</p></div>
      ) : groups.map((g) => <ClassCard key={g.key} week={week} row={g.weeks[0]} previous={previousOf.get(g.key) ?? null} canReflect={canReflect && week >= addWeeks(current, -1)} onSaved={load} />)}
    </div>
  )
}
