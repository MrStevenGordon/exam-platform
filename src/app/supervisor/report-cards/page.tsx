'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import ReportCardView from '@/components/ReportCardView'

type Term = { id: string; name: string; academic_year: string }
type Student = { id: string; full_name: string; student_id: string | null }

export default function SupervisorReportCardsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [terms, setTerms] = useState<Term[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [selectedStudent, setSelectedStudent] = useState('')
  const [selectedTerm, setSelectedTerm] = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    try {
      await loadDataInner()
    } catch (err) {
      console.error('Failed to load report cards page', err)
    } finally {
      setLoading(false)
    }
  }

  async function loadDataInner() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    // Students don't carry a department_id of their own (only staff do) --
    // matches the existing "Supervisors view all student profiles" RLS
    // precedent, which is also unscoped for the same reason.
    const [{ data: termData }, { data: studentData }] = await Promise.all([
      supabase.from('academic_terms').select('id, name, academic_year').order('start_date', { ascending: false }),
      supabase.from('profiles').select('id, full_name, student_id').eq('role', 'student').order('full_name'),
    ])
    setTerms(termData || [])
    setStudents(studentData || [])
    setLoading(false)
  }

  if (loading) return <div className="page-container">Loading…</div>

  return (
    <div className="page-container">
      <p className="portal-page-title" style={{ margin: 0 }}>Report Cards</p>
      <p className="portal-page-sub" style={{ margin: '4px 0 20px' }}>{students.length} students</p>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <select value={selectedStudent} onChange={(e) => setSelectedStudent(e.target.value)} style={{ flex: '1 1 240px' }}>
          <option value="">Select a student…</option>
          {students.map((s) => <option key={s.id} value={s.id}>{s.full_name}{s.student_id ? ` (${s.student_id})` : ''}</option>)}
        </select>
        <select value={selectedTerm} onChange={(e) => setSelectedTerm(e.target.value)} style={{ flex: '1 1 200px' }}>
          <option value="">Select a term…</option>
          {terms.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.academic_year})</option>)}
        </select>
      </div>

      {selectedStudent && selectedTerm ? (
        <ReportCardView studentId={selectedStudent} termId={selectedTerm} mode="staff" editable />
      ) : (
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Select a student and term to view their report card.</p>
      )}
    </div>
  )
}
