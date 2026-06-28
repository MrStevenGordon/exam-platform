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
  profiles: { full_name: string } | null
}

export default function SupervisorDashboard() {
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
        .select('id, title, subject, status, created_at, profiles!draft_exams_created_by_fkey(full_name)')
        .order('created_at', { ascending: false })

      if (error) {
        setErrorMsg(error.message)
      } else {
        setExams((data as any) || [])
      }
      setLoading(false)
    }
    loadExams()
  }, [router])

  if (loading) return <div style={{ padding: 40 }}>Loading...</div>

  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif', maxWidth: 800, margin: '0 auto' }}>
      <h1>Department Exam Submissions</h1>

      {errorMsg && <p style={{ color: 'red' }}>{errorMsg}</p>}

      {exams.length === 0 && !errorMsg && (
        <p>No exams submitted yet from your department's teachers.</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {exams.map((exam) => (
          <Link key={exam.id} href={`/supervisor/exam/${exam.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <strong>{exam.title}</strong>
                <span style={{
                  fontSize: 12,
                  padding: '4px 10px',
                  borderRadius: 12,
                  background: exam.status === 'draft' ? '#eee' : exam.status === 'submitted' ? '#fff3cd' : '#d4edda',
                }}>
                  {exam.status}
                </span>
              </div>
              <p style={{ color: '#666', margin: '4px 0 0' }}>
                {exam.subject} — by {exam.profiles?.full_name || 'Unknown'}
              </p>
            </div>
          </Link>
        ))}
      </div>

      <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid #ddd' }}>
        <Link href="/supervisor/final-exams">
          <button style={{ padding: '10px 20px', fontSize: 16 }}>Manage Final Exams</button>
        </Link>
      </div>
    </div>
  )
}
