'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type FinalExam = {
  id: string
  title: string
  subject: string
  status: string
  department_id: string
}

type Teacher = {
  id: string
  full_name: string
}

type Question = {
  id: string
  question_type: string
  question_text: string
  points: number
  created_by: string
  draft_exams: { title: string } | null
}

export default function AssembleFinalExamPage() {
  const router = useRouter()
  const params = useParams()
  const finalExamId = params.id as string

  const [finalExam, setFinalExam] = useState<FinalExam | null>(null)
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [activeTeacherId, setActiveTeacherId] = useState<string>('')
  const [questionsByTeacher, setQuestionsByTeacher] = useState<Record<string, Question[]>>({})
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [allQuestionsById, setAllQuestionsById] = useState<Record<string, Question>>({})
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadData()
  }, [finalExamId])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    const { data: examData, error: examError } = await supabase
      .from('final_exams')
      .select('id, title, subject, status, department_id')
      .eq('id', finalExamId)
      .single()

    if (examError) {
      setErrorMsg(examError.message)
      setLoading(false)
      return
    }
    setFinalExam(examData)

    // Get all approved draft exams in this department, with their teacher info
    const { data: drafts, error: draftsError } = await supabase
      .from('draft_exams')
      .select('id, created_by, profiles!draft_exams_created_by_fkey(id, full_name)')
      .eq('department_id', examData.department_id)
      .eq('status', 'approved')

    if (draftsError) {
      setErrorMsg(draftsError.message)
      setLoading(false)
      return
    }

    const draftIds = (drafts || []).map((d) => d.id)

    // Build unique teacher list
    const teacherMap: Record<string, Teacher> = {}
    ;(drafts || []).forEach((d: any) => {
      if (d.profiles) {
        teacherMap[d.profiles.id] = { id: d.profiles.id, full_name: d.profiles.full_name }
      }
    })
    const teacherList = Object.values(teacherMap)
    setTeachers(teacherList)
    if (teacherList.length > 0) setActiveTeacherId(teacherList[0].id)

    // Get all questions from those approved drafts
    const { data: questionData, error: questionError } = await supabase
      .from('questions')
      .select('id, question_type, question_text, points, created_by, draft_exams(title)')
      .in('draft_exam_id', draftIds.length > 0 ? draftIds : ['00000000-0000-0000-0000-000000000000'])

    if (questionError) {
      setErrorMsg(questionError.message)
      setLoading(false)
      return
    }

    const grouped: Record<string, Question[]> = {}
    const byId: Record<string, Question> = {}
    ;(questionData || []).forEach((q: any) => {
      if (!grouped[q.created_by]) grouped[q.created_by] = []
      grouped[q.created_by].push(q)
      byId[q.id] = q
    })
    setQuestionsByTeacher(grouped)
    setAllQuestionsById(byId)

    // Load already-selected questions for this final exam
    const { data: existingLinks } = await supabase
      .from('final_exam_questions')
      .select('question_id')
      .eq('final_exam_id', finalExamId)

    setSelectedIds(new Set((existingLinks || []).map((l) => l.question_id)))

    setLoading(false)
  }

  function toggleQuestion(id: string) {
    const updated = new Set(selectedIds)
    if (updated.has(id)) {
      updated.delete(id)
    } else {
      updated.add(id)
    }
    setSelectedIds(updated)
  }

  async function handleSaveSelections() {
    setSaving(true)
    setErrorMsg('')

    // Clear existing links, then re-insert current selection (simplest correct approach)
    const { error: deleteError } = await supabase
      .from('final_exam_questions')
      .delete()
      .eq('final_exam_id', finalExamId)

    if (deleteError) {
      setErrorMsg(deleteError.message)
      setSaving(false)
      return
    }

    const rows = Array.from(selectedIds).map((qid, index) => ({
      final_exam_id: finalExamId,
      question_id: qid,
      order_index: index,
    }))

    if (rows.length > 0) {
      const { error: insertError } = await supabase.from('final_exam_questions').insert(rows)
      if (insertError) {
        setErrorMsg(insertError.message)
        setSaving(false)
        return
      }
    }

    setSaving(false)
    alert('Selections saved.')
  }

  if (loading) return <div style={{ padding: 40 }}>Loading...</div>
  if (errorMsg) return <div style={{ padding: 40, color: 'red' }}>{errorMsg}</div>
  if (!finalExam) return <div style={{ padding: 40 }}>Final exam not found.</div>

  const selectedQuestions = Array.from(selectedIds).map((id) => allQuestionsById[id]).filter(Boolean)
  const totalPoints = selectedQuestions.reduce((sum, q) => sum + q.points, 0)
  const activeQuestions = questionsByTeacher[activeTeacherId] || []

  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif', maxWidth: 900, margin: '0 auto' }}>
      <Link href="/supervisor/final-exams" style={{ color: '#666' }}>&larr; Back to Final Exams</Link>

      <h1 style={{ marginTop: 16 }}>{finalExam.title}</h1>
      <p style={{ color: '#666' }}>{finalExam.subject}</p>

      <div style={{
        position: 'sticky', top: 0, background: 'white', padding: '12px 0',
        borderBottom: '2px solid #ddd', marginBottom: 16, zIndex: 10,
      }}>
        <strong>{selectedQuestions.length} questions selected — {totalPoints} total points</strong>
      </div>

      {teachers.length === 0 && (
        <p>No approved exams found yet in your department. Approve some teacher submissions first.</p>
      )}

      {teachers.length > 0 && (
        <>
          <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid #ddd', marginBottom: 16, flexWrap: 'wrap' }}>
            {teachers.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTeacherId(t.id)}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  background: 'none',
                  borderBottom: activeTeacherId === t.id ? '3px solid #2563eb' : '3px solid transparent',
                  fontWeight: activeTeacherId === t.id ? 600 : 400,
                  cursor: 'pointer',
                  fontSize: 15,
                }}
              >
                {t.full_name} ({(questionsByTeacher[t.id] || []).length})
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {activeQuestions.map((q) => (
              <label
                key={q.id}
                style={{
                  display: 'flex', gap: 12, alignItems: 'flex-start',
                  border: '1px solid #ddd', borderRadius: 8, padding: 12, cursor: 'pointer',
                  background: selectedIds.has(q.id) ? '#eff6ff' : 'white',
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(q.id)}
                  onChange={() => toggleQuestion(q.id)}
                  style={{ marginTop: 4 }}
                />
                <div>
                  <div style={{ fontSize: 12, color: '#888', textTransform: 'uppercase' }}>
                    {q.question_type.replace('_', ' ')} — {q.points} pt{q.points !== 1 ? 's' : ''}
                    {q.draft_exams && ` — from "${q.draft_exams.title}"`}
                  </div>
                  <p style={{ margin: '4px 0 0' }}>{q.question_text}</p>
                </div>
              </label>
            ))}
            {activeQuestions.length === 0 && <p>No questions from this teacher.</p>}
          </div>
        </>
      )}

      <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid #ddd' }}>
        <button
          onClick={handleSaveSelections}
          disabled={saving}
          style={{ padding: '10px 20px', fontSize: 16, background: '#2563eb', color: 'white', border: 'none', borderRadius: 6 }}
        >
          {saving ? 'Saving...' : 'Save Selections'}
        </button>
      </div>
    </div>
  )
}
