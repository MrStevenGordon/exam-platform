'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type DraftExam = { id: string; title: string; subject: string; status: string; exam_kind: string; direct_published: boolean; created_at: string }

const TASK_KINDS = ['homework', 'assignment']

export default function TeacherTasksPage() {
  const router = useRouter()
  const [tasks, setTasks] = useState<DraftExam[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data } = await supabase
        .from('draft_exams')
        .select('id, title, subject, status, exam_kind, direct_published, created_at')
        .eq('created_by', user.id)
        .in('exam_kind', TASK_KINDS)
        .order('created_at', { ascending: false })
      setTasks(data || [])
      setLoading(false)
    }
    load()
  }, [router])

  if (loading) return <div>Loading…</div>

  const kindLabels: Record<string, string> = { homework: 'Homework', assignment: 'Assignment' }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <p className="portal-page-title" style={{ margin: 0 }}>Tasks</p>
          <p className="portal-page-sub" style={{ margin: '4px 0 0' }}>Homework and assignments</p>
        </div>
        <Link href="/teacher/new?kind=task"><button className="btn btn-primary">+ New task</button></Link>
      </div>
      {tasks.length === 0 && <div className="card"><p style={{ color: 'var(--text-secondary)' }}>No tasks yet.</p></div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {tasks.map((task) => {
          const statusLabel = task.direct_published ? 'Published' : task.status === 'submitted' ? 'Submitted' : task.status === 'approved' ? 'Approved' : 'Draft'
          const statusClass = task.direct_published || task.status === 'approved' ? 'badge-success' : task.status === 'submitted' ? 'badge-warning' : 'badge-default'
          return (
            <Link key={task.id} href={`/teacher/exam/${task.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="card card-clickable" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{task.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{task.subject} · {kindLabels[task.exam_kind] || task.exam_kind}</div>
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
