'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type ReviewItem = {
  id: string
  answer: string
  points_awarded: number | null
  question_text: string
  question_type: string
  correct_answer: string | null
  points: number
}

type SessionInfo = {
  status: string
  results_released: boolean
  total_score: number | null
  max_possible_score: number | null
}

export default function ReviewDirectExamPage() {
  const router = useRouter()
  const params = useParams()
  const examId = params.id as string

  const [examTitle, setExamTitle] = useState('')
  const [session, setSession] = useState<SessionInfo | null>(null)
  const [items, setItems] = useState<ReviewItem[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data: examData } = await supabase
        .from('draft_exams')
        .select('title')
        .eq('id', examId)
        .single()
      setExamTitle(examData?.title || '')

      const { data: sessionData, error: sessionError } = await supabase
        .from('exam_sessions')
        .select('id, status, results_released, total_score, max_possible_score')
        .eq('draft_exam_id', examId)
        .eq('student_id', user.id)
        .single()

      if (sessionError || !sessionData) {
        setErrorMsg('No exam session found.')
        setLoading(false)
        return
      }
      setSession(sessionData)

      if (!sessionData.results_released) {
        setLoading(false)
        return
      }

      const { data: questionData, error: questionError } = await supabase
        .from('questions')
        .select('id, question_text, question_type, correct_answer, points, order_index')
        .eq('draft_exam_id', examId)
        .order('order_index', { ascending: true })

      if (questionError) {
        setErrorMsg(questionError.message)
        setLoading(false)
        return
      }

      const { data: responseData, error: responseError } = await supabase
        .from('responses')
        .select('id, answer, points_awarded, question_id')
        .eq('session_id', sessionData.id)

      if (responseError) {
        setErrorMsg(responseError.message)
        setLoading(false)
        return
      }

      const responseMap: Record<string, { id: string; answer: string; points_awarded: number | null }> = {}
      ;(responseData || []).forEach((r) => { responseMap[r.question_id] = r })

      const combined = (questionData || []).map((q: any) => {
        const r = responseMap[q.id]
        return {
          id: r?.id || q.id,
          answer: r?.answer || '',
          points_awarded: r?.points_awarded ?? null,
          question_text: q.question_text,
          question_type: q.question_type,
          correct_answer: q.correct_answer,
          points: q.points,
        }
      })

      setItems(combined)
      setLoading(false)
    }
    loadData()
  }, [examId, router])

  if (loading) return <div style={{ padding: 40 }}>Loading...</div>
  if (errorMsg) return <div style={{ padding: 40, color: 'red' }}>{errorMsg}</div>
  if (!session) return <div style={{ padding: 40 }}>No session found.</div>

  if (!session.results_released) {
    return (
      <div style={{ padding: 40, fontFamily: 'sans-serif', maxWidth: 700, margin: '0 auto' }}>
        <Link href="/student" style={{ color: '#666' }}>&larr; Back to My Exams</Link>
        <p style={{ marginTop: 24, padding: 16, background: '#fff3cd', borderRadius: 8 }}>
          Results haven't been released yet. Check back later.
        </p>
      </div>
    )
  }

  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif', maxWidth: 700, margin: '0 auto' }}>
      <Link href="/student" style={{ color: '#666' }}>&larr; Back to My Exams</Link>

      <h1 style={{ marginTop: 16 }}>{examTitle} — Review</h1>
      <p style={{ color: '#666' }}>Score: {session.total_score} / {session.max_possible_score}</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 24 }}>
        {items.map((item, i) => {
          const isEssay = item.question_type === 'essay'
          const isCorrect = !isEssay && item.points_awarded === item.points
          let borderColor = '#ddd'
          if (!isEssay) borderColor = isCorrect ? '#16a34a' : (item.points_awarded === 0 ? '#dc2626' : '#d97706')

          return (
            <div key={item.id} style={{ border: `2px solid ${borderColor}`, borderRadius: 8, padding: 16 }}>
              <p style={{ fontWeight: 600, margin: '0 0 8px' }}>{i + 1}. {item.question_text}</p>
              <p style={{ margin: '4px 0', fontSize: 14 }}>
                <strong>Your answer:</strong> {item.answer || <em>No answer provided</em>}
              </p>
              {!isEssay && item.correct_answer && item.answer !== item.correct_answer && (
                <p style={{ margin: '4px 0', fontSize: 14, color: '#16a34a' }}>
                  <strong>Correct answer:</strong> {item.correct_answer}
                </p>
              )}
              <p style={{ margin: '8px 0 0', fontSize: 14, fontWeight: 600 }}>
                {isEssay ? (
                  item.points_awarded !== null ? `Score: ${item.points_awarded} / ${item.points}` : 'Not yet graded'
                ) : (
                  <span style={{ color: isCorrect ? '#16a34a' : '#dc2626' }}>
                    {isCorrect ? '✓ Correct' : '✗ Incorrect'} — {item.points_awarded ?? 0} / {item.points} pts
                  </span>
                )}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
