'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type FinalExam = {
  id: string
  title: string
  subject: string
  instructions: string
  duration_minutes: number
}

export default function ExamFrontPage() {
  const router = useRouter()
  const params = useParams()
  const examId = params.id as string

  const [exam, setExam] = useState<FinalExam | null>(null)
  const [questionCount, setQuestionCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [existingSession, setExistingSession] = useState<{ id: string; status: string } | null>(null)

  useEffect(() => {
    loadData()
  }, [examId])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    const { data: examData, error: examError } = await supabase
      .from('final_exams')
      .select('id, title, subject, instructions, duration_minutes')
      .eq('id', examId)
      .single()

    if (examError) {
      setErrorMsg(examError.message)
      setLoading(false)
      return
    }
    setExam(examData)

    const { count } = await supabase
      .from('final_exam_questions')
      .select('id', { count: 'exact', head: true })
      .eq('final_exam_id', examId)

    setQuestionCount(count || 0)

    const { data: sessionData } = await supabase
      .from('exam_sessions')
      .select('id, status')
      .eq('final_exam_id', examId)
      .eq('student_id', user.id)
      .maybeSingle()

    if (sessionData) setExistingSession(sessionData)

    setLoading(false)
  }

  async function handleBeginExam() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !exam) return

    if (existingSession) {
      if (existingSession.status === 'completed') {
        alert('You have already submitted this exam.')
        return
      }
      router.push(`/student/exam/${examId}/take`)
      return
    }

    const { data, error } = await supabase
      .from('exam_sessions')
      .insert({
        final_exam_id: examId,
        student_id: user.id,
        status: 'in_progress',
        started_at: new Date().toISOString(),
        time_limit_seconds: exam.duration_minutes * 60,
      })
      .select()
      .single()

    if (error) {
      setErrorMsg(error.message)
      return
    }

    router.push(`/student/exam/${examId}/take`)
  }

  if (loading) return <div style={{ padding: 40 }}>Loading...</div>
  if (errorMsg) return <div style={{ padding: 40, color: 'red' }}>{errorMsg}</div>
  if (!exam) return <div style={{ padding: 40 }}>Exam not found.</div>

  const alreadyCompleted = existingSession?.status === 'completed'

  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif', maxWidth: 700, margin: '0 auto' }}>
      <Link href="/student" style={{ color: '#666' }}>&larr; Back to My Exams</Link>

      <h1 style={{ marginTop: 16 }}>{exam.title}</h1>
      <p style={{ color: '#666' }}>{exam.subject}</p>

      <div style={{ display: 'flex', gap: 24, margin: '24px 0', padding: 16, background: '#f8f8f8', borderRadius: 8 }}>
        <div>
          <strong>{questionCount}</strong>
          <p style={{ margin: 0, fontSize: 14, color: '#666' }}>Questions</p>
        </div>
        <div>
          <strong>{exam.duration_minutes} min</strong>
          <p style={{ margin: 0, fontSize: 14, color: '#666' }}>Time Limit</p>
        </div>
      </div>

      <div style={{ marginBottom: 24, padding: 12, background: '#fff3cd', borderRadius: 8, fontSize: 14 }}>
        <strong>Before you begin:</strong> This exam will open in fullscreen mode. Leaving fullscreen or
        switching tabs is monitored and logged. Repeated violations will automatically submit your exam.
      </div>

      {exam.instructions && (
        <div style={{ marginBottom: 24 }}>
          <h2>Instructions</h2>
          <p style={{ whiteSpace: 'pre-wrap' }}>{exam.instructions}</p>
        </div>
      )}

      {alreadyCompleted ? (
        <p style={{ padding: 12, background: '#d4edda', borderRadius: 8 }}>
          You have already completed this exam.
        </p>
      ) : (
        <button
          onClick={handleBeginExam}
          style={{ padding: '14px 28px', fontSize: 18, background: '#2563eb', color: 'white', border: 'none', borderRadius: 6 }}
        >
          {existingSession ? 'Resume Exam' : 'Begin Exam'}
        </button>
      )}
    </div>
  )
}
