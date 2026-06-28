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

  if (loading) return <div style={{ padding: 40 }}>Loading...</div>
  if (errorMsg) return <div style={{ padding: 40, color: 'red' }}>{errorMsg}</div>
  if (!exam) return <div style={{ padding: 40 }}>Exam not found.</div>

  const canDecide = exam.status === 'submitted'

  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif', maxWidth: 800, margin: '0 auto' }}>
      <Link href="/supervisor" style={{ color: '#666' }}>&larr; Back to Submissions</Link>

      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ margin: 0 }}>{exam.title}</h1>
          <p style={{ color: '#666', margin: '4px 0' }}>
            {exam.subject} — by {exam.profiles?.full_name || 'Unknown'}
          </p>
        </div>
        <span style={{
          fontSize: 12,
          padding: '4px 10px',
          borderRadius: 12,
          background: exam.status === 'submitted' ? '#fff3cd' : exam.status === 'approved' ? '#d4edda' : '#eee',
        }}>
          {exam.status}
        </span>
      </div>

      {exam.instructions && (
        <div style={{ marginTop: 16, padding: 12, background: '#f8f8f8', borderRadius: 8 }}>
          <strong>Instructions:</strong>
          <p style={{ margin: '4px 0 0' }}>{exam.instructions}</p>
        </div>
      )}

      <h2 style={{ marginTop: 32 }}>Questions ({questions.length})</h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {questions.map((q, i) => (
          <div key={q.id} style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: '#888', textTransform: 'uppercase' }}>
                {i + 1}. {q.question_type.replace('_', ' ')}
              </span>
              <span style={{ fontSize: 12, color: '#888' }}>{q.points} pt{q.points !== 1 ? 's' : ''}</span>
            </div>
            <p style={{ margin: '8px 0 0' }}>{q.question_text}</p>
            {q.options && (
              <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
                {q.options.map((opt, idx) => (
                  <li key={idx} style={{ color: opt === q.correct_answer ? '#16a34a' : undefined, fontWeight: opt === q.correct_answer ? 600 : 400 }}>
                    {opt}
                  </li>
                ))}
              </ul>
            )}
            {!q.options && q.correct_answer && (
              <p style={{ margin: '8px 0 0', fontSize: 14, color: '#16a34a' }}>
                Correct answer: {q.correct_answer}
              </p>
            )}

            <div style={{ marginTop: 10 }}>
              <label style={{ fontSize: 13, color: '#555' }}>Comment for teacher (optional)</label>
              <textarea
                value={comments[q.id] || ''}
                onChange={(e) => updateComment(q.id, e.target.value)}
                disabled={!canDecide}
                rows={2}
                placeholder="e.g. This option is ambiguous, please clarify"
                style={{ width: '100%', padding: 8, fontSize: 14, marginTop: 4 }}
              />
            </div>
          </div>
        ))}
      </div>

      {canDecide && (
        <div style={{ marginTop: 16, display: 'flex', gap: 12 }}>
          <button
            onClick={handleApprove}
            disabled={actioning}
            style={{ padding: '10px 20px', fontSize: 16, background: '#16a34a', color: 'white', border: 'none', borderRadius: 6 }}
          >
            Approve
          </button>
          <button
            onClick={handleSendFeedback}
            disabled={actioning}
            style={{ padding: '10px 20px', fontSize: 16, background: '#d97706', color: 'white', border: 'none', borderRadius: 6 }}
          >
            Send Feedback
          </button>
        </div>
      )}

      {!canDecide && exam.status === 'approved' && (
        <p style={{ marginTop: 16, color: '#666' }}>This exam has been approved.</p>
      )}
    </div>
  )
}
