'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { currentAcademicYear, computeSubjectGrades, SubjectGrade } from '@/lib/reportCard'

type Term = { id: string; name: string; academic_year: string; start_date: string; end_date: string }
type Student = { id: string; full_name: string }
type TaughtSubject = { studentId: string; subject: string }

export default function TeacherReportCardsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [terms, setTerms] = useState<Term[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [taughtSubjects, setTaughtSubjects] = useState<TaughtSubject[]>([])

  const [selectedStudent, setSelectedStudent] = useState('')
  const [selectedTerm, setSelectedTerm] = useState('')
  const [selectedSubject, setSelectedSubject] = useState('')
  const [comment, setComment] = useState('')
  const [grades, setGrades] = useState<SubjectGrade[]>([])

  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    try {
      await loadDataInner()
    } catch (err) {
      console.error('Failed to load report card data', err)
      setErrorMsg('Something went wrong loading this page. Please try again.')
      setLoading(false)
    }
  }

  async function loadDataInner() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const academicYear = currentAcademicYear()

    const [{ data: termData }, { data: sectionData }] = await Promise.all([
      supabase.from('academic_terms').select('id, name, academic_year, start_date, end_date').order('start_date', { ascending: false }),
      supabase.from('timetable_sections').select('id, subject').eq('teacher_id', user.id).eq('academic_year', academicYear),
    ])
    setTerms(termData || [])

    const sectionIds = (sectionData || []).map((s) => s.id)
    const subjectBySection: Record<string, string> = {}
    ;(sectionData || []).forEach((s) => { subjectBySection[s.id] = s.subject })

    if (sectionIds.length === 0) {
      setStudents([])
      setTaughtSubjects([])
      setLoading(false)
      return
    }

    const { data: enrollmentData } = await supabase.from('section_enrollments').select('student_id, section_id').in('section_id', sectionIds)

    const subjects: TaughtSubject[] = (enrollmentData || []).map((e) => ({ studentId: e.student_id, subject: subjectBySection[e.section_id] }))
    setTaughtSubjects(subjects)

    const studentIds = Array.from(new Set(subjects.map((s) => s.studentId)))
    if (studentIds.length === 0) {
      setStudents([])
      setLoading(false)
      return
    }

    const { data: studentData } = await supabase.from('profiles').select('id, full_name').in('id', studentIds).order('full_name')
    setStudents(studentData || [])
    setLoading(false)
  }

  const subjectsForSelectedStudent = Array.from(new Set(taughtSubjects.filter((t) => t.studentId === selectedStudent).map((t) => t.subject)))

  useEffect(() => {
    setSelectedSubject('')
    setComment('')
    setGrades([])
  }, [selectedStudent])

  useEffect(() => {
    if (!selectedStudent || !selectedTerm) { setGrades([]); return }
    const term = terms.find((t) => t.id === selectedTerm)
    if (!term) return
    computeSubjectGrades(selectedStudent, term).then(setGrades)
  }, [selectedStudent, selectedTerm, terms])

  useEffect(() => {
    async function loadExistingComment() {
      if (!selectedStudent || !selectedTerm || !selectedSubject) { setComment(''); return }
      const { data } = await supabase.from('report_card_comments').select('comment').eq('student_id', selectedStudent).eq('term_id', selectedTerm).eq('subject', selectedSubject).maybeSingle()
      setComment(data?.comment || '')
    }
    loadExistingComment()
  }, [selectedStudent, selectedTerm, selectedSubject])

  async function handleSaveComment() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !selectedStudent || !selectedTerm || !selectedSubject || !comment.trim()) return
    setSaving(true)
    setErrorMsg('')

    const { error } = await supabase.from('report_card_comments').upsert({
      student_id: selectedStudent,
      term_id: selectedTerm,
      subject: selectedSubject,
      teacher_id: user.id,
      comment: comment.trim(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'student_id,term_id,subject' })

    if (error) { setErrorMsg(error.message); setSaving(false); return }

    setSuccessMsg('Comment saved.')
    setSaving(false)
    setTimeout(() => setSuccessMsg(''), 3000)
  }

  if (loading) return <div className="page-container">Loading…</div>

  return (
    <div className="page-container">
      <p className="portal-page-title" style={{ margin: 0 }}>Report Cards</p>
      <p className="portal-page-sub" style={{ margin: '4px 0 20px' }}>Write comments for the subjects you teach</p>

      {students.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>You don't have any students assigned via the timetable yet.</p>
      ) : (
        <>
          {successMsg && <div className="banner banner-success" style={{ marginBottom: 16 }}>{successMsg}</div>}
          {errorMsg && <div className="banner banner-danger" style={{ marginBottom: 16 }}>{errorMsg}</div>}

          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Student</label>
                <select value={selectedStudent} onChange={(e) => setSelectedStudent(e.target.value)} style={{ width: '100%', marginTop: 4 }}>
                  <option value="">Select a student…</option>
                  {students.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Term</label>
                <select value={selectedTerm} onChange={(e) => setSelectedTerm(e.target.value)} style={{ width: '100%', marginTop: 4 }}>
                  <option value="">Select a term…</option>
                  {terms.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.academic_year})</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Subject</label>
                <select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} style={{ width: '100%', marginTop: 4 }} disabled={!selectedStudent}>
                  <option value="">Select a subject…</option>
                  {subjectsForSelectedStudent.map((subj) => <option key={subj} value={subj}>{subj}</option>)}
                </select>
              </div>
            </div>

            {selectedStudent && selectedTerm && grades.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div className="section-label" style={{ marginBottom: 8 }}>Grade summary this term</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {grades.map((g) => (
                    <span key={g.subject} className="badge badge-default">{g.subject}: {g.percentage}%</span>
                  ))}
                </div>
              </div>
            )}

            {selectedStudent && selectedTerm && selectedSubject && (
              <>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Comment</label>
                <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={4} style={{ width: '100%', marginTop: 4, marginBottom: 12 }} />
                <button onClick={handleSaveComment} disabled={saving || !comment.trim()} className="btn btn-primary">{saving ? 'Saving…' : 'Save comment'}</button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
