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

  if (loading) return <div style={{ padding: 40 }}>Loading...</div>

  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif', maxWidth: 800, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1>My Exams</h1>
        <Link href="/teacher/new">
          <button style={{ padding: '10px 20px', fontSize: 16 }}>+ New Exam</button>
        </Link>
      </div>

      {errorMsg && <p style={{ color: 'red' }}>{errorMsg}</p>}

      {exams.length === 0 && !errorMsg && (
        <p>No exams yet. Click "New Exam" to create your first one.</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {exams.map((exam) => (
          <Link key={exam.id} href={`/teacher/exam/${exam.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
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
              <p style={{ color: '#666', margin: '4px 0 0' }}>{exam.subject}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
