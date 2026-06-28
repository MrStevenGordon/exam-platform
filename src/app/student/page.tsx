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

type SessionStatus = {
  final_exam_id: string
  status: string
}

export default function StudentDashboard() {
  const router = useRouter()
  const [exams, setExams] = useState<FinalExam[]>([])
  const [sessionMap, setSessionMap] = useState<Record<string, string>>({})
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
        setLoading(false)
        return
      }
      setExams(data || [])

      const { data: sessions } = await supabase
        .from('exam_sessions')
        .select('final_exam_id, status')
        .eq('student_id', user.id)

      const map: Record<string, string> = {}
      ;(sessions || []).forEach((s) => {
        map[s.final_exam_id] = s.status
      })
      setSessionMap(map)

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
        {exams.map((exam) => {
          const status = sessionMap[exam.id]
          const isCompleted = status === 'completed'

          return (
            <div key={exam.id} style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong>{exam.title}</strong>
                  <p style={{ color: '#666', margin: '4px 0 0' }}>
                    {exam.subject} — {exam.duration_minutes} minutes
                  </p>
                </div>
                {isCompleted ? (
                  <Link href={`/student/exam/${exam.id}/results`}>
                    <button style={{ padding: '8px 16px', fontSize: 14, background: '#2563eb', color: 'white', border: 'none', borderRadius: 6 }}>
                      View Results
                    </button>
                  </Link>
                ) : (
                  <Link href={`/student/exam/${exam.id}`}>
                    <button style={{ padding: '8px 16px', fontSize: 14 }}>
                      {status === 'in_progress' ? 'Resume' : 'Begin'}
                    </button>
                  </Link>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
