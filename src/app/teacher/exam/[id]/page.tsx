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
}

type Question = {
  id: string
  question_type: string
  question_text: string
  points: number
  order_index: number
}

export default function ExamEditorPage() {
  const router = useRouter()
  const params = useParams()
  const examId = params.id as string

  const [exam, setExam] = useState<DraftExam | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
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

    const { data: examData, error: examError } = await supabase
      .from('draft_exams')
      .select('id, title, subject, instructions, status')
      .eq('id', examId)
      .single()

    if (examError) {
      setErrorMsg(examError.message)
      setLoading(false)
      return
    }
    setExam(examData)

    const { data: questionData, error: questionError } = await supabase
      .from('questions')
      .select('id, question_type, question_text, points, order_index')
      .eq('draft_exam_id', examId)
      .order('order_index', { ascending: true })

    if (questionError) {
      setErrorMsg(questionError.message)
    } else {
      setQuestions(questionData || [])
    }
    setLoading(false)
  }

  async function handleSubmitForReview() {
    if (!confirm('Submit this exam for review? You won\'t be able to edit it after this.')) return

    setSubmitting(true)
    const { error } = await supabase
      .from('draft_exams')
      .update({ status: 'submitted', submitted_at: new Date().toISOString() })
      .eq('id', examId)

    if (error) {
      setErrorMsg(error.message)
      setSubmitting(false)
    } else {
      loadData()
      setSubmitting(false)
    }
  }

  if (loading) return <div style={{ padding: 40 }}>Loading...</div>
  if (errorMsg) return <div style={{ padding: 40, color: 'red' }}>{errorMsg}</div>
  if (!exam) return <div style={{ padding: 40 }}>Exam not found.</div>

  const isLocked = exam.status !== 'draft'

  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif', maxWidth: 800, margin: '0 auto' }}>
      <Link href="/teacher" style={{ color: '#666' }}>&larr; Back to My Exams</Link>

      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ margin: 0 }}>{exam.title}</h1>
          <p style={{ color: '#666', margin: '4px 0' }}>{exam.subject}</p>
        </div>
        <span style={{
          fontSize: 12,
          padding: '4px 10px',
          borderRadius: 12,
          background: exam.status === 'draft' ? '#eee' : exam.status === 'submitted' ? '#fff3cd' : '#d4edda',
        }}>
          {exam.status}
        </span>
      </div>

      {isLocked && (
        <p style={{ background: '#fff3cd', padding: 12, borderRadius: 8 }}>
          This exam has been submitted and is now locked for editing.
        </p>
      )}

      <h2 style={{ marginTop: 32 }}>Questions ({questions.length})</h2>

      {questions.length === 0 && <p>No questions added yet.</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {questions.map((q, i) => (
          <div key={q.id} style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: '#888', textTransform: 'uppercase' }}>
                {i + 1}. {q.question_type.replace('_', ' ')}
              </span>
              <span style={{ fontSize: 12, color: '#888' }}>{q.points} pt{q.points !== 1 ? 's' : ''}</span>
            </div>
            <p style={{ margin: '8px 0 0' }}>{q.question_text}</p>
          </div>
        ))}
      </div>

      {!isLocked && (
        <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
          <Link href={`/teacher/exam/${examId}/add-question`}>
            <button style={{ padding: '10px 20px', fontSize: 16 }}>+ Add Question</button>
          </Link>
          {questions.length > 0 && (
            <button
              onClick={handleSubmitForReview}
              disabled={submitting}
              style={{ padding: '10px 20px', fontSize: 16, background: '#2563eb', color: 'white', border: 'none', borderRadius: 6 }}
            >
              {submitting ? 'Submitting...' : 'Submit for Review'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
