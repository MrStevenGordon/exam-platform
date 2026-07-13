'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type DirectExam = {
  id: string
  title: string
  subject: string
  instructions: string
  exam_kind: string
  duration_minutes: number
  access_password: string | null
}

export default function DirectExamFrontPage() {
  const router = useRouter()
  const params = useParams()
  const examId = params.id as string

  const [exam, setExam] = useState<DirectExam | null>(null)
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
      .from('draft_exams')
      .select('id, title, subject, instructions, exam_kind, duration_minutes, access_password')
      .eq('id', examId)
      .single()

    if (examError) {
      setErrorMsg(examError.message)
      setLoading(false)
      return
    }
    setExam(examData)

    const { count } = await supabase
      .from('questions')
      .select('id', { count: 'exact', head: true })
      .eq('draft_exam_id', examId)

    setQuestionCount(count || 0)

    const { data: sessionData } = await supabase
      .from('exam_sessions')
      .select('id, status, password_verified')
      .eq('draft_exam_id', examId)
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
      setPasswordError('Incorrect password. Check with your teacher.')
    }
  }

  async function handleBeginExam() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !exam) return

    if (existingSession) {
      if (existingSession.status === 'completed') return
      await supabase.from('exam_sessions').update({ password_verified: true }).eq('id', existingSession.id)
      router.push(`/student/direct-exam/${examId}/take`)
      return
    }

    const { data, error } = await supabase
      .from('exam_sessions')
      .insert({
        draft_exam_id: examId,
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

    router.push(`/student/direct-exam/${examId}/take`)
  }

  if (loading) return <div className="page-container">Loading…</div>
  if (errorMsg) return <div className="page-container"><p className="banner banner-danger">{errorMsg}</p></div>
  if (!exam) return <div className="page-container">Exam not found.</div>

  const alreadyCompleted = existingSession?.status === 'completed'
  const isRelaxedExam = exam.exam_kind === 'homework' || exam.exam_kind === 'assignment'
  const kindLabels: Record<string, string> = { pop_quiz: 'Pop quiz', midterm: 'Mid term', end_of_year: 'End of year', class_test: 'Class test', weekly_test: 'Weekly test', assignment: 'Assignment', homework: 'Homework', monthly: 'Monthly exam', end_of_term: 'End of term' }

  return (
    <div className="page-container" style={{ maxWidth: 640 }}>
      <Link href="/student" style={{ color: 'var(--text-secondary)', fontSize: 14 }}>&larr; Back to my exams</Link>

      <h1 style={{ marginTop: 16 }}>{exam.title}</h1>
      <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>{exam.subject} — {kindLabels[exam.exam_kind] || exam.exam_kind}</p>

      <div className="card" style={{ display: 'flex', gap: 32, margin: '20px 0' }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{questionCount}</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Questions</div>
        </div>
      </div>

      {isRelaxedExam ? (
        <div className="banner" style={{ marginBottom: 20 }}>
          This is {kindLabels[exam.exam_kind]?.toLowerCase() || 'homework'} — take your time, no timer or proctoring is applied.
        </div>
      ) : (
        <div className="banner banner-warning" style={{ marginBottom: 20 }}>
          <strong>Before you begin:</strong> this exam opens in fullscreen. Leaving fullscreen or switching tabs
          is monitored and logged. Repeated violations submit your exam automatically.
        </div>
      )}

      {exam.instructions && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px 20px' }}>
            <h2 style={{ margin: '0 0 12px', fontSize: 15, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.5 }}>Read the following instructions carefully</h2>
            <ol style={{ margin: 0, paddingLeft: 20, color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.8 }}>
              {exam.instructions.split('\n').filter((line: string) => line.trim()).map((line: string, i: number) => {
                const cleaned = line.replace(/^\d+[\.)\s]+/, '').trim()
                return cleaned ? <li key={i}>{cleaned}</li> : null
              })}
            </ol>
          </div>
        </div>
      )}

      {alreadyCompleted ? (
        <div className="card" style={{ background: 'var(--success-bg)' }}>
          <p style={{ marginBottom: 12, color: 'var(--success)', fontWeight: 600 }}>You've already completed this exam.</p>
          <Link href={`/student/direct-exam/${examId}/results`}>
            <button className="btn btn-primary">View results</button>
          </Link>
        </div>
      ) : !unlocked ? (
        <div className="card">
          <p style={{ fontWeight: 700, marginBottom: 6 }}>Enter the exam password to begin</p>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 14 }}>
            Your teacher provides this password on exam day.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="7F3K9P"
              style={{ fontSize: 18, fontFamily: 'monospace', letterSpacing: 2, textTransform: 'uppercase', width: 160 }}
              maxLength={6}
            />
            <button onClick={handleVerifyPassword} className="btn btn-primary">Unlock</button>
          </div>
          {passwordError && <p className="banner banner-danger" style={{ marginTop: 10 }}>{passwordError}</p>}
        </div>
      ) : (
        <button onClick={async () => {
          // Request fullscreen first (must be from user gesture) — skip for
          // relaxed exam types where no proctoring applies.
          if (!isRelaxedExam) {
            try {
              await document.documentElement.requestFullscreen()
            } catch {}
          }
          handleBeginExam()
        }} className="btn btn-primary" style={{ fontSize: 16, padding: '14px 28px' }}>
          {existingSession ? 'Resume exam' : 'Begin exam'}
        </button>
      )}
    </div>
  )
}
