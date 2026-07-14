'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type DraftExam = {
  id: string
  title: string
  subject: string
  instructions: string
  status: string
  review_notes: string | null
  profiles: { full_name: string } | null
}

type Question = {
  id: string
  question_type: string
  question_text: string
  points: number
  order_index: number
  options: string[] | null
  correct_answer: string | null
  supervisor_comment: string | null
}

export default function SupervisorExamReviewPage() {
  const router = useRouter()
  const params = useParams()
  const examId = params.id as string

  const [exam, setExam] = useState<DraftExam | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [comments, setComments] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [actioning, setActioning] = useState(false)
  const [backHref, setBackHref] = useState('/supervisor')
  const [backLabel, setBackLabel] = useState('Back to submissions')

  useEffect(() => {
    loadData()
  }, [examId])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    // This review page is shared by two different reviewer roles: real
    // supervisors approving final-exam submissions, and senior team leads
    // vetting monthly/midterm/end-of-term/end-of-year exams. The "back"
    // link needs to return each of them to where they actually came from.
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'supervisor') {
      setBackHref('/teacher/vetting')
      setBackLabel('Back to vetting')
    }

    const { data: examData, error: examError } = await supabase
      .from('draft_exams')
      .select('id, title, subject, instructions, status, review_notes, profiles!draft_exams_created_by_fkey(full_name)')
      .eq('id', examId)
      .single()

    if (examError) {
      setErrorMsg(examError.message)
      setLoading(false)
      return
    }
    setExam(examData as any)

    const { data: questionData, error: questionError } = await supabase
      .from('questions')
      .select('id, question_type, question_text, points, order_index, options, correct_answer, supervisor_comment')
      .eq('draft_exam_id', examId)
      .order('order_index', { ascending: true })

    if (questionError) {
      setErrorMsg(questionError.message)
    } else {
      setQuestions(questionData || [])
      const initialComments: Record<string, string> = {}
      ;(questionData || []).forEach((q) => {
        initialComments[q.id] = q.supervisor_comment || ''
      })
      setComments(initialComments)
    }
    setLoading(false)
  }

  function updateComment(questionId: string, value: string) {
    setComments({ ...comments, [questionId]: value })
  }

  async function saveComments() {
    const updates = Object.entries(comments).map(([questionId, comment]) =>
      supabase
        .from('questions')
        .update({ supervisor_comment: comment.trim() === '' ? null : comment })
        .eq('id', questionId)
    )
    await Promise.all(updates)
  }

  async function handleApprove() {
    setActioning(true)
    setErrorMsg('')

    await saveComments()

    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase
      .from('draft_exams')
      .update({
        status: 'approved',
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', examId)

    if (error) {
      setErrorMsg(error.message)
    } else {
      loadData()
    }
    setActioning(false)
  }

  async function handleSendFeedback() {
    const hasAnyComment = Object.values(comments).some((c) => c.trim() !== '')
    if (!hasAnyComment) {
      alert('Add at least one comment before sending feedback.')
      return
    }
    if (!confirm('Send feedback to the teacher? The exam will go back to draft so they can make changes.')) {
      return
    }

    setActioning(true)
    setErrorMsg('')

    await saveComments()

    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase
      .from('draft_exams')
      .update({
        status: 'draft',
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', examId)

    if (error) {
      setErrorMsg(error.message)
    } else {
      loadData()
    }
    setActioning(false)
  }

  if (loading) return <div className="page-container">Loading…</div>
  if (errorMsg) return <div className="page-container"><p className="banner banner-danger">{errorMsg}</p></div>
  if (!exam) return <div className="page-container">Exam not found.</div>

  const canDecide = exam.status === 'submitted'

  return (
    <div className="page-container">
      <Link href={backHref} style={{ color: 'var(--text-secondary)', fontSize: 14 }}>&larr; {backLabel}</Link>

      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ margin: 0 }}>{exam.title}</h1>
          <p style={{ color: '#666', margin: '4px 0' }}>
            {exam.subject} — by {exam.profiles?.full_name || 'Unknown'}
          </p>
        </div>
        <span className={`badge ${exam.status === 'submitted' ? 'badge-warning' : exam.status === 'approved' ? 'badge-success' : 'badge-default'}`}>
          {exam.status}
        </span>
      </div>

      {exam.instructions && (
        <div className="card" style={{ marginTop: 16, background: 'var(--page-bg)' }}>
          <strong>Instructions:</strong>
          <p style={{ margin: '4px 0 0' }}>{exam.instructions}</p>
        </div>
      )}

      <h2 style={{ marginTop: 32 }}>Questions ({questions.length})</h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {questions.map((q, i) => (
          <div key={q.id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="section-label" style={{ fontSize: 11 }}>
                {i + 1}. {q.question_type.replace('_', ' ')}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{q.points} pt{q.points !== 1 ? 's' : ''}</span>
            </div>
            <p style={{ margin: '8px 0 0' }}>{q.question_text}</p>
            {q.options && (
              <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
                {q.options.map((opt, idx) => (
                  <li key={idx} style={{ color: opt === q.correct_answer ? 'var(--success)' : undefined, fontWeight: opt === q.correct_answer ? 700 : 400 }}>
                    {opt}
                  </li>
                ))}
              </ul>
            )}
            {!q.options && q.correct_answer && (
              <p style={{ margin: '8px 0 0', fontSize: 14, color: 'var(--success)' }}>
                Correct answer: {q.correct_answer}
              </p>
            )}

            <div style={{ marginTop: 10 }}>
              <label style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Comment for teacher (optional)</label>
              <textarea
                value={comments[q.id] || ''}
                onChange={(e) => updateComment(q.id, e.target.value)}
                disabled={!canDecide}
                rows={2}
                placeholder="e.g. This option is ambiguous, please clarify"
                style={{ width: '100%', marginTop: 4 }}
              />
            </div>
          </div>
        ))}
      </div>

      {canDecide && (
        <div style={{ marginTop: 16, display: 'flex', gap: 12 }}>
          <button onClick={handleApprove} disabled={actioning} className="btn btn-primary">
            Approve
          </button>
          <button onClick={handleSendFeedback} disabled={actioning} className="btn btn-secondary">
            Send feedback
          </button>
        </div>
      )}

      {!canDecide && exam.status === 'approved' && (
        <p style={{ marginTop: 16, color: 'var(--text-secondary)' }}>This exam has been approved.</p>
      )}
    </div>
  )
}
