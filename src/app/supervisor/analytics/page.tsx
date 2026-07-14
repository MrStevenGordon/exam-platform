'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type FinalExam = { id: string; title: string; subject: string; status: string }

export default function SupervisorAnalyticsPage() {
  const router = useRouter()
  const [exams, setExams] = useState<FinalExam[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data } = await supabase.from('final_exams').select('id, title, subject, status').eq('status', 'published').order('published_at', { ascending: false })
      setExams(data || [])
      setLoading(false)
    }
    load()
  }, [router])

  if (loading) return <div>Loading…</div>

  return (
    <div>
      <p className="portal-page-title">Analytics</p>
      <p className="portal-page-sub">Published exams</p>
      {exams.length === 0 && (
        <div className="card"><p style={{ color: 'var(--text-secondary)' }}>No published exams with results yet.</p></div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {exams.map((exam) => (
          <Link key={exam.id} href={`/supervisor/final-exams/${exam.id}/analytics`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="card card-clickable" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{exam.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{exam.subject}</div>
              </div>
              <span className="badge badge-success">View analytics →</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
