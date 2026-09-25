'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { jamaicaDate } from '@/lib/attendance'
import { STEP_INFO, STEP_KEYS, dueLabel, paragraphs, type Resource, type StepKey } from '@/lib/learning'

type LessonForStudent = {
  id: string
  title: string
  subject: string
  grade: number | null
  teacher_name: string
  due_date: string | null
  key_terms: string
  steps: { key: StepKey; text: string; resources: Resource[] }[]
  steps_done: StepKey[]
  completed_at: string | null
}

const RESOURCE_ICON = { video: 'ti-brand-youtube', file: 'ti-file-download', link: 'ti-external-link' } as const

// A lesson as a student sees it: five steps, the teacher's links, and a way to tick each
// step off. Progress is saved as they go, so they can stop and pick it up later.
export default function StudentLessonView({ lessonId }: { lessonId: string }) {
  const [lesson, setLesson] = useState<LessonForStudent | null>(null)
  const [error, setError] = useState('')
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const today = jamaicaDate()

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data, error: e } = await supabase.rpc('learning_get_lesson', { p_lesson_id: lessonId })
      if (cancelled) return
      if (e) { setError(e.code === '42501' ? 'This lesson is not available to you.' : e.message || 'Could not open this lesson.'); return }
      const l = data as LessonForStudent
      setLesson(l)
      // Pick up at the first step they have not finished.
      const first = STEP_KEYS.findIndex((k) => !l.steps_done.includes(k))
      setStep(first === -1 ? 0 : first)
    }
    load()
    return () => { cancelled = true }
  }, [lessonId])

  async function toggle(key: StepKey, done: boolean) {
    if (!lesson || busy) return
    setBusy(true); setMessage('')
    const { data, error: e } = await supabase.rpc('learning_mark_step', { p_lesson_id: lessonId, p_step: key, p_done: done })
    setBusy(false)
    if (e) { setMessage(e.message || 'Could not save that. Please try again.'); return }
    const r = data as { steps_done: StepKey[]; completed_at: string | null }
    const finishedNow = !lesson.completed_at && !!r.completed_at
    setLesson({ ...lesson, steps_done: r.steps_done, completed_at: r.completed_at })
    if (finishedNow) setMessage('You finished the lesson. Well done!')
    else if (done && step < STEP_KEYS.length - 1) setStep(step + 1)
  }

  if (error) {
    return (
      <div>
        <p className="banner banner-danger" role="alert">{error}</p>
        <Link href="/learning" className="btn btn-secondary">Back to my lessons</Link>
      </div>
    )
  }
  if (!lesson) return <div>Loading…</div>

  const current = lesson.steps[step]
  const info = STEP_INFO[current.key]
  const isDone = lesson.steps_done.includes(current.key)
  const due = dueLabel(lesson.due_date, today)
  const terms = lesson.key_terms.split(/\r?\n/).map((t) => t.trim()).filter(Boolean)

  return (
    <div style={{ maxWidth: 900 }}>
      <Link href="/learning" style={{ color: 'var(--text-secondary)', fontSize: 14 }}>&larr; My lessons</Link>
      <p className="portal-page-title" style={{ marginTop: 8 }}>{lesson.title}</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
        <span>{lesson.subject}{lesson.grade ? ` · Grade ${lesson.grade}` : ''}</span>
        <span>· {lesson.teacher_name}</span>
        {due && <span style={{ color: due.overdue && !lesson.completed_at ? 'var(--danger)' : undefined, fontWeight: due.overdue && !lesson.completed_at ? 700 : 400 }}>· {due.text}</span>}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--border)' }} role="progressbar" aria-valuemin={0} aria-valuemax={STEP_KEYS.length} aria-valuenow={lesson.steps_done.length} aria-label="Lesson progress">
          <div style={{ width: `${(lesson.steps_done.length / STEP_KEYS.length) * 100}%`, height: 6, borderRadius: 3, background: 'var(--accent)' }} />
        </div>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{lesson.steps_done.length} of {STEP_KEYS.length} steps</span>
      </div>

      {lesson.completed_at && (
        <p className="banner banner-success" role="status" style={{ marginBottom: 12 }}>
          {message || 'You have finished this lesson. You can come back to it any time.'}
        </p>
      )}
      {!lesson.completed_at && message && <p className="banner banner-danger" role="alert" style={{ marginBottom: 12 }}>{message}</p>}

      <div role="tablist" aria-label="Lesson steps" className="hub-tabs" style={{ marginBottom: 14 }}>
        {lesson.steps.map((s, i) => (
          <button
            key={s.key}
            role="tab"
            type="button"
            className="hub-tab"
            aria-selected={i === step}
            onClick={() => { setStep(i); setMessage('') }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <i className={`ti ${STEP_INFO[s.key].icon}`} aria-hidden="true" />
            {STEP_INFO[s.key].label}
            {lesson.steps_done.includes(s.key) && <i className="ti ti-check" style={{ color: 'var(--success)' }} aria-label="done" />}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 14 }} className="learning-grid">
        <div className="card" style={{ minHeight: 220 }} role="tabpanel">
          <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--text-muted)' }}>{info.label} · {info.hint}</p>
          {paragraphs(current.text).map((p, i) => (
            <p key={i} style={{ margin: '0 0 12px', fontSize: 15, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{p}</p>
          ))}
          {current.resources.length > 0 && (
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {current.resources.map((r, i) => (
                <a key={i} href={r.url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, textDecoration: 'none', color: 'inherit', fontSize: 14 }}>
                  <i className={`ti ${RESOURCE_ICON[r.kind]}`} style={{ fontSize: 18 }} aria-hidden="true" />
                  <span style={{ flex: 1 }}>{r.title || r.url}</span>
                  <i className="ti ti-arrow-up-right" aria-hidden="true" style={{ color: 'var(--text-muted)' }} />
                </a>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 18 }}>
            <button type="button" className="btn btn-ghost" onClick={() => { setStep(Math.max(0, step - 1)); setMessage('') }} style={{ visibility: step === 0 ? 'hidden' : 'visible' }}>&larr; Back</button>
            <div style={{ display: 'flex', gap: 8 }}>
              {isDone
                ? <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => toggle(current.key, false)}>Mark as not done</button>
                : <button type="button" className="btn btn-primary" disabled={busy} onClick={() => toggle(current.key, true)}>{busy ? 'Saving…' : step === STEP_KEYS.length - 1 ? 'Finish lesson' : 'Done, next step'}</button>}
              {isDone && step < STEP_KEYS.length - 1 && <button type="button" className="btn btn-secondary" onClick={() => { setStep(step + 1); setMessage('') }}>Next step &rarr;</button>}
            </div>
          </div>
        </div>

        {terms.length > 0 && (
          <div className="card">
            <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700 }}>Key formulae and vocabulary</p>
            {terms.map((t, i) => <div key={i} style={{ fontSize: 14, padding: '3px 0' }}>{t}</div>)}
          </div>
        )}
      </div>
      <style>{`@media (min-width: 820px) { .learning-grid { grid-template-columns: minmax(0, 1fr) 260px !important; align-items: start; } }`}</style>
    </div>
  )
}
