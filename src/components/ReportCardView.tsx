'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { computeSubjectGrades, SubjectGrade } from '@/lib/reportCard'
import EmptyState from '@/components/EmptyState'

type Student = { id: string; full_name: string; student_id: string | null; grade_level: number | null }
type Term = { id: string; name: string; academic_year: string; start_date: string; end_date: string; report_cards_released: boolean }
type Comment = { subject: string; comment: string; teacher: { full_name: string } | null }
type Attendance = { days_present: number | null; days_absent: number | null; days_late: number | null; conduct_comment: string | null }

export default function ReportCardView({
  studentId,
  termId,
  mode,
  editable = false,
}: {
  studentId: string
  termId: string
  mode: 'staff' | 'student'
  editable?: boolean
}) {
  const [loading, setLoading] = useState(true)
  const [student, setStudent] = useState<Student | null>(null)
  const [term, setTerm] = useState<Term | null>(null)
  const [grades, setGrades] = useState<SubjectGrade[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [attendance, setAttendance] = useState<Attendance | null>(null)

  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [daysPresent, setDaysPresent] = useState('')
  const [daysAbsent, setDaysAbsent] = useState('')
  const [daysLate, setDaysLate] = useState('')
  const [conductComment, setConductComment] = useState('')

  useEffect(() => { loadData() }, [studentId, termId])

  async function loadData() {
    setLoading(true)

    const [{ data: studentData }, { data: termData }] = await Promise.all([
      supabase.from('profiles').select('id, full_name, student_id, grade_level').eq('id', studentId).single(),
      supabase.from('academic_terms').select('id, name, academic_year, start_date, end_date, report_cards_released').eq('id', termId).single(),
    ])

    setStudent(studentData || null)
    setTerm(termData || null)

    if (termData) {
      const [gradeData, { data: commentData }, { data: attendanceData }] = await Promise.all([
        computeSubjectGrades(studentId, termData),
        supabase.from('report_card_comments').select('subject, comment, teacher:profiles!teacher_id(full_name)').eq('student_id', studentId).eq('term_id', termId),
        supabase.from('report_card_attendance').select('days_present, days_absent, days_late, conduct_comment').eq('student_id', studentId).eq('term_id', termId).maybeSingle(),
      ])
      setGrades(gradeData)
      setComments((commentData as any) || [])
      setAttendance(attendanceData || null)
      setDaysPresent(attendanceData?.days_present?.toString() ?? '')
      setDaysAbsent(attendanceData?.days_absent?.toString() ?? '')
      setDaysLate(attendanceData?.days_late?.toString() ?? '')
      setConductComment(attendanceData?.conduct_comment ?? '')
    }

    setLoading(false)
  }

  async function handleSaveAttendance() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setSaving(true)
    setErrorMsg('')

    const { error } = await supabase.from('report_card_attendance').upsert({
      student_id: studentId,
      term_id: termId,
      days_present: daysPresent ? Number(daysPresent) : null,
      days_absent: daysAbsent ? Number(daysAbsent) : null,
      days_late: daysLate ? Number(daysLate) : null,
      conduct_comment: conductComment.trim() || null,
      entered_by: user.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'student_id,term_id' })

    if (error) { setErrorMsg(error.message); setSaving(false); return }

    setSuccessMsg('Attendance saved.')
    setSaving(false)
    setTimeout(() => setSuccessMsg(''), 3000)
    loadData()
  }

  if (loading) return <div>Loading…</div>

  if (!term) return <EmptyState icon="🎓" title="No report card available yet" description="Select a student and term to view a report card." />

  if (mode === 'student' && !term.report_cards_released) {
    return <EmptyState icon="🎓" title="Not released yet" description="Your report card for this term hasn't been released by the school yet." />
  }

  const commentBySubject: Record<string, Comment> = {}
  comments.forEach((c) => { commentBySubject[c.subject] = c })

  const tdStyle: React.CSSProperties = { border: '1px solid var(--border)', padding: '8px 12px', fontSize: 14 }
  const thStyle: React.CSSProperties = { ...tdStyle, background: 'var(--page-bg)', fontWeight: 700, textAlign: 'left' }

  return (
    <div>
      {mode === 'staff' && !term.report_cards_released && (
        <div className="banner banner-warning" style={{ marginBottom: 16 }}>This term hasn't been released to students yet.</div>
      )}
      {errorMsg && <div className="banner banner-danger" style={{ marginBottom: 16 }}>{errorMsg}</div>}
      {successMsg && <div className="banner banner-success" style={{ marginBottom: 16 }}>{successMsg}</div>}

      <div className="card">
        <div style={{ textAlign: 'center', borderBottom: '2px solid var(--border)', paddingBottom: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-secondary)' }}>Report Card</div>
          <h2 style={{ margin: '4px 0 0' }}>{student?.full_name}</h2>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
            {student?.student_id ? `ID: ${student.student_id} · ` : ''}{student?.grade_level ? `Grade ${student.grade_level} · ` : ''}{term.name} ({term.academic_year})
          </div>
        </div>

        <div className="section-label" style={{ marginBottom: 8 }}>Grades</div>
        {grades.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>No graded results for this term yet.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20 }}>
            <thead>
              <tr><th style={thStyle}>Subject</th><th style={thStyle}>Grade</th></tr>
            </thead>
            <tbody>
              {grades.map((g) => (
                <tr key={g.subject}>
                  <td style={tdStyle}>{g.subject}</td>
                  <td style={tdStyle}>
                    <span className={`badge ${g.percentage >= 50 ? 'badge-success' : 'badge-danger'}`}>{g.percentage}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="section-label" style={{ marginBottom: 8 }}>Teacher comments</div>
        {(() => {
          const subjects = Array.from(new Set([...grades.map((g) => g.subject), ...comments.map((c) => c.subject)])).sort()
          if (subjects.length === 0) {
            return <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>No comments yet.</p>
          }
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              {subjects.map((subject) => {
                const c = commentBySubject[subject]
                return (
                  <div key={subject} style={{ borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{subject}{c?.teacher ? ` — ${c.teacher.full_name}` : ''}</div>
                    <div style={{ fontSize: 13, color: c ? 'var(--text-primary)' : 'var(--text-secondary)', marginTop: 2 }}>
                      {c ? c.comment : 'No comment yet.'}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })()}

        <div className="section-label" style={{ marginBottom: 8 }}>Attendance & conduct</div>
        {editable ? (
          <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Days present</label>
                <input type="number" min={0} value={daysPresent} onChange={(e) => setDaysPresent(e.target.value)} style={{ width: '100%', marginTop: 4 }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Days absent</label>
                <input type="number" min={0} value={daysAbsent} onChange={(e) => setDaysAbsent(e.target.value)} style={{ width: '100%', marginTop: 4 }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Days late</label>
                <input type="number" min={0} value={daysLate} onChange={(e) => setDaysLate(e.target.value)} style={{ width: '100%', marginTop: 4 }} />
              </div>
            </div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Conduct comment</label>
            <textarea value={conductComment} onChange={(e) => setConductComment(e.target.value)} rows={3} style={{ width: '100%', marginTop: 4, marginBottom: 12 }} />
            <button onClick={handleSaveAttendance} disabled={saving} className="btn btn-primary">{saving ? 'Saving…' : 'Save attendance'}</button>
          </div>
        ) : (
          <div style={{ fontSize: 14 }}>
            <div>Present: {attendance?.days_present ?? '—'} · Absent: {attendance?.days_absent ?? '—'} · Late: {attendance?.days_late ?? '—'}</div>
            <div style={{ marginTop: 8, color: attendance?.conduct_comment ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
              {attendance?.conduct_comment || 'No conduct comment yet.'}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
