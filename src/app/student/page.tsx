'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type ExamItem = {
  id: string
  title: string
  subject: string
  duration_minutes: number | null
  kind: 'final_exam' | 'direct_exam'
  exam_kind?: string
}

export default function StudentDashboard() {
  const router = useRouter()
  const [exams, setExams] = useState<ExamItem[]>([])
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

      const { data: finalExams, error: finalError } = await supabase
        .from('final_exams')
        .select('id, title, subject, duration_minutes, published_at')
        .order('published_at', { ascending: false })

      if (finalError) {
        setErrorMsg(finalError.message)
        setLoading(false)
        return
      }

      const { data: directExams, error: directError } = await supabase
        .from('draft_exams')
        .select('id, title, subject, exam_kind, direct_published_at')
        .eq('direct_published', true)
        .order('direct_published_at', { ascending: false })

      if (directError) {
        setErrorMsg(directError.message)
        setLoading(false)
        return
      }

      const combined: ExamItem[] = [
        ...(finalExams || []).map((e) => ({
          id: e.id, title: e.title, subject: e.subject,
          duration_minutes: e.duration_minutes, kind: 'final_exam' as const,
        })),
        ...(directExams || []).map((e) => ({
          id: e.id, title: e.title, subject: e.subject,
          duration_minutes: null, kind: 'direct_exam' as const, exam_kind: e.exam_kind,
        })),
      ]
      setExams(combined)

      const { data: sessions } = await supabase
        .from('exam_sessions')
        .select('final_exam_id, draft_exam_id, status')
        .eq('student_id', user.id)

      const map: Record<string, string> = {}
      ;(sessions || []).forEach((s: any) => {
        const key = s.final_exam_id || s.draft_exam_id
        if (key) map[key] = s.status
      })
      setSessionMap(map)

      setLoading(false)
    }
    loadExams()
  }, [router])

  if (loading) return <div style={{ padding: 40 }}>Loading...</div>

  const kindLabels: Record<string, string> = {
    mock: 'Mock Exam',
    pop_quiz: 'Pop Quiz',
    midterm: 'Midterm Exam',
  }

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
          const basePath = exam.kind === 'final_exam' ? '/student/exam' : '/student/direct-exam'

          return (
            <div key={exam.id} style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong>{exam.title}</strong>
                  <p style={{ color: '#666', margin: '4px 0 0' }}>
                    {exam.subject}
                    {exam.exam_kind && ` — ${kindLabels[exam.exam_kind]}`}
                    {exam.duration_minutes && ` — ${exam.duration_minutes} minutes`}
                  </p>
                </div>
                {isCompleted ? (
                  <Link href={`${basePath}/${exam.id}/results`}>
                    <button style={{ padding: '8px 16px', fontSize: 14, background: '#2563eb', color: 'white', border: 'none', borderRadius: 6 }}>
                      View Results
                    </button>
                  </Link>
                ) : (
                  <Link href={`${basePath}/${exam.id}`}>
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
