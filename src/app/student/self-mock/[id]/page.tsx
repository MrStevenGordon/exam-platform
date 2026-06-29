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

  if (loading) return <div style={{ padding: 40 }}>Loading...</div>
  if (errorMsg) return <div style={{ padding: 40, color: 'red' }}>{errorMsg}</div>

  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif', maxWidth: 700, margin: '0 auto' }}>
      <Link href="/student/self-mock" style={{ color: '#666' }}>&larr; Generate Another</Link>

      <h1 style={{ marginTop: 16 }}>{subject} — Practice Mock</h1>

      {completed && (
        <div style={{ padding: 16, background: '#f0fdf4', borderRadius: 8, marginBottom: 24 }}>
          <p style={{ fontSize: 14, color: '#666', margin: 0 }}>Your Score</p>
          <p style={{ fontSize: 36, fontWeight: 700, margin: '4px 0', color: '#16a34a' }}>{totalScore} / {maxScore}</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {items.map((item, i) => {
          const isCorrect = completed && item.points_awarded === item.points
          const borderColor = completed ? (isCorrect ? '#16a34a' : '#dc2626') : '#ddd'

          return (
            <div key={item.id} style={{ border: `2px solid ${borderColor}`, borderRadius: 8, padding: 16 }}>
              <p style={{ fontWeight: 600, marginBottom: 12 }}>
                {i + 1}. {item.question_text} <span style={{ fontWeight: 400, color: '#888', fontSize: 14 }}>({item.points} pt{item.points !== 1 ? 's' : ''})</span>
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
                  style={{ width: '100%', padding: 8, fontSize: 16 }}
                />
              )}

              {completed && (
                <p style={{ margin: '8px 0 0', fontSize: 14, fontWeight: 600 }}>
                  {isCorrect ? (
                    <span style={{ color: '#16a34a' }}>✓ Correct</span>
                  ) : (
                    <span style={{ color: '#dc2626' }}>
                      ✗ Incorrect — Correct answer: {item.correct_answer}
                    </span>
                  )}
                </p>
              )}
            </div>
          )
        })}
      </div>

      {!completed && items.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{ padding: '14px 28px', fontSize: 18, background: '#16a34a', color: 'white', border: 'none', borderRadius: 6 }}
          >
            {submitting ? 'Checking...' : 'Check My Answers'}
          </button>
        </div>
      )}
    </div>
  )
}
