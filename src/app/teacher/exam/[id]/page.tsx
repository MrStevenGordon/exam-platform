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
  exam_kind: string
  direct_published: boolean
}

type Question = {
  id: string
  question_type: string
  question_text: string
  points: number
  order_index: number
  supervisor_comment: string | null
  is_bank_question: boolean
}

type ClassGroup = {
  id: string
  name: string
  year_grade: string
}

export default function ExamEditorPage() {
  const router = useRouter()
  const params = useParams()
  const examId = params.id as string

  const [exam, setExam] = useState<DraftExam | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [classGroups, setClassGroups] = useState<ClassGroup[]>([])
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set())
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
      .select('id, title, subject, instructions, status, exam_kind, direct_published')
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
      .select('id, question_type, question_text, points, order_index, supervisor_comment, is_bank_question')
      .eq('draft_exam_id', examId)
      .order('order_index', { ascending: true })

    if (questionError) {
      setErrorMsg(questionError.message)
    } else {
      setQuestions(questionData || [])
    }

    if (examData.exam_kind !== 'final_exam_submission') {
      const { data: profile } = await supabase
        .from('profiles')
        .select('department_id')
        .eq('id', user.id)
        .single()

      const { data: groups } = await supabase
        .from('class_groups')
        .select('id, name, year_grade')
        .eq('department_id', profile?.department_id)

      setClassGroups(groups || [])

      const { data: existingLinks } = await supabase
        .from('draft_exam_class_groups')
        .select('class_group_id')
        .eq('draft_exam_id', examId)

      setSelectedGroups(new Set((existingLinks || []).map((l) => l.class_group_id)))
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

  function toggleGroup(id: string) {
    const updated = new Set(selectedGroups)
    if (updated.has(id)) updated.delete(id)
    else updated.add(id)
    setSelectedGroups(updated)
  }

  async function handlePublishDirect() {
    if (selectedGroups.size === 0) {
      alert('Select at least one class to publish to.')
      return
    }
    if (!confirm('Publish this exam to the selected class(es)? Students will be able to take it immediately.')) return

    setSubmitting(true)
    setErrorMsg('')

    await supabase.from('draft_exam_class_groups').delete().eq('draft_exam_id', examId)
    const rows = Array.from(selectedGroups).map((cgId) => ({
      draft_exam_id: examId,
      class_group_id: cgId,
    }))
    const { error: linkError } = await supabase.from('draft_exam_class_groups').insert(rows)

    if (linkError) {
      setErrorMsg(linkError.message)
      setSubmitting(false)
      return
    }

    const { error } = await supabase
      .from('draft_exams')
      .update({ direct_published: true, direct_published_at: new Date().toISOString() })
      .eq('id', examId)

    if (error) {
      setErrorMsg(error.message)
    } else {
      loadData()
    }
    setSubmitting(false)
  }

  if (loading) return <div style={{ padding: 40 }}>Loading...</div>
  if (errorMsg) return <div style={{ padding: 40, color: 'red' }}>{errorMsg}</div>
  if (!exam) return <div style={{ padding: 40 }}>Exam not found.</div>

  const isFinalExamSubmission = exam.exam_kind === 'final_exam_submission'
  const isLocked = isFinalExamSubmission ? exam.status !== 'draft' : exam.direct_published
  const hasComments = questions.some((q) => q.supervisor_comment)

  const kindLabels: Record<string, string> = {
    final_exam_submission: 'Final Exam Submission',
    mock: 'Mock Exam',
    pop_quiz: 'Pop Quiz',
    midterm: 'Midterm Exam',
  }

  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif', maxWidth: 800, margin: '0 auto' }}>
      <Link href="/teacher" style={{ color: '#666' }}>&larr; Back to My Exams</Link>

      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ margin: 0 }}>{exam.title}</h1>
          <p style={{ color: '#666', margin: '4px 0' }}>{exam.subject} — {kindLabels[exam.exam_kind]}</p>
        </div>
        {isFinalExamSubmission ? (
          <span style={{
            fontSize: 12, padding: '4px 10px', borderRadius: 12,
            background: exam.status === 'draft' ? '#eee' : exam.status === 'submitted' ? '#fff3cd' : '#d4edda',
          }}>
            {exam.status}
          </span>
        ) : (
          <span style={{
            fontSize: 12, padding: '4px 10px', borderRadius: 12,
            background: exam.direct_published ? '#d4edda' : '#eee',
          }}>
            {exam.direct_published ? 'published' : 'draft'}
          </span>
        )}
      </div>

      {isFinalExamSubmission && isLocked && (
        <p style={{ background: '#fff3cd', padding: 12, borderRadius: 8 }}>
          This exam has been submitted and is now locked for editing.
        </p>
      )}

      {!isFinalExamSubmission && exam.direct_published && (
        <p style={{ background: '#d4edda', padding: 12, borderRadius: 8 }}>
          This exam is published and visible to students in the selected class(es).
        </p>
      )}

      {isFinalExamSubmission && !isLocked && hasComments && (
        <p style={{ background: '#fef3c7', padding: 12, borderRadius: 8 }}>
          Your supervisor left feedback on one or more questions below. Please review and make changes before resubmitting.
        </p>
      )}

      <h2 style={{ marginTop: 32 }}>Questions ({questions.length})</h2>

      {questions.length === 0 && <p>No questions added yet.</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {questions.map((q, i) => (
          <div key={q.id} style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: '#888', textTransform: 'uppercase' }}>
                {i + 1}. {q.question_type.replace('_', ' ')} {q.is_bank_question && '• from bank'}
              </span>
              <span style={{ fontSize: 12, color: '#888' }}>{q.points} pt{q.points !== 1 ? 's' : ''}</span>
            </div>
            <p style={{ margin: '8px 0 0' }}>{q.question_text}</p>
            {q.supervisor_comment && (
              <div style={{ marginTop: 8, padding: 8, background: '#fef3c7', borderRadius: 6, fontSize: 14 }}>
                <strong>Supervisor feedback:</strong> {q.supervisor_comment}
              </div>
            )}
          </div>
        ))}
      </div>

      {!isLocked && (
        <div style={{ marginTop: 24, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link href={`/teacher/exam/${examId}/add-question`}>
            <button style={{ padding: '10px 20px', fontSize: 16 }}>+ Add Question</button>
          </Link>
          {!isFinalExamSubmission && (
            <Link href={`/teacher/exam/${examId}/add-from-bank`}>
              <button style={{ padding: '10px 20px', fontSize: 16 }}>+ Add from Question Bank</button>
            </Link>
          )}
        </div>
      )}

      {isFinalExamSubmission && !isLocked && questions.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <button
            onClick={handleSubmitForReview}
            disabled={submitting}
            style={{ padding: '10px 20px', fontSize: 16, background: '#2563eb', color: 'white', border: 'none', borderRadius: 6 }}
          >
            {submitting ? 'Submitting...' : 'Submit for Review'}
          </button>
        </div>
      )}

      {!isFinalExamSubmission && !isLocked && (
        <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid #ddd' }}>
          <h3>Publish to Class(es)</h3>
          {classGroups.length === 0 && <p>No class groups found for your department.</p>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {classGroups.map((cg) => (
              <label key={cg.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={selectedGroups.has(cg.id)}
                  onChange={() => toggleGroup(cg.id)}
                />
                {cg.year_grade} — {cg.name}
              </label>
            ))}
          </div>
          {questions.length > 0 && (
            <button
              onClick={handlePublishDirect}
              disabled={submitting}
              style={{ padding: '10px 20px', fontSize: 16, background: '#16a34a', color: 'white', border: 'none', borderRadius: 6 }}
            >
              {submitting ? 'Publishing...' : 'Publish Directly'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
