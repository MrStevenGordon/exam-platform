'use client'

import { Suspense, useMemo, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { computeInsight, insightToCsv, questionNote, reasonText, RULES, type Insight, type InsightPayload, type QuestionInsight, type StudentInsight, type SupportReason } from '@/lib/examInsightPure'

// The Insight page for one test or exam: summary cards and three tabs (Questions, Students, Class over time).
// It only shows what examInsightPure.computeInsight worked out; the rules and the wording live there.

const TABS = [
  { key: 'questions', label: 'Questions' },
  { key: 'students', label: 'Students' },
  { key: 'trend', label: 'Class over time' },
] as const
type TabKey = (typeof TABS)[number]['key']

const pctText = (n: number | null) => (n === null ? '–' : `${Math.round(n)}%`)
// A word next to every bar, so it still reads without colour.
const band = (pct: number) => (pct >= 70 ? 'Strong' : pct >= 40 ? 'Mixed' : 'Weak')
const bandColor = (pct: number) => (pct >= 70 ? 'var(--success)' : pct >= 40 ? 'var(--accent)' : 'var(--danger)')
const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s)
const TYPE_LABEL: Record<string, string> = { essay: 'Essay', short_answer: 'Short answer', fill_blank: 'Fill in the blank', true_false: 'True or false', multiple_choice: 'Multiple choice' }

function Bar({ pct, label }: { pct: number; label: string }) {
  return (
    <div role="img" aria-label={label} style={{ height: 8, borderRadius: 4, background: 'var(--border)', overflow: 'hidden', marginTop: 4 }}>
      <div style={{ width: `${Math.max(2, Math.min(100, pct))}%`, height: '100%', background: bandColor(pct), borderRadius: 4 }} />
    </div>
  )
}

function Pill({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'danger' | 'warning' }) {
  const style: CSSProperties = tone === 'danger' ? { background: 'var(--danger-bg)', color: 'var(--danger)' } : tone === 'warning' ? { background: 'var(--warning-bg)', color: 'var(--warning)' } : { background: 'var(--border)', color: 'var(--text-secondary)' }
  return <span style={{ ...style, display: 'inline-block', fontSize: 11, fontWeight: 700, borderRadius: 100, padding: '3px 9px', margin: '2px 4px 2px 0' }}>{children}</span>
}

const reasonTone = (r: SupportReason) => (r.kind === 'below_pass' ? 'danger' : r.kind === 'dropped' ? 'warning' : 'default')

function csvFileName(title: string): string {
  const base = title.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'test'
  return `${base}-insight.csv`
}

export default function InsightScreen({ payload, backHref, backLabel }: { payload: InsightPayload; backHref: string; backLabel: string }) {
  const insight = useMemo(() => computeInsight(payload), [payload])
  return (
    <Suspense fallback={null}>
      <Inner payload={payload} insight={insight} backHref={backHref} backLabel={backLabel} />
    </Suspense>
  )
}

