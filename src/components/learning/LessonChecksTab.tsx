'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import EmptyState from '@/components/EmptyState'
import {
  MAX_CHECK_QUESTIONS, MAX_OPTIONS, MIN_OPTIONS, draftFromQuestion, draftToRow, emptyDraft, validateDraft,
  type CheckKind, type CheckQuestion, type QuestionDraft,
} from '@/lib/learningChecks'
import type { LessonRow } from '@/lib/learning'

const KIND_LABEL: Record<CheckKind, string> = { multiple_choice: 'Multiple choice', numeric: 'Number' }
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']

// Where a teacher writes the short questions students answer after the lesson. They are marked
// automatically; students only see the right answers once they have submitted.
export default function LessonChecksTab({ lesson }: { lesson: LessonRow }) {
  const [questions, setQuestions] = useState<CheckQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  // editing.id === null means a brand new question
  const [editing, setEditing] = useState<{ id: string | null; draft: QuestionDraft } | null>(null)
  const [formError, setFormError] = useState('')
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data, error: e } = await supabase
        .from('learning_check_questions')
        .select('id, lesson_id, position, kind, prompt, options, correct_index, correct_number, tolerance, explanation')
        .eq('lesson_id', lesson.id)
        .order('position').order('created_at')
      if (cancelled) return
      if (e) setError('Could not load the questions. Please try again.')
      else { setQuestions((data as CheckQuestion[]) || []); setError('') }
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [lesson.id, reload])

  const refresh = useCallback(() => setReload((n) => n + 1), [])
  const full = questions.length >= MAX_CHECK_QUESTIONS

  function startNew(kind: CheckKind) {
    setEditing({ id: null, draft: emptyDraft(kind) }); setFormError(''); setNotice('')
  }

  function patch(p: Partial<QuestionDraft>) {
    setEditing((cur) => (cur ? { ...cur, draft: { ...cur.draft, ...p } } : cur)); setFormError('')
  }

  async function save() {
    if (!editing) return
    const problem = validateDraft(editing.draft)
    if (problem) { setFormError(problem); return }
    setBusy(true); setFormError('')
    const row = draftToRow(editing.draft)
    const { error: e } = editing.id
      ? await supabase.from('learning_check_questions').update(row).eq('id', editing.id)
      : await supabase.from('learning_check_questions').insert({ ...row, lesson_id: lesson.id, position: Math.min(50, (questions.reduce((m, q) => Math.max(m, q.position), 0)) + 1) })
    setBusy(false)
    if (e) { setFormError(e.message || 'Could not save the question. Please try again.'); return }
    setEditing(null); setNotice('Question saved.'); refresh()
  }

  async function remove(q: CheckQuestion) {
    if (!confirm('Delete this question? Students’ past scores are kept, but the question no longer appears.')) return
    setBusy(true); setNotice('')
    const { error: e } = await supabase.from('learning_check_questions').delete().eq('id', q.id)
    setBusy(false)
    if (e) { setError('Could not delete the question. Please try again.'); return }
    if (editing?.id === q.id) setEditing(null)
    refresh()
  }

  // Swaps a question with its neighbour, then renumbers so positions stay 1, 2, 3...
  async function move(index: number, delta: -1 | 1) {
    const target = index + delta
    if (target < 0 || target >= questions.length) return
    const order = [...questions]
    ;[order[index], order[target]] = [order[target], order[index]]
    setBusy(true); setNotice('')
    let failed = false
    for (let i = 0; i < order.length; i++) {
      if (order[i].position === i + 1) continue
      const { error: e } = await supabase.from('learning_check_questions').update({ position: i + 1 }).eq('id', order[i].id)
      if (e) { failed = true; break }
    }
    setBusy(false)
    if (failed) setError('Could not change the order. Please try again.')
    refresh()
  }

  if (loading) return <div>Loading…</div>

  const d = editing?.draft

  return (
    <div>
      <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text-secondary)' }}>
        Short questions students answer after the lesson. They are marked automatically and students see the right answers only after they submit. Only a student’s first try goes on their record; later tries are practice.
      </p>
      {error && <p className="banner banner-danger" role="alert">{error}</p>}
      {notice && <p className="banner banner-success" role="status">{notice}</p>}
      {lesson.status === 'published' && questions.length > 0 && (
        <p className="banner banner-warning" style={{ fontSize: 13 }}>
          This lesson is published. Students who have already answered keep their scores, even if you change a question.
        </p>
      )}

      {questions.length === 0 && !editing && (
        <EmptyState icon="❓" title="No check questions yet" description="Add a few questions to see how well students understood the lesson." />
      )}

      {questions.map((q, i) => (
        <div key={q.id} className="card" style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontWeight: 700, fontSize: 13 }}>Question {i + 1}</span>
                <span className="badge badge-default">{KIND_LABEL[q.kind]}</span>
              </div>
              <div style={{ fontSize: 14, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{q.prompt}</div>
              {q.kind === 'multiple_choice' ? (
                <ol type="A" style={{ margin: '8px 0 0', paddingLeft: 22, fontSize: 13 }}>
                  {(q.options ?? []).map((o, k) => (
                    <li key={k} style={{ fontWeight: k === q.correct_index ? 700 : 400, color: k === q.correct_index ? 'var(--success)' : undefined }}>
                      {o}{k === q.correct_index ? ' ✓ correct' : ''}
                    </li>
                  ))}
                </ol>
              ) : (
                <div style={{ marginTop: 8, fontSize: 13 }}>
                  Correct answer: <strong>{q.correct_number}</strong>
                  {q.tolerance > 0 ? <span style={{ color: 'var(--text-secondary)' }}> (anything within ±{q.tolerance} is accepted)</span> : null}
                </div>
              )}
              {q.explanation && <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-secondary)' }}>Explanation: {q.explanation}</div>}
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} disabled={busy || i === 0} onClick={() => move(i, -1)} aria-label={`Move question ${i + 1} up`}>↑</button>
              <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} disabled={busy || i === questions.length - 1} onClick={() => move(i, 1)} aria-label={`Move question ${i + 1} down`}>↓</button>
              <button type="button" className="btn btn-secondary" style={{ fontSize: 12 }} disabled={busy} onClick={() => { setEditing({ id: q.id, draft: draftFromQuestion(q) }); setFormError(''); setNotice('') }}>Edit</button>
              <button type="button" className="btn btn-ghost" style={{ fontSize: 12, color: 'var(--danger)' }} disabled={busy} onClick={() => remove(q)}>Delete</button>
            </div>
          </div>
        </div>
      ))}

      {editing && d && (
        <div className="card" style={{ marginBottom: 12, borderColor: 'var(--accent)' }}>
          <p style={{ margin: '0 0 10px', fontWeight: 700, fontSize: 14 }}>{editing.id ? 'Edit question' : `New ${KIND_LABEL[d.kind].toLowerCase()} question`}</p>

          {editing.id === null && (
            <div role="radiogroup" aria-label="Question type" style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              {(['multiple_choice', 'numeric'] as CheckKind[]).map((k) => (
                <button key={k} type="button" role="radio" aria-checked={d.kind === k} className={d.kind === k ? 'btn btn-primary' : 'btn btn-ghost'} style={{ fontSize: 12 }} onClick={() => patch({ kind: k })}>{KIND_LABEL[k]}</button>
              ))}
            </div>
          )}

          <label htmlFor="cq-prompt" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Question</label>
          <textarea id="cq-prompt" value={d.prompt} onChange={(e) => patch({ prompt: e.target.value })} rows={3} style={{ width: '100%', margin: '4px 0 12px' }} placeholder="e.g. What is 10% of $200?" />

          {d.kind === 'multiple_choice' ? (
            <fieldset style={{ border: 'none', padding: 0, margin: '0 0 12px' }}>
              <legend style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', padding: 0, marginBottom: 6 }}>Answers. Tick the correct one.</legend>
              {d.options.map((o, k) => (
                <div key={k} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                  <input type="radio" name="cq-correct" checked={d.correctIndex === k} onChange={() => patch({ correctIndex: k })} aria-label={`Answer ${LETTERS[k]} is correct`} />
                  <span style={{ width: 16, fontWeight: 700, fontSize: 13 }} aria-hidden="true">{LETTERS[k]}</span>
                  <input value={o} onChange={(e) => patch({ options: d.options.map((x, j) => (j === k ? e.target.value : x)) })} aria-label={`Answer ${LETTERS[k]}`} style={{ flex: 1 }} />
                  <button
                    type="button" className="btn btn-ghost" style={{ fontSize: 12 }}
                    disabled={d.options.length <= MIN_OPTIONS}
                    onClick={() => patch({ options: d.options.filter((_, j) => j !== k), correctIndex: d.correctIndex === null ? null : d.correctIndex === k ? null : d.correctIndex > k ? d.correctIndex - 1 : d.correctIndex })}
                    aria-label={`Remove answer ${LETTERS[k]}`}
                  >Remove</button>
                </div>
              ))}
              {d.options.length < MAX_OPTIONS && (
                <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => patch({ options: [...d.options, ''] })}>+ Add an answer</button>
              )}
            </fieldset>
          ) : (
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
              <div>
                <label htmlFor="cq-num" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Correct answer</label>
                <input id="cq-num" inputMode="decimal" value={d.correctNumber} onChange={(e) => patch({ correctNumber: e.target.value })} style={{ width: 160, marginTop: 4 }} placeholder="e.g. 150" />
              </div>
              <div>
                <label htmlFor="cq-tol" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Also accept within ± (optional)</label>
                <input id="cq-tol" inputMode="decimal" value={d.tolerance} onChange={(e) => patch({ tolerance: e.target.value })} style={{ width: 160, marginTop: 4 }} placeholder="e.g. 0.5" />
              </div>
              <p style={{ flex: '1 1 100%', margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>Students type just the number, with no units. Spaces and commas are ignored, so 1,250 and 1250 are the same.</p>
            </div>
          )}

          <label htmlFor="cq-exp" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Explanation (optional, shown after they answer)</label>
          <textarea id="cq-exp" value={d.explanation} onChange={(e) => patch({ explanation: e.target.value })} rows={2} style={{ width: '100%', margin: '4px 0 12px' }} placeholder="e.g. 10% is one tenth, so $200 ÷ 10 = $20." />

          {formError && <p className="banner banner-danger" role="alert" style={{ fontSize: 13 }}>{formError}</p>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save question'}</button>
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => { setEditing(null); setFormError('') }}>Cancel</button>
          </div>
        </div>
      )}

      {!editing && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
          <button type="button" className="btn btn-primary" disabled={full || busy} onClick={() => startNew('multiple_choice')}>+ Multiple choice</button>
          <button type="button" className="btn btn-secondary" disabled={full || busy} onClick={() => startNew('numeric')}>+ Number answer</button>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{questions.length} of {MAX_CHECK_QUESTIONS}{full ? ' (the most a lesson can have)' : ''}</span>
        </div>
      )}
    </div>
  )
}
