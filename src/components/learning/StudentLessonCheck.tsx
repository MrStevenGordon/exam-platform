'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { parseNumber, percent, type CheckOverview, type CheckSubmission } from '@/lib/learningChecks'
import { findTopicFor, isLevel, LEVEL_HELP, LEVEL_LABEL, orderLevels, startingLevel, suggestLevel, type CheckLevel, type Suggestion } from '@/lib/checkLevelsPure'
import { loadMyTopics } from '@/lib/studentTopics'
import { computeTopics } from '@/lib/studentTopicsPure'

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']

// "Check your understanding": a few short questions after the lesson, marked straight away.
// The right answers arrive only after the student submits. Shows nothing if the lesson has no
// questions or the feature is not installed, so it can never get in the way of the lesson.
export default function StudentLessonCheck({ lessonId, stepsDone, stepsTotal, topic = null }: { lessonId: string; stepsDone: number; stepsTotal: number; topic?: { name: string; subject: string } | null }) {
  const [overview, setOverview] = useState<CheckOverview | null>(null)
  const [mode, setMode] = useState<'idle' | 'answering' | 'result'>('idle')
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [result, setResult] = useState<CheckSubmission | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  // Only present when the lesson has more than one level of questions (migration 086).
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null)

  // Loads the questions, for one level when asked. Without migration 086 the level is ignored and nothing changes.
  const load = useCallback(async (level?: CheckLevel) => {
    const { data, error: e } = await supabase.rpc('learning_get_check', level ? { p_lesson_id: lessonId, p_level: level } : { p_lesson_id: lessonId })
    // Not installed, closed, or not available: simply show nothing.
    if (e || !data) { setOverview(null); return }
    setOverview(data as CheckOverview)
  }, [lessonId])

  useEffect(() => {
    let cancelled = false
    async function init() {
      const { data, error: e } = await supabase.rpc('learning_get_check', { p_lesson_id: lessonId })
      if (cancelled) return
      if (e || !data) { setOverview(null); return }
      let ov = data as CheckOverview
      const levels = orderLevels(ov.levels)
      if (levels.length > 1) {
        // Suggest a level from how the student has done on this lesson's topic. If their results cannot be read, the suggestion is core.
        const res = await loadMyTopics()
        const sug = suggestLevel(res.ok ? findTopicFor(computeTopics(res.rows), topic) : null)
        const start = startingLevel(levels, sug.level)
        if (!cancelled) setSuggestion(sug)
        if (start !== ov.level) {
          const again = await supabase.rpc('learning_get_check', { p_lesson_id: lessonId, p_level: start })
          if (!again.error && again.data) ov = again.data as CheckOverview
        }
      }
      if (!cancelled) setOverview(ov)
    }
    init()
    return () => { cancelled = true }
  }, [lessonId, topic?.name, topic?.subject]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!overview || overview.questions.length === 0) return null
  const questions = overview.questions
  const levels = orderLevels(overview.levels)
  const level: CheckLevel | null = isLevel(overview.level) ? overview.level : null
  const total = questions.length
  const answered = questions.filter((q) => (answers[q.id] ?? '').trim() !== '').length
  const numbersOk = questions.every((q) => q.kind !== 'numeric' || (answers[q.id] ?? '') === '' || parseNumber(answers[q.id]) !== null)

  function start() { setAnswers({}); setResult(null); setError(''); setMode('answering') }

  async function submit() {
    if (submitting) return
    if (answered < total) { setError('Answer every question first.'); return }
    if (!numbersOk) { setError('Type numbers only for the number questions, for example 150 or 2.5.'); return }
    setSubmitting(true); setError('')
    const payload: Record<string, number | string> = {}
    for (const q of questions) payload[q.id] = q.kind === 'multiple_choice' ? Number(answers[q.id]) : answers[q.id].trim()
    const { data, error: e } = await supabase.rpc('learning_submit_check', level && levels.length > 1 ? { p_lesson_id: lessonId, p_answers: payload, p_level: level } : { p_lesson_id: lessonId, p_answers: payload })
    setSubmitting(false)
    if (e) { setError(e.message && !/^(JWT|fetch|Failed)/i.test(e.message) ? e.message : 'Could not submit. Please try again.'); return }
    setResult(data as CheckSubmission); setMode('result'); load(level && levels.length > 1 ? level : undefined)
  }

  return (
    <section className="card" style={{ marginTop: 14 }} aria-labelledby="check-title">
      <p id="check-title" style={{ margin: '0 0 2px', fontSize: 15, fontWeight: 700 }}>Check your understanding</p>

      {mode === 'idle' && (
        <div>
          {levels.length > 1 && level && (
            <div style={{ margin: '4px 0 12px' }}>
              <div role="radiogroup" aria-label="Practice level" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {levels.map((l) => (
                  <button key={l} type="button" role="radio" aria-checked={level === l} className={level === l ? 'btn btn-primary' : 'btn btn-ghost'} style={{ fontSize: 13 }}
                    onClick={() => { if (l !== level) { setAnswers({}); load(l) } }}>
                    {LEVEL_LABEL[l]}{suggestion?.level === l ? ' (suggested)' : ''}
                  </button>
                ))}
              </div>
              <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
                {LEVEL_HELP[level]}{suggestion && suggestion.level === level ? ` ${suggestion.reason}` : suggestion ? ` Suggested for you: ${LEVEL_LABEL[suggestion.level]}. ${suggestion.reason}` : ''} You can switch levels any time.
              </p>
            </div>
          )}
          <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--text-secondary)' }}>
            {total} short question{total === 1 ? '' : 's'}, marked straight away.
            {stepsDone < stepsTotal ? ' You can try it now, but it works best after you finish the lesson.' : ''}
          </p>
          {overview.attempts > 0 && overview.first_try_score !== null && (
            <p style={{ margin: '0 0 10px', fontSize: 13 }}>
              Your first try: <strong>{overview.first_try_score} of {overview.first_try_max}</strong>
              {overview.best_score !== null && overview.attempts > 1 ? <> · Best: <strong>{overview.best_score}</strong></> : null}
              {' '}· Tries: {overview.attempts}
            </p>
          )}
          <button type="button" className="btn btn-primary" onClick={start}>{overview.attempts > 0 ? 'Practise again' : 'Start the check'}</button>
        </div>
      )}

      {mode === 'answering' && (
        <form onSubmit={(e) => { e.preventDefault(); submit() }}>
          {levels.length > 1 && level && <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>{LEVEL_LABEL[level]} level</p>}
          {overview.attempts > 0 && <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--text-secondary)' }}>This is practice. Your first score is the one on your record.</p>}
          {questions.map((q, i) => (
            <fieldset key={q.id} style={{ border: 'none', padding: 0, margin: '0 0 16px' }}>
              <legend style={{ fontSize: 14, fontWeight: 600, padding: 0, marginBottom: 8, whiteSpace: 'pre-wrap' }}>{i + 1}. {q.prompt}</legend>
              {q.kind === 'multiple_choice' ? (
                (q.options ?? []).map((o, k) => (
                  <label key={k} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 10px', border: `1px solid ${answers[q.id] === String(k) ? 'var(--accent)' : 'var(--border)'}`, background: answers[q.id] === String(k) ? 'var(--accent-light)' : 'var(--card-bg)', borderRadius: 8, marginBottom: 6, cursor: 'pointer', fontSize: 14 }}>
                    <input type="radio" name={`q-${q.id}`} value={k} checked={answers[q.id] === String(k)} onChange={() => { setAnswers((a) => ({ ...a, [q.id]: String(k) })); setError('') }} style={{ marginTop: 3 }} />
                    <span><strong style={{ marginRight: 6 }}>{LETTERS[k]}</strong>{o}</span>
                  </label>
                ))
              ) : (
                <div>
                  <input
                    inputMode="decimal" value={answers[q.id] ?? ''} aria-label={`Answer to question ${i + 1}`}
                    onChange={(e) => { setAnswers((a) => ({ ...a, [q.id]: e.target.value })); setError('') }}
                    placeholder="Type a number" style={{ width: 200 }} autoComplete="off"
                  />
                  <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-muted)' }}>Just the number, no units.</span>
                </div>
              )}
            </fieldset>
          ))}
          {error && <p className="banner banner-danger" role="alert" style={{ fontSize: 13 }}>{error}</p>}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Checking…' : 'Check my answers'}</button>
            <button type="button" className="btn btn-ghost" disabled={submitting} onClick={() => { setMode('idle'); setError('') }}>Cancel</button>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{answered} of {total} answered</span>
          </div>
        </form>
      )}

      {mode === 'result' && result && (
        <div>
          <div className={`banner ${percent(result.score, result.max) >= 70 ? 'banner-success' : 'banner-warning'}`} role="status" style={{ margin: '8px 0 12px' }}>
            <strong>You got {result.score} of {result.max}.</strong>{' '}
            {result.first_try
              ? 'This was your first try, so it counts toward your record.'
              : `This was practice. Your first try${overview.first_try_score !== null ? ` (${overview.first_try_score} of ${overview.first_try_max})` : ''} is the one on your record.`}
          </div>
          {questions.map((q, i) => {
            const fb = result.results.find((r) => r.question_id === q.id)
            if (!fb) return null
            return (
              <div key={q.id} style={{ padding: '10px 0', borderTop: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <span className={`badge ${fb.correct ? 'badge-success' : 'badge-danger'}`} style={{ flexShrink: 0 }}>{fb.correct ? 'Correct' : 'Not quite'}</span>
                  <span style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'pre-wrap' }}>{i + 1}. {q.prompt}</span>
                </div>
                {!fb.correct && (
                  <div style={{ marginTop: 6, fontSize: 13 }}>
                    Your answer: <strong>{q.kind === 'multiple_choice' ? `${LETTERS[Number(answers[q.id])] ?? ''} ${(q.options ?? [])[Number(answers[q.id])] ?? ''}` : answers[q.id]}</strong>
                    {' · '}Correct answer: <strong>{fb.correct_answer}</strong>
                  </div>
                )}
                {fb.explanation && <div style={{ marginTop: 4, fontSize: 13, color: 'var(--text-secondary)' }}>{fb.explanation}</div>}
              </div>
            )
          })}
          <div style={{ marginTop: 12 }}>
            <button type="button" className="btn btn-secondary" onClick={start}>Practise again</button>{' '}
            <button type="button" className="btn btn-ghost" onClick={() => setMode('idle')}>Done</button>
          </div>
        </div>
      )}
    </section>
  )
}
