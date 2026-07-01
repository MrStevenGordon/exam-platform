'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type ResultData = {
  status: string
  total_score: number | null
  max_possible_score: number | null
  results_released: boolean
}

export default function ResultsPage() {
  const router = useRouter()
  const params = useParams()
  const examId = params.id as string

  const [result, setResult] = useState<ResultData | null>(null)
  const [examTitle, setExamTitle] = useState('')
  const [classAvg, setClassAvg] = useState<number | null>(null)
  const [classAvg, setClassAvg] = useState<number | null>(null)
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

      const { data, error } = await supabase
        .from('exam_sessions')
        .select('status, total_score, max_possible_score, results_released')
        .eq('final_exam_id', examId)
        .eq('student_id', user.id)
        .single()

      if (error) {
        setErrorMsg(error.message)
      } else {
        setResult(data)
        if (data?.results_released) {
          const { data: allSessions } = await supabase
            .from('exam_sessions')
            .select('total_score, max_possible_score')
            .eq('final_exam_id', examId)
            .eq('status', 'completed')
            .eq('results_released', true)
          if (allSessions && allSessions.length > 0) {
            const valid = allSessions.filter((s) => s.max_possible_score > 0)
            const avg = valid.length
              ? Math.round(valid.reduce((sum, s) => sum + Math.round((s.total_score / s.max_possible_score) * 100), 0) / valid.length)
              : null
            setClassAvg(avg)
          }
        }
      }
      setLoading(false)
    }
    loadData()
  }, [examId, router])

  if (loading) return <div className="page-container">Loading…</div>
  if (errorMsg) return <div className="page-container"><p className="banner banner-danger">{errorMsg}</p></div>
  if (!result) return <div className="page-container">No result found.</div>

  const percent = result.max_possible_score ? Math.round((result.total_score! / result.max_possible_score) * 100) : 0

  return (
    <div className="page-container" style={{ maxWidth: 480, textAlign: 'center' }}>
      <Link href="/student" style={{ color: 'var(--text-secondary)', fontSize: 14, display: 'block', textAlign: 'left', marginBottom: 16 }}>
        &larr; Back to my exams
      </Link>

      <h1>{examTitle}</h1>

      {result.status !== 'completed' && (
        <div className="card" style={{ marginTop: 20 }}>
          <p style={{ color: 'var(--text-secondary)' }}>You haven't completed this exam yet.</p>
        </div>
      )}

      {result.status === 'completed' && !result.results_released && (
        <div className="banner banner-warning" style={{ marginTop: 20 }}>
          Your exam has been submitted. Results haven't been released yet — check back later.
        </div>
      )}

      {result.status === 'completed' && result.results_released && (
        <div className="card" style={{ background: 'var(--success-bg)', marginTop: 20 }}>
          <p style={{ fontSize: 13, color: 'var(--success)', fontWeight: 600 }}>Your score</p>
          <p style={{ fontSize: 44, fontWeight: 700, margin: '6px 0', color: 'var(--success)' }}>
            {result.total_score} / {result.max_possible_score}
          </p>
          <p style={{ fontSize: 16, color: 'var(--text-secondary)' }}>{percent}%</p>
          {classAvg !== null && (
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8 }}>
              Class average: <strong>{classAvg}%</strong>
              {percent > classAvg
                ? <span style={{ color: 'var(--success)', marginLeft: 6 }}>↑ above average</span>
                : percent < classAvg
                ? <span style={{ color: 'var(--danger)', marginLeft: 6 }}>↓ below average</span>
                : <span style={{ marginLeft: 6 }}>= at average</span>}
            </p>
          )}
          <Link href={`/student/exam/${examId}/review`}>
            <button className="btn btn-primary" style={{ marginTop: 12 }}>Review answers</button>
          </Link>
        </div>
      )}
    </div>
  )
}
