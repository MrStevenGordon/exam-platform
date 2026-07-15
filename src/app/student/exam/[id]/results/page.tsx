'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function FinalExamResultsPage() {
  const router = useRouter()
  const params = useParams()
  const examId = params.id as string

  const [result, setResult] = useState<any>(null)
  const [exam, setExam] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: examData } = await supabase
        .from('final_exams')
        .select('title, subject, pass_mark, duration_minutes')
        .eq('id', examId)
        .single()
      setExam(examData)

      const { data, error } = await supabase
        .from('exam_sessions')
        .select('status, total_score, max_possible_score, results_released, completed_at, started_at')
        .eq('final_exam_id', examId)
        .eq('student_id', user.id)
        .single()

      if (error) setErrorMsg(error.message)
      else setResult(data)
      setLoading(false)
    }
    loadData()
  }, [examId, router])

  if (loading) return <div className="page-container">Loading…</div>
  if (errorMsg) return <div className="page-container"><p className="banner banner-danger">{errorMsg}</p></div>
  if (!result) return <div className="page-container">No result found.</div>

  const percent = result.max_possible_score ? Math.round((result.total_score / result.max_possible_score) * 100) : 0
  const passMark = exam?.pass_mark || 50
  const passed = percent >= passMark

  const getFeedback = (pct: number) => {
    if (pct >= 90) return { text: 'Excellent work!', color: 'var(--success)' }
    if (pct >= 75) return { text: 'Very good!', color: 'var(--success)' }
    if (pct >= 60) return { text: 'Good effort.', color: 'var(--accent)' }
    if (pct >= passMark) return { text: 'Passed — keep it up!', color: 'var(--accent)' }
    return { text: 'Keep studying — you can do better!', color: 'var(--danger)' }
  }

  const feedback = getFeedback(percent)
  const timeTaken = result.started_at && result.completed_at
    ? Math.round((new Date(result.completed_at).getTime() - new Date(result.started_at).getTime()) / 60000)
    : null

  return (
    <div className="page-container" style={{ maxWidth: 520 }}>
      <Link href="/student/exams" style={{ color: 'var(--text-secondary)', fontSize: 14, display: 'block', marginBottom: 16 }}>
        ← Back to exams
      </Link>

      <h1 style={{ marginBottom: 4 }}>{exam?.title}</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 24 }}>{exam?.subject}</p>

      {result.status !== 'completed' && (
        <div className="banner banner-warning">You haven't completed this exam yet.</div>
      )}

      {result.status === 'completed' && !result.results_released && (
        <div className="card" style={{ textAlign: 'center', padding: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⏳</div>
          <h2 style={{ marginBottom: 8 }}>Results pending</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            Your supervisor hasn't released results yet.
          </p>
        </div>
      )}

      {result.status === 'completed' && result.results_released && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card" style={{ textAlign: 'center', padding: 32, borderTop: `4px solid ${passed ? 'var(--success)' : 'var(--danger)'}` }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: passed ? 'var(--success)' : 'var(--danger)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
              {passed ? '✓ Pass' : '✗ Did not pass'}
            </div>
            <div style={{ fontSize: 56, fontWeight: 800, color: passed ? 'var(--success)' : 'var(--danger)', letterSpacing: -2, lineHeight: 1 }}>
              {percent}%
            </div>
            <div style={{ fontSize: 18, color: 'var(--text-secondary)', marginTop: 6 }}>
              {result.total_score} / {result.max_possible_score} marks
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: feedback.color, marginTop: 12 }}>
              {feedback.text}
            </div>
          </div>

          <div className="stat-grid">
            <div className="stat-card">
              <div className="stat-card-value">{percent}%</div>
              <div className="stat-card-label">Your score</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-value">{passMark}%</div>
              <div className="stat-card-label">Pass mark</div>
            </div>
            {timeTaken && (
              <div className="stat-card">
                <div className="stat-card-value">{timeTaken}m</div>
                <div className="stat-card-label">Time taken</div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <Link href={`/student/exam/${examId}/review`} style={{ flex: 1 }}>
              <button className="btn btn-primary" style={{ width: '100%' }}>Review my answers</button>
            </Link>
            <Link href="/student/exams">
              <button className="btn btn-ghost">Back to exams</button>
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
