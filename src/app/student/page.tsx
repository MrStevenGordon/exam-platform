'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type ExamItem = {
  id: string
  title: string
  subject: string
  duration_minutes: number | null
  kind: 'final_exam' | 'direct_exam'
  category: string
}

const CATEGORY_LABELS: Record<string, string> = {
  pop_quiz: 'Pop quizzes',
  midterm: 'Mid terms',
  end_of_year: 'End of year exams',
}

const CATEGORY_ORDER = ['pop_quiz', 'midterm', 'end_of_year']

export default function StudentDashboard() {
  const router = useRouter()
  const [exams, setExams] = useState<ExamItem[]>([])
  const [sessionMap, setSessionMap] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [studentProfile, setStudentProfile] = useState<{ full_name: string; student_id: string | null; grade_level: number | null } | null>(null)
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({})

  useEffect(() => {
    async function loadExams() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name, student_id, grade_level')
        .eq('id', user.id)
        .single()
      if (profileData) setStudentProfile(profileData)

      const { data: finalExams, error: finalError } = await supabase
        .from('final_exams')
        .select('id, title, subject, duration_minutes, published_at, exam_category')
        .order('published_at', { ascending: false })

      if (finalError) {
        setErrorMsg(finalError.message)
        setLoading(false)
        return
      }

      const { data: directExams, error: directError } = await supabase
        .from('draft_exams')
        .select('id, title, subject, exam_kind, direct_published_at, duration_minutes')
        .eq('direct_published', true)
        .order('direct_published_at', { ascending: false })

      if (directError) {
        setErrorMsg(directError.message)
        setLoading(false)
        return
      }

      const combined: ExamItem[] = [
        ...(finalExams || []).map((e) => ({
          id: e.id, title: e.title, subject: e.subject,
          duration_minutes: e.duration_minutes, kind: 'final_exam' as const,
          category: e.exam_category,
        })),
        ...(directExams || []).map((e) => ({
          id: e.id, title: e.title, subject: e.subject,
          duration_minutes: e.duration_minutes, kind: 'direct_exam' as const,
          category: e.exam_kind,
        })),
      ]
      setExams(combined)

      const { data: sessions } = await supabase
        .from('exam_sessions')
        .select('final_exam_id, draft_exam_id, status')
        .eq('student_id', user.id)

      const map: Record<string, string> = {}
      ;(sessions || []).forEach((s: any) => {
        const key = s.final_exam_id || s.draft_exam_id
        if (key) map[key] = s.status
      })
      setSessionMap(map)

      setLoading(false)
    }
    loadExams()
  }, [router])

  if (loading) return <div className="page-container">Loading…</div>

  const grouped: Record<string, ExamItem[]> = {}
  exams.forEach((e) => {
    if (!grouped[e.category]) grouped[e.category] = []
    grouped[e.category].push(e)
  })

  return (
    <div className="page-container">
      {studentProfile && (
        <div className="card" style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{studentProfile.full_name}</div>
            {studentProfile.student_id && (
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                Student ID: {studentProfile.student_id} · Grade {studentProfile.grade_level}
              </div>
            )}
          </div>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>My exams</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/student/self-mock"><button className="btn btn-secondary">Practice mock exam</button></Link>
          <Link href="/student/history"><button className="btn btn-ghost">My score history</button></Link>
        </div>
      </div>

      {errorMsg && <p className="banner banner-danger" style={{ marginTop: 16 }}>{errorMsg}</p>}

      {exams.length === 0 && !errorMsg && (
        <div className="card" style={{ marginTop: 24, textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)' }}>No exams available right now. Check back later.</p>
        </div>
      )}

      <div style={{ display: 'flex', gap: 16, marginTop: 32, flexWrap: 'wrap', alignItems: 'flex-start' }}>
      {CATEGORY_ORDER.map((cat) => {
        const items = grouped[cat]
        if (!items || items.length === 0) return null

        const isOpen = openCategories[cat] === true

        return (
          <div key={cat} style={{ flex: '1 1 280px', minWidth: 260 }}>
            <button
              onClick={() => setOpenCategories({ ...openCategories, [cat]: !isOpen })}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                width: '100%', background: 'var(--card-bg)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', padding: '14px 16px', cursor: 'pointer', textAlign: 'left',
                boxShadow: 'var(--shadow-card)',
              }}
            >
              <span className="section-label" style={{ fontSize: 13 }}>{CATEGORY_LABELS[cat]} ({items.length})</span>
              <span style={{ fontSize: 16, color: 'var(--accent)' }}>{isOpen ? '−' : '+'}</span>
            </button>
            {isOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
              {items.map((exam) => {
                const status = sessionMap[exam.id]
                const isCompleted = status === 'completed'
                const basePath = exam.kind === 'final_exam' ? '/student/exam' : '/student/direct-exam'

                return (
                  <div key={exam.id} className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>{exam.title}</div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 2 }}>
                          {exam.subject}
                          {exam.duration_minutes && ` — ${exam.duration_minutes} min`}
                        </div>
                      </div>
                      {isCompleted ? (
                        <Link href={`${basePath}/${exam.id}/results`}>
                          <button className="btn btn-secondary" style={{ whiteSpace: 'nowrap' }}>Results</button>
                        </Link>
                      ) : (
                        <Link href={`${basePath}/${exam.id}`}>
                          <button className="btn btn-primary" style={{ whiteSpace: 'nowrap' }}>
                            {status === 'in_progress' ? 'Resume' : 'Begin'}
                          </button>
                        </Link>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
            )}
          </div>
        )
      })}
      </div>
    </div>
  )
}
