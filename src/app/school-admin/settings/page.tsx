'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function SettingsPage() {
  const [classGroups, setClassGroups] = useState<{ id: string; name: string; year_grade: string }[]>([])
  const [stats, setStats] = useState({ students: 0, staff: 0, departments: 0, exams: 0 })
  const [loading, setLoading] = useState(true)
  const [settingsId, setSettingsId] = useState<string | null>(null)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [logoError, setLogoError] = useState('')

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('class_groups').select('id, name, year_grade').order('year_grade')
      setClassGroups(data || [])

      const { data: settingsRow } = await supabase.from('school_settings').select('id, logo_url').limit(1).single()
      if (settingsRow) {
        setSettingsId(settingsRow.id)
        setLogoUrl(settingsRow.logo_url)
      }

      const [
        { count: students },
        { count: staff },
        { count: departments },
        { count: finalExams },
        { count: directExams },
      ] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'student'),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).in('role', ['teacher', 'supervisor']),
        supabase.from('departments').select('id', { count: 'exact', head: true }),
        supabase.from('final_exams').select('id', { count: 'exact', head: true }),
        supabase.from('draft_exams').select('id', { count: 'exact', head: true }).eq('direct_published', true),
      ])

      setStats({ students: students || 0, staff: staff || 0, departments: departments || 0, exams: (finalExams || 0) + (directExams || 0) })
      setLoading(false)
    }
    load()
  }, [])

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !settingsId) return

    setUploadingLogo(true)
    setLogoError('')

    const ext = file.name.split('.').pop()
    const path = `logo-${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage.from('school-logo').upload(path, file, { upsert: true })
    if (uploadError) {
      setLogoError(uploadError.message)
      setUploadingLogo(false)
      return
    }

    const { data: publicUrlData } = supabase.storage.from('school-logo').getPublicUrl(path)
    const newUrl = publicUrlData.publicUrl

    const { error: updateError } = await supabase.from('school_settings').update({ logo_url: newUrl }).eq('id', settingsId)
    if (updateError) {
      setLogoError(updateError.message)
      setUploadingLogo(false)
      return
    }

    setLogoUrl(newUrl)
    setUploadingLogo(false)
  }

  if (loading) return <div>Loading…</div>

  const grades = ['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11']

  return (
    <div>
      <p className="portal-page-title">School Settings</p>
      <p className="portal-page-sub">Manchester High School · Academic year 2026–2027</p>

      {/* School branding */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ marginBottom: 16 }}>School branding</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{
            width: 72, height: 72, borderRadius: 12, border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--page-bg)', overflow: 'hidden', flexShrink: 0,
          }}>
            {logoUrl ? (
              <img src={logoUrl} alt="School logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            ) : (
              <span style={{ fontSize: 24 }}>🏫</span>
            )}
          </div>
          <div>
            <label className="btn btn-secondary" style={{ cursor: 'pointer', display: 'inline-block' }}>
              {uploadingLogo ? 'Uploading…' : logoUrl ? 'Change logo' : 'Upload logo'}
              <input type="file" accept="image/*" onChange={handleLogoUpload} disabled={uploadingLogo} style={{ display: 'none' }} />
            </label>
            {logoError && <p style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>{logoError}</p>}
          </div>
        </div>
      </div>

      {/* School info */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ marginBottom: 16 }}>School information</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {[
            { label: 'School name', value: 'Manchester High School' },
            { label: 'Email domain', value: '@mhs.smartassess' },
            { label: 'Academic year', value: '2026–2027' },
            { label: 'Student default password', value: 'Student.Test' },
            { label: 'Staff default password', value: 'Staff.Default1' },
            { label: 'Platform', value: 'Smart Assess Ja' },
          ].map((item) => (
            <div key={item.label} style={{ padding: '10px 12px', background: 'var(--page-bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{item.label}</div>
              <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>{item.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick stats */}
      <div className="stat-grid" style={{ marginBottom: 16 }}>
        <div className="stat-card"><div className="stat-card-value">{stats.students}</div><div className="stat-card-label">Students</div></div>
        <div className="stat-card"><div className="stat-card-value">{stats.staff}</div><div className="stat-card-label">Staff</div></div>
        <div className="stat-card"><div className="stat-card-value">{stats.departments}</div><div className="stat-card-label">Departments</div></div>
        <div className="stat-card"><div className="stat-card-value">{stats.exams}</div><div className="stat-card-label">Published exams</div></div>
      </div>

      {/* Class groups */}
      <div className="card">
        <h2 style={{ marginBottom: 16 }}>Class groups ({classGroups.length} total)</h2>
        {grades.map((grade) => {
          const gradeClasses = classGroups
            .filter((cg) => cg.year_grade === grade)
            .sort((a, b) => {
              const aNum = parseInt((a.name || '').split('-')[1] || '0')
              const bNum = parseInt((b.name || '').split('-')[1] || '0')
              return aNum - bNum
            })
          if (gradeClasses.length === 0) return null
          return (
            <div key={grade} style={{ marginBottom: 16 }}>
              <div className="section-label" style={{ marginBottom: 8 }}>{grade} — {gradeClasses.length} classes</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {gradeClasses.map((cg) => (
                  <span key={cg.id} className="badge badge-default">{cg.name}</span>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <RoutingCheckSection />
      </div>
    </div>
  )
}

type RcStudent = { id: string; full_name: string; student_id: string | null }
type RcSubject = { subject: string; department_id: string }
type RcTraceStep = { label: string; status: 'pass' | 'fail' | 'warn'; detail: string }

function RoutingCheckSection() {
  const [students, setStudents] = useState<RcStudent[]>([])
  const [subjects, setSubjects] = useState<RcSubject[]>([])
  const [studentSearch, setStudentSearch] = useState('')
  const [selectedStudent, setSelectedStudent] = useState<RcStudent | null>(null)
  const [selectedSubject, setSelectedSubject] = useState('')
  const [rcLoading, setRcLoading] = useState(true)
  const [checking, setChecking] = useState(false)
  const [trace, setTrace] = useState<RcTraceStep[] | null>(null)
  const [resultTeachers, setResultTeachers] = useState<string[]>([])

  useEffect(() => {
    async function load() {
      const [{ data: studentData }, { data: subjectData }] = await Promise.all([
        supabase.from('profiles').select('id, full_name, student_id').eq('role', 'student').order('full_name'),
        supabase.from('department_subjects').select('subject, department_id').order('subject'),
      ])
      setStudents(studentData || [])
      const uniqueSubjects = Array.from(new Map((subjectData || []).map((s) => [s.subject, s])).values())
      setSubjects(uniqueSubjects)
      setRcLoading(false)
    }
    load()
  }, [])

  async function runCheck() {
    if (!selectedStudent || !selectedSubject) return
    setChecking(true)
    setTrace(null)
    setResultTeachers([])

    const steps: RcTraceStep[] = []

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

  if (rcLoading) return <div>Loading routing check…</div>

  const filteredStudents = studentSearch
    ? students.filter((s) => s.full_name.toLowerCase().includes(studentSearch.toLowerCase()) || s.student_id?.includes(studentSearch))
    : []

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>Routing Check</h2>

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

      {trace && (
        <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
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
