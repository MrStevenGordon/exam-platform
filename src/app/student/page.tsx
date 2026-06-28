'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type FinalExam = {
  id: string
  title: string
  subject: string
  duration_minutes: number
  published_at: string
}

export default function StudentDashboard() {
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
        .select('id, title, subject, duration_minutes, published_at')
        .order('published_at', { ascending: false })

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
      <h1>My Exams</h1>

      {errorMsg && <p style={{ color: 'red' }}>{errorMsg}</p>}

      {exams.length === 0 && !errorMsg && (
        <p>No exams available right now. Check back later.</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {exams.map((exam) => (
          <Link key={exam.id} href={`/student/exam/${exam.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, cursor: 'pointer' }}>
              <strong>{exam.title}</strong>
              <p style={{ color: '#666', margin: '4px 0 0' }}>
                {exam.subject} — {exam.duration_minutes} minutes
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
