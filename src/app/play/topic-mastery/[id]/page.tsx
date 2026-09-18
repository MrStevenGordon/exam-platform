'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

type Question = {
  id: string
  order_index: number
  question_type: 'multiple_choice' | 'true_false' | 'fill_blank' | 'short_answer'
  question_text: string
  options: string[] | null
  points: number
  answered: boolean
  answer: string | null
  points_awarded: number | null
  correct_answer: string | null
  explanation: string | null
}

type Session = {
  id: string
  subject: string
  topic: string
  question_count: number
  completed_at: string | null
  score: number | null
  max_score: number | null
}

type Feedback = { correct: boolean; pointsAwarded: number; maxPoints: number; correctAnswer: string; explanation: string | null }

export default function PlayPracticePage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [session, setSession] = useState<Session | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [index, setIndex] = useState(0)
  const [answer, setAnswer] = useState('')
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => { load() }, [id])

  async function load() {
    try {
      const res = await fetch(`/api/play/practice/${id}`)
      if (res.status === 401) { router.push('/play/login'); return }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSession(data.session)
      setQuestions(data.questions)
      const firstOpen = data.questions.findIndex((q: Question) => !q.answered)
      setIndex(firstOpen === -1 ? data.questions.length : firstOpen)
    } catch (err: any) {
      setError(err?.message || 'Something went wrong loading this practice.')
    } finally {
      setLoading(false)
    }
  }

  async function submit(value: string) {
    const q = questions[index]
    if (!value.trim()) { setError('Enter an answer first.'); return }
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(`/api/play/practice/${id}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: q.id, answer: value }),
      })
      const data = await res.json()
      if (res.status === 401) { router.push('/play/login'); return }
      if (!res.ok) throw new Error(data.error)
      setFeedback(data)
      setQuestions((prev) => prev.map((x, i) => (i === index ? { ...x, answered: true, answer: value, points_awarded: data.pointsAwarded, correct_answer: data.correctAnswer, explanation: data.explanation } : x)))
      if (data.completed) setSession((s) => (s ? { ...s, completed_at: new Date().toISOString(), score: data.score, max_score: data.maxScore } : s))
    } catch (err: any) {
      setError(err?.message || 'Something went wrong saving that answer. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  function next() {
    setFeedback(null)
    setAnswer('')
    setError('')
    setIndex((i) => i + 1)
  }

  if (loading) return <div className="page-container">Loading…</div>
  if (!session) {
    return (
      <div className="page-container" style={{ maxWidth: 560 }}>
        <p className="banner banner-danger" role="alert">{error || 'Practice not found.'}</p>
        <Link href="/play/topic-mastery" className="btn btn-secondary">Back to topics</Link>
      </div>
    )
  }

  const total = questions.length
  const finished = index >= total

  if (finished) {
    const score = session.score ?? questions.reduce((n, q) => n + (q.points_awarded ?? 0), 0)
    const max = session.max_score ?? questions.reduce((n, q) => n + q.points, 0)
    const pct = max > 0 ? Math.round((score / max) * 100) : 0
    const color = pct >= 80 ? 'var(--success)' : pct >= 50 ? 'var(--accent)' : 'var(--danger)'
    return (
      <div className="page-container" style={{ maxWidth: 560 }}>
        <p className="portal-page-title" style={{ margin: 0 }}>{session.topic}: round complete</p>
        <div className="card" style={{ margin: '16px 0', textAlign: 'center' }}>
          <div style={{ fontSize: 44, fontWeight: 800, color }}>{pct}%</div>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{score} of {max} points</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {questions.map((q, i) => {
            const right = (q.points_awarded ?? 0) === q.points
            return (
              <div key={q.id} className="card" style={{ padding: '10px 14px' }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{i + 1}. {q.question_text}</div>
                <div style={{ fontSize: 12, marginTop: 4, color: right ? 'var(--success)' : 'var(--danger)' }}>
                  {right ? 'Correct' : `Your answer: ${q.answer ?? '(none)'}. Correct answer: ${q.correct_answer}`}
                </div>
              </div>
            )
          })}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link href="/play/topic-mastery" className="btn btn-primary">Back to topics</Link>
          <Link href="/play/home" className="btn btn-secondary">All games</Link>
        </div>
      </div>
    )
  }

  const q = questions[index]
  const options = q.question_type === 'true_false' ? ['True', 'False'] : q.options || []
  const isChoice = q.question_type === 'multiple_choice' || q.question_type === 'true_false'
  const toValue = (opt: string) => (q.question_type === 'true_false' ? opt.toLowerCase() : opt)

  return (
    <div className="page-container" style={{ maxWidth: 560 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
        <span>{session.topic}</span>
        <span>Question {index + 1} of {total}</span>
      </div>
      <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden', marginBottom: 20 }}>
        <div style={{ height: '100%', width: `${(index / total) * 100}%`, background: 'var(--accent)', transition: 'width 0.3s ease' }} />
      </div>

      <div className="card">
        <p style={{ fontSize: 17, fontWeight: 600, margin: '0 0 4px' }}>{q.question_text}</p>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 16px' }}>{q.points} point{q.points !== 1 ? 's' : ''}</p>

        {error && <p className="banner banner-danger" role="alert" style={{ marginBottom: 12 }}>{error}</p>}

        {isChoice ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {options.map((opt) => {
              const val = toValue(opt)
              const isCorrect = feedback && feedback.correctAnswer.trim().toLowerCase() === val.trim().toLowerCase()
              const isChosen = feedback && (q.answer ?? '').trim().toLowerCase() === val.trim().toLowerCase()
              const style: React.CSSProperties = { textAlign: 'left', justifyContent: 'flex-start' }
              if (feedback && isCorrect) { style.borderColor = 'var(--success)'; style.background = 'var(--success-bg)' }
              else if (feedback && isChosen) { style.borderColor = 'var(--danger)'; style.background = 'var(--danger-bg)' }
              return (
                <button key={opt} disabled={submitting || !!feedback} onClick={() => submit(val)} className="btn btn-secondary" style={style}>
                  {opt}
                </button>
              )
            })}
          </div>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); if (!feedback) submit(answer) }} style={{ display: 'flex', gap: 8 }}>
            <input value={answer} onChange={(e) => setAnswer(e.target.value)} disabled={submitting || !!feedback} aria-label="Your answer" placeholder="Type your answer" style={{ flex: 1 }} autoFocus />
            <button type="submit" disabled={submitting || !!feedback} className="btn btn-primary">Check</button>
          </form>
        )}

        {feedback && (
          <div style={{ marginTop: 16 }}>
            <p style={{ margin: '0 0 4px', fontWeight: 700, color: feedback.correct ? 'var(--success)' : 'var(--danger)' }}>
              {feedback.correct ? `Correct! +${feedback.pointsAwarded}` : `Not quite. The answer is ${feedback.correctAnswer}`}
            </p>
            {feedback.explanation && <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text-secondary)' }}>{feedback.explanation}</p>}
            <button onClick={next} className="btn btn-primary" autoFocus>{index + 1 >= total ? 'See results' : 'Next question'}</button>
          </div>
        )}
      </div>
    </div>
  )
}
