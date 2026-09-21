'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import EmptyState from '@/components/EmptyState'

type DraftExam = {
  id: string
  title: string
  subject: string
  status: string
  exam_kind: string
  direct_published: boolean
  created_at: string
}

export default function TeacherHome() {
  const router = useRouter()
  const [exams, setExams] = useState<DraftExam[]>([])
  const [essayCount, setEssayCount] = useState(0)
  const [studentCount, setStudentCount] = useState(0)
  const [avgScore, setAvgScore] = useState<number | null>(null)
  const [scoreLoading, setScoreLoading] = useState(true)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      // Reads the locally cached session rather than asking the auth server
      // again: every query below runs under this user's token, so row-level
      // security still decides what comes back.
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) { router.push('/login'); return }

      // The essay-grading count and the average score both go through the
      // heavily policy-guarded exam_sessions / responses tables, which can
      // take seconds on a cold connection. Neither is needed to draw the
      // page, so they load in the background instead of holding it up.
      loadEssayCount()

      // These two don't depend on each other, so fire them together
      // instead of waiting on each round trip in turn.
      const [examsRes, classesRes] = await Promise.all([
        supabase
          .from('draft_exams')
          .select('id, title, subject, status, exam_kind, direct_published, created_at')
          .eq('created_by', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('teacher_class_groups')
          .select('class_group_id')
          .eq('teacher_id', user.id),
      ])
      setExams(examsRes.data || [])

      const classIds = (classesRes.data || []).map((tc) => tc.class_group_id)
      const enrollmentsRes = classIds.length > 0
        ? await supabase.from('enrollments').select('student_id', { count: 'exact' }).in('class_group_id', classIds)
        : { data: [] as { student_id: string }[], count: 0 }
      setStudentCount(enrollmentsRes.count || 0)

      loadAvgScore((enrollmentsRes.data || []).map((e) => e.student_id))
    } catch (err) {
      // A failed request here used to leave the page spinning forever,
      // since nothing after the throw ever reached setLoading(false).
      console.error('Failed to load teacher home data', err)
      setScoreLoading(false)
    } finally {
      setLoading(false)
    }
  }

  async function loadEssayCount() {
    try {
      const sessionsRes = await supabase.from('exam_sessions').select('id').eq('status', 'completed')
      if (sessionsRes.data && sessionsRes.data.length > 0) {
        const { count } = await supabase
          .from('responses')
          .select('id', { count: 'exact', head: true })
          .is('points_awarded', null)
          .in('session_id', sessionsRes.data.map((s) => s.id))
        setEssayCount(count || 0)
      }
    } catch (err) {
      console.error('Failed to load essay count', err)
    }
  }

  async function loadAvgScore(studentIds: string[]) {
    try {
      if (studentIds.length > 0) {
        const { data: scoreSessions } = await supabase
          .from('exam_sessions')
          .select('total_score, max_possible_score')
          .eq('status', 'completed')
          .not('total_score', 'is', null)
          .in('student_id', studentIds)

        if (scoreSessions && scoreSessions.length > 0) {
          const avg = scoreSessions.reduce((sum, s) => {
            return sum + (s.max_possible_score > 0 ? (s.total_score / s.max_possible_score) * 100 : 0)
          }, 0) / scoreSessions.length
          setAvgScore(Math.round(avg))
        }
      }
    } catch (err) {
      console.error('Failed to load average score', err)
    } finally {
      setScoreLoading(false)
    }
  }

  if (loading) return <div>Loading…</div>

  const kindLabels: Record<string, string> = {
    final_exam_submission: 'Final Exam', pop_quiz: 'Pop Quiz',
    midterm: 'Mid Term', end_of_year: 'End of Year',
    monthly: 'Monthly Exam', end_of_term: 'End of Term',
    class_test: 'Class Test', weekly_test: 'Weekly Test',
    assignment: 'Assignment', homework: 'Homework', group_project: 'Group Project',
  }

  const submitted = exams.filter((e) => e.status === 'submitted').length
  const published = exams.filter((e) => e.direct_published).length
  const drafts = exams.filter((e) => e.status === 'draft' && !e.direct_published).length

  return (
    <div>
      <p className="portal-page-title">Overview</p>
      <p className="portal-page-sub">Academic year 2026–2027</p>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-card-value">{exams.length}</div>
          <div className="stat-card-label">Total items</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-value">{studentCount}</div>
          <div className="stat-card-label">Number of students</div>
        </div>
        <div className="stat-card stat-card-accent">
          <div className="stat-card-value">{avgScore !== null ? `${avgScore}%` : scoreLoading ? '…' : 'N/A'}</div>
          <div className="stat-card-label">Student performance</div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div className="section-label">Recent activity</div>
        <Link href="/teacher/new">
          <button className="btn btn-primary" style={{ fontSize: 12, padding: '8px 16px' }}>+ New</button>
        </Link>
      </div>

      {exams.length === 0 && (
        <EmptyState icon="🗂️" title="Nothing yet" description="Everything you create (tasks, tests, and exams) will show up here." action={{ label: '+ Create your first item', href: '/teacher/new' }} />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {exams.slice(0, 6).map((exam) => {
          const statusLabel = exam.direct_published ? 'Published' : exam.status === 'submitted' ? 'Submitted' : exam.status === 'approved' ? 'Approved' : 'Draft'
          const statusClass = exam.direct_published ? 'badge-success' : exam.status === 'submitted' ? 'badge-warning' : exam.status === 'approved' ? 'badge-success' : 'badge-default'
          return (
            <Link key={exam.id} href={`/teacher/exam/${exam.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="card card-clickable" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{exam.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{exam.subject} · {kindLabels[exam.exam_kind] || exam.exam_kind}</div>
                </div>
                <span className={`badge ${statusClass}`}>{statusLabel}</span>
              </div>
            </Link>
          )
        })}
      </div>

      {essayCount > 0 && (
        <div className="banner banner-warning" style={{ marginTop: 16 }}>
          {essayCount} essay response{essayCount !== 1 ? 's' : ''} waiting to be graded.
          <Link href="/teacher/grade" style={{ marginLeft: 8, fontWeight: 700, color: 'var(--warning)' }}>Grade now →</Link>
        </div>
      )}
    </div>
  )
}
