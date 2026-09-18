'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export type QuestionType = 'multiple_choice' | 'true_false' | 'fill_blank' | 'short_answer'
type Status = 'draft' | 'approved' | 'archived'

export type QuestionDraft = {
  subject: string
  topic: string
  questionType: QuestionType
  questionText: string
  options: string[]
  correctAnswer: string
  points: number
  explanation: string
  status: Status
}

export type Facet = { subject: string; topic: string; count: number }

export const TYPE_LABELS: Record<QuestionType, string> = {
  multiple_choice: 'Multiple choice',
  true_false: 'True or false',
  fill_blank: 'Fill in the blank',
  short_answer: 'Short answer',
}

const EMPTY: QuestionDraft = {
  subject: '',
  topic: '',
  questionType: 'multiple_choice',
  questionText: '',
  options: ['', '', '', ''],
  correctAnswer: '',
  points: 1,
  explanation: '',
  status: 'approved',
}

export default function QuestionForm({
  questionId,
  initial,
  facets,
  timesAnswered = 0,
}: {
  questionId?: string
  initial?: Partial<QuestionDraft>
  facets: Facet[]
  timesAnswered?: number
}) {
  const router = useRouter()
  const [q, setQ] = useState<QuestionDraft>({ ...EMPTY, ...initial, options: initial?.options?.length ? initial.options : EMPTY.options })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const errorRef = useRef<HTMLParagraphElement>(null)
  useEffect(() => { if (error) errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }, [error])

  const subjects = useMemo(() => Array.from(new Set(facets.map((f) => f.subject))).sort(), [facets])
  const topics = useMemo(
    () => Array.from(new Set(facets.filter((f) => f.subject.toLowerCase() === q.subject.trim().toLowerCase()).map((f) => f.topic))).sort(),
    [facets, q.subject]
  )

  const set = <K extends keyof QuestionDraft>(key: K, value: QuestionDraft[K]) => setQ((prev) => ({ ...prev, [key]: value }))
  const setOption = (i: number, value: string) => {
    setQ((prev) => {
      const wasCorrect = prev.correctAnswer !== '' && prev.correctAnswer === prev.options[i]
      const options = prev.options.map((o, idx) => (idx === i ? value : o))
      return { ...prev, options, correctAnswer: wasCorrect ? value : prev.correctAnswer }
    })
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const body = {
        subject: q.subject,
        topic: q.topic,
        questionType: q.questionType,
        questionText: q.questionText,
        options: q.questionType === 'multiple_choice' ? q.options : null,
        correctAnswer: q.correctAnswer,
        points: q.points,
        explanation: q.explanation,
        status: q.status,
      }
      const res = await fetch(questionId ? `/api/play/host/questions/${questionId}` : '/api/play/host/questions', {
        method: questionId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.status === 401) { router.push('/play/login'); return }
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error)
      router.push('/play/host/questions')
    } catch (err: any) {
      setError(err?.message || 'Something went wrong saving the question.')
      setSaving(false)
    }
  }

  const label: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: 'var(--text-secondary)' }
  const liveReady = q.questionType === 'multiple_choice' || q.questionType === 'true_false'

  return (
    <form onSubmit={save} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {error && <p ref={errorRef} className="banner banner-danger" role="alert" style={{ margin: 0 }}>{error}</p>}
      {questionId && timesAnswered > 0 && (
        <p className="banner" style={{ margin: 0, fontSize: 13 }}>
          Students have answered this question {timesAnswered} time{timesAnswered !== 1 ? 's' : ''}. Changing the answer will not change past scores.
        </p>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <label style={{ ...label, flex: '1 1 180px' }}>
          Subject
          <input list="play-subjects" value={q.subject} onChange={(e) => set('subject', e.target.value)} required maxLength={60} placeholder="e.g. Mathematics" />
          <datalist id="play-subjects">{subjects.map((s) => <option key={s} value={s} />)}</datalist>
        </label>
        <label style={{ ...label, flex: '1 1 180px' }}>
          Topic
          <input list="play-topics" value={q.topic} onChange={(e) => set('topic', e.target.value)} required maxLength={60} placeholder="e.g. Algebra" />
          <datalist id="play-topics">{topics.map((t) => <option key={t} value={t} />)}</datalist>
        </label>
      </div>

      <label style={label}>
        Question type
        <select value={q.questionType} onChange={(e) => set('questionType', e.target.value as QuestionType)} style={{ maxWidth: 260 }}>
          {(Object.keys(TYPE_LABELS) as QuestionType[]).map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
        </select>
      </label>

      <label style={label}>
        Question
        <textarea value={q.questionText} onChange={(e) => set('questionText', e.target.value)} required maxLength={500} rows={3} placeholder="Type the question students will see" />
      </label>

      {q.questionType === 'multiple_choice' && (
        <fieldset style={{ border: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <legend style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>Answer choices. Select the correct one.</legend>
          {q.options.map((opt, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="radio"
                name="correct"
                aria-label={`Choice ${i + 1} is correct`}
                checked={q.correctAnswer !== '' && q.correctAnswer === opt}
                onChange={() => set('correctAnswer', opt)}
                disabled={!opt.trim()}
                style={{ width: 18, height: 18, flexShrink: 0 }}
              />
              <input value={opt} onChange={(e) => setOption(i, e.target.value)} aria-label={`Choice ${i + 1}`} placeholder={`Choice ${i + 1}`} maxLength={120} style={{ flex: 1 }} />
              {q.options.length > 2 && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: 12, padding: '4px 10px' }}
                  onClick={() => setQ((prev) => ({ ...prev, options: prev.options.filter((_, idx) => idx !== i), correctAnswer: prev.correctAnswer === opt ? '' : prev.correctAnswer }))}
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          {q.options.length < 6 && (
            <div>
              <button type="button" className="btn btn-secondary" style={{ fontSize: 12, padding: '4px 12px' }} onClick={() => set('options', [...q.options, ''])}>Add a choice</button>
            </div>
          )}
        </fieldset>
      )}

      {q.questionType === 'true_false' && (
        <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
          <legend style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>The statement is</legend>
          <div style={{ display: 'flex', gap: 20 }}>
            {['true', 'false'].map((v) => (
              <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 15 }}>
                <input type="radio" name="tf" checked={q.correctAnswer === v} onChange={() => set('correctAnswer', v)} style={{ width: 18, height: 18 }} />
                {v === 'true' ? 'True' : 'False'}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {(q.questionType === 'fill_blank' || q.questionType === 'short_answer') && (
        <label style={label}>
          Correct answer
          <input value={q.correctAnswer} onChange={(e) => set('correctAnswer', e.target.value)} maxLength={100} placeholder="Students must type exactly this (capital letters and extra spaces are ignored)" />
        </label>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <label style={{ ...label, width: 110 }}>
          Points
          <select value={q.points} onChange={(e) => set('points', Number(e.target.value))}>
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <label style={{ ...label, width: 180 }}>
          Status
          <select value={q.status} onChange={(e) => set('status', e.target.value as Status)}>
            <option value="approved">Approved (students can get it)</option>
            <option value="draft">Draft (hidden from students)</option>
            <option value="archived">Archived (hidden)</option>
          </select>
        </label>
      </div>

      <label style={label}>
        Explanation shown after answering (optional)
        <textarea value={q.explanation} onChange={(e) => set('explanation', e.target.value)} maxLength={500} rows={2} placeholder="Why is this the right answer?" />
      </label>

      <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
        {liveReady ? 'This type works in live games, Topic Mastery and Math Duels.' : 'This type works in Topic Mastery and Math Duels. Live games use multiple choice and true or false only.'}
      </p>

      <div style={{ display: 'flex', gap: 10 }}>
        <button type="submit" disabled={saving} className="btn btn-primary">{saving ? 'Saving…' : questionId ? 'Save changes' : 'Add question'}</button>
        <Link href="/play/host/questions" className="btn btn-secondary">Cancel</Link>
      </div>
    </form>
  )
}
