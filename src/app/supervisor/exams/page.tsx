'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Exam = {
  id: string
  title: string
  subject: string
  exam_kind: string
  status: string
  direct_published: boolean
  created_at: string
}

export default function SupervisorExamsPage() {
  const router = useRouter()
  const [exams, setExams] = useState<Exam[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data } = await supabase
        .from('draft_exams')
        .select('id, title, subject, exam_kind, status, direct_published, created_at')
        .eq('created_by', user.id)
        .eq('exam_kind', 'pop_quiz')
        .order('created_at', { ascending: false })

      setExams(data || [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div>Loading…</div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <p className="portal-page-title" style={{ margin: 0 }}>My Exams</p>
          <p className="portal-page-sub" style={{ margin: '4px 0 0' }}>Pop quizzes and class tests</p>
        </div>
        <Link href="/supervisor/exams/new">
          <button className="btn btn-primary">+ New exam</button>
        </Link>
      </div>

      {exams.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 32 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📝</div>
          <p style={{ fontWeight: 700, margin: '0 0 6px' }}>No exams yet</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: '0 0 16px' }}>
            Create pop quizzes and class tests for your students.
          </p>
          <Link href="/supervisor/exams/new">
            <button className="btn btn-primary">Create your first exam</button>
          </Link>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {exams.map((exam) => (
          <Link key={exam.id} href={`/teacher/exam/${exam.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="card card-clickable" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{exam.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                  {exam.subject} · {exam.exam_kind.replace('_', ' ')}
                </div>
              </div>
              <span className={`badge ${exam.direct_published ? 'badge-success' : 'badge-default'}`}>
                {exam.direct_published ? 'published' : exam.status}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
