'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Response = {
  id: string
  question_id: string
  answer: string
  working: string | null
  points_awarded: number | null
  questions: {
    question_text: string
    question_type: string
    correct_answer: string | null
    points: number
    options: string[] | null
    marking_points: any[] | null
    show_working: boolean | null
  }
}

export default function TeacherReviewSessionPage() {
  const router = useRouter()
  const params = useParams()
  const examId = params.id as string
  const sessionId = params.sessionId as string

  const [studentName, setStudentName] = useState('')
  const [studentIdNum, setStudentIdNum] = useState('')
  const [responses, setResponses] = useState<Response[]>([])
  const [overrides, setOverrides] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [totalScore, setTotalScore] = useState<number | null>(null)
  const [maxScore, setMaxScore] = useState<number | null>(null)

  useEffect(() => { loadData() }, [sessionId])

  async function loadData() {
    const { data: session } = await supabase
      .from('exam_sessions')
      .select('total_score, max_possible_score, profiles!exam_sessions_student_id_fkey(full_name, student_id)')
      .eq('id', sessionId)
      .single()

    if (session) {
      setStudentName((session.profiles as any)?.full_name || 'Unknown')
      setStudentIdNum((session.profiles as any)?.student_id || '')
      setTotalScore(session.total_score)
      setMaxScore(session.max_possible_score)
    }

    const { data: responseData } = await supabase
      .from('responses')
      .select('id, question_id, answer, working, points_awarded, questions(question_text, question_type, correct_answer, points, options, marking_points, show_working)')
      .eq('session_id', sessionId)
      .order('question_id')

    setResponses((responseData as any) || [])
    setLoading(false)
  }

  async function handleSaveOverrides() {
    setSaving(true)
    setErrorMsg('')

    const { data: { user } } = await supabase.auth.getUser()

    for (const [responseId, pts] of Object.entries(overrides)) {
      const { error } = await supabase
        .from('responses')
        .update({ points_awarded: parseInt(pts), graded_by: user?.id, graded_at: new Date().toISOString() })
        .eq('id', responseId)
      if (error) {
        setErrorMsg(`Failed to save one or more marks: ${error.message}`)
        setSaving(false)
        return
      }
    }

    // Recalculate total score
    const { data: allResponses } = await supabase
      .from('responses')
      .select('points_awarded')
      .eq('session_id', sessionId)

    const newTotal = (allResponses || []).reduce((sum, r) => sum + (r.points_awarded || 0), 0)
    await supabase.from('exam_sessions').update({ total_score: newTotal, fully_graded: true }).eq('id', sessionId)

    setTotalScore(newTotal)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
    loadData()
  }

  if (loading) return <div style={{ padding: 40 }}>Loading...</div>

  return (
    <div className="page-container">
      <Link href={`/teacher/exam/${examId}/sessions`} style={{ color: 'var(--text-secondary)', fontSize: 14 }}>← Back to sessions</Link>

      <div style={{ marginTop: 16, marginBottom: 24 }}>
        <h1 style={{ marginBottom: 4 }}>{studentName}</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0 }}>
          ID: {studentIdNum}
          {totalScore !== null && ` · Score: ${totalScore} / ${maxScore} (${Math.round((totalScore / (maxScore || 1)) * 100)}%)`}
        </p>
      </div>

      {saved && <div className="banner banner-success" style={{ marginBottom: 16 }}>Marks saved successfully.</div>}
      {errorMsg && <div className="banner banner-danger" style={{ marginBottom: 16 }}>{errorMsg}</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {responses.map((r, i) => {
          const q = r.questions as any
          const isCorrect = q.question_type === 'multiple_choice' || q.question_type === 'true_false'
            ? r.answer?.toLowerCase() === q.correct_answer?.toLowerCase()
            : null
          const needsManualGrade = q.question_type === 'essay' || (q.question_type === 'short_answer' && q.show_working)

          return (
            <div key={r.id} className="card" style={{ borderLeft: `3px solid ${isCorrect === true ? 'var(--success)' : isCorrect === false ? 'var(--danger)' : 'var(--border)'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Q{i + 1} · {q.question_type.replace('_', ' ')}
                </span>
                <span style={{ fontSize: 13, fontWeight: 700 }}>
                  {r.points_awarded !== null ? r.points_awarded : '—'} / {q.points} pts
                </span>
              </div>

              <p style={{ fontWeight: 600, marginBottom: 10, fontSize: 14 }}>{q.question_text}</p>

              {/* Student working */}
              {r.working && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 4 }}>Student working</div>
                  <div style={{ padding: '10px 14px', background: '#F0F4FF', borderRadius: 8, border: '1px solid #C8D4F0', fontSize: 14, fontFamily: 'monospace', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
                    {r.working}
                  </div>
                </div>
              )}

              {/* Student answer */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 4 }}>Student answer</div>
                <div style={{ padding: '8px 12px', background: 'var(--page-bg)', borderRadius: 8, border: '1px solid var(--border)', fontSize: 14 }}>
                  {r.answer || <em style={{ color: 'var(--text-muted)' }}>No answer</em>}
                </div>
              </div>

              {/* Correct answer for MCQ/TF */}
              {q.correct_answer && (
                <div style={{ fontSize: 12, color: isCorrect ? 'var(--success)' : 'var(--danger)', fontWeight: 600, marginBottom: 8 }}>
                  {isCorrect ? '✓ Correct' : `✗ Correct answer: ${q.correct_answer}`}
                </div>
              )}

              {/* Manual mark override */}
              {needsManualGrade && (
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>Award marks:</label>
                  <input
                    type="number"
                    min={0}
                    max={q.points}
                    value={overrides[r.id] ?? (r.points_awarded ?? '')}
                    onChange={(e) => setOverrides(prev => ({ ...prev, [r.id]: e.target.value }))}
                    style={{ width: 70 }}
                  />
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>/ {q.points}</span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {Object.keys(overrides).length > 0 && (
        <div style={{ marginTop: 20, display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={handleSaveOverrides} disabled={saving} className="btn btn-primary">
            {saving ? 'Saving…' : 'Save marks'}
          </button>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Changes will update the student score</span>
        </div>
      )}
    </div>
  )
}
