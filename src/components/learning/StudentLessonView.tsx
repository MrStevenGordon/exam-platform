'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { jamaicaDate } from '@/lib/attendance'
import { STEP_INFO, STEP_KEYS, dueLabel, paragraphs, subjectIcon, type Resource, type StepKey } from '@/lib/learning'
import { currentUserId } from '@/lib/offline/flashcardsOffline'
import { idbKv } from '@/lib/offline/kv'
import { isNetworkFailure } from '@/lib/offline/network'
import { getLesson, saveLesson } from '@/lib/offline/offlineCache'
import { warmOfflinePages } from '@/lib/offline/serviceWorker'
import { useOnline } from '@/lib/offline/useOnline'
import StudentLessonCheck from '@/components/learning/StudentLessonCheck'
import PlayTopicLink from '@/components/learning/PlayTopicLink'
import StudentTutor from '@/components/learning/StudentTutor'
import { catchupMessage, loadStudentCatchup, type StudentCatchup } from '@/lib/learningCatchup'

type LessonForStudent = {
  id: string
  title: string
  subject: string
  grade: number | null
  teacher_name: string
  due_date: string | null
  key_terms: string
  // Present once migration 061 is applied; null when the lesson has no topic.
  topic?: { name: string; subject: string } | null
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
  const [catchup, setCatchup] = useState<StudentCatchup | undefined>(undefined)
  // Without a connection the lesson is the copy saved on this device when it was last opened. It can be read, not changed.
  const [fromCache, setFromCache] = useState(false)
  const online = useOnline()
  // How many paragraphs of a worked example (the Explain step) are revealed so far — a student
  // works through it one part at a time instead of the whole thing landing at once. Resets on
  // every step change, including coming back to Explain later.
  const [revealCount, setRevealCount] = useState(1)
  const today = jamaicaDate()

  useEffect(() => {
    let cancelled = false
    loadStudentCatchup().then((all) => { if (!cancelled) setCatchup(all[lessonId]) })
    return () => { cancelled = true }
  }, [lessonId])

  // Changing steps always starts a worked example unrevealed again, so this goes together with
  // setStep everywhere it's called rather than as a separate effect keyed off `step`.
  function goToStep(i: number) {
    setStep(i)
    setRevealCount(1)
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data, error: e } = await supabase.rpc('learning_get_lesson', { p_lesson_id: lessonId })
      if (cancelled) return
      const kv = idbKv(); const uid = await currentUserId()
      let l: LessonForStudent | null = null
      if (!e) {
        l = data as LessonForStudent
        if (kv && uid) await saveLesson(kv, uid, lessonId, l)        // keep a copy for reading offline
        warmOfflinePages([`/learning/lesson/${lessonId}`])            // and the page that shows it
      } else if (isNetworkFailure(e) && kv && uid) {
        const cached = await getLesson(kv, uid, lessonId)
        if (cached) { l = cached.lesson as LessonForStudent; setFromCache(true) }
        else { setError('You are offline, and this lesson was not saved on this device. Open it once while you are online to read it offline.'); return }
      } else {
        setError(e.code === '42501' ? 'This lesson is not available to you.' : e.message || 'Could not open this lesson.'); return
      }
      setLesson(l)
      const first = STEP_KEYS.findIndex((k) => !l.steps_done.includes(k))
      goToStep(first === -1 ? 0 : first)
    }
    load()
    return () => { cancelled = true }
  }, [lessonId])

  async function toggle(key: StepKey, done: boolean) {
    if (!lesson || busy) return
    if (!online || fromCache) { setMessage('You are offline. Reconnect to tick off a step; nothing about the lesson can be saved until then.'); return }
    setBusy(true); setMessage('')
    const { data, error: e } = await supabase.rpc('learning_mark_step', { p_lesson_id: lessonId, p_step: key, p_done: done })
    setBusy(false)
    if (e) { setMessage(e.message || 'Could not save that. Please try again.'); return }
    const r = data as { steps_done: StepKey[]; completed_at: string | null }
    const finishedNow = !lesson.completed_at && !!r.completed_at
    setLesson({ ...lesson, steps_done: r.steps_done, completed_at: r.completed_at })
    if (finishedNow) setMessage('You finished the lesson. Well done!')
    else if (done && step < STEP_KEYS.length - 1) goToStep(step + 1)
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
      {(fromCache || !online) && <p className="banner banner-warning" style={{ marginTop: 10, fontSize: 13 }}>You are reading the copy of this lesson saved on this device. You can read it, but ticking off steps and the lesson check need a connection.</p>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
        <div aria-hidden="true" style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--accent-light)', color: 'var(--accent-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0 }}>
          <i className={`ti ${subjectIcon(lesson.subject)}`} />
        </div>
        <p className="portal-page-title" style={{ margin: 0 }}>{lesson.title}</p>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 13, color: 'var(--text-secondary)', margin: '8px 0 12px' }}>
        <span>{lesson.subject}{lesson.grade ? ` · Grade ${lesson.grade}` : ''}</span>
        <span>· {lesson.teacher_name}</span>
        {due && <span style={{ color: due.overdue && !lesson.completed_at ? 'var(--danger)' : undefined, fontWeight: due.overdue && !lesson.completed_at ? 700 : 400 }}>· {due.text}</span>}
      </div>

      {catchup && !lesson.completed_at && (
        <p className="banner banner-warning" role="status" style={{ marginBottom: 12 }}>{catchupMessage(catchup)}</p>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--border)' }} role="progressbar" aria-valuemin={0} aria-valuemax={STEP_KEYS.length} aria-valuenow={lesson.steps_done.length} aria-label="Lesson progress">
          <div style={{ width: `${(lesson.steps_done.length / STEP_KEYS.length) * 100}%`, height: 6, borderRadius: 3, background: 'var(--accent)', transition: 'width 0.4s ease' }} />
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
            onClick={() => { goToStep(i); setMessage('') }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <i className={`ti ${STEP_INFO[s.key].icon}`} aria-hidden="true" />
            {STEP_INFO[s.key].label}
            {lesson.steps_done.includes(s.key) && <i className="ti ti-check lesson-check-in" style={{ color: 'var(--success)' }} aria-label="done" />}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 14 }} className="learning-grid">
        <div key={current.key} className="card lesson-step-fade" style={{ minHeight: 220, position: 'relative', overflow: 'hidden' }} role="tabpanel">
          <i className={`ti ${subjectIcon(lesson.subject)}`} aria-hidden="true" style={{ position: 'absolute', top: -14, right: -14, fontSize: 150, color: 'var(--accent)', opacity: 0.05, pointerEvents: 'none' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, position: 'relative' }}>
            <div aria-hidden="true" style={{ width: 42, height: 42, borderRadius: 11, background: 'var(--accent-light)', color: 'var(--accent-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
              <i className={`ti ${info.icon}`} />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{info.label}</p>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>{info.hint}</p>
            </div>
          </div>
          {(() => {
            const paras = paragraphs(current.text)
            // The worked example (Explain) is read one part at a time instead of landing all at
            // once — reuses the paragraph breaks a teacher already writes with, no new authoring
            // step. Every other lesson step still shows in full immediately.
            const isWorkedExample = current.key === 'explain' && paras.length > 1
            const shown = isWorkedExample ? paras.slice(0, revealCount) : paras
            return (
              <>
                {shown.map((p, i) => (
                  <p key={i} className="lesson-para-in" style={{ margin: '0 0 12px', fontSize: 15, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{p}</p>
                ))}
                {isWorkedExample && revealCount < paras.length && (
                  <button type="button" className="btn btn-secondary" onClick={() => setRevealCount((n) => n + 1)} style={{ marginBottom: 12 }}>
                    Show next part <i className="ti ti-chevron-down" aria-hidden="true" />
                  </button>
                )}
              </>
            )
          })()}
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
            <button type="button" className="btn btn-ghost" onClick={() => { goToStep(Math.max(0, step - 1)); setMessage('') }} style={{ visibility: step === 0 ? 'hidden' : 'visible' }}>&larr; Back</button>
            <div style={{ display: 'flex', gap: 8 }}>
              {isDone
                ? <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => toggle(current.key, false)}>Mark as not done</button>
                : <button type="button" className="btn btn-primary" disabled={busy} onClick={() => toggle(current.key, true)}>{busy ? 'Saving…' : step === STEP_KEYS.length - 1 ? 'Finish lesson' : 'Done, next step'}</button>}
              {isDone && step < STEP_KEYS.length - 1 && <button type="button" className="btn btn-secondary" onClick={() => { goToStep(step + 1); setMessage('') }}>Next step &rarr;</button>}
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
      <StudentLessonCheck lessonId={lessonId} stepsDone={lesson.steps_done.length} stepsTotal={STEP_KEYS.length} topic={lesson.topic ?? null} />
      <StudentTutor lessonId={lessonId} />
      <PlayTopicLink topic={lesson.topic ?? null} />
      <style>{`
        @media (min-width: 820px) { .learning-grid { grid-template-columns: minmax(0, 1fr) 260px !important; align-items: start; } }
        @media (prefers-reduced-motion: no-preference) {
          .lesson-step-fade { animation: lessonStepIn 0.28s ease both; }
          .lesson-para-in { animation: lessonParaIn 0.3s ease both; }
          .lesson-check-in { animation: lessonCheckIn 0.3s ease both; }
        }
        @keyframes lessonStepIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes lessonParaIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes lessonCheckIn { from { opacity: 0; transform: scale(0.5); } to { opacity: 1; transform: scale(1); } }
      `}</style>
    </div>
  )
}
