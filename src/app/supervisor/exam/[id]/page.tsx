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

type Section = {
  id: string
  name: string
  instructions: string | null
  order_index: number
  question_type: string | null
}

export default function SupervisorExamReviewPage() {
  const router = useRouter()
  const params = useParams()
  const examId = params.id as string

  const [exam, setExam] = useState<DraftExam | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [sections, setSections] = useState<Section[]>([])
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

    const { data: sectionData } = await supabase
      .from('exam_sections')
      .select('id, name, instructions, order_index, question_type')
      .eq('draft_exam_id', examId)
      .order('order_index', { ascending: true })
    setSections(sectionData || [])

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

    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/review-exam', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ examId, action: 'approve', accessToken: session?.access_token }),
    })
    const result = await res.json()

    if (result.error) {
      setErrorMsg(result.error)
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

    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/review-exam', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ examId, action: 'request-changes', accessToken: session?.access_token }),
    })
    const result = await res.json()

    if (result.error) {
      setErrorMsg(result.error)
    } else {
      loadData()
    }
    setActioning(false)
  }

  if (loading) return <div className="page-container">Loading…</div>
  if (errorMsg) return <div className="page-container"><p className="banner banner-danger">{errorMsg}</p></div>
  if (!exam) return <div className="page-container">Exam not found.</div>

  const canDecide = exam.status === 'submitted'

  function renderQuestion(q: Question, displayNumber: number) {
    return (
      <div key={q.id} className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span className="section-label" style={{ fontSize: 11 }}>
            {displayNumber}. {q.question_type.replace('_', ' ')}
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
    )
  }

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
          <p style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>{exam.instructions}</p>
        </div>
      )}

      <h2 style={{ marginTop: 32 }}>Questions ({questions.length})</h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {(() => {
          if (sections.length === 0) {
            // No sections defined — fall back to a flat numbered list
            return questions.map((q, i) => renderQuestion(q, i + 1))
          }

          const items: React.ReactNode[] = []
          let runningNumber = 0
          const assignedIds = new Set<string>()

          sections.forEach((s, si) => {
            const sectionQuestions = s.question_type
              ? questions.filter((q) => q.question_type === s.question_type)
              : []
            sectionQuestions.forEach((q) => assignedIds.add(q.id))

            items.push(
              <div key={`section-${s.id}`} style={{ padding: '12px 16px', background: 'var(--accent-light)', borderRadius: 'var(--radius)', borderLeft: '4px solid var(--accent)', marginTop: si > 0 ? 16 : 0, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: 14, flexShrink: 0 }}>
                  {String.fromCharCode(65 + si)}
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--accent-dark)' }}>
                    Section {String.fromCharCode(65 + si)}: {s.name}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                    {sectionQuestions.length} question{sectionQuestions.length !== 1 ? 's' : ''}
                    {s.question_type && ` · ${s.question_type.replace('_', ' ')}`}
                    {s.instructions && ` · ${s.instructions}`}
                  </div>
                </div>
              </div>
            )

            sectionQuestions.forEach((q) => {
              runningNumber++
              items.push(renderQuestion(q, runningNumber))
            })
          })

          // Any questions that didn't match a section's question_type
          questions.forEach((q) => {
            if (!assignedIds.has(q.id)) {
              runningNumber++
              items.push(renderQuestion(q, runningNumber))
            }
          })

          return items
        })()}
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
