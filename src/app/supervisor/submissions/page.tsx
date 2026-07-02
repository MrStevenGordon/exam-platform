'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type DraftExam = { id: string; title: string; subject: string; status: string; created_at: string; profiles: { full_name: string } | null }

export default function SupervisorSubmissionsPage() {
  const router = useRouter()
  const [exams, setExams] = useState<DraftExam[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data } = await supabase.from('draft_exams').select('id, title, subject, status, created_at, profiles!draft_exams_created_by_fkey(full_name)').eq('exam_kind', 'final_exam_submission').order('created_at', { ascending: false })
      setExams((data as any) || [])
      setLoading(false)
    }
    load()
  }, [router])

  if (loading) return <div>Loading…</div>

  const filtered = exams.filter((e) => {
    const q = search.toLowerCase()
    return !q || e.title?.toLowerCase().includes(q) || e.subject?.toLowerCase().includes(q) || (e.profiles as any)?.full_name?.toLowerCase().includes(q)
  })

  return (
    <div>
      <p className="portal-page-title">Submissions</p>
      <p className="portal-page-sub">All teacher exam submissions</p>
      <input type="text" placeholder="Search by title, subject or teacher…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: '100%', marginBottom: 16 }} />
      {filtered.length === 0 && <div className="card"><p style={{ color: 'var(--text-secondary)' }}>No submissions found.</p></div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.map((exam) => (
          <Link key={exam.id} href={`/supervisor/exam/${exam.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="card card-clickable" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{exam.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{exam.subject} · by {(exam.profiles as any)?.full_name || 'Unknown'}</div>
              </div>
              <span className={`badge ${exam.status === 'submitted' ? 'badge-warning' : exam.status === 'approved' ? 'badge-success' : 'badge-default'}`}>{exam.status}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
