'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { gradeAnswer } from '@/lib/grading'

type Question = {
  id: string
  question_type: string
  question_text: string
  points: number
  options: string[] | null
  correct_answer: string | null
  order_index: number
}

export default function TakeExamQuestionsPage() {
  const router = useRouter()
  const params = useParams()
  const examId = params.examId as string

  const [loading, setLoading] = useState(true)
  const [sessionId, setSessionId] = useState('')
  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => { loadData() }, [examId])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push(`/take-exam/${examId}`); return }

    const { data: session, error: sessionError } = await supabase
      .from('org_exam_sessions')
      .select('id, submitted_at')
      .eq('org_exam_id', examId)
      .eq('auth_user_id', user.id)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (sessionError || !session) { router.push(`/take-exam/${examId}`); return }
    if (session.submitted_at) { router.push(`/take-exam/${examId}/submitted`); return }

    setSessionId(session.id)

    const { data: questionData, error: questionError } = await supabase
      .from('org_exam_questions')
      .select('id, question_type, question_text, points, options, correct_answer, order_index')
      .eq('org_exam_id', examId)
      .order('order_index', { ascending: true })

    if (questionError) { setErrorMsg(questionError.message); setLoading(false); return }
    setQuestions(questionData || [])
    setLoading(false)
  }

  function updateAnswer(questionId: string, value: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
  }

  async function handleSubmit() {
    setSubmitting(true)
    setErrorMsg('')

    let totalScore = 0
    let maxScore = 0

    const rows = questions.map((q) => {
      const studentAnswer = answers[q.id] || ''
      const awarded = gradeAnswer(q, studentAnswer) ?? 0
      totalScore += awarded
      maxScore += q.points
      return { session_id: sessionId, question_id: q.id, answer: studentAnswer, points_awarded: awarded }
    })

    if (rows.length > 0) {
      const { error } = await supabase.from('org_exam_responses').insert(rows)
      if (error) { setErrorMsg(error.message); setSubmitting(false); return }
    }

    const { error: sessionError } = await supabase
      .from('org_exam_sessions')
      .update({ submitted_at: new Date().toISOString(), total_score: totalScore, max_possible_score: maxScore })
      .eq('id', sessionId)

    if (sessionError) { setErrorMsg(sessionError.message); setSubmitting(false); return }

    router.push(`/take-exam/${examId}/submitted`)
  }

  if (loading) return <div style={{ padding: 40 }}>Loading…</div>
  if (errorMsg && questions.length === 0) return <div className="page-container"><p className="banner banner-danger">{errorMsg}</p></div>

  const answeredCount = questions.filter((q) => answers[q.id]).length

  return (
    <div className="page-container" style={{ maxWidth: 640 }}>
      <h1>Exam</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>{answeredCount} of {questions.length} answered</p>

      {errorMsg && <div className="banner banner-danger" style={{ marginBottom: 16 }}>{errorMsg}</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {questions.map((q, i) => (
          <div key={q.id} className="card">
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>
              Q{i + 1} · {q.points} pt{q.points !== 1 ? 's' : ''}
            </div>
            <p style={{ fontWeight: 600, marginBottom: 10 }}>{q.question_text}</p>

            {q.question_type === 'multiple_choice' && q.options && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {q.options.map((opt, idx) => (
                  <label key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '8px 12px', borderRadius: 8, background: answers[q.id] === opt ? 'var(--accent-light)' : 'var(--page-bg)', border: `1px solid ${answers[q.id] === opt ? 'var(--accent)' : 'var(--border)'}` }}>
                    <input type="radio" name={q.id} checked={answers[q.id] === opt} onChange={() => updateAnswer(q.id, opt)} />
                    {opt}
                  </label>
                ))}
              </div>
            )}

            {q.question_type === 'true_false' && (
              <div style={{ display: 'flex', gap: 12 }}>
                {['true', 'false'].map((val) => (
                  <label key={val} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '8px 16px', borderRadius: 8, background: answers[q.id] === val ? 'var(--accent-light)' : 'var(--page-bg)', border: `1px solid ${answers[q.id] === val ? 'var(--accent)' : 'var(--border)'}` }}>
                    <input type="radio" name={q.id} checked={answers[q.id] === val} onChange={() => updateAnswer(q.id, val)} />
                    {val.charAt(0).toUpperCase() + val.slice(1)}
                  </label>
                ))}
              </div>
            )}

            {(q.question_type === 'short_answer' || q.question_type === 'fill_blank') && (
              <input value={answers[q.id] || ''} onChange={(e) => updateAnswer(q.id, e.target.value)} style={{ width: '100%' }} placeholder="Your answer…" />
            )}
          </div>
        ))}
      </div>

      <button onClick={handleSubmit} disabled={submitting} className="btn btn-primary" style={{ width: '100%', marginTop: 20 }}>
        {submitting ? 'Submitting…' : 'Submit'}
      </button>
    </div>
  )
}
