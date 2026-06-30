'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type FinalExam = {
  id: string
  title: string
  subject: string
  status: string
  duration_minutes: number
  created_at: string
}

export default function FinalExamsListPage() {
  const router = useRouter()
  const [exams, setExams] = useState<FinalExam[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    async function loadExams() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data, error } = await supabase
        .from('final_exams')
        .select('id, title, subject, status, duration_minutes, created_at')
        .order('created_at', { ascending: false })

      if (error) {
        setErrorMsg(error.message)
      } else {
        setExams(data || [])
      }
      setLoading(false)
    }
    loadExams()
  }, [router])

  if (loading) return <div className="page-container">Loading…</div>

  return (
    <div className="page-container">
      <Link href="/supervisor" style={{ color: 'var(--text-secondary)', fontSize: 14 }}>&larr; Back to submissions</Link>

      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Final exams</h1>
        <Link href="/supervisor/final-exams/new">
          <button className="btn btn-primary">+ New final exam</button>
        </Link>
      </div>

      {errorMsg && <p className="banner banner-danger" style={{ marginTop: 16 }}>{errorMsg}</p>}

      {exams.length === 0 && !errorMsg && (
        <div className="card" style={{ marginTop: 20 }}>
          <p style={{ color: 'var(--text-secondary)' }}>No final exams created yet.</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {exams.map((exam) => (
          <Link key={exam.id} href={`/supervisor/final-exams/${exam.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="card card-clickable">
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <strong>{exam.title}</strong>
                <span className={`badge ${exam.status === 'draft' ? 'badge-default' : exam.status === 'published' ? 'badge-success' : 'badge-danger'}`}>
                  {exam.status}
                </span>
              </div>
              <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0', fontSize: 14 }}>
                {exam.subject} — {exam.duration_minutes} minutes
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
