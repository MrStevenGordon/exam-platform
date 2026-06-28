'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type FinalExam = {
  id: string
  title: string
  duration_minutes: number
}

type Question = {
  id: string
  question_type: string
  question_text: string
  points: number
  options: string[] | null
  order_index: number
}

export default function TakeExamPage() {
  const router = useRouter()
  const params = useParams()
  const examId = params.id as string

  const [exam, setExam] = useState<FinalExam | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [sessionId, setSessionId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadData()
  }, [examId])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    const { data: sessionData, error: sessionError } = await supabase
      .from('exam_sessions')
      .select('id, status')
      .eq('final_exam_id', examId)
      .eq('student_id', user.id)
      .single()

    if (sessionError || !sessionData) {
      router.push(`/student/exam/${examId}`)
      return
    }

    if (sessionData.status === 'completed') {
      alert('You have already submitted this exam.')
      router.push('/student')
      return
    }

    setSessionId(sessionData.id)

    const { data: examData, error: examError } = await supabase
      .from('final_exams')
      .select('id, title, duration_minutes')
      .eq('id', examId)
      .single()

    if (examError) {
      setErrorMsg(examError.message)
      setLoading(false)
      return
    }
    setExam(examData)

    const { data: linkData, error: linkError } = await supabase
      .from('final_exam_questions')
      .select('order_index, questions(id, question_type, question_text, points, options, order_index)')
      .eq('final_exam_id', examId)
      .order('order_index', { ascending: true })

    if (linkError) {
      setErrorMsg(linkError.message)
      setLoading(false)
      return
    }

    const qs = (linkData || []).map((l: any) => l.questions).filter(Boolean)
    setQuestions(qs)

    // Load any previously saved answers (in case they're resuming)
    const { data: existingAnswers } = await supabase
      .from('responses')
      .select('question_id, answer')
      .eq('session_id', sessionData.id)

    const answerMap: Record<string, string> = {}
    ;(existingAnswers || []).forEach((a) => {
      answerMap[a.question_id] = a.answer
    })
    setAnswers(answerMap)

    setLoading(false)
  }

  function updateAnswer(questionId: string, value: string) {
    setAnswers({ ...answers, [questionId]: value })
  }

  async function handleSubmit() {
    if (!confirm('Submit your exam? You will not be able to change your answers after this.')) return

    setSubmitting(true)
    setErrorMsg('')

    const rows = questions.map((q) => ({
      session_id: sessionId,
      question_id: q.id,
      answer: answers[q.id] || '',
    }))

    // Clear any existing responses first (in case of resume), then insert fresh
    await supabase.from('responses').delete().eq('session_id', sessionId)

    if (rows.length > 0) {
      const { error: responseError } = await supabase.from('responses').insert(rows)
      if (responseError) {
        setErrorMsg(responseError.message)
        setSubmitting(false)
        return
      }
    }

    const { error: sessionError } = await supabase
      .from('exam_sessions')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', sessionId)

    if (sessionError) {
      setErrorMsg(sessionError.message)
      setSubmitting(false)
      return
    }

    router.push(`/student/exam/${examId}/submitted`)
  }

  if (loading) return <div style={{ padding: 40 }}>Loading...</div>
  if (errorMsg) return <div style={{ padding: 40, color: 'red' }}>{errorMsg}</div>
  if (!exam) return <div style={{ padding: 40 }}>Exam not found.</div>

  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif', maxWidth: 700, margin: '0 auto' }}>
      <div style={{ position: 'sticky', top: 0, background: 'white', padding: '12px 0', borderBottom: '2px solid #ddd', marginBottom: 24, zIndex: 10 }}>
        <h1 style={{ margin: 0 }}>{exam.title}</h1>
        <p style={{ margin: '4px 0 0', color: '#666' }}>{questions.length} questions</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {questions.map((q, i) => (
          <div key={q.id} style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16 }}>
            <p style={{ fontWeight: 600, marginBottom: 12 }}>
              {i + 1}. {q.question_text} <span style={{ fontWeight: 400, color: '#888', fontSize: 14 }}>({q.points} pt{q.points !== 1 ? 's' : ''})</span>
            </p>

            {q.question_type === 'multiple_choice' && q.options && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {q.options.map((opt, idx) => (
                  <label key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="radio"
                      name={q.id}
                      checked={answers[q.id] === opt}
                      onChange={() => updateAnswer(q.id, opt)}
                    />
                    {opt}
                  </label>
                ))}
              </div>
            )}

            {q.question_type === 'true_false' && (
              <div style={{ display: 'flex', gap: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="radio"
                    name={q.id}
                    checked={answers[q.id] === 'true'}
                    onChange={() => updateAnswer(q.id, 'true')}
                  />
                  True
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="radio"
                    name={q.id}
                    checked={answers[q.id] === 'false'}
                    onChange={() => updateAnswer(q.id, 'false')}
                  />
                  False
                </label>
              </div>
            )}

            {(q.question_type === 'short_answer' || q.question_type === 'fill_blank') && (
              <input
                value={answers[q.id] || ''}
                onChange={(e) => updateAnswer(q.id, e.target.value)}
                style={{ width: '100%', padding: 8, fontSize: 16 }}
              />
            )}

            {q.question_type === 'essay' && (
              <textarea
                value={answers[q.id] || ''}
                onChange={(e) => updateAnswer(q.id, e.target.value)}
                rows={6}
                style={{ width: '100%', padding: 8, fontSize: 16 }}
              />
            )}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 32, paddingTop: 16, borderTop: '1px solid #ddd' }}>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          style={{ padding: '14px 28px', fontSize: 18, background: '#16a34a', color: 'white', border: 'none', borderRadius: 6 }}
        >
          {submitting ? 'Submitting...' : 'Submit Exam'}
        </button>
      </div>
    </div>
  )
}
