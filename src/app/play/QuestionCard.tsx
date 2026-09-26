'use client'

import { useState } from 'react'

export type PlayQuestion = {
  id: string
  question_type: 'multiple_choice' | 'true_false' | 'fill_blank' | 'short_answer'
  question_text: string
  options: string[] | null
  points: number
}

export type AnswerFeedback = {
  correct: boolean
  pointsAwarded: number
  correctAnswer: string
  explanation: string | null
}

// One question with instant feedback. `submit` performs the server call and
// throws an Error with a user-facing message on failure. Give this component
// a `key` of the question id so its state resets for each question.
export default function QuestionCard({
  question,
  submit,
  onNext,
  nextLabel,
}: {
  question: PlayQuestion
  submit: (value: string) => Promise<AnswerFeedback>
  onNext: () => void
  nextLabel: string
}) {
  const [text, setText] = useState('')
  const [chosen, setChosen] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<AnswerFeedback | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const isChoice = question.question_type === 'multiple_choice' || question.question_type === 'true_false'
  const options = question.question_type === 'true_false' ? ['True', 'False'] : question.options || []
  const toValue = (opt: string) => (question.question_type === 'true_false' ? opt.toLowerCase() : opt)
  const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

  async function handle(value: string) {
    if (!value.trim()) { setError('Enter an answer first.'); return }
    setSubmitting(true)
    setError('')
    setChosen(value)
    try {
      setFeedback(await submit(value))
    } catch (err: any) {
      setError(err?.message || 'Something went wrong saving that answer. Please try again.')
      setChosen(null)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="card">
      <p style={{ fontSize: 17, fontWeight: 600, margin: '0 0 4px' }}>{question.question_text}</p>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 16px' }}>{question.points} point{question.points !== 1 ? 's' : ''}</p>

      {error && <p className="banner banner-danger" role="alert" style={{ marginBottom: 12 }}>{error}</p>}

      {isChoice ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {options.map((opt) => {
            const val = toValue(opt)
            const style: React.CSSProperties = { textAlign: 'left', justifyContent: 'flex-start' }
            if (feedback && same(feedback.correctAnswer, val)) { style.borderColor = 'var(--success)'; style.background = 'var(--success-bg)' }
            else if (feedback && chosen && same(chosen, val)) { style.borderColor = 'var(--danger)'; style.background = 'var(--danger-bg)' }
            return (
              <button key={opt} disabled={submitting || !!feedback} onClick={() => handle(val)} className="btn btn-secondary" style={style}>
                {opt}
              </button>
            )
          })}
        </div>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); if (!feedback) handle(text) }} style={{ display: 'flex', gap: 8 }}>
          <input value={text} onChange={(e) => setText(e.target.value)} disabled={submitting || !!feedback} aria-label="Your answer" placeholder="Type your answer" style={{ flex: 1 }} autoFocus />
          <button type="submit" disabled={submitting || !!feedback} className="btn btn-primary">Check</button>
        </form>
      )}

      {feedback && (
        <div style={{ marginTop: 16 }}>
          <p style={{ margin: '0 0 4px', fontWeight: 700, color: feedback.correct ? 'var(--success)' : 'var(--danger)' }}>
            {feedback.correct ? `Correct! +${feedback.pointsAwarded}` : `Not quite. The answer is ${feedback.correctAnswer}`}
          </p>
          {feedback.explanation && <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text-secondary)' }}>{feedback.explanation}</p>}
          <button onClick={onNext} className="btn btn-primary" autoFocus>{nextLabel}</button>
        </div>
      )}
    </div>
  )
}
