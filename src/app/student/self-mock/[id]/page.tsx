'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Item = {
  id: string
  question_id: string
  answer: string | null
  points_awarded: number | null
  order_index: number
  question_text: string
  question_type: string
  options: string[] | null
  correct_answer: string | null
  points: number
}

export default function SelfMockPage() {
  const router = useRouter()
  const params = useParams()
  const mockId = params.id as string

  const [items, setItems] = useState<Item[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [completed, setCompleted] = useState(false)
  const [totalScore, setTotalScore] = useState<number | null>(null)
  const [maxScore, setMaxScore] = useState<number | null>(null)
  const [subject, setSubject] = useState('')
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadData()
  }, [mockId])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    const { data: mock, error: mockError } = await supabase
      .from('self_mocks')
      .select('subject, completed_at, total_score, max_possible_score')
      .eq('id', mockId)
      .single()

    if (mockError) {
      setErrorMsg(mockError.message)
      setLoading(false)
      return
    }
    setSubject(mock.subject)
    if (mock.completed_at) {
      setCompleted(true)
      setTotalScore(mock.total_score)
      setMaxScore(mock.max_possible_score)
    }

    const { data: linkData, error: linkError } = await supabase
      .from('self_mock_questions')
      .select('id, question_id, answer, points_awarded, order_index, questions(question_text, question_type, options, correct_answer, points)')
      .eq('self_mock_id', mockId)
      .order('order_index', { ascending: true })

    if (linkError) {
      setErrorMsg(linkError.message)
      setLoading(false)
      return
    }

    const combined = (linkData || []).map((l: any) => ({
      id: l.id,
      question_id: l.question_id,
      answer: l.answer,
      points_awarded: l.points_awarded,
      order_index: l.order_index,
      question_text: l.questions.question_text,
      question_type: l.questions.question_type,
      options: l.questions.options,
      correct_answer: l.questions.correct_answer,
      points: l.questions.points,
    }))
    setItems(combined)

    const answerMap: Record<string, string> = {}
    combined.forEach((i) => { if (i.answer) answerMap[i.id] = i.answer })
    setAnswers(answerMap)

    setLoading(false)
  }

  function updateAnswer(itemId: string, value: string) {
    setAnswers({ ...answers, [itemId]: value })
  }

  async function handleSubmit() {
    setSubmitting(true)
    setErrorMsg('')

    let score = 0
    let max = 0

    for (const item of items) {
      const studentAnswer = answers[item.id] || ''
      const awarded = item.correct_answer && studentAnswer.trim() === item.correct_answer.trim() ? item.points : 0
      score += awarded
      max += item.points

      await supabase
        .from('self_mock_questions')
        .update({ answer: studentAnswer, points_awarded: awarded })
        .eq('id', item.id)
    }

    const { error } = await supabase
      .from('self_mocks')
      .update({ completed_at: new Date().toISOString(), total_score: score, max_possible_score: max })
      .eq('id', mockId)

    if (error) {
      setErrorMsg(error.message)
      setSubmitting(false)
      return
    }

    setTotalScore(score)
    setMaxScore(max)
    setCompleted(true)
    setSubmitting(false)
    loadData()
  }

  if (loading) return <div className="page-container">Loading…</div>
  if (errorMsg) return <div className="page-container"><p className="banner banner-danger">{errorMsg}</p></div>

  return (
    <div className="page-container" style={{ maxWidth: 640 }}>
      <Link href="/student/self-mock" style={{ color: 'var(--text-secondary)', fontSize: 14 }}>&larr; Generate another</Link>

      <h1 style={{ marginTop: 16 }}>{subject} — Practice mock</h1>

      {completed && (
        <div className="card" style={{ background: 'var(--success-bg)', marginBottom: 20 }}>
          <p style={{ fontSize: 13, color: 'var(--success)' }}>Your score</p>
          <p style={{ fontSize: 32, fontWeight: 700, margin: '4px 0', color: 'var(--success)' }}>{totalScore} / {maxScore}</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {items.map((item, i) => {
          const isCorrect = completed && item.points_awarded === item.points
          const borderColor = completed ? (isCorrect ? 'var(--success)' : 'var(--danger)') : 'var(--border-strong)'

          return (
            <div key={item.id} className="card" style={{ borderLeft: `4px solid ${borderColor}` }}>
              <p style={{ fontWeight: 700, marginBottom: 12 }}>
                {i + 1}. {item.question_text} <span style={{ fontWeight: 400, color: 'var(--text-secondary)', fontSize: 14 }}>({item.points} pt{item.points !== 1 ? 's' : ''})</span>
              </p>

              {item.question_type === 'multiple_choice' && item.options && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {item.options.map((opt, idx) => (
                    <label key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="radio"
                        name={item.id}
                        disabled={completed}
                        checked={answers[item.id] === opt}
                        onChange={() => updateAnswer(item.id, opt)}
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              )}

              {item.question_type === 'true_false' && (
                <div style={{ display: 'flex', gap: 16 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="radio" name={item.id} disabled={completed} checked={answers[item.id] === 'true'} onChange={() => updateAnswer(item.id, 'true')} />
                    True
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="radio" name={item.id} disabled={completed} checked={answers[item.id] === 'false'} onChange={() => updateAnswer(item.id, 'false')} />
                    False
                  </label>
                </div>
              )}

              {(item.question_type === 'short_answer' || item.question_type === 'fill_blank') && (
                <input
                  value={answers[item.id] || ''}
                  disabled={completed}
                  onChange={(e) => updateAnswer(item.id, e.target.value)}
                  style={{ width: '100%' }}
                />
              )}

              {completed && (
                <p style={{ margin: '8px 0 0', fontSize: 14, fontWeight: 700, color: isCorrect ? 'var(--success)' : 'var(--danger)' }}>
                  {isCorrect ? 'Correct' : `Incorrect — Correct answer: ${item.correct_answer}`}
                </p>
              )}
            </div>
          )
        })}
      </div>

      {!completed && items.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <button onClick={handleSubmit} disabled={submitting} className="btn btn-primary" style={{ fontSize: 16, padding: '14px 28px' }}>
            {submitting ? 'Checking…' : 'Check my answers'}
          </button>
        </div>
      )}
    </div>
  )
}
