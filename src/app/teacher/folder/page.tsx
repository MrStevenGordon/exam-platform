'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type DraftExam = { id: string; title: string; subject: string; exam_kind: string; created_at: string }

const TASK_KINDS = ['homework', 'assignment', 'group_project']
const TEST_KINDS = ['pop_quiz', 'class_test', 'weekly_test']

const KIND_LABELS: Record<string, string> = {
  homework: 'Homework',
  assignment: 'Assignment',
  pop_quiz: 'Pop Quiz',
  class_test: 'Class Test',
  weekly_test: 'Weekly Test',
}

export default function TeacherFolderPage() {
  const router = useRouter()
  const [items, setItems] = useState<DraftExam[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data } = await supabase
        .from('draft_exams')
        .select('id, title, subject, exam_kind, created_at')
        .eq('created_by', user.id)
        .eq('direct_published', true)
        .order('created_at', { ascending: false })
      setItems(data || [])
      setLoading(false)
    }
    load()
  }, [router])

  if (loading) return <div>Loading…</div>

  const tasks = items.filter((i) => TASK_KINDS.includes(i.exam_kind))
  const tests = items.filter((i) => TEST_KINDS.includes(i.exam_kind))

  function renderItem(item: DraftExam) {
    return (
      <Link key={item.id} href={`/teacher/exam/${item.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
        <div className="card card-clickable" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{item.title}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{item.subject} · {KIND_LABELS[item.exam_kind] || item.exam_kind}</div>
          </div>
          <span className="badge badge-success">Published</span>
        </div>
      </Link>
    )
  }

  return (
    <div>
      <p className="portal-page-title" style={{ margin: 0 }}>Folder</p>
      <p className="portal-page-sub" style={{ margin: '4px 0 0' }}>Everything you've published</p>

      {items.length === 0 && (
        <div className="card" style={{ marginTop: 20 }}>
          <p style={{ color: 'var(--text-secondary)' }}>Nothing published yet. Publish a task or test to see it here.</p>
        </div>
      )}

      {tasks.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div className="section-label" style={{ marginBottom: 10 }}>Tasks ({tasks.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {tasks.map(renderItem)}
          </div>
        </div>
      )}

      {tests.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div className="section-label" style={{ marginBottom: 10 }}>Tests ({tests.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {tests.map(renderItem)}
          </div>
        </div>
      )}
    </div>
  )
}
