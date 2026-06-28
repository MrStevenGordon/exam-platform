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
      }
      setLoading(false)
    }
    loadData()
  }, [examId, router])

  if (loading) return <div style={{ padding: 40 }}>Loading...</div>
  if (errorMsg) return <div style={{ padding: 40, color: 'red' }}>{errorMsg}</div>
  if (!result) return <div style={{ padding: 40 }}>No result found.</div>

  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif', maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
      <Link href="/student" style={{ color: '#666', display: 'block', textAlign: 'left', marginBottom: 16 }}>&larr; Back to My Exams</Link>

      <h1>{examTitle}</h1>

      {result.status !== 'completed' && (
        <p>You haven't completed this exam yet.</p>
      )}

      {result.status === 'completed' && !result.results_released && (
        <p style={{ padding: 16, background: '#fff3cd', borderRadius: 8 }}>
          Your exam has been submitted. Results haven't been released yet — check back later.
        </p>
      )}

      {result.status === 'completed' && result.results_released && (
        <div style={{ padding: 24, background: '#f0fdf4', borderRadius: 8, marginTop: 16 }}>
          <p style={{ fontSize: 14, color: '#666', margin: 0 }}>Your Score</p>
          <p style={{ fontSize: 48, fontWeight: 700, margin: '8px 0', color: '#16a34a' }}>
            {result.total_score} / {result.max_possible_score}
          </p>
          <p style={{ fontSize: 18, color: '#666' }}>
            {result.max_possible_score ? Math.round((result.total_score! / result.max_possible_score) * 100) : 0}%
          </p>
        </div>
      )}
    </div>
  )
}
