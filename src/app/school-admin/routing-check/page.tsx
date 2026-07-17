'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Student = { id: string; full_name: string; student_id: string | null }
type Subject = { subject: string; department_id: string }

type TraceStep = {
  label: string
  status: 'pass' | 'fail' | 'warn'
  detail: string
}

export default function RoutingCheckPage() {
  const router = useRouter()
  const [students, setStudents] = useState<Student[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [studentSearch, setStudentSearch] = useState('')
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [selectedSubject, setSelectedSubject] = useState('')
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)
  const [trace, setTrace] = useState<TraceStep[] | null>(null)
  const [resultTeachers, setResultTeachers] = useState<string[]>([])

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const [{ data: studentData }, { data: subjectData }] = await Promise.all([
      supabase.from('profiles').select('id, full_name, student_id').eq('role', 'student').order('full_name'),
      supabase.from('department_subjects').select('subject, department_id').order('subject'),
    ])

    setStudents(studentData || [])
    const uniqueSubjects = Array.from(new Map((subjectData || []).map((s) => [s.subject, s])).values())
    setSubjects(uniqueSubjects)
    setLoading(false)
  }

  async function runCheck() {
    if (!selectedStudent || !selectedSubject) return
    setChecking(true)
    setTrace(null)
    setResultTeachers([])

    const steps: TraceStep[] = []

    const { data: enrollment } = await supabase
      .from('enrollments')
      .select('class_group_id, class_groups(name)')
      .eq('student_id', selectedStudent.id)
      .limit(1)
      .maybeSingle()

    if (!enrollment) {
      steps.push({ label: 'Student enrollment', status: 'fail', detail: `${selectedStudent.full_name} is not enrolled in any class. Nothing will route until this is fixed.` })
      setTrace(steps)
      setChecking(false)
      return
    }
    const className = (enrollment.class_groups as any)?.name || 'Unknown class'
    steps.push({ label: 'Student enrollment', status: 'pass', detail: `${selectedStudent.full_name} is enrolled in class ${className}.` })

    const { data: classTeachers } = await supabase
      .from('teacher_class_groups')
      .select('teacher_id, profiles(full_name)')
      .eq('class_group_id', enrollment.class_group_id)

    if (!classTeachers || classTeachers.length === 0) {
      steps.push({ label: 'Class assignment', status: 'fail', detail: `No teacher is assigned to class ${className} at all. Go to Supervisor \u2192 Class Assignments to fix this.` })
      setTrace(steps)
      setChecking(false)
      return
    }
    steps.push({
      label: 'Class assignment',
      status: 'pass',
      detail: `Class ${className} has ${classTeachers.length} teacher(s) assigned: ${classTeachers.map((t: any) => t.profiles?.full_name).join(', ')}.`,
    })

    const teacherIds = classTeachers.map((t: any) => t.teacher_id)
    const { data: subjectMatches } = await supabase
      .from('teacher_subjects')
      .select('teacher_id, profiles(full_name)')
      .in('teacher_id', teacherIds)
      .eq('subject', selectedSubject)

    if (!subjectMatches || subjectMatches.length === 0) {
      steps.push({
        label: 'Subject assignment',
        status: 'fail',
        detail: `None of the teacher(s) assigned to ${className} are linked to "${selectedSubject}". Go to School Admin \u2192 Staff \u2192 that teacher's profile to add it.`,
      })
      setTrace(steps)
      setChecking(false)
      return
    }

    const names = subjectMatches.map((m: any) => m.profiles?.full_name).filter(Boolean)

    if (names.length > 1) {
      steps.push({
        label: 'Subject assignment',
        status: 'warn',
        detail: `More than one teacher assigned to ${className} teaches "${selectedSubject}": ${names.join(', ')}. Grading access will go to all of them — consider narrowing this if that's not intended.`,
      })
    } else {
      steps.push({ label: 'Subject assignment', status: 'pass', detail: `${names[0]} teaches "${selectedSubject}" and is assigned to ${className}.` })
    }

    setResultTeachers(names)
    setTrace(steps)
    setChecking(false)
  }

  if (loading) return <div>Loading…</div>

  const filteredStudents = studentSearch
    ? students.filter((s) => s.full_name.toLowerCase().includes(studentSearch.toLowerCase()) || s.student_id?.includes(studentSearch))
    : []

  return (
    <div>
      <p className="portal-page-title">Routing Check</p>
      <p className="portal-page-sub">Verify which teacher a student's exam would be graded by, before a real exam goes out</p>

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Student</label>
            {selectedStudent ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{selectedStudent.full_name}</span>
                <button onClick={() => { setSelectedStudent(null); setStudentSearch(''); setTrace(null) }} className="btn btn-ghost" style={{ fontSize: 11 }}>Change</button>
              </div>
            ) : (
              <div style={{ position: 'relative' }}>
                <input
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder="Search by name or student ID…"
                  style={{ width: '100%', marginTop: 4 }}
                />
                {filteredStudents.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid var(--border)', borderRadius: 8, marginTop: 4, maxHeight: 220, overflowY: 'auto', zIndex: 20, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
                    {filteredStudents.slice(0, 8).map((s) => (
                      <div
                        key={s.id}
                        onClick={() => { setSelectedStudent(s); setStudentSearch(''); setTrace(null) }}
                        style={{ padding: '9px 12px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid var(--border)' }}
                      >
                        {s.full_name} {s.student_id && <span style={{ color: 'var(--text-secondary)' }}>· {s.student_id}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Subject</label>
            <select value={selectedSubject} onChange={(e) => { setSelectedSubject(e.target.value); setTrace(null) }} style={{ width: '100%', marginTop: 4 }}>
              <option value="">Select subject…</option>
              {subjects.map((s) => <option key={s.subject} value={s.subject}>{s.subject}</option>)}
            </select>
          </div>
        </div>

        <button
          onClick={runCheck}
          disabled={!selectedStudent || !selectedSubject || checking}
          className="btn btn-primary"
          style={{ marginTop: 16 }}
        >
          {checking ? 'Checking…' : 'Run check'}
        </button>
      </div>

      {trace && (
        <div className="card">
          <h2 style={{ marginBottom: 16 }}>Trace</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {trace.map((step, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%', flexShrink: 0, marginTop: 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: step.status === 'pass' ? 'var(--success-bg)' : step.status === 'warn' ? '#FFF4E0' : 'var(--danger-bg, #FDECEC)',
                  color: step.status === 'pass' ? 'var(--success)' : step.status === 'warn' ? '#B8860B' : 'var(--danger)',
                  fontSize: 13, fontWeight: 700,
                }}>
                  {step.status === 'pass' ? '✓' : step.status === 'warn' ? '!' : '✕'}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{step.label}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{step.detail}</div>
                </div>
              </div>
            ))}
          </div>

          {resultTeachers.length > 0 && (
            <div style={{ marginTop: 20, padding: '14px 16px', background: 'var(--accent-light)', borderRadius: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-dark)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                Would route to
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>{resultTeachers.join(', ')}</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
