'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

// A read-only look at one teacher for school leadership (school admin, principal / vice principal, and heads of
// department for their own department). Everything comes from server-side reports that check who is asking
// (migration 069), so a head of department cannot see another department's teachers and unpublished drafts are never
// shown, only counted. Lesson plans are not part of it (they stay private to their author).

type Overview = {
  id: string; full_name: string; role: string; department_name: string | null; is_active: boolean; last_seen_at: string | null
  subjects: string[]; classes: { name: string; year_grade: string }[]
  live_assessments: number; unpublished_drafts: number; awaiting_marking: number
}
type Assessment = {
  id: string; title: string; exam_kind: string; subject: string; classes: string[]; state: 'upcoming' | 'open' | 'closed'
  available_from: string | null; available_until: string | null; created_at: string
  expected: number; started: number; submitted: number; awaiting: number; average_pct: number | null
}
type Assessments = { unpublished_drafts: number; items: Assessment[] }
type MarkingItem = { kind: 'direct' | 'final'; id: string; title: string; exam_kind: string; subject: string; waiting: number; oldest_waiting_at: string }
type Marking = { awaiting_total: number; oldest_waiting_at: string | null; marked_last_30_days: number; items: MarkingItem[] }

const KIND_LABELS: Record<string, string> = {
  pop_quiz: 'Pop quiz', midterm: 'Mid term', end_of_year: 'End of year', class_test: 'Class test', weekly_test: 'Weekly test',
  assignment: 'Assignment', homework: 'Homework', monthly: 'Monthly exam', end_of_term: 'End of term', group_project: 'Group project',
  final_exam_submission: 'Final exam', final: 'Final exam',
}
const kindLabel = (k: string) => KIND_LABELS[k] || k.replace(/_/g, ' ')
const ROLE_LABELS: Record<string, string> = { teacher: 'Teacher', supervisor: 'HOD' }

function fmtDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : ''
}
function daysAgo(iso: string | null): number | null {
  return iso ? Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)) : null
}
function ago(iso: string | null): string {
  const d = daysAgo(iso)
  if (d === null) return 'never'
  return d === 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`
}

function friendlyError(err: { code?: string; message?: string } | null): string {
  if (!err) return ''
  if (err.code === '42501') return 'You do not have access to this teacher.'
  if (err.code === 'PGRST202' || /Could not find the function/i.test(err.message ?? '')) return 'The teacher view needs a database update (069) that has not been applied yet.'
  return 'Something went wrong loading this page. Please try again.'
}

export default function TeacherOverview({ teacherId, backHref, backLabel }: { teacherId: string; backHref: string; backLabel: string }) {
  const [tab, setTab] = useState<'overview' | 'assessments' | 'marking'>('overview')
  const [overview, setOverview] = useState<Overview | null>(null)
  const [assessments, setAssessments] = useState<Assessments | null>(null)
  const [marking, setMarking] = useState<Marking | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data, error: err } = await supabase.rpc('leadership_teacher_overview', { p_teacher: teacherId })
      if (cancelled) return
      if (err) setError(friendlyError(err)); else setOverview(data as Overview)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [teacherId])

  // The other two tabs are read when first opened.
  useEffect(() => {
    if (!overview) return
    let cancelled = false
    async function loadTab() {
      if (tab === 'assessments' && !assessments) {
        const { data, error: err } = await supabase.rpc('leadership_teacher_assessments', { p_teacher: teacherId })
        if (cancelled) return
        if (err) setError(friendlyError(err)); else setAssessments(data as Assessments)
      }
      if (tab === 'marking' && !marking) {
        const { data, error: err } = await supabase.rpc('leadership_teacher_marking', { p_teacher: teacherId })
        if (cancelled) return
        if (err) setError(friendlyError(err)); else setMarking(data as Marking)
      }
    }
    loadTab()
    return () => { cancelled = true }
  }, [tab, overview, assessments, marking, teacherId])

  if (loading) return <div>Loading…</div>

  return (
    <div>
      <Link href={backHref} style={{ color: 'var(--text-secondary)', fontSize: 14 }}>&larr; {backLabel}</Link>
      {error && <p className="banner banner-danger" role="alert" style={{ marginTop: 16 }}>{error}</p>}
      {overview && (
        <>
          <div className="card" style={{ marginTop: 16 }}>
            <h1 style={{ margin: 0 }}>{overview.full_name}</h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
              {ROLE_LABELS[overview.role] || overview.role}
              {overview.department_name ? ` · ${overview.department_name}` : ''}
              {!overview.is_active && <span className="badge badge-danger" style={{ marginLeft: 8 }}>Deactivated</span>}
            </p>
            <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>Read-only view. Last signed in {overview.last_seen_at ? ago(overview.last_seen_at) : 'not recorded'}.</p>
          </div>

          <nav aria-label="Teacher sections" role="tablist" style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', margin: '16px 0 20px', flexWrap: 'wrap' }}>
            {([['overview', 'Overview'], ['assessments', 'Assessments & homework'], ['marking', `Marking${overview.awaiting_marking ? ` (${overview.awaiting_marking})` : ''}`]] as const).map(([key, label]) => (
              <button
                key={key}
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                style={{ padding: '10px 16px', fontSize: 14, fontWeight: tab === key ? 700 : 500, background: 'transparent', border: 'none', cursor: 'pointer', color: tab === key ? 'var(--accent-dark, var(--text-primary))' : 'var(--text-secondary)', borderBottom: `3px solid ${tab === key ? 'var(--accent)' : 'transparent'}`, marginBottom: -1 }}
              >
                {label}
              </button>
            ))}
          </nav>

          {tab === 'overview' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 16 }}>
                <Stat label="Live assessments" value={overview.live_assessments} note="Published for students" onClick={() => setTab('assessments')} />
                <Stat label="Awaiting marking" value={overview.awaiting_marking} note="Submissions to mark" tone={overview.awaiting_marking > 0 ? 'warning' : undefined} onClick={() => setTab('marking')} />
                <Stat label="Unpublished drafts" value={overview.unpublished_drafts} note="Private, not shown" />
              </div>
              <div className="card" style={{ marginBottom: 12 }}>
                <div className="section-label" style={{ marginBottom: 8 }}>Subjects taught</div>
                {overview.subjects.length === 0 ? <p style={muted}>No subjects assigned yet.</p> : (
                  <div style={chips}>{overview.subjects.map((s) => <span key={s} className="badge badge-default">{s}</span>)}</div>
                )}
              </div>
              <div className="card">
                <div className="section-label" style={{ marginBottom: 8 }}>Classes</div>
                {overview.classes.length === 0 ? <p style={muted}>No classes assigned yet.</p> : (
                  <div style={chips}>{overview.classes.map((c) => <span key={c.name} className="badge badge-default" title={c.year_grade}>{c.name}</span>)}</div>
                )}
              </div>
            </>
          )}

          {tab === 'assessments' && (
            !assessments ? (!error && <div>Loading…</div>) : (
              <>
                <p style={{ ...muted, margin: '0 0 12px' }}>
                  Tests, quizzes, homework and assignments published to students.
                  {assessments.unpublished_drafts > 0 && ` ${assessments.unpublished_drafts} unpublished draft${assessments.unpublished_drafts === 1 ? ' is' : 's are'} private and not shown.`}
                </p>
                {assessments.items.length === 0 ? <div className="card"><p style={muted}>Nothing published yet.</p></div> : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {assessments.items.map((a) => (
                      <div key={a.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                        <div style={{ minWidth: 220, flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 14 }}>
                            {a.title}{' '}
                            <span className={`badge ${a.state === 'open' ? 'badge-success' : a.state === 'upcoming' ? 'badge-warning' : 'badge-default'}`}>
                              {a.state === 'open' ? 'Open' : a.state === 'upcoming' ? 'Opens later' : 'Closed'}
                            </span>
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                            {kindLabel(a.exam_kind)} · {a.subject}{a.classes.length ? ` · ${a.classes.join(', ')}` : ''}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                            {a.available_from ? `Opens ${fmtDate(a.available_from)}` : `Published ${fmtDate(a.created_at)}`}
                            {a.available_until ? ` · ${a.state === 'closed' ? 'closed' : 'due'} ${fmtDate(a.available_until)}` : ''}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', fontSize: 13, alignSelf: 'center' }}>
                          <div><strong>{a.submitted}</strong> of {a.expected} submitted{a.started > a.submitted ? ` · ${a.started - a.submitted} in progress` : ''}</div>
                          {a.awaiting > 0 && <div style={{ color: 'var(--warning)', marginTop: 2 }}>{a.awaiting} awaiting marking</div>}
                          {a.average_pct !== null && <div style={{ color: 'var(--text-secondary)', marginTop: 2 }}>Average {a.average_pct}%</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )
          )}

          {tab === 'marking' && (
            !marking ? (!error && <div>Loading…</div>) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 16 }}>
                  <Stat label="Waiting to be marked" value={marking.awaiting_total} tone={marking.awaiting_total > 0 ? 'warning' : undefined} />
                  <Stat label="Longest wait" value={marking.oldest_waiting_at ? `${daysAgo(marking.oldest_waiting_at)} d` : '—'} note={marking.oldest_waiting_at ? `Since ${fmtDate(marking.oldest_waiting_at)}` : 'Nothing waiting'} tone={(daysAgo(marking.oldest_waiting_at) ?? 0) >= 7 ? 'danger' : undefined} />
                  <Stat label="Answers marked" value={marking.marked_last_30_days} note="Last 30 days" />
                </div>
                {marking.items.length === 0 ? <div className="card"><p style={muted}>Nothing is waiting for this teacher to mark.</p></div> : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {marking.items.map((m) => (
                      <div key={`${m.kind}-${m.id}`} className="card" style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14 }}>{m.title}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{kindLabel(m.exam_kind)} · {m.subject}</div>
                        </div>
                        <div style={{ textAlign: 'right', fontSize: 13, alignSelf: 'center' }}>
                          <div><strong>{m.waiting}</strong> waiting</div>
                          <div style={{ color: (daysAgo(m.oldest_waiting_at) ?? 0) >= 7 ? 'var(--danger)' : 'var(--text-secondary)', marginTop: 2 }}>oldest submitted {ago(m.oldest_waiting_at)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )
          )}
        </>
      )}
    </div>
  )
}

const muted: React.CSSProperties = { fontSize: 13, color: 'var(--text-secondary)', margin: 0 }
const chips: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 6 }

function Stat({ label, value, note, tone, onClick }: { label: string; value: number | string; note?: string; tone?: 'warning' | 'danger'; onClick?: () => void }) {
  const color = tone === 'danger' ? 'var(--danger)' : tone === 'warning' ? 'var(--warning)' : 'var(--text-primary)'
  const body = (
    <>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {note && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{note}</div>}
    </>
  )
  return onClick
    ? <button type="button" onClick={onClick} className="card" style={{ textAlign: 'left', cursor: 'pointer', font: 'inherit', color: 'inherit' }}>{body}</button>
    : <div className="card">{body}</div>
}
