'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type DraftExam = {
  id: string
  title: string
  subject: string
  exam_kind: string
  term: string | null
  target_grade: number | null
  status: string
  instructions: string | null
  duration_minutes: number | null
  access_password: string | null
  questions_per_page: number
  department_id: string | null
}

type Question = {
  id: string
  question_type: string
  question_text: string
  points: number
  options: string[] | null
}

type ClassGroup = {
  id: string
  name: string
  year_grade: string
}

const KIND_LABELS: Record<string, string> = {
  monthly: 'Monthly Exam',
  midterm: 'Midterm Exam',
  end_of_term: 'End of Term',
  end_of_year: 'End of Year',
}

function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let result = ''
  for (let i = 0; i < 6; i++) result += chars[Math.floor(Math.random() * chars.length)]
  return result
}

export default function SupervisorExamPublishPage() {
  const router = useRouter()
  const params = useParams()
  const examId = params.id as string

  const [exam, setExam] = useState<DraftExam | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [classGroups, setClassGroups] = useState<ClassGroup[]>([])
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [publishing, setPublishing] = useState(false)
  const [showPublishModal, setShowPublishModal] = useState(false)
  const [modalGrade, setModalGrade] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: examData } = await supabase
      .from('draft_exams')
      .select('id, title, subject, exam_kind, term, target_grade, status, instructions, duration_minutes, access_password, questions_per_page, department_id')
      .eq('id', examId)
      .single()
    setExam(examData)

    const { data: qData } = await supabase
      .from('questions')
      .select('id, question_type, question_text, points, options')
      .eq('draft_exam_id', examId)
      .order('order_index')
    setQuestions(qData || [])

    const { data: cgData } = await supabase
      .from('class_groups')
      .select('id, name, year_grade')
      .order('year_grade')
    setClassGroups(cgData || [])

    setLoading(false)
  }

  async function handlePublish() {
    if (selectedGroups.size === 0) return
    setPublishing(true)

    const password = generatePassword()

    // Create final exam from this draft
    const { data: finalExam, error: feError } = await supabase
      .from('final_exams')
      .insert({
        title: exam!.title,
        subject: exam!.subject,
        instructions: exam!.instructions,
        duration_minutes: exam!.duration_minutes,
        status: 'published',
        department_id: exam!.department_id,
        exam_category: exam!.exam_kind,
        access_password: password,
        published_at: new Date().toISOString(),
        questions_per_page: exam!.questions_per_page,
        target_grade: exam!.target_grade,
      })
      .select()
      .single()

    if (feError) { setErrorMsg(feError.message); setPublishing(false); return }

    // Copy questions to final_exam_questions
    for (const q of questions) {
      await supabase.from('final_exam_questions').insert({
        final_exam_id: finalExam.id,
        question_id: q.id,
        order_index: questions.indexOf(q),
      })
    }

    // Link class groups
    await supabase.from('final_exam_class_groups').insert(
      Array.from(selectedGroups).map((cgId) => ({
        final_exam_id: finalExam.id,
        class_group_id: cgId,
      }))
    )

    // Mark draft as published
    await supabase.from('draft_exams').update({ status: 'published' }).eq('id', examId)

    setShowPublishModal(false)
    setPublishing(false)
    router.push('/supervisor/final-exams')
  }

  if (loading) return <div>Loading…</div>
  if (!exam) return <div>Exam not found.</div>

  const isPublished = exam.status === 'published'

  return (
    <div>
      <Link href="/supervisor/final-exams" style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
        ← Back to final exams
      </Link>

      <div style={{ marginTop: 16, marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ margin: 0 }}>{exam.title}</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
              {exam.subject} · {KIND_LABELS[exam.exam_kind] || exam.exam_kind}
              {exam.target_grade && ` · Grade ${exam.target_grade}`}
              {exam.duration_minutes && ` · ${exam.duration_minutes} min`}
            </p>
          </div>
          <span className={`badge ${isPublished ? 'badge-success' : 'badge-warning'}`}>
            {isPublished ? 'Published' : 'Ready to publish'}
          </span>
        </div>
      </div>

      {errorMsg && <div className="banner banner-danger" style={{ marginBottom: 16 }}>{errorMsg}</div>}

      {isPublished && (
        <div className="banner banner-success" style={{ marginBottom: 20 }}>
          This exam has been published to students.
        </div>
      )}

      {/* Questions preview */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h2 style={{ marginBottom: 12 }}>Questions ({questions.length})</h2>
        {questions.length === 0 && <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>No questions found.</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {questions.map((q, i) => (
            <div key={q.id} style={{ padding: '10px 12px', background: 'var(--page-bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                  {i + 1}. {q.question_type.replace('_', ' ')}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{q.points} pt{q.points !== 1 ? 's' : ''}</span>
              </div>
              <p style={{ margin: '6px 0 0', fontSize: 14 }}>{q.question_text}</p>
            </div>
          ))}
        </div>
      </div>

      {!isPublished && questions.length > 0 && (
        <button
          onClick={() => {
            setModalGrade(exam.target_grade ? `Grade ${exam.target_grade}` : '')
            if (exam.target_grade) {
              const gradeClasses = classGroups.filter(cg => cg.year_grade === `Grade ${exam.target_grade}`)
              setSelectedGroups(new Set(gradeClasses.map(cg => cg.id)))
            }
            setShowPublishModal(true)
          }}
          className="btn btn-primary"
        >
          Publish to students
        </button>
      )}

      {/* Publish modal */}
      {showPublishModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div className="card" style={{ maxWidth: 500, width: '100%', padding: 28 }}>
            <h2 style={{ marginBottom: 6 }}>Publish exam</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 20 }}>
              Select the year group and classes this exam will be published to.
            </p>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>Year group</label>
              <select
                value={modalGrade}
                onChange={(e) => {
                  setModalGrade(e.target.value)
                  const gradeClasses = classGroups.filter(cg => cg.year_grade === e.target.value)
                  setSelectedGroups(new Set(gradeClasses.map(cg => cg.id)))
                }}
                style={{ width: '100%', marginTop: 6 }}
              >
                <option value="">Select year group…</option>
                {['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11'].map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>

            {modalGrade && (
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>Classes</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                  {classGroups.filter(cg => cg.year_grade === modalGrade).map(cg => (
                    <label key={cg.id} style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '6px 14px', borderRadius: 20, cursor: 'pointer',
                      border: `1.5px solid ${selectedGroups.has(cg.id) ? 'var(--accent)' : 'var(--border-strong)'}`,
                      background: selectedGroups.has(cg.id) ? 'var(--accent-light)' : 'var(--card-bg)',
                      fontSize: 13, fontWeight: 600,
                    }}>
                      <input
                        type="checkbox"
                        checked={selectedGroups.has(cg.id)}
                        onChange={() => {
                          const updated = new Set(selectedGroups)
                          if (updated.has(cg.id)) updated.delete(cg.id)
                          else updated.add(cg.id)
                          setSelectedGroups(updated)
                        }}
                        style={{ accentColor: 'var(--accent)' }}
                      />
                      {cg.name}
                    </label>
                  ))}
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>
                  {selectedGroups.size} class{selectedGroups.size !== 1 ? 'es' : ''} selected
                </p>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowPublishModal(false)} className="btn btn-ghost">Cancel</button>
              <button
                onClick={handlePublish}
                disabled={selectedGroups.size === 0 || publishing}
                className="btn btn-primary"
              >
                {publishing ? 'Publishing…' : `Publish to ${selectedGroups.size} class${selectedGroups.size !== 1 ? 'es' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
