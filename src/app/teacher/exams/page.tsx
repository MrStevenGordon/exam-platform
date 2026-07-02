'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type DraftExam = { id: string; title: string; subject: string; status: string; exam_kind: string; direct_published: boolean; created_at: string }

export default function TeacherExamsPage() {
  const router = useRouter()
  const [exams, setExams] = useState<DraftExam[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data } = await supabase.from('draft_exams').select('id, title, subject, status, exam_kind, direct_published, created_at').eq('created_by', user.id).order('created_at', { ascending: false })
      setExams(data || [])
      setLoading(false)
    }
    load()
  }, [router])

  if (loading) return <div>Loading…</div>

  const kindLabels: Record<string, string> = { final_exam_submission: 'Final Exam', pop_quiz: 'Pop Quiz', midterm: 'Mid Term', end_of_year: 'End of Year' }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <p className="portal-page-title" style={{ margin: 0 }}>My Exams</p>
          <p className="portal-page-sub" style={{ margin: '4px 0 0' }}>All your created exams</p>
        </div>
        <Link href="/teacher/new"><button className="btn btn-primary">+ New exam</button></Link>
      </div>
      {exams.length === 0 && <div className="card"><p style={{ color: 'var(--text-secondary)' }}>No exams yet.</p></div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {exams.map((exam) => {
          const statusLabel = exam.direct_published ? 'Published' : exam.status === 'submitted' ? 'Submitted' : exam.status === 'approved' ? 'Approved' : 'Draft'
          const statusClass = exam.direct_published || exam.status === 'approved' ? 'badge-success' : exam.status === 'submitted' ? 'badge-warning' : 'badge-default'
          return (
            <Link key={exam.id} href={`/teacher/exam/${exam.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="card card-clickable" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{exam.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{exam.subject} · {kindLabels[exam.exam_kind]}</div>
                </div>
                <span className={`badge ${statusClass}`}>{statusLabel}</span>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
