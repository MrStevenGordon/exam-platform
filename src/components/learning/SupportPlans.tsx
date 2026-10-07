'use client'

import { useCallback, useEffect, useState } from 'react'
import { addAction, closePlan, loadCases, schoolToday, updatePlan } from '@/lib/support'
import { ACTION_KINDS, OUTCOMES, caseProgress, kindLabel, outcomeLabel, outcomeSummary, reviewState, type SupportCase } from '@/lib/supportPure'

// The intervention tracker: each support plan with its goal, review date, actions so far, and how the student's results moved since it began.

const sub = { fontSize: 13, color: 'var(--text-secondary)' } as const
const label = { display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 } as const
const dayLabel = (d: string) => new Intl.DateTimeFormat('en-JM', { timeZone: 'UTC', day: 'numeric', month: 'short' }).format(new Date(`${d}T12:00:00Z`))
const TONE = { up: 'banner-success', down: 'banner-warning', same: '', unknown: '' } as const

function PlanCard({ c, onChanged }: { c: SupportCase; onChanged: () => void }) {
  const today = schoolToday()
  const closed = c.status === 'closed'
  const rs = reviewState(c.review_on, today)
  const prog = caseProgress(c)
  const [mode, setMode] = useState<'none' | 'action' | 'edit' | 'close'>('none')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [kind, setKind] = useState<string>(ACTION_KINDS[0].value)
  const [note, setNote] = useState('')
  const [doneOn, setDoneOn] = useState(today)
  const [status, setStatus] = useState<'open' | 'monitoring'>(c.status === 'monitoring' ? 'monitoring' : 'open')
  const [reviewOn, setReviewOn] = useState(c.review_on ?? '')
  const [goal, setGoal] = useState(c.goal)
  const [outcome, setOutcome] = useState<string>('improved')
  const [outcomeNote, setOutcomeNote] = useState('')

  async function run(fn: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setBusy(true); setError('')
    const r = await fn()
    setBusy(false)
    if (!r.ok) { setError(r.error); return }
    setMode('none'); setNote(''); onChanged()
  }

  return (
    <section className="card" style={{ marginTop: 14 }} aria-label={`Support plan for ${c.student}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>{c.student}{c.subject ? `, ${c.subject}` : ', general support'}</h3>
          <p style={{ ...sub, margin: '2px 0 0' }}>{[c.grade ? `Grade ${c.grade}` : null, c.classes.join(', ') || null, `Owner: ${c.owner}`, `Started ${dayLabel(c.opened_at.slice(0, 10))}`].filter(Boolean).join(' · ')}</p>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span className={`badge ${closed ? 'badge-default' : c.status === 'monitoring' ? 'badge-warning' : 'badge-success'}`}>{closed ? 'Finished' : c.status === 'monitoring' ? 'Monitoring' : 'Open'}</span>
          {!closed && rs === 'overdue' && <span className="badge badge-danger">Review overdue</span>}
          {!closed && rs === 'soon' && <span className="badge badge-warning">Review {c.review_on === today ? 'today' : `by ${dayLabel(c.review_on as string)}`}</span>}
          {!closed && rs === 'later' && <span className="badge badge-default">Review {dayLabel(c.review_on as string)}</span>}
        </div>
      </div>

      <p style={{ margin: '12px 0 2px', fontSize: 14 }}><strong>Why:</strong> {c.reason}</p>
      <p style={{ margin: '0 0 10px', fontSize: 14 }}><strong>Goal:</strong> {c.goal}</p>
      <p className={`banner ${TONE[prog.tone]}`} style={{ margin: 0 }}>{prog.text}</p>
      {closed && <p style={{ ...sub, marginTop: 10 }}>Outcome: <strong>{outcomeLabel(c.outcome)}</strong>{c.outcome_note ? `. ${c.outcome_note}` : ''}</p>}

      <div style={{ marginTop: 12 }}>
        <h4 style={{ fontSize: 13, margin: '0 0 4px' }}>What has been done ({c.actions.length})</h4>
        {c.actions.length === 0 ? <p style={{ ...sub, margin: 0 }}>Nothing recorded yet.</p> : (
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {c.actions.map((a) => <li key={a.id} style={{ fontSize: 13, marginBottom: 3, overflowWrap: 'anywhere' }}><strong>{dayLabel(a.done_on)}</strong> · {kindLabel(a.kind)}{a.note ? `: ${a.note}` : ''} <span style={{ color: 'var(--text-muted)' }}>({a.by})</span></li>)}
          </ul>
        )}
      </div>

      {!closed && mode === 'none' && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <button type="button" className="btn btn-primary" onClick={() => setMode('action')}>Record what was done</button>
          {c.can_edit && <button type="button" className="btn btn-secondary" onClick={() => setMode('edit')}>Change goal or review date</button>}
          {c.can_edit && <button type="button" className="btn btn-secondary" onClick={() => setMode('close')}>Finish this plan</button>}
        </div>
      )}

      {mode === 'action' && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
          <label style={label} htmlFor={`k-${c.id}`}>What was done?</label>
          <select id={`k-${c.id}`} value={kind} onChange={(e) => setKind(e.target.value)} style={{ marginBottom: 10 }}>{ACTION_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}</select>
          <label style={label} htmlFor={`n-${c.id}`}>Note (optional)</label>
          <textarea id={`n-${c.id}`} rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} style={{ marginBottom: 10 }} />
          <label style={label} htmlFor={`d-${c.id}`}>Date</label>
          <input id={`d-${c.id}`} type="date" value={doneOn} max={today} onChange={(e) => setDoneOn(e.target.value)} style={{ marginBottom: 10, maxWidth: 200 }} />
          <div style={{ display: 'flex', gap: 8 }}><button type="button" className="btn btn-primary" disabled={busy} onClick={() => run(() => addAction(c.id, kind, note, doneOn))}>{busy ? 'Saving…' : 'Save'}</button><button type="button" className="btn btn-ghost" onClick={() => setMode('none')}>Cancel</button></div>
        </div>
      )}
      {mode === 'edit' && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
          <label style={label} htmlFor={`g-${c.id}`}>Goal</label>
          <textarea id={`g-${c.id}`} rows={2} maxLength={500} value={goal} onChange={(e) => setGoal(e.target.value)} style={{ marginBottom: 10 }} />
          <label style={label} htmlFor={`s-${c.id}`}>Status</label>
          <select id={`s-${c.id}`} value={status} onChange={(e) => setStatus(e.target.value as 'open' | 'monitoring')} style={{ marginBottom: 10 }}>
            <option value="open">Open: actively supporting</option><option value="monitoring">Monitoring: improving, keep an eye on it</option>
          </select>
          <label style={label} htmlFor={`r-${c.id}`}>Review on</label>
          <input id={`r-${c.id}`} type="date" value={reviewOn} min={c.review_on && c.review_on < today ? c.review_on : today} onChange={(e) => setReviewOn(e.target.value)} style={{ marginBottom: 10, maxWidth: 200 }} />
          <div style={{ display: 'flex', gap: 8 }}><button type="button" className="btn btn-primary" disabled={busy} onClick={() => run(() => updatePlan(c.id, status, reviewOn || null, goal))}>{busy ? 'Saving…' : 'Save'}</button><button type="button" className="btn btn-ghost" onClick={() => setMode('none')}>Cancel</button></div>
        </div>
      )}
      {mode === 'close' && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
          <label style={label} htmlFor={`o-${c.id}`}>How did it end?</label>
          <select id={`o-${c.id}`} value={outcome} onChange={(e) => setOutcome(e.target.value)} style={{ marginBottom: 10 }}>{OUTCOMES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
          <label style={label} htmlFor={`on-${c.id}`}>Note (optional)</label>
          <textarea id={`on-${c.id}`} rows={2} maxLength={500} value={outcomeNote} onChange={(e) => setOutcomeNote(e.target.value)} style={{ marginBottom: 10 }} />
          <div style={{ display: 'flex', gap: 8 }}><button type="button" className="btn btn-primary" disabled={busy} onClick={() => run(() => closePlan(c.id, outcome, outcomeNote))}>{busy ? 'Saving…' : 'Finish plan'}</button><button type="button" className="btn btn-ghost" onClick={() => setMode('none')}>Cancel</button></div>
        </div>
      )}
      {error && <p role="alert" className="banner banner-danger" style={{ marginTop: 10 }}>{error}</p>}
    </section>
  )
}

export default function SupportPlans({ scope, reloadKey, onChanged }: { scope: 'active' | 'closed'; reloadKey: number; onChanged: () => void }) {
  const [cases, setCases] = useState<SupportCase[] | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let cancelled = false
    loadCases(scope).then((r) => { if (cancelled) return; if (r.ok) { setCases(r.cases); setError('') } else { setCases([]); setError(r.error) } })
    return () => { cancelled = true }
  }, [scope, reloadKey])
  const changed = useCallback(() => onChanged(), [onChanged])

  if (cases === null) return <p style={{ marginTop: 18 }}>Loading…</p>
  const out = outcomeSummary(cases)
  return (
    <div>
      {error && <p role="alert" className="banner banner-danger" style={{ marginTop: 14 }}>{error}</p>}
      {scope === 'closed' && out.total > 0 && <p style={{ ...sub, marginTop: 14 }}>Finished in the last 6 months: {out.total}. Improved: <strong>{out.improved}</strong>, no change: {out.noChange}, other: {out.other}.</p>}
      {cases.length === 0 && !error && <div className="card" style={{ marginTop: 14 }}><p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)' }}>{scope === 'active' ? 'No open support plans. Start one from the Students tab.' : 'No plans have been finished in the last 6 months.'}</p></div>}
      {cases.map((c) => <PlanCard key={`${c.id}${c.status}${c.actions.length}`} c={c} onChanged={changed} />)}
    </div>
  )
}
