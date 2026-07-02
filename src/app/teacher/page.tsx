'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

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
  const [bankCount, setBankCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: examData } = await supabase
      .from('draft_exams')
      .select('id, title, subject, status, exam_kind, direct_published, created_at')
      .eq('created_by', user.id)
      .order('created_at', { ascending: false })
    setExams(examData || [])

    const { data: sessions } = await supabase
      .from('exam_sessions')
      .select('id')
      .eq('status', 'completed')

    if (sessions && sessions.length > 0) {
      const { count } = await supabase
        .from('responses')
        .select('id', { count: 'exact', head: true })
        .is('points_awarded', null)
        .in('session_id', sessions.map((s) => s.id))
      setEssayCount(count || 0)
    }

    const { count: bank } = await supabase
      .from('questions')
      .select('id', { count: 'exact', head: true })
      .eq('created_by', user.id)
      .eq('is_bank_question', true)
    setBankCount(bank || 0)

    setLoading(false)
  }

  if (loading) return <div>Loading…</div>

  const kindLabels: Record<string, string> = {
    final_exam_submission: 'Final Exam', pop_quiz: 'Pop Quiz',
    midterm: 'Mid Term', end_of_year: 'End of Year',
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
          <div className="stat-card-label">Total exams</div>
        </div>
        <div className={`stat-card ${submitted > 0 ? 'stat-card-accent' : ''}`}>
          <div className="stat-card-value">{submitted}</div>
          <div className="stat-card-label">Pending review</div>
        </div>
        <div className={`stat-card ${essayCount > 0 ? 'stat-card-danger' : 'stat-card-success'}`}>
          <div className="stat-card-value">{essayCount}</div>
          <div className="stat-card-label">Essays to grade</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-value">{bankCount}</div>
          <div className="stat-card-label">Bank questions</div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div className="section-label">Recent exams</div>
        <Link href="/teacher/new">
          <button className="btn btn-primary" style={{ fontSize: 12, padding: '8px 16px' }}>+ New exam</button>
        </Link>
      </div>

      {exams.length === 0 && (
        <div className="card">
          <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>No exams yet. Create your first one.</p>
        </div>
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
