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

export default function DirectExamResultsPage() {
  const router = useRouter()
  const params = useParams()
  const examId = params.id as string

  const [result, setResult] = useState<ResultData | null>(null)
  const [examTitle, setExamTitle] = useState('')
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

      const { data, error } = await supabase
        .from('exam_sessions')
        .select('status, total_score, max_possible_score, results_released')
        .eq('draft_exam_id', examId)
        .eq('student_id', user.id)
        .single()

      if (error) {
        setErrorMsg(error.message)
      } else {
        setResult(data)
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
          <Link href={`/student/direct-exam/${examId}/review`}>
            <button className="btn btn-primary" style={{ marginTop: 12 }}>Review answers</button>
          </Link>
        </div>
      )}
    </div>
  )
}
