'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type DraftExam = { id: string; title: string; subject: string; status: string; exam_kind: string; direct_published: boolean; created_at: string }

const TEST_KINDS = ['pop_quiz', 'class_test', 'weekly_test']

export default function TeacherTestsPage() {
  const router = useRouter()
  const [tests, setTests] = useState<DraftExam[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data } = await supabase
        .from('draft_exams')
        .select('id, title, subject, status, exam_kind, direct_published, created_at')
        .eq('created_by', user.id)
        .in('exam_kind', TEST_KINDS)
        .order('created_at', { ascending: false })
      setTests(data || [])
      setLoading(false)
    }
    load()
  }, [router])

  if (loading) return <div>Loading…</div>

  const kindLabels: Record<string, string> = { pop_quiz: 'Pop Quiz', class_test: 'Class Test', weekly_test: 'Weekly Test' }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <p className="portal-page-title" style={{ margin: 0 }}>Tests</p>
          <p className="portal-page-sub" style={{ margin: '4px 0 0' }}>Pop quizzes, class tests, and weekly tests — timed and proctored</p>
        </div>
        <Link href="/teacher/new?kind=test"><button className="btn btn-primary">+ New test</button></Link>
      </div>
      {tests.length === 0 && <div className="card"><p style={{ color: 'var(--text-secondary)' }}>No tests yet.</p></div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {tests.map((test) => {
          const statusLabel = test.direct_published ? 'Published' : test.status === 'submitted' ? 'Submitted' : test.status === 'approved' ? 'Approved' : 'Draft'
          const statusClass = test.direct_published || test.status === 'approved' ? 'badge-success' : test.status === 'submitted' ? 'badge-warning' : 'badge-default'
          return (
            <Link key={test.id} href={`/teacher/exam/${test.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="card card-clickable" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{test.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{test.subject} · {kindLabels[test.exam_kind] || test.exam_kind}</div>
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
