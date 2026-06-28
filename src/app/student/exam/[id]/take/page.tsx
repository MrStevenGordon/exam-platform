'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
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
  correct_answer: string | null
  order_index: number
}

type SessionInfo = {
  id: string
  status: string
  started_at: string
  time_limit_seconds: number
  tab_switch_count: number
}

export default function TakeExamPage() {
  const router = useRouter()
  const params = useParams()
  const examId = params.id as string

  const [exam, setExam] = useState<FinalExam | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [session, setSession] = useState<SessionInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [warning, setWarning] = useState('')
  const [inFullscreen, setInFullscreen] = useState(false)
  const [debugMsg, setDebugMsg] = useState('')
  const [confirmingSubmit, setConfirmingSubmit] = useState(false)

  const violationCount = useRef(0)
  const submittedRef = useRef(false)
  const intentionalExitRef = useRef(false)

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
      .select('id, status, started_at, time_limit_seconds, tab_switch_count')
      .eq('final_exam_id', examId)
      .eq('student_id', user.id)
      .single()

    if (sessionError || !sessionData) {
      router.push(`/student/exam/${examId}`)
      return
    }

    if (sessionData.status === 'completed') {
      router.push('/student')
      return
    }

    setSession(sessionData)
    violationCount.current = sessionData.tab_switch_count || 0

    const startedAt = new Date(sessionData.started_at).getTime()
    const deadline = startedAt + sessionData.time_limit_seconds * 1000
    setSecondsLeft(Math.max(0, Math.floor((deadline - Date.now()) / 1000)))

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
      .select('order_index, questions(id, question_type, question_text, points, options, correct_answer, order_index)')
      .eq('final_exam_id', examId)
      .order('order_index', { ascending: true })

    if (linkError) {
      setErrorMsg(linkError.message)
      setLoading(false)
      return
    }

    const qs = (linkData || []).map((l: any) => l.questions).filter(Boolean)
    setQuestions(qs)

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

  useEffect(() => {
    if (!session) return
    const interval = setInterval(() => {
      const startedAt = new Date(session.started_at).getTime()
      const deadline = startedAt + session.time_limit_seconds * 1000
      const remaining = Math.max(0, Math.floor((deadline - Date.now()) / 1000))
      setSecondsLeft(remaining)
      if (remaining <= 0 && !submittedRef.current) {
        submittedRef.current = true
        intentionalExitRef.current = true
        handleSubmit()
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [session])

  const enterFullscreen = useCallback(() => {
    const el = document.documentElement
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {})
  }, [])

  useEffect(() => {
    enterFullscreen()

    function handleFullscreenChange() {
      const isFull = !!document.fullscreenElement
      setInFullscreen(isFull)
      if (!isFull && !submittedRef.current && !intentionalExitRef.current && session?.status !== 'completed') {
        registerViolation('exited fullscreen')
      }
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [session])

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.hidden && !submittedRef.current && !intentionalExitRef.current) {
        registerViolation('switched tabs or minimized window')
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [session])

  async function registerViolation(reason: string) {
    if (!session) return
    violationCount.current += 1
    const count = violationCount.current

    await supabase
      .from('exam_sessions')
      .update({ tab_switch_count: count, flagged: true })
      .eq('id', session.id)

    if (count >= 3) {
      setWarning(`This is violation ${count} (${reason}). Your exam is being submitted automatically.`)
      if (!submittedRef.current) {
        submittedRef.current = true
        intentionalExitRef.current = true
        handleSubmit()
      }
    } else {
      setWarning(`Warning ${count}/3: ${reason}. Reaching 3 violations will auto-submit your exam.`)
    }
  }

  function updateAnswer(questionId: string, value: string) {
    setAnswers({ ...answers, [questionId]: value })
  }

  function gradeAnswer(question: Question, studentAnswer: string): number | null {
    const autoGradable = ['multiple_choice', 'true_false', 'short_answer', 'fill_blank']
    if (!autoGradable.includes(question.question_type)) return null
    if (!question.correct_answer) return 0
    return studentAnswer.trim() === question.correct_answer.trim() ? question.points : 0
  }

  function handleFinalSubmitClick() {
    intentionalExitRef.current = true
    submittedRef.current = true
    handleSubmit()
  }

  async function handleSubmit() {
    if (!session) return

    setSubmitting(true)
    setErrorMsg('')
    // debug removed

    let autoScore = 0
    let autoMax = 0
    let hasEssay = false

    const rows = questions.map((q) => {
      const studentAnswer = answers[q.id] || ''
      const awarded = gradeAnswer(q, studentAnswer)
      if (awarded === null) {
        hasEssay = true
      } else {
        autoScore += awarded
      }
      autoMax += q.points
      return {
        session_id: session.id,
        question_id: q.id,
        answer: studentAnswer,
        points_awarded: awarded,
        graded_at: awarded !== null ? new Date().toISOString() : null,
      }
    })

    // debug removed
    const { error: deleteError } = await supabase.from('responses').delete().eq('session_id', session.id)
    if (deleteError) {
      setErrorMsg(`Delete failed: ${deleteError.message} (${deleteError.code})`)
      setSubmitting(false)
      return
    }

    if (rows.length > 0) {
      // debug removed
      const { error: responseError } = await supabase.from('responses').insert(rows)
      if (responseError) {
        setErrorMsg(`Insert failed: ${responseError.message} (${responseError.code})`)
        setSubmitting(false)
        return
      }
    }

    // debug removed
    const { error: sessionError } = await supabase
      .from('exam_sessions')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        total_score: autoScore,
        max_possible_score: autoMax,
        fully_graded: !hasEssay,
      })
      .eq('id', session.id)

    if (sessionError) {
      setErrorMsg(`Session update failed: ${sessionError.message} (${sessionError.code})`)
      setSubmitting(false)
      return
    }

    

    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {})
    }

    router.push(`/student/exam/${examId}/submitted`)
  }

  if (loading) return <div style={{ padding: 40 }}>Loading...</div>
  if (errorMsg) return (
    <div style={{ padding: 40 }}>
      <p style={{ color: 'red', fontWeight: 600 }}>{errorMsg}</p>
      <p style={{ color: '#666' }}>{debugMsg}</p>
    </div>
  )
  if (!exam) return <div style={{ padding: 40 }}>Exam not found.</div>

  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60
  const timeLow = secondsLeft < 300

  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif', maxWidth: 700, margin: '0 auto' }}>
      <div style={{
        position: 'sticky', top: 0, background: 'white', padding: '12px 0',
        borderBottom: '2px solid #ddd', marginBottom: 16, zIndex: 10,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ margin: 0 }}>{exam.title}</h1>
            <p style={{ margin: '4px 0 0', color: '#666' }}>{questions.length} questions</p>
          </div>
          <div style={{
            fontSize: 24, fontWeight: 700,
            color: timeLow ? '#dc2626' : '#111',
          }}>
            {minutes}:{seconds.toString().padStart(2, '0')}
          </div>
        </div>
        {!inFullscreen && (
          <button onClick={enterFullscreen} style={{ marginTop: 8, padding: '6px 12px', fontSize: 14 }}>
            Re-enter Fullscreen
          </button>
        )}
        {debugMsg && <p style={{ fontSize: 12, color: '#999', margin: '4px 0 0' }}>{debugMsg}</p>}
      </div>

      {warning && (
        <div style={{ padding: 12, background: '#fee2e2', color: '#991b1b', borderRadius: 8, marginBottom: 16, fontWeight: 600 }}>
          {warning}
        </div>
      )}

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
        {!confirmingSubmit ? (
          <button
            onClick={() => setConfirmingSubmit(true)}
            disabled={submitting}
            style={{ padding: '14px 28px', fontSize: 18, background: '#16a34a', color: 'white', border: 'none', borderRadius: 6 }}
          >
            Submit Exam
          </button>
        ) : (
          <div style={{ padding: 16, background: '#fff3cd', borderRadius: 8 }}>
            <p style={{ margin: '0 0 12px', fontWeight: 600 }}>
              Are you sure? You won't be able to change your answers after this.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={handleFinalSubmitClick}
                disabled={submitting}
                style={{ padding: '12px 24px', fontSize: 16, background: '#16a34a', color: 'white', border: 'none', borderRadius: 6 }}
              >
                {submitting ? 'Submitting...' : 'Yes, Submit'}
              </button>
              <button
                onClick={() => setConfirmingSubmit(false)}
                disabled={submitting}
                style={{ padding: '12px 24px', fontSize: 16, background: '#eee', border: 'none', borderRadius: 6 }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
