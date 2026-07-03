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
  access_password: string | null
  target_grade: number | null
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

function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let result = ''
  for (let i = 0; i < 6; i++) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  return result
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
  const [allClassGroups, setAllClassGroups] = useState<{ id: string; name: string; year_grade: string }[]>([])
  const [selectedClassGroups, setSelectedClassGroups] = useState<Set<string>>(new Set())
  const [showPublishModal, setShowPublishModal] = useState(false)
  const [modalGrade, setModalGrade] = useState<string>('')
  const [publishing, setPublishing] = useState(false)

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
      .select('id, title, subject, status, department_id, access_password, target_grade')
      .eq('id', finalExamId)
      .single()

    if (examError) {
      setErrorMsg(examError.message)
      setLoading(false)
      return
    }
    setFinalExam(examData)

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

    const teacherMap: Record<string, Teacher> = {}
    ;(drafts || []).forEach((d: any) => {
      if (d.profiles) {
        teacherMap[d.profiles.id] = { id: d.profiles.id, full_name: d.profiles.full_name }
      }
    })
    const teacherList = Object.values(teacherMap)
    setTeachers(teacherList)
    if (teacherList.length > 0 && !activeTeacherId) setActiveTeacherId(teacherList[0].id)

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

    const { data: existingLinks } = await supabase
      .from('final_exam_questions')
      .select('question_id')
      .eq('final_exam_id', finalExamId)

    setSelectedIds(new Set((existingLinks || []).map((l) => l.question_id)))

    // Load all class groups for manual assignment
    const { data: cgData } = await supabase
      .from('class_groups')
      .select('id, name, year_grade')
      .order('year_grade', { ascending: true })
    setAllClassGroups(cgData || [])

    // Load existing class group assignments
    const { data: existingClassLinks } = await supabase
      .from('final_exam_class_groups')
      .select('class_group_id')
      .eq('final_exam_id', finalExamId)
    setSelectedClassGroups(new Set((existingClassLinks || []).map((l) => l.class_group_id)))

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

  async function handlePublish() {
    if (selectedIds.size === 0) {
      alert('Select at least one question before publishing.')
      return
    }
    // Auto-assign by target_grade if set, otherwise use manual selection
    let classGroupsToAssign = Array.from(selectedClassGroups)

    if (finalExam?.target_grade) {
      const gradeLabel = `Grade ${finalExam.target_grade}`
      const gradeGroups = allClassGroups.filter((cg) => cg.year_grade === gradeLabel)
      if (gradeGroups.length > 0) {
        classGroupsToAssign = gradeGroups.map((cg) => cg.id)
      }
    }

    if (classGroupsToAssign.length === 0) {
      alert('Please assign this exam to at least one class group before publishing.')
      return
    }

    // Insert class group links
    await supabase.from('final_exam_class_groups').delete().eq('final_exam_id', finalExamId)
    await supabase.from('final_exam_class_groups').insert(
      classGroupsToAssign.map((cgId) => ({ final_exam_id: finalExamId, class_group_id: cgId }))
    )
    if (!confirm('Publish this exam? Students will be able to see and take it once published. This cannot be undone from this screen.')) {
      return
    }

    setPublishing(true)
    setErrorMsg('')

    // Make sure selections are saved first
    await handleSaveSelections()

    const { error } = await supabase
      .from('final_exams')
      .update({ status: 'published', published_at: new Date().toISOString(), access_password: generatePassword() })
      .eq('id', finalExamId)

    if (error) {
      setErrorMsg(error.message)
    } else {
      loadData()
    }
    setPublishing(false)
  }

  if (loading) return <div className="page-container">Loading…</div>
  if (errorMsg) return <div className="page-container"><p className="banner banner-danger">{errorMsg}</p></div>
  if (!finalExam) return <div className="page-container">Final exam not found.</div>

  const selectedQuestions = Array.from(selectedIds).map((id) => allQuestionsById[id]).filter(Boolean)
  const totalPoints = selectedQuestions.reduce((sum, q) => sum + q.points, 0)
  const activeQuestions = questionsByTeacher[activeTeacherId] || []
  const isPublished = finalExam.status === 'published'

  return (
    <div className="page-container" style={{ maxWidth: 900 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link href="/supervisor/final-exams" style={{ color: 'var(--text-secondary)', fontSize: 14 }}>&larr; Back to final exams</Link>
        <Link href={`/supervisor/final-exams/${finalExamId}/sessions`}><button className="btn btn-secondary">View student sessions</button></Link>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 16 }}>
        <div>
          <h1 style={{ margin: 0 }}>{finalExam.title}</h1>
          <p style={{ color: 'var(--text-secondary)', margin: '4px 0' }}>{finalExam.subject}</p>
        </div>
        <span className={`badge ${isPublished ? 'badge-success' : 'badge-default'}`}>
          {finalExam.status}
        </span>
      </div>

      {isPublished && (
        <div className="banner banner-success" style={{ marginTop: 16 }}>
          <p style={{ margin: 0 }}>This exam is published and visible to students.</p>
          {finalExam.access_password && (
            <p style={{ marginTop: 8, marginBottom: 0, fontSize: 18, fontWeight: 700 }}>
              Exam password: <span style={{ fontFamily: 'monospace', background: 'white', padding: '2px 10px', borderRadius: 6 }}>{finalExam.access_password}</span>
            </p>
          )}
        </div>
      )}

      <div style={{
        position: 'sticky', top: 0, background: 'var(--page-bg)', padding: '12px 0',
        borderBottom: '2px solid var(--border-strong)', marginTop: 16, marginBottom: 16, zIndex: 10,
      }}>
        <strong>{selectedQuestions.length} questions selected — {totalPoints} total points</strong>
      </div>

      {teachers.length === 0 && (
        <div className="card"><p style={{ color: 'var(--text-secondary)' }}>No approved exams found yet in your department. Approve some teacher submissions first.</p></div>
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
                  borderBottom: activeTeacherId === t.id ? '3px solid var(--accent)' : '3px solid transparent',
                  fontWeight: activeTeacherId === t.id ? 700 : 400,
                  cursor: 'pointer',
                  fontSize: 15,
                  color: 'var(--text-primary)',
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
                className="card"
                style={{
                  display: 'flex', gap: 12, alignItems: 'flex-start',
                  cursor: isPublished ? 'default' : 'pointer',
                  background: selectedIds.has(q.id) ? 'var(--accent-light)' : 'var(--card-bg)',
                  opacity: isPublished ? 0.7 : 1,
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(q.id)}
                  onChange={() => toggleQuestion(q.id)}
                  disabled={isPublished}
                  style={{ marginTop: 4 }}
                />
                <div>
                  <div className="section-label" style={{ fontSize: 11 }}>
                    {q.question_type.replace('_', ' ')} — {q.points} pt{q.points !== 1 ? 's' : ''}
                    {q.draft_exams && ` — from "${q.draft_exams.title}"`}
                  </div>
                  <p style={{ margin: '4px 0 0' }}>{q.question_text}</p>
                </div>
              </label>
            ))}
            {activeQuestions.length === 0 && <p style={{ color: 'var(--text-secondary)' }}>No questions from this teacher.</p>}
          </div>
        </>
      )}

      {!isPublished && (
        <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border)', display: 'flex', gap: 12 }}>
          <button onClick={handleSaveSelections} disabled={saving || publishing} className="btn btn-ghost">
            {saving ? 'Saving…' : 'Save selections'}
          </button>
          <button onClick={() => {
            setModalGrade(finalExam?.target_grade ? `Grade ${finalExam.target_grade}` : '')
            setShowPublishModal(true)
          }} disabled={saving || publishing} className="btn btn-primary">
            Publish exam
          </button>
        </div>
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
                  // Auto-select all classes in this grade
                  const gradeGroups = allClassGroups.filter(cg => cg.year_grade === e.target.value)
                  setSelectedClassGroups(new Set(gradeGroups.map(cg => cg.id)))
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
                <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>Classes (deselect any to exclude)</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                  {allClassGroups.filter(cg => cg.year_grade === modalGrade).map(cg => (
                    <label key={cg.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 20, border: `1.5px solid ${selectedClassGroups.has(cg.id) ? 'var(--accent)' : 'var(--border-strong)'}`, background: selectedClassGroups.has(cg.id) ? 'var(--accent-light)' : 'var(--card-bg)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                      <input
                        type="checkbox"
                        checked={selectedClassGroups.has(cg.id)}
                        onChange={() => {
                          const updated = new Set(selectedClassGroups)
                          if (updated.has(cg.id)) updated.delete(cg.id)
                          else updated.add(cg.id)
                          setSelectedClassGroups(updated)
                        }}
                        style={{ accentColor: 'var(--accent)' }}
                      />
                      {cg.name}
                    </label>
                  ))}
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>
                  {selectedClassGroups.size} class{selectedClassGroups.size !== 1 ? 'es' : ''} selected
                </p>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowPublishModal(false)} className="btn btn-ghost">Cancel</button>
              <button
                onClick={() => { setShowPublishModal(false); handlePublish() }}
                disabled={selectedClassGroups.size === 0 || publishing}
                className="btn btn-primary"
              >
                {publishing ? 'Publishing…' : `Publish to ${selectedClassGroups.size} class${selectedClassGroups.size !== 1 ? 'es' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
