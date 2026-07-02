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
  created_at: string
  profiles: { full_name: string } | null
}

type FinalExam = {
  id: string
  title: string
  subject: string
  status: string
}

export default function SupervisorHome() {
  const router = useRouter()
  const [submissions, setSubmissions] = useState<DraftExam[]>([])
  const [finalExams, setFinalExams] = useState<FinalExam[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: submissionsData } = await supabase
      .from('draft_exams')
      .select('id, title, subject, status, created_at, profiles!draft_exams_created_by_fkey(full_name)')
      .eq('exam_kind', 'final_exam_submission')
      .eq('status', 'submitted')
      .order('created_at', { ascending: false })
    setSubmissions((submissionsData as any) || [])

    const { data: finalData } = await supabase
      .from('final_exams')
      .select('id, title, subject, status')
      .order('created_at', { ascending: false })
      .limit(5)
    setFinalExams(finalData || [])

    setLoading(false)
  }

  if (loading) return <div>Loading…</div>

  const filtered = submissions.filter((e) => {
    const q = search.toLowerCase()
    return !q || e.title?.toLowerCase().includes(q) || e.subject?.toLowerCase().includes(q) || (e.profiles as any)?.full_name?.toLowerCase().includes(q)
  })

  return (
    <div>
      <p className="portal-page-title">Department overview</p>
      <p className="portal-page-sub">Academic year 2026–2027</p>

      <div className="stat-grid">
        <div className={`stat-card ${submissions.length > 0 ? 'stat-card-accent' : 'stat-card-success'}`}>
          <div className="stat-card-value">{submissions.length}</div>
          <div className="stat-card-label">Pending review</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-value">{finalExams.length}</div>
          <div className="stat-card-label">Final exams</div>
        </div>
        <div className="stat-card stat-card-success">
          <div className="stat-card-value">{finalExams.filter((e) => e.status === 'published').length}</div>
          <div className="stat-card-label">Published</div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div className="section-label">Pending submissions</div>
      </div>

      <input
        type="text"
        placeholder="Search by title, subject or teacher…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ width: '100%', marginBottom: 12 }}
      />

      {filtered.length === 0 && (
        <div className="card">
          <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            {submissions.length === 0 ? 'No submissions awaiting review.' : 'No results match your search.'}
          </p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.map((exam) => (
          <Link key={exam.id} href={`/supervisor/exam/${exam.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="card card-clickable" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{exam.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                  {exam.subject} · by {(exam.profiles as any)?.full_name || 'Unknown'}
                </div>
              </div>
              <span className="badge badge-warning">Review</span>
            </div>
          </Link>
        ))}
      </div>

      {finalExams.length > 0 && (
        <>
          <div className="section-label" style={{ marginTop: 24, marginBottom: 10 }}>Final exams</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {finalExams.map((exam) => (
              <Link key={exam.id} href={`/supervisor/final-exams/${exam.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div className="card card-clickable" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{exam.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{exam.subject}</div>
                  </div>
                  <span className={`badge ${exam.status === 'published' ? 'badge-success' : 'badge-default'}`}>{exam.status}</span>
                </div>
              </Link>
            ))}
          </div>
          <Link href="/supervisor/final-exams" style={{ fontSize: 12, color: 'var(--accent-dark)', display: 'block', marginTop: 8 }}>
            View all final exams →
          </Link>
        </>
      )}
    </div>
  )
}
