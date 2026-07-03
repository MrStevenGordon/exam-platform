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
  options: string[] | null
  points: number
}

type SessionInfo = {
  status: string
  results_released: boolean
  total_score: number | null
  max_possible_score: number | null
}

export default function ReviewExamPage() {
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
        .from('final_exams')
        .select('title')
        .eq('id', examId)
        .single()
      setExamTitle(examData?.title || '')

      const { data: sessionData, error: sessionError } = await supabase
        .from('exam_sessions')
        .select('id, status, results_released, total_score, max_possible_score')
        .eq('final_exam_id', examId)
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

      const { data: linkData, error: linkError } = await supabase
        .from('final_exam_questions')
        .select('order_index, questions(id, question_text, question_type, correct_answer, options, points)')
        .eq('final_exam_id', examId)
        .order('order_index', { ascending: true })

      if (linkError) {
        setErrorMsg(linkError.message)
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
      ;(responseData || []).forEach((r) => {
        responseMap[r.question_id] = r
      })

      const combined = (linkData || [])
        .map((l: any) => l.questions)
        .filter(Boolean)
        .map((q: any) => {
          const r = responseMap[q.id]
          return {
            id: r?.id || q.id,
            answer: r?.answer || '',
            points_awarded: r?.points_awarded ?? null,
            question_text: q.question_text,
            question_type: q.question_type,
            correct_answer: q.correct_answer,
            options: q.options,
            points: q.points,
          }
        })

      setItems(combined)
      setLoading(false)
    }
    loadData()
  }, [examId, router])

  if (loading) return <div className="page-container">Loading…</div>
  if (errorMsg) return <div className="page-container"><p className="banner banner-danger">{errorMsg}</p></div>
  if (!session) return <div className="page-container">No session found.</div>

  if (!session.results_released) {
    return (
      <div className="page-container" style={{ maxWidth: 640 }}>
        <Link href="/student" style={{ color: 'var(--text-secondary)', fontSize: 14 }}>&larr; Back to my exams</Link>
        <div className="banner banner-warning" style={{ marginTop: 24 }}>
          Results haven't been released for this exam yet. Check back later.
        </div>
      </div>
    )
  }

  return (
    <div className="page-container" style={{ maxWidth: 640 }}>
      <Link href="/student" style={{ color: 'var(--text-secondary)', fontSize: 14 }}>&larr; Back to my exams</Link>

      <h1 style={{ marginTop: 16 }}>{examTitle} — Review</h1>
      <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>
        Score: {session.total_score} / {session.max_possible_score}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 24 }}>
        {items.map((item, i) => {
          const isEssay = item.question_type === 'essay'
          const isCorrect = !isEssay && item.points_awarded === item.points
          const isPartial = !isEssay && item.points_awarded !== null && item.points_awarded > 0 && item.points_awarded < item.points

          let borderColor = 'var(--border-strong)'
          if (!isEssay) {
            borderColor = isCorrect ? 'var(--success)' : (item.points_awarded === 0 ? 'var(--danger)' : 'var(--warning)')
          }

          return (
            <div key={item.id} className="card" style={{ borderLeft: `4px solid ${borderColor}` }}>
              <p style={{ fontWeight: 600, margin: '0 0 8px' }}>
                {i + 1}. {item.question_text}
              </p>

              <div style={{ margin: '4px 0', fontSize: 14 }}>
                <strong>Your answer:</strong>
                {!item.answer ? (
                  <em style={{ color: 'var(--text-secondary)', marginLeft: 6 }}>No answer provided</em>
                ) : item.answer.includes('\n') ? (
                  <ol style={{ margin: '6px 0 0', paddingLeft: 20 }}>
                    {item.answer.split('\n').filter((a: string) => a.trim()).map((a: string, i: number) => (
                      <li key={i} style={{ marginBottom: 4 }}>{a.trim()}</li>
                    ))}
                  </ol>
                ) : (
                  <span style={{ marginLeft: 6 }}>{item.answer}</span>
                )}
              </div>

              {!isEssay && item.correct_answer && item.answer !== item.correct_answer && (
                <p style={{ margin: '4px 0', fontSize: 14, color: 'var(--success)' }}>
                  <strong>Correct answer:</strong> {item.correct_answer}
                </p>
              )}

              <p style={{ margin: '8px 0 0', fontSize: 14, fontWeight: 600 }}>
                {isEssay ? (
                  item.points_awarded !== null
                    ? `Score: ${item.points_awarded} / ${item.points}`
                    : 'Not yet graded'
                ) : (
                  <span style={{ color: isCorrect ? 'var(--success)' : 'var(--danger)' }}>
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
