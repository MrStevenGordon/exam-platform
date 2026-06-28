'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Session = {
  id: string
  status: string
  started_at: string
  completed_at: string | null
  tab_switch_count: number
  flagged: boolean
  total_score: number | null
  max_possible_score: number | null
  fully_graded: boolean
  results_released: boolean
  profiles: { full_name: string } | null
}

export default function ExamSessionsPage() {
  const router = useRouter()
  const params = useParams()
  const finalExamId = params.id as string

  const [examTitle, setExamTitle] = useState('')
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [releasing, setReleasing] = useState(false)

  useEffect(() => {
    loadData()
  }, [finalExamId])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    const { data: examData } = await supabase
      .from('final_exams')
      .select('title')
      .eq('id', finalExamId)
      .single()

    setExamTitle(examData?.title || '')

    const { data, error } = await supabase
      .from('exam_sessions')
      .select('id, status, started_at, completed_at, tab_switch_count, flagged, total_score, max_possible_score, fully_graded, results_released, profiles(full_name)')
      .eq('final_exam_id', finalExamId)
      .order('started_at', { ascending: false })

    if (error) {
      setErrorMsg(error.message)
    } else {
      setSessions((data as any) || [])
    }
    setLoading(false)
  }

  async function handleReleaseAll() {
    const eligible = sessions.filter((s) => s.status === 'completed' && s.fully_graded && !s.results_released)
    if (eligible.length === 0) {
      alert('No fully-graded, unreleased results to release.')
      return
    }
    if (!confirm(`Release results for ${eligible.length} student(s)? They will be able to see their scores immediately.`)) return

    setReleasing(true)
    const { error } = await supabase
      .from('exam_sessions')
      .update({ results_released: true })
      .eq('final_exam_id', finalExamId)
      .eq('status', 'completed')
      .eq('fully_graded', true)

    if (error) {
      alert(error.message)
    } else {
      loadData()
    }
    setReleasing(false)
  }

  if (loading) return <div style={{ padding: 40 }}>Loading...</div>

  const ungradedCount = sessions.filter((s) => s.status === 'completed' && !s.fully_graded).length

  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif', maxWidth: 800, margin: '0 auto' }}>
      <Link href={`/supervisor/final-exams/${finalExamId}`} style={{ color: '#666' }}>&larr; Back to Exam</Link>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 16 }}>
        <h1>{examTitle} — Student Sessions</h1>
        <button
          onClick={handleReleaseAll}
          disabled={releasing}
          style={{ padding: '10px 20px', fontSize: 15, background: '#2563eb', color: 'white', border: 'none', borderRadius: 6, whiteSpace: 'nowrap' }}
        >
          {releasing ? 'Releasing...' : 'Release All Results'}
        </button>
      </div>

      {ungradedCount > 0 && (
        <p style={{ background: '#fff3cd', padding: 12, borderRadius: 8 }}>
          {ungradedCount} session(s) still have ungraded essay responses and won't be included in release.
        </p>
      )}

      {errorMsg && <p style={{ color: 'red' }}>{errorMsg}</p>}
      {sessions.length === 0 && !errorMsg && <p>No students have started this exam yet.</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
        {sessions.map((s) => (
          <div
            key={s.id}
            style={{
              border: '1px solid #ddd', borderRadius: 8, padding: 12,
              background: s.flagged ? '#fee2e2' : 'white',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <strong>{s.profiles?.full_name || 'Unknown student'}</strong>
              <span style={{
                fontSize: 12, padding: '4px 10px', borderRadius: 12,
                background: s.status === 'completed' ? '#d4edda' : '#fff3cd',
              }}>
                {s.status}
              </span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: 14, color: '#666' }}>
              Started: {new Date(s.started_at).toLocaleString()}
              {s.completed_at && ` — Completed: ${new Date(s.completed_at).toLocaleString()}`}
            </p>
            {s.status === 'completed' && (
              <p style={{ margin: '4px 0 0', fontSize: 14 }}>
                Score: {s.fully_graded ? `${s.total_score} / ${s.max_possible_score}` : 'Pending essay grading'}
                {s.results_released && <span style={{ marginLeft: 8, color: '#16a34a', fontWeight: 600 }}>Released</span>}
              </p>
            )}
            {s.flagged && (
              <p style={{ margin: '8px 0 0', fontWeight: 600, color: '#991b1b' }}>
                ⚠ Flagged — {s.tab_switch_count} violation{s.tab_switch_count !== 1 ? 's' : ''} detected
                {s.tab_switch_count >= 3 ? ' (auto-submitted)' : ''}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
