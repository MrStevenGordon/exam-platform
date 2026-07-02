'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Exam = { id: string; title: string; subject: string; duration_minutes: number; exam_category: string }

export default function StudentExamsPage() {
  const router = useRouter()
  const [exams, setExams] = useState<Exam[]>([])
  const [sessionMap, setSessionMap] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data } = await supabase.from('final_exams').select('id, title, subject, duration_minutes, exam_category').order('published_at', { ascending: false })
      setExams(data || [])
      const { data: sessions } = await supabase.from('exam_sessions').select('final_exam_id, status').eq('student_id', user.id)
      const map: Record<string, string> = {}
      ;(sessions || []).forEach((s: any) => { if (s.final_exam_id) map[s.final_exam_id] = s.status })
      setSessionMap(map)
      setLoading(false)
    }
    load()
  }, [router])

  if (loading) return <div>Loading…</div>

  const kindLabels: Record<string, string> = { pop_quiz: 'Pop Quiz', midterm: 'Mid Term', end_of_year: 'End of Year' }

  return (
    <div>
      <p className="portal-page-title">End of Year Exams</p>
      <p className="portal-page-sub">Supervisor-approved examinations</p>
      {exams.length === 0 && <div className="card"><p style={{ color: 'var(--text-secondary)' }}>No exams available yet.</p></div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {exams.map((exam) => {
          const status = sessionMap[exam.id]
          return (
            <Link key={exam.id} href={status === 'completed' ? `/student/exam/${exam.id}/results` : `/student/exam/${exam.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="card card-clickable" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{exam.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{exam.subject} · {kindLabels[exam.exam_category]} · {exam.duration_minutes} min</div>
                </div>
                <span className={`badge ${status === 'completed' ? 'badge-success' : status === 'in_progress' ? 'badge-warning' : 'badge-default'}`}>
                  {status === 'completed' ? 'View results' : status === 'in_progress' ? 'Resume' : 'Begin'}
                </span>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
