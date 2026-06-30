'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type DraftExam = {
  id: string
  title: string
  subject: string
  status: string
  created_at: string
}

export default function TeacherDashboard() {
  const router = useRouter()
  const [exams, setExams] = useState<DraftExam[]>([])
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
        .from('draft_exams')
        .select('id, title, subject, status, created_at')
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

  function statusBadgeClass(status: string) {
    if (status === 'submitted') return 'badge badge-warning'
    if (status === 'approved' || status === 'direct_published') return 'badge badge-success'
    return 'badge badge-default'
  }

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>My exams</h1>
        <Link href="/teacher/new">
          <button className="btn btn-primary">+ New exam</button>
        </Link>
      </div>

      {errorMsg && <p className="banner banner-danger" style={{ marginTop: 16 }}>{errorMsg}</p>}

      {exams.length === 0 && !errorMsg && (
        <div className="card" style={{ marginTop: 24, textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)' }}>No exams yet. Click "New exam" to create your first one.</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 24 }}>
        {exams.map((exam) => (
          <Link key={exam.id} href={`/teacher/exam/${exam.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="card card-clickable">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>{exam.title}</strong>
                <span className={statusBadgeClass(exam.status)}>{exam.status}</span>
              </div>
              <p style={{ color: 'var(--text-secondary)', marginTop: 4, fontSize: 14 }}>{exam.subject}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
