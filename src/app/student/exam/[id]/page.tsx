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
  access_password: string | null
}

export default function ExamFrontPage() {
  const router = useRouter()
  const params = useParams()
  const examId = params.id as string

  const [exam, setExam] = useState<FinalExam | null>(null)
  const [questionCount, setQuestionCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [existingSession, setExistingSession] = useState<{ id: string; status: string; password_verified: boolean } | null>(null)
  const [passwordInput, setPasswordInput] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [unlocked, setUnlocked] = useState(false)

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
      .select('id, title, subject, instructions, duration_minutes, access_password')
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
      .select('id, status, password_verified')
      .eq('final_exam_id', examId)
      .eq('student_id', user.id)
      .maybeSingle()

    if (sessionData) {
      setExistingSession(sessionData)
      if (sessionData.password_verified) setUnlocked(true)
    }

    setLoading(false)
  }

  function handleVerifyPassword() {
    if (!exam) return
    if (passwordInput.trim().toUpperCase() === (exam.access_password || '').toUpperCase()) {
      setUnlocked(true)
      setPasswordError('')
    } else {
      setPasswordError('Incorrect password. Check with your teacher or supervisor.')
    }
  }

  async function handleBeginExam() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !exam) return

    if (existingSession) {
      if (existingSession.status === 'completed') return
      await supabase.from('exam_sessions').update({ password_verified: true }).eq('id', existingSession.id)
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
        password_verified: true,
        option_shuffle_seed: Math.floor(Math.random() * 1000000),
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
        <div style={{ padding: 16, background: '#d4edda', borderRadius: 8 }}>
          <p style={{ margin: '0 0 12px' }}>You have already completed this exam.</p>
          <Link href={`/student/exam/${examId}/results`}>
            <button style={{ padding: '10px 20px', fontSize: 16, background: '#2563eb', color: 'white', border: 'none', borderRadius: 6 }}>
              View Results
            </button>
          </Link>
        </div>
      ) : !unlocked ? (
        <div style={{ padding: 20, background: '#f0f0f0', borderRadius: 8 }}>
          <p style={{ fontWeight: 600, marginBottom: 8 }}>Enter the exam password to begin</p>
          <p style={{ fontSize: 14, color: '#666', marginBottom: 12 }}>
            Your teacher or supervisor will provide this password on exam day.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="e.g. 7F3K9P"
              style={{ padding: 10, fontSize: 18, fontFamily: 'monospace', letterSpacing: 2, textTransform: 'uppercase', width: 160 }}
              maxLength={6}
            />
            <button
              onClick={handleVerifyPassword}
              style={{ padding: '10px 20px', fontSize: 16, background: '#2563eb', color: 'white', border: 'none', borderRadius: 6 }}
            >
              Unlock
            </button>
          </div>
          {passwordError && <p style={{ color: 'red', marginTop: 8 }}>{passwordError}</p>}
        </div>
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
