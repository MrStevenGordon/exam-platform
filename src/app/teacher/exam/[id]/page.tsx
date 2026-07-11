'use client'
import React from 'react'

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
  access_password: string | null
  target_grade: number | null
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

function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let result = ''
  for (let i = 0; i < 6; i++) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  return result
}
export default function ExamEditorPage() {
  const router = useRouter()
  const params = useParams()
  const examId = params.id as string

  const [exam, setExam] = useState<DraftExam | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [classGroups, setClassGroups] = useState<ClassGroup[]>([])
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set())
  const [sections, setSections] = useState<{ id?: string; name: string; instructions: string; order_index: number; question_type?: string | null }[]>([])
  const [showSectionForm, setShowSectionForm] = useState(false)
  const [newSectionName, setNewSectionName] = useState('')
  const [newSectionInstructions, setNewSectionInstructions] = useState('')
  const [newSectionType, setNewSectionType] = useState('')
  const [newSectionLetter, setNewSectionLetter] = useState('')
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null)
  const [editSectionName, setEditSectionName] = useState('')
  const [editSectionType, setEditSectionType] = useState('')
  const [editSectionInstructions, setEditSectionInstructions] = useState('')
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')

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
      .select('id, title, subject, instructions, status, exam_kind, direct_published, access_password, target_grade')
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

      // Load teacher's assigned classes from teacher_class_groups
      const { data: teacherClasses } = await supabase
        .from('teacher_class_groups')
        .select('class_group_id, class_groups(id, name, year_grade)')
        .eq('teacher_id', user.id)

      const groups = (teacherClasses || [])
        .map((tc: any) => tc.class_groups)
        .filter(Boolean)

      setClassGroups(groups || [])

      const { data: existingLinks } = await supabase
        .from('draft_exam_class_groups')
        .select('class_group_id')
        .eq('draft_exam_id', examId)

      setSelectedGroups(new Set((existingLinks || []).map((l) => l.class_group_id)))
    }

    // Load sections
    const { data: sectionData } = await supabase
      .from('exam_sections')
      .select('id, name, instructions, order_index, question_type')
      .eq('draft_exam_id', examId)
      .order('order_index', { ascending: true })
    setSections(sectionData || [])

    setLoading(false)
  }

  async function handleAddSection() {
    if (!newSectionName.trim()) return
    const { data, error } = await supabase
      .from('exam_sections')
      .insert({
        draft_exam_id: examId,
        name: newSectionName.trim(),
        instructions: newSectionInstructions.trim(),
        order_index: sections.length,
        question_type: newSectionType || null,
      })
      .select()
      .single()
    if (!error && data) {
      setSections([...sections, data])
      setNewSectionName('')
      setNewSectionInstructions('')
      setNewSectionType('')
      setNewSectionLetter('')
      setShowSectionForm(false)
    }
  }

  async function handleSaveEditSection(sectionId: string) {
    await supabase.from('exam_sections').update({
      name: editSectionName.trim(),
      question_type: editSectionType || null,
      instructions: editSectionInstructions.trim(),
    }).eq('id', sectionId)
    setEditingSectionId(null)
    loadData()
  }

  async function handleDeleteSection(sectionId: string) {
    await supabase.from('exam_sections').delete().eq('id', sectionId)
    setSections(sections.filter((s) => s.id !== sectionId))
  }

  async function handleSaveDraft() {
    setSavingDraft(true)
    const { error } = await supabase
      .from('draft_exams')
      .update({ title: exam?.title, instructions: exam?.instructions })
      .eq('id', examId)
    setSavingDraft(false)
    if (!error) {
      setSavedMsg('Saved')
      setTimeout(() => setSavedMsg(''), 2000)
    }
  }

  async function handleSubmitForReview() {
    if (!confirm('Submit this exam for senior team lead vetting? You can still edit it after submission.')) return

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
    // Auto-assign all classes in target grade if set
    let groupsToPublish = new Set(selectedGroups)
    if (exam?.target_grade && classGroups.length > 0) {
      classGroups.forEach((cg) => groupsToPublish.add(cg.id))
    }
    if (groupsToPublish.size === 0) {
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
      .update({ direct_published: true, direct_published_at: new Date().toISOString(), access_password: generatePassword() })
      .eq('id', examId)

    if (error) {
      setErrorMsg(error.message)
    } else {
      loadData()
    }
    setSubmitting(false)
  }

  if (loading) return <div className="page-container">Loading…</div>
  if (errorMsg) return <div className="page-container"><p className="banner banner-danger">{errorMsg}</p></div>
  if (!exam) return <div className="page-container">Exam not found.</div>

  const isFinalExamSubmission = exam.exam_kind === 'final_exam_submission'
  const isTeamLeadExam = ['monthly', 'midterm', 'end_of_term', 'end_of_year'].includes(exam.exam_kind)
  const isLocked = exam.direct_published === true
  const hasComments = questions.some((q) => q.supervisor_comment)

  const kindLabels: Record<string, string> = {
    final_exam_submission: 'Final Exam Submission',
    mock: 'Mock Exam',
    pop_quiz: 'Pop Quiz',
    midterm: 'Midterm Exam',
  }

  return (
    <div className="page-container">
      <Link href="/teacher" style={{ color: 'var(--text-secondary)', fontSize: 14 }}>&larr; Back to my exams</Link>

      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ margin: 0 }}>{exam.title}</h1>
          <p style={{ color: '#666', margin: '4px 0' }}>{exam.subject} — {kindLabels[exam.exam_kind]}</p>
        </div>
        {isFinalExamSubmission ? (
          <span className={`badge ${exam.status === 'draft' ? 'badge-default' : exam.status === 'submitted' ? 'badge-warning' : 'badge-success'}`}>
            {exam.status}
          </span>
        ) : (
          <>
            <span className={`badge ${exam.direct_published ? 'badge-success' : 'badge-default'}`}>
              {exam.direct_published ? 'published' : 'draft'}
            </span>
            {!isLocked && (
              <button onClick={handleSaveDraft} disabled={savingDraft} className="btn btn-ghost" style={{ fontSize: 12 }}>
                {savingDraft ? 'Saving…' : savedMsg || '💾 Save'}
              </button>
            )}
          </>
        )}
      </div>



      {!isFinalExamSubmission && exam.direct_published && (
        <div className="banner banner-success" style={{ marginTop: 16 }}>
          <p style={{ margin: 0 }}>This exam is published and visible to students in the selected class(es).</p>
          {exam.access_password && (
            <p style={{ marginTop: 8, marginBottom: 0, fontSize: 18, fontWeight: 700 }}>
              Exam password: <span style={{ fontFamily: 'monospace', background: 'white', padding: '2px 10px', borderRadius: 6 }}>{exam.access_password}</span>
            </p>
          )}
        </div>
      )}

      {isFinalExamSubmission && !isLocked && hasComments && (
        <div className="banner banner-warning" style={{ marginTop: 16 }}>
          Your supervisor left feedback on one or more questions below. Please review and make changes before resubmitting.
        </div>
      )}

      {/* Sections management */}
      {!isLocked && (
        <div style={{ marginTop: 24, padding: 16, background: 'var(--page-bg)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: sections.length > 0 ? 12 : 0 }}>
            <h2 style={{ margin: 0 }}>Exam sections</h2>
            <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => setShowSectionForm(!showSectionForm)}>
              + Add section
            </button>
          </div>

          {sections.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
              {[...sections].sort((a, b) => {
              const aM = a.name.match(/^Section ([A-F])/)
              const bM = b.name.match(/^Section ([A-F])/)
              return (aM?.[1] || 'Z').localeCompare(bM?.[1] || 'Z')
            }).map((s, i) => (
                <div key={s.id || i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--card-bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>Section {String.fromCharCode(65 + i)}: {s.name}</div>
                    {s.instructions && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{s.instructions.slice(0, 80)}{s.instructions.length > 80 ? '…' : ''}</div>}
                  </div>
                  {s.id && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => {
                          setEditingSectionId(s.id!)
                          setEditSectionName(s.name)
                          setEditSectionType(s.question_type || '')
                          setEditSectionInstructions(s.instructions || '')
                        }}
                        style={{ background: 'none', border: 'none', color: 'var(--accent-dark)', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}
                      >
                        Edit
                      </button>
                      <button onClick={() => handleDeleteSection(s.id!)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>Remove</button>
                    </div>
                  )}
                  {editingSectionId === s.id && (
                    <div style={{ marginTop: 12, padding: 12, background: 'var(--page-bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
                      <div style={{ marginBottom: 10 }}>
                        <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Question type</label>
                        <select value={editSectionType} onChange={(e) => setEditSectionType(e.target.value)} style={{ width: '100%', marginTop: 4 }}>
                          <option value="">All types / Mixed</option>
                          <option value="multiple_choice">Multiple Choice</option>
                          <option value="true_false">True / False</option>
                          <option value="short_answer">Short Answer</option>
                          <option value="essay">Essay</option>
                          <option value="fill_blank">Fill in the Blank</option>
                        </select>
                      </div>
                      <div style={{ marginBottom: 10 }}>
                        <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Section name</label>
                        <input value={editSectionName} onChange={(e) => setEditSectionName(e.target.value)} style={{ width: '100%', marginTop: 4 }} />
                      </div>
                      <div style={{ marginBottom: 12 }}>
                        <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Instructions</label>
                        <textarea value={editSectionInstructions} onChange={(e) => setEditSectionInstructions(e.target.value)} rows={2} style={{ width: '100%', marginTop: 4 }} />
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => handleSaveEditSection(s.id!)} className="btn btn-primary" style={{ fontSize: 12 }}>Save</button>
                        <button onClick={() => setEditingSectionId(null)} className="btn btn-ghost" style={{ fontSize: 12 }}>Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {showSectionForm && (
            <div style={{ marginTop: 12, padding: 12, background: 'var(--card-bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Section letter</label>
                <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                  {['A','B','C','D','E','F'].map((letter) => {
                    const usedLetters = sections.map((s, sIdx) => {
                      const match = s.name.match(/^Section ([A-F])(?::|\s)/)
                      return match ? match[1] : null
                    }).filter(Boolean)
                    const isUsed = usedLetters.includes(letter)
                    const isSelected = newSectionLetter === letter
                    return (
                      <button
                        key={letter}
                        type="button"
                        disabled={isUsed}
                        onClick={() => setNewSectionLetter(isSelected ? '' : letter)}
                        style={{
                          width: 36, height: 36, borderRadius: '50%', fontWeight: 800, fontSize: 14,
                          border: `2px solid ${isUsed ? 'var(--border)' : isSelected ? 'var(--accent)' : 'var(--border-strong)'}`,
                          background: isUsed ? 'var(--page-bg)' : isSelected ? 'var(--accent)' : 'var(--card-bg)',
                          color: isUsed ? 'var(--text-muted)' : isSelected ? 'white' : 'var(--text-secondary)',
                          cursor: isUsed ? 'not-allowed' : 'pointer',
                          position: 'relative',
                        }}
                        title={isUsed ? 'Section already used' : `Section ${letter}`}
                      >
                        {letter}
                        {isUsed && <span style={{ position: 'absolute', top: -2, right: -2, width: 8, height: 8, borderRadius: '50%', background: 'var(--danger)' }} />}
                      </button>
                    )
                  })}
                </div>
                {newSectionLetter && <p style={{ fontSize: 12, color: 'var(--accent-dark)', marginTop: 6 }}>Section {newSectionLetter} selected</p>}
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Question type for this section</label>
                <select
                  value={newSectionType}
                  onChange={(e) => {
                    setNewSectionType(e.target.value)
                    // Auto-fill section name based on type
                    const typeLabels: Record<string, string> = {
                      multiple_choice: 'Multiple Choice',
                      true_false: 'True / False',
                      short_answer: 'Short Answer',
                      essay: 'Essay',
                      fill_blank: 'Fill in the Blank',
                    }
                    setNewSectionName(typeLabels[e.target.value] || '')
                  }}
                  style={{ width: '100%', marginTop: 4 }}
                >
                  <option value="">All types / Mixed</option>
                  <option value="multiple_choice">Multiple Choice</option>
                  <option value="true_false">True / False</option>
                  <option value="short_answer">Short Answer</option>
                  <option value="essay">Essay</option>
                  <option value="fill_blank">Fill in the Blank</option>
                </select>
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Section name</label>
                <input value={newSectionName} onChange={(e) => setNewSectionName(e.target.value)} placeholder="e.g. Section A — Multiple Choice" style={{ width: '100%', marginTop: 4 }} />
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Section instructions (shown to students)</label>
                <textarea value={newSectionInstructions} onChange={(e) => setNewSectionInstructions(e.target.value)} rows={2} placeholder="e.g. Read each question carefully and circle the best answer." style={{ width: '100%', marginTop: 4 }} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={handleAddSection} className="btn btn-primary" style={{ fontSize: 12 }}>Save section</button>
                <button onClick={() => setShowSectionForm(false)} className="btn btn-ghost" style={{ fontSize: 12 }}>Cancel</button>
              </div>
            </div>
          )}

          {sections.length === 0 && !showSectionForm && (
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '8px 0 0' }}>No sections yet — add sections to divide your exam into parts (e.g. Section A and Section B).</p>
          )}
        </div>
      )}

      <h2 style={{ marginTop: 32 }}>Questions ({questions.length})</h2>

      {questions.length === 0 && sections.length === 0 && <p>No questions added yet.</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {sections.length > 0 ? (() => {
          // Divide questions equally among sections
          // Questions not claimed by any typed section
          const typedSectionTypes = new Set(sections.filter(s => s.question_type).map(s => s.question_type))
          const untypedQuestions = questions.filter(q => !typedSectionTypes.has(q.question_type))
          const untypedSections = sections.filter(s => !s.question_type)
          const totalQ = untypedQuestions.length
          const totalS = Math.max(untypedSections.length, 1)
          const baseCount = Math.floor(totalQ / totalS)
          const remainder = totalQ % totalS
          const items: React.ReactElement[] = []
          let qStart = 0
          const sortedSections = [...sections].sort((a, b) => {
          const aMatch = a.name.match(/^Section ([A-F])/)
          const bMatch = b.name.match(/^Section ([A-F])/)
          const aLetter = aMatch ? aMatch[1] : 'Z'
          const bLetter = bMatch ? bMatch[1] : 'Z'
          return aLetter.localeCompare(bLetter)
        })
        sortedSections.forEach((s, si) => {
            // If section has a question_type, group matching questions
            // Otherwise use equal distribution
            const untypedSectionIndex = untypedSections.indexOf(s as any) !== -1 ? untypedSections.indexOf(s as any) : si
            const sectionQuestions = s.question_type
              ? questions.filter(q => q.question_type === s.question_type)
              : (() => {
                  const count = baseCount + (untypedSectionIndex < remainder ? 1 : 0)
                  const slice = untypedQuestions.slice(qStart, qStart + count)
                  qStart += count
                  return slice
                })()

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
            sectionQuestions.forEach((q, qi) => {
              const globalI = questions.indexOf(q)
              items.push(
                <div key={q.id} className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 12, color: '#888', textTransform: 'uppercase' }}>
                      {globalI + 1}. {q.question_type.replace('_', ' ')} {q.is_bank_question && '• from bank'}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 12, color: '#888' }}>{q.points} pt{q.points !== 1 ? 's' : ''}</span>
                      {!isLocked && (
                        <>
                          <Link href={`/teacher/exam/${examId}/edit-question/${q.id}`} style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-dark)', textDecoration: 'none' }}>Edit</Link>
                          <button onClick={async () => { if (confirm('Remove this question?')) { await supabase.from('questions').delete().eq('id', q.id); loadData() } }} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>Remove</button>
                        </>
                      )}
                    </div>
                  </div>
                  <p style={{ margin: '8px 0 0' }}>{q.question_text}</p>
                  {q.supervisor_comment && (
                    <div className="banner banner-warning" style={{ marginTop: 8, fontSize: 14 }}>
                      <strong>Supervisor feedback:</strong> {q.supervisor_comment}
                    </div>
                  )}
                </div>
              )
            })
          })
          // Remaining questions not matched to any typed section
          const assignedIds = new Set(items
            .filter((item: any) => item?.key && !item.key.startsWith('section-'))
            .map((item: any) => item?.key))
          questions.forEach((q, i) => {
            if (!assignedIds.has(q.id)) {
              items.push(
                <div key={q.id} className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 12, color: '#888', textTransform: 'uppercase' }}>
                      {i + 1}. {q.question_type.replace('_', ' ')} {q.is_bank_question && '• from bank'}
                    </span>
                    <span style={{ fontSize: 12, color: '#888' }}>{q.points} pt{q.points !== 1 ? 's' : ''}</span>
                  </div>
                  <p style={{ margin: '8px 0 0' }}>{q.question_text}</p>
                </div>
              )
            }
          })
          return items
        })() : questions.map((q, i) => (
          <div key={q.id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <span style={{ fontSize: 12, color: '#888', textTransform: 'uppercase' }}>
                {i + 1}. {q.question_type.replace('_', ' ')} {q.is_bank_question && '• from bank'}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 12, color: '#888' }}>{q.points} pt{q.points !== 1 ? 's' : ''}</span>
                {!isLocked && (
                  <>
                    <Link href={`/teacher/exam/${examId}/edit-question/${q.id}`} style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-dark)', textDecoration: 'none' }}>Edit</Link>
                    <button onClick={async () => { if (confirm('Remove this question?')) { await supabase.from('questions').delete().eq('id', q.id); loadData() } }} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>Remove</button>
                  </>
                )}
              </div>
            </div>
            <p style={{ margin: '8px 0 0' }}>{q.question_text}</p>
            {q.supervisor_comment && (
              <div className="banner banner-warning" style={{ marginTop: 8, fontSize: 14 }}>
                <strong>Supervisor feedback:</strong> {q.supervisor_comment}
              </div>
            )}

          </div>
        ))}
      </div>

      {!isLocked && (
        <div style={{ marginTop: 24, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link href={`/teacher/exam/${examId}/add-question`}>
            <button className="btn btn-secondary">+ Add question</button>
          </Link>
          {!isFinalExamSubmission && (
            <Link href={`/teacher/exam/${examId}/add-from-bank`}>
              <button className="btn btn-secondary">+ Add from question bank</button>
            </Link>
          )}
          <Link href={`/teacher/exam/${examId}/import-pdf`}>
            <button className="btn btn-ghost">📄 Import from PDF</button>
          </Link>
        </div>
      )}

      {isFinalExamSubmission && !isLocked && questions.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <button onClick={handleSubmitForReview} disabled={submitting} className="btn btn-primary">
            {submitting ? 'Submitting…' : 'Submit for review'}
          </button>
        </div>
      )}

      {!isFinalExamSubmission && !isLocked && (
        <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border)' }}>

          {isTeamLeadExam ? (
            /* Team lead exams — save for team review, no direct publish */
            <div>
              <h3 style={{ marginBottom: 6 }}>Team lead exam</h3>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
                This exam is saved to the team lead panel where all team leads in your year group and subject can view and contribute. Once ready, submit it for senior team lead vetting.
              </p>
              {questions.length > 0 && exam.status === 'draft' && (
                <button onClick={handleSubmitForReview} disabled={submitting} className="btn btn-primary">
                  {submitting ? 'Submitting…' : 'Submit for vetting'}
                </button>
              )}
              {exam.status === 'submitted' && (
                <div className="banner banner-warning">Submitted for senior team lead vetting.</div>
              )}
              {exam.status === 'approved' && (
                <div className="banner banner-success">Approved — awaiting supervisor to publish.</div>
              )}
            </div>
          ) : (
            /* Regular teacher exams — publish directly to classes */
            <div>
              <h3 style={{ marginBottom: 6 }}>Publish to class(es)</h3>
              {classGroups.length === 0 && (
                <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>No class groups found.</p>
              )}

              {/* Grouped by year grade */}
              {['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11'].map((grade) => {
                const gradeClasses = classGroups.filter((cg) => cg.year_grade === grade)
                if (gradeClasses.length === 0) return null
                const allSelected = gradeClasses.every((cg) => selectedGroups.has(cg.id))
                const someSelected = gradeClasses.some((cg) => selectedGroups.has(cg.id))
                return (
                  <div key={grade} style={{ marginBottom: 12 }}>
                    {/* Year group header with select-all */}
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '8px 10px', background: 'var(--page-bg)', borderRadius: 8, border: '1px solid var(--border)', fontWeight: 700, fontSize: 13, width: '100%', boxSizing: 'border-box' }}>
                      <input
                        type="checkbox"
                        checked={allSelected}
                        ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected }}
                        onChange={() => {
                          const updated = new Set(selectedGroups)
                          if (allSelected) gradeClasses.forEach((cg) => updated.delete(cg.id))
                          else gradeClasses.forEach((cg) => updated.add(cg.id))
                          setSelectedGroups(updated)
                        }}
                        style={{ accentColor: 'var(--accent)' }}
                      />
                      {grade}
                      <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-secondary)', marginLeft: 4 }}>
                        ({gradeClasses.length} classes)
                      </span>
                    </label>

                    {/* Individual classes */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8, paddingLeft: 8 }}>
                      {gradeClasses.map((cg) => (
                        <label key={cg.id} style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
                          border: `1.5px solid ${selectedGroups.has(cg.id) ? 'var(--accent)' : 'var(--border-strong)'}`,
                          background: selectedGroups.has(cg.id) ? 'var(--accent-light)' : 'var(--card-bg)',
                          fontSize: 13, fontWeight: 600, minWidth: 60,
                          color: selectedGroups.has(cg.id) ? 'var(--accent-dark)' : 'var(--text-secondary)',
                        }}>
                          <input
                            type="checkbox"
                            checked={selectedGroups.has(cg.id)}
                            onChange={() => toggleGroup(cg.id)}
                            style={{ accentColor: 'var(--accent)', display: 'none' }}
                          />
                          {cg.name}
                        </label>
                      ))}
                    </div>
                  </div>
                )
              })}

              {questions.length > 0 && selectedGroups.size > 0 && (
                <button onClick={handlePublishDirect} disabled={submitting} className="btn btn-primary" style={{ marginTop: 8 }}>
                  {submitting ? 'Publishing…' : `Publish to ${selectedGroups.size} class${selectedGroups.size !== 1 ? 'es' : ''}`}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
