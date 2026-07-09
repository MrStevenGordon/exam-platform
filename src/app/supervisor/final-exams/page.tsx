'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type ApprovedExam = {
  id: string
  title: string
  subject: string
  exam_kind: string
  term: string | null
  target_grade: number | null
  status: string
  created_at: string
  profiles: { full_name: string } | null
}

const KIND_LABELS: Record<string, string> = {
  monthly: 'Monthly Exam',
  midterm: 'Midterm Exam',
  end_of_term: 'End of Term',
  end_of_year: 'End of Year',
}

const TERM_LABELS: Record<string, string> = {
  christmas: 'Christmas Term',
  easter: 'Easter Term',
  summer: 'Summer Term',
}

export default function FinalExamsPage() {
  const router = useRouter()
  const [exams, setExams] = useState<ApprovedExam[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'approved' | 'published'>('approved')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data } = await supabase
        .from('draft_exams')
        .select('id, title, subject, exam_kind, term, target_grade, status, created_at, profiles!draft_exams_created_by_fkey(full_name)')
        .in('exam_kind', ['monthly', 'midterm', 'end_of_term', 'end_of_year'])
        .in('status', ['approved', 'published'])
        .order('created_at', { ascending: false })

      setExams((data as any) || [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div>Loading…</div>

  const filtered = exams.filter((e) =>
    activeTab === 'approved' ? e.status === 'approved' : e.status === 'published'
  )

  return (
    <div>
      <p className="portal-page-title">Final Exams</p>
      <p className="portal-page-sub">Approved exams ready to publish to students</p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button
          onClick={() => setActiveTab('approved')}
          className={activeTab === 'approved' ? 'btn btn-primary' : 'btn btn-ghost'}
          style={{ fontSize: 12 }}
        >
          Awaiting publish ({exams.filter(e => e.status === 'approved').length})
        </button>
        <button
          onClick={() => setActiveTab('published')}
          className={activeTab === 'published' ? 'btn btn-primary' : 'btn btn-ghost'}
          style={{ fontSize: 12 }}
        >
          Published ({exams.filter(e => e.status === 'published').length})
        </button>
      </div>

      {filtered.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 32 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>
            {activeTab === 'approved' ? '✓' : '📋'}
          </div>
          <p style={{ fontWeight: 700, margin: '0 0 6px' }}>
            {activeTab === 'approved' ? 'No exams awaiting publication' : 'No published exams yet'}
          </p>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0 }}>
            {activeTab === 'approved'
              ? 'Approved exams from senior team leads will appear here.'
              : 'Published exams will appear here after you publish them to students.'}
          </p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map((exam) => (
          <Link key={exam.id} href={`/supervisor/final-exams/${exam.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="card card-clickable">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{exam.title}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                    {exam.subject} · {KIND_LABELS[exam.exam_kind] || exam.exam_kind}
                    {exam.term && ` · ${TERM_LABELS[exam.term] || exam.term}`}
                    {exam.target_grade && ` · Grade ${exam.target_grade}`}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    Set by {(exam.profiles as any)?.full_name || 'Unknown'} · {new Date(exam.created_at).toLocaleDateString()}
                  </div>
                </div>
                <span className={`badge ${exam.status === 'published' ? 'badge-success' : 'badge-warning'}`}>
                  {exam.status === 'approved' ? 'Ready to publish' : 'Published'}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