function Inner({ payload, insight, backHref, backLabel }: { payload: InsightPayload; insight: Insight; backHref: string; backLabel: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const active: TabKey = (TABS.find((t) => t.key === searchParams.get('tab'))?.key ?? 'questions') as TabKey
  const { exam } = payload
  const s = insight.summary

  function select(key: TabKey) {
    const next = new URLSearchParams(searchParams.toString())
    next.set('tab', key)
    router.replace(`${pathname}?${next.toString()}`, { scroll: false })
  }
  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!delta) return
    e.preventDefault()
    const target = TABS[(index + delta + TABS.length) % TABS.length]
    select(target.key)
    document.getElementById(`insight-tab-${target.key}`)?.focus()
  }
  function download() {
    const blob = new Blob(['﻿' + insightToCsv(payload, insight)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = csvFileName(exam.title)
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const classNames = exam.classes.map((c) => c.name).join(', ')
  const when = exam.date ? new Date(exam.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : ''
  const delta = s.deltaVsPrevious
  const notes: string[] = []
  if (!s.showPercent) notes.push(`Only ${s.sat} student${s.sat === 1 ? '' : 's'} sat this test, so percentages are hidden. Counts are shown instead.`)
  if (s.waitingForMarking > 0) notes.push(`${s.waitingForMarking} paper${s.waitingForMarking === 1 ? ' is' : 's are'} still waiting for marking and ${s.waitingForMarking === 1 ? 'is' : 'are'} left out of the average and the support list.`)
  if (!exam.sees_all) notes.push('You are seeing the students you teach. Other classes that sat this exam are not shown.')

  return (
    <div className="page-container">
      <Link href={backHref} style={{ color: 'var(--text-secondary)', fontSize: 14 }}>← {backLabel}</Link>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 16, marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="portal-page-title" style={{ margin: 0 }}>{exam.title}</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: '4px 0 0' }}>
            {[exam.subject, classNames, when && `sat ${when}`].filter(Boolean).join(' · ')}
          </p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={download}>Download CSV</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        <div className="stat-card"><div className="stat-card-value">{s.sat} of {s.expected}</div><div className="stat-card-label">Students sat it</div></div>
        <div className="stat-card"><div className="stat-card-value">{s.showPercent ? pctText(s.averagePct) : '–'}</div><div className="stat-card-label">Class average</div></div>
        <div className="stat-card"><div className="stat-card-value">{s.belowPass}</div><div className="stat-card-label">Below the {s.passMark}% pass mark</div></div>
        <div className="stat-card">
          <div className="stat-card-value">{!s.showPercent || delta === null ? '–' : `${delta > 0 ? '+' : delta < 0 ? '−' : ''}${Math.abs(delta)}`}</div>
          <div className="stat-card-label">{!s.showPercent || delta === null ? 'No earlier test to compare' : 'Points against the last test'}</div>
        </div>
      </div>

      {notes.length > 0 && (
        <ul style={{ margin: '14px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {notes.map((n) => <li key={n} style={{ fontSize: 13, color: 'var(--warning)', background: 'var(--warning-bg)', borderRadius: 'var(--radius)', padding: '8px 12px' }}>{n}</li>)}
        </ul>
      )}

      <div role="tablist" aria-label="Insight sections" className="hub-tabs" style={{ marginTop: 18 }}>
        {TABS.map((t, i) => (
          <button key={t.key} id={`insight-tab-${t.key}`} role="tab" type="button" aria-selected={t.key === active} aria-controls="insight-panel"
            tabIndex={t.key === active ? 0 : -1} className="hub-tab" onClick={() => select(t.key)} onKeyDown={(e) => onKeyDown(e, i)}>
            {t.label}
          </button>
        ))}
      </div>

      <div id="insight-panel" role="tabpanel" aria-labelledby={`insight-tab-${active}`}>
        {s.sat === 0
          ? <div className="card" style={{ color: 'var(--text-secondary)' }}>No one has finished this test yet. Insight appears here as soon as papers are submitted.</div>
          : active === 'questions' ? <QuestionsTab payload={payload} insight={insight} />
          : active === 'students' ? <StudentsTab insight={insight} passMark={s.passMark} />
          : <TrendTab insight={insight} />}
      </div>
    </div>
  )
}

// ---------------- Questions ----------------
function gotItText(q: QuestionInsight, showPercent: boolean): string {
  if (q.difficulty === null) return q.waiting > 0 ? 'Waiting to be marked' : 'No answers'
  if (q.metric === 'right') return showPercent ? `${Math.round(q.difficulty * 100)}% (${q.fullMarks} of ${q.graded})` : `${q.fullMarks} of ${q.graded}`
  return showPercent ? `${Math.round(q.difficulty * 100)}% of marks` : 'See Results'
}

function QuestionsTab({ payload, insight }: { payload: InsightPayload; insight: Insight }) {
  const [all, setAll] = useState(false)
  const show = all ? insight.questions : insight.questions.slice(0, 10)
  const showPercent = insight.summary.showPercent
  const worth = insight.questions.filter((q) => q.mostMissed || q.checkQuestion).slice(0, 3)
  const topicsOn = payload.exam.topics_available
  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <div className="card" style={{ flex: '1 1 560px', padding: 0, overflowX: 'auto' }}>
        <div style={{ padding: '16px 18px 4px' }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Questions, hardest first</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Share of students who got full marks. Essays and multi-mark questions show the average share of marks.</div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--text-secondary)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6 }}>
              <th scope="col" style={{ padding: '10px 8px 8px 18px', width: 34 }}>#</th>
              <th scope="col" style={{ padding: '10px 8px 8px' }}>Question</th>
              <th scope="col" style={{ padding: '10px 8px 8px', width: 170 }}>Got it right</th>
              <th scope="col" style={{ padding: '10px 18px 8px 8px', width: 210 }}>Worth knowing</th>
            </tr>
          </thead>
          <tbody>
            {show.map((q) => (
              <tr key={q.id} style={{ borderTop: '1px solid var(--border)', verticalAlign: 'top' }}>
                <td style={{ padding: '12px 8px 12px 18px', fontWeight: 700 }}>{q.number}</td>
                <td style={{ padding: '12px 8px' }}>
                  <div title={q.text}>{clip(q.text, 150)}</div>
                  <div style={{ marginTop: 2 }}>
                    {q.topic && <Pill>{q.topic}</Pill>}
                    {(q.type === 'essay' || q.type === 'short_answer') && <Pill tone="warning">{TYPE_LABEL[q.type]}</Pill>}
                    {q.mostMissed && <Pill tone="danger">Most missed</Pill>}
                    {q.checkQuestion && <Pill tone="warning">Check this question</Pill>}
                  </div>
                </td>
                <td style={{ padding: '12px 8px' }}>
                  <div style={{ fontWeight: 700 }}>{gotItText(q, showPercent)}</div>
                  {showPercent && q.difficulty !== null && (
                    <>
                      <Bar pct={q.difficulty * 100} label={`${Math.round(q.difficulty * 100)} percent`} />
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{band(q.difficulty * 100)}</div>
                    </>
                  )}
                  {q.waiting > 0 && q.difficulty !== null && <div style={{ fontSize: 11, color: 'var(--warning)', marginTop: 2 }}>{q.waiting} waiting to be marked</div>}
                </td>
                <td style={{ padding: '12px 18px 12px 8px', fontSize: 12, color: 'var(--text-secondary)' }}>
                  {questionNote(q)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {insight.questions.length > 10 && (
          <div style={{ padding: '10px 18px 14px' }}>
            <button type="button" className="btn btn-ghost" onClick={() => setAll((v) => !v)}>{all ? 'Show fewer questions' : `Show all ${insight.questions.length} questions`}</button>
          </div>
        )}
      </div>

      <div style={{ flex: '0 1 300px', minWidth: 260, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 8 }}>By topic</div>
          {!topicsOn && <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>Topic scores are not set up for this school yet.</p>}
          {topicsOn && insight.topics.length === 0 && <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>None of the questions on this test has a topic, so there are no topic scores. Add a topic when you write a question and it will appear here.</p>}
          {topicsOn && showPercent && insight.topics.map((t) => (
            <div key={t.key} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span>{t.name}</span><strong>{Math.round(t.pct)}%</strong></div>
              <Bar pct={t.pct} label={`${t.name}: ${Math.round(t.pct)} percent`} />
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{band(t.pct)} · {t.questions} question{t.questions === 1 ? '' : 's'}</div>
            </div>
          ))}
          {topicsOn && insight.topics.length > 0 && insight.untaggedQuestions > 0 && (
            <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '4px 0 0' }}>{insight.untaggedQuestions} question{insight.untaggedQuestions === 1 ? ' has' : 's have'} no topic, so {insight.untaggedQuestions === 1 ? 'it is' : 'they are'} left out.</p>
          )}
        </div>
        {worth.length > 0 && (
          <div className="card" style={{ background: 'var(--accent-light)' }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Worth a look</div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.5 }}>
              {worth.map((q) => (
                <li key={q.id}>
                  Question {q.number} {q.checkQuestion ? 'may have a problem with the key or the wording.' : 'was missed by most students.'}
                  {q.wrongAnswer ? ` ${q.wrongAnswer.n} chose the same wrong answer (${q.wrongAnswer.text}).` : ''}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------- Students ----------------
function StudentsTab({ insight, passMark }: { insight: Insight; passMark: number }) {
  const [allSupport, setAllSupport] = useState(false)
  const [everyone, setEveryone] = useState(false)
  const list = allSupport ? insight.support : insight.support.slice(0, 10)
  const waiting = insight.students.filter((x) => x.waitingForMarking)
  const showPercent = insight.summary.showPercent
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <div style={{ padding: '16px 18px 4px', display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Students who may need support ({insight.support.length})</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>You decide. This list is a prompt, not a verdict.</div>
        </div>
        {insight.support.length === 0 ? (
          <p style={{ padding: '8px 18px 18px', margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>No one stands out on the rules below. That is good news.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--text-secondary)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                <th scope="col" style={{ padding: '10px 8px 8px 18px' }}>Student</th>
                <th scope="col" style={{ padding: '10px 8px 8px', width: 80 }}>Score</th>
                <th scope="col" style={{ padding: '10px 8px 8px' }}>Why they are listed</th>
                <th scope="col" style={{ padding: '10px 18px 8px 8px', width: 170 }}>Earlier tests, then this one</th>
              </tr>
            </thead>
            <tbody>
              {list.map((x) => <SupportRow key={x.id} x={x} showPercent={showPercent} />)}
            </tbody>
          </table>
        )}
        {insight.support.length > 10 && (
          <div style={{ padding: '10px 18px 14px' }}>
            <button type="button" className="btn btn-ghost" onClick={() => setAllSupport((v) => !v)}>{allSupport ? 'Show fewer' : `Show all ${insight.support.length}`}</button>
          </div>
        )}
        <p style={{ margin: 0, padding: '0 18px 16px', fontSize: 12, color: 'var(--text-secondary)' }}>
          Listed when a student is below the pass mark ({passMark}%), {RULES.dropPoints} or more points under their own average on at least {RULES.minEarlierTests} earlier tests in this subject, did not sit the test,
          or scored under {Math.round(RULES.weakTopicBelow * 100)}% on a topic with at least {RULES.weakTopicMinQuestions} questions.
        </p>
      </div>

      {waiting.length > 0 && (
        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Waiting for marking ({waiting.length})</div>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>{waiting.map((w) => w.name).join(', ')}. They are not judged until their papers are fully marked.</p>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <div style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 700 }}>Everyone ({insight.students.length})</div>
          <button type="button" className="btn btn-ghost" onClick={() => setEveryone((v) => !v)} aria-expanded={everyone}>{everyone ? 'Hide' : 'Show'}</button>
        </div>
        {everyone && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--text-secondary)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                <th scope="col" style={{ padding: '8px 8px 8px 18px' }}>Student</th>
                <th scope="col" style={{ padding: '8px' }}>Class</th>
                <th scope="col" style={{ padding: '8px' }}>Status</th>
                <th scope="col" style={{ padding: '8px 18px 8px 8px' }}>Score</th>
              </tr>
            </thead>
            <tbody>
              {insight.students.map((x) => (
                <tr key={x.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 8px 8px 18px' }}>{x.name}{x.number ? <span style={{ color: 'var(--text-muted)' }}> · {x.number}</span> : null}</td>
                  <td style={{ padding: '8px' }}>{x.class ?? ''}</td>
                  <td style={{ padding: '8px' }}>{x.status === 'completed' ? (x.waitingForMarking ? 'Waiting for marking' : 'Sat') : x.status === 'in_progress' ? 'Still sitting' : 'Did not sit'}</td>
                  <td style={{ padding: '8px 18px 8px 8px', fontWeight: 600 }}>{showPercent ? pctText(x.pct) : (x.pct === null ? '–' : 'Marked')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function SupportRow({ x, showPercent }: { x: StudentInsight; showPercent: boolean }) {
  return (
    <tr style={{ borderTop: '1px solid var(--border)', verticalAlign: 'top' }}>
      <td style={{ padding: '12px 8px 12px 18px' }}>
        <div style={{ fontWeight: 700 }}>{x.name}</div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{[x.number, x.class].filter(Boolean).join(' · ')}</div>
      </td>
      <td style={{ padding: '12px 8px', fontWeight: 700 }}>{showPercent ? pctText(x.pct) : x.pct === null ? '–' : 'Marked'}</td>
      <td style={{ padding: '10px 8px' }}>{x.reasons.map((r, i) => <Pill key={i} tone={reasonTone(r)}>{reasonText(r)}</Pill>)}</td>
      <td style={{ padding: '12px 18px 12px 8px', fontVariantNumeric: 'tabular-nums', color: 'var(--text-secondary)' }}>
        {x.earlier.length === 0 ? 'No earlier tests' : [...x.earlier.map((e) => `${Math.round(e.pct)}`), x.pct === null ? '–' : `${Math.round(x.pct)}`].join(' → ')}
      </td>
    </tr>
  )
}

// ---------------- Class over time ----------------
function TrendTab({ insight }: { insight: Insight }) {
  const points = insight.trend
  if (!insight.summary.showPercent) return <div className="card" style={{ color: 'var(--text-secondary)' }}>Too few students sat this test to compare it with earlier ones.</div>
  if (points.length < 2) return <div className="card" style={{ color: 'var(--text-secondary)' }}>There are not enough earlier tests in this subject to show a trend yet. It appears once this class has at least one earlier finished test with {RULES.trendMinStudents} or more of the same students.</div>
  return (
    <div className="card">
      <div style={{ fontWeight: 700, fontSize: 16 }}>Class average, last {points.length} tests</div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>The same students, oldest on the left. Students who did not sit this test are left out.</div>
      <ol style={{ listStyle: 'none', margin: '18px 0 0', padding: 0, display: 'flex', alignItems: 'flex-end', gap: 14, minHeight: 170 }}>
        {points.map((p) => (
          <li key={p.examId} style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{Math.round(p.averagePct)}%</div>
            <div role="img" aria-label={`${p.title}: ${Math.round(p.averagePct)} percent`} style={{ height: Math.max(6, p.averagePct * 1.2), background: p.isThis ? 'var(--accent)' : 'var(--border-strong)', borderRadius: '4px 4px 0 0', marginTop: 4 }} />
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 6, overflowWrap: 'anywhere' }} title={p.title}>{clip(p.title, 28)}{p.isThis ? ' (this test)' : ''}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{new Date(p.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} · {p.students} students</div>
          </li>
        ))}
      </ol>
    </div>
  )
}
