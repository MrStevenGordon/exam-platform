'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Exam = { id: string; title: string; subject: string; exam_kind: string; duration_minutes: number; profiles?: { full_name: string } | null }

const TASK_KINDS = ['homework', 'assignment']

export default function StudentTasksPage() {
  const router = useRouter()
  const [exams, setExams] = useState<Exam[]>([])
  const [sessionMap, setSessionMap] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data } = await supabase
        .from('draft_exams')
        .select('id, title, subject, exam_kind, duration_minutes, profiles!draft_exams_created_by_fkey(full_name)')
        .eq('direct_published', true)
        .in('exam_kind', TASK_KINDS)
        .order('direct_published_at', { ascending: false })
      setExams((data as any) || [])
      const { data: sessions } = await supabase.from('exam_sessions').select('draft_exam_id, status').eq('student_id', user.id)
      const map: Record<string, string> = {}
      ;(sessions || []).forEach((s: any) => { if (s.draft_exam_id) map[s.draft_exam_id] = s.status })
      setSessionMap(map)
      setLoading(false)
    }
    load()
  }, [router])

  if (loading) return <div>Loading…</div>

  const kindLabels: Record<string, string> = { homework: 'Homework', assignment: 'Assignment' }

  const grouped: Record<string, Exam[]> = {}
  exams.forEach((e) => {
    if (!grouped[e.exam_kind]) grouped[e.exam_kind] = []
    grouped[e.exam_kind].push(e)
  })

  return (
    <div>
      <p className="portal-page-title">Tasks</p>
      <p className="portal-page-sub">Homework and assignments</p>
      {exams.length === 0 && <div className="card"><p style={{ color: 'var(--text-secondary)' }}>No tasks available yet.</p></div>}
      {TASK_KINDS.map((kind) => {
        const items = grouped[kind]
        if (!items?.length) return null
        return (
          <div key={kind} style={{ marginBottom: 24 }}>
            <div className="section-label" style={{ marginBottom: 10 }}>{kindLabels[kind]}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {items.map((exam) => {
                const status = sessionMap[exam.id]
                return (
                  <Link key={exam.id} href={status === 'completed' ? `/student/direct-exam/${exam.id}/results` : `/student/direct-exam/${exam.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div className="card card-clickable" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{exam.title}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{exam.subject}</div>
                        {(exam as any).profiles?.full_name && (
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Set by {(exam as any).profiles.full_name}</div>
                        )}
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
      })}
    </div>
  )
}
