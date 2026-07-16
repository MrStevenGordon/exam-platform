'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type StudentProfile = {
  id: string
  full_name: string
  student_id: string | null
  grade_level: number | null
  birth_date: string | null
  gender: string | null
}

type SessionRow = {
  id: string
  status: string
  started_at: string
  completed_at: string | null
  total_score: number | null
  max_possible_score: number | null
  results_released: boolean
  flagged: boolean
  title: string
  subject: string
}

export default function SupervisorStudentDetailPage() {
  const router = useRouter()
  const params = useParams()
  const studentId = params.id as string

  const [student, setStudent] = useState<StudentProfile | null>(null)
  const [className, setClassName] = useState<string | null>(null)
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: studentData, error } = await supabase
        .from('profiles')
        .select('id, full_name, student_id, grade_level, birth_date, gender')
        .eq('id', studentId)
        .single()

      if (error || !studentData) {
        setErrorMsg('Could not load this student — you may not have access, or the profile no longer exists.')
        setLoading(false)
        return
      }
      setStudent(studentData)

      const { data: enrollment } = await supabase
        .from('enrollments')
        .select('class_groups(name)')
        .eq('student_id', studentId)
        .limit(1)
        .maybeSingle()
      setClassName((enrollment?.class_groups as any)?.name || null)

      // Direct-exam sessions (only ones this teacher created — matches existing RLS)
      const { data: directSessions } = await supabase
        .from('exam_sessions')
        .select('id, status, started_at, completed_at, total_score, max_possible_score, results_released, flagged, draft_exams(title, subject)')
        .eq('student_id', studentId)
        .not('draft_exam_id', 'is', null)

      // Final-exam sessions (only ones this teacher is the assigned subject-teacher for)
      const { data: finalSessions } = await supabase
        .from('exam_sessions')
        .select('id, status, started_at, completed_at, total_score, max_possible_score, results_released, flagged, final_exams(title, subject)')
        .eq('student_id', studentId)
        .not('final_exam_id', 'is', null)

      const combined: SessionRow[] = [
        ...((directSessions as any) || []).map((s: any) => ({
          id: s.id, status: s.status, started_at: s.started_at, completed_at: s.completed_at,
          total_score: s.total_score, max_possible_score: s.max_possible_score,
          results_released: s.results_released, flagged: s.flagged,
          title: s.draft_exams?.title || 'Untitled', subject: s.draft_exams?.subject || '',
        })),
        ...((finalSessions as any) || []).map((s: any) => ({
          id: s.id, status: s.status, started_at: s.started_at, completed_at: s.completed_at,
          total_score: s.total_score, max_possible_score: s.max_possible_score,
          results_released: s.results_released, flagged: s.flagged,
          title: s.final_exams?.title || 'Untitled', subject: s.final_exams?.subject || '',
        })),
      ].sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())

      setSessions(combined)
      setLoading(false)
    }
    load()
  }, [studentId, router])

  if (loading) return <div className="page-container">Loading…</div>
  if (errorMsg) return <div className="page-container"><p className="banner banner-danger">{errorMsg}</p></div>
  if (!student) return <div className="page-container">Student not found.</div>

  const initials = student.full_name.split(' ').map((n) => n[0]).slice(0, 2).join('')

  return (
    <div className="page-container">
      <Link href="/supervisor/students" style={{ color: 'var(--text-secondary)', fontSize: 14 }}>&larr; Back to students</Link>

      <div className="card" style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: 'var(--accent-dark)', flexShrink: 0 }}>
          {initials}
        </div>
        <div>
          <h1 style={{ margin: 0 }}>{student.full_name}</h1>
          <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0', fontSize: 13 }}>
            {student.student_id && `ID: ${student.student_id}`}
            {student.grade_level && ` · Grade ${student.grade_level}`}
            {className && ` · Class ${className}`}
          </p>
        </div>
      </div>

      <div className="stat-grid" style={{ marginTop: 16 }}>
        <div className="stat-card">
          <div className="stat-card-value">{student.gender || '—'}</div>
          <div className="stat-card-label">Gender</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-value">{student.birth_date ? new Date(student.birth_date).toLocaleDateString() : '—'}</div>
          <div className="stat-card-label">Date of birth</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-value">{sessions.filter((s) => s.status === 'completed').length}</div>
          <div className="stat-card-label">Exams completed</div>
        </div>
        <div className={`stat-card ${sessions.some((s) => s.flagged) ? 'stat-card-danger' : ''}`}>
          <div className="stat-card-value">{sessions.filter((s) => s.flagged).length}</div>
          <div className="stat-card-label">Flagged sessions</div>
        </div>
      </div>

      <h2 style={{ marginTop: 24 }}>Exam history</h2>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: -4, marginBottom: 12 }}>
        Only shows exams you have access to.
      </p>

      {sessions.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 32 }}>
          <p style={{ color: 'var(--text-secondary)' }}>No exam activity yet for exams you can view.</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {sessions.map((s) => {
          const pct = s.max_possible_score ? Math.round(((s.total_score || 0) / s.max_possible_score) * 100) : null
          return (
            <div key={s.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{s.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                  {s.subject} · {s.status === 'completed' ? `Completed ${new Date(s.completed_at || s.started_at).toLocaleDateString()}` : 'In progress'}
                  {s.flagged && ' · ⚠ Flagged'}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                {s.status === 'completed' && s.results_released && pct !== null ? (
                  <span className={`badge ${pct >= 50 ? 'badge-success' : 'badge-danger'}`}>{pct}%</span>
                ) : s.status === 'completed' ? (
                  <span className="badge badge-default">Awaiting release</span>
                ) : (
                  <span className="badge badge-warning">In progress</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
