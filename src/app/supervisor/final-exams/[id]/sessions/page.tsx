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
  const [search, setSearch] = useState('')

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

  if (loading) return <div className="page-container">Loading…</div>

  const ungradedCount = sessions.filter((s) => s.status === 'completed' && !s.fully_graded).length

  return (
    <div className="page-container">
      <Link href={`/supervisor/final-exams/${finalExamId}`} style={{ color: 'var(--text-secondary)', fontSize: 14 }}>&larr; Back to exam</Link>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 16 }}>
        <h1>{examTitle} — Student sessions</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href={`/supervisor/final-exams/${finalExamId}/analytics`}>
            <button className="btn btn-secondary">View analytics</button>
          </Link>
          <button onClick={handleReleaseAll} disabled={releasing} className="btn btn-primary" style={{ whiteSpace: 'nowrap' }}>
          {releasing ? 'Releasing…' : 'Release all results'}
        </button>
          </div>
      </div>

      {ungradedCount > 0 && (
        <div className="banner banner-warning" style={{ marginTop: 16 }}>
          {ungradedCount} session(s) still have ungraded essay responses and won't be included in release.
        </div>
      )}

      {errorMsg && <p className="banner banner-danger" style={{ marginTop: 16 }}>{errorMsg}</p>}
      {sessions.length === 0 && !errorMsg && (
        <div className="card" style={{ marginTop: 20 }}>
          <p style={{ color: 'var(--text-secondary)' }}>No students have started this exam yet.</p>
        </div>
      )}

      <input
        type="text"
        placeholder="Search by student name…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ width: '100%', marginBottom: 12 }}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
        {sessions.filter((s) => !search || s.profiles?.full_name?.toLowerCase().includes(search.toLowerCase())).map((s) => (
          <div key={s.id} className="card" style={{ background: s.flagged ? 'var(--danger-bg)' : 'var(--card-bg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <strong>{s.profiles?.full_name || 'Unknown student'}</strong>
              <span className={`badge ${s.status === 'completed' ? 'badge-success' : 'badge-warning'}`}>
                {s.status}
              </span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--text-secondary)' }}>
              Started: {new Date(s.started_at).toLocaleString()}
              {s.completed_at && ` — Completed: ${new Date(s.completed_at).toLocaleString()}`}
            </p>
            {s.status === 'completed' && (
              <p style={{ margin: '4px 0 0', fontSize: 14 }}>
                Score: {s.fully_graded ? `${s.total_score} / ${s.max_possible_score}` : 'Pending essay grading'}
                {s.results_released && <span style={{ marginLeft: 8, color: 'var(--success)', fontWeight: 700 }}>Released</span>}
              </p>
            )}
            {s.flagged && (
              <p style={{ margin: '8px 0 0', fontWeight: 700, color: 'var(--danger)' }}>
                Flagged — {s.tab_switch_count} violation{s.tab_switch_count !== 1 ? 's' : ''} detected
                {s.tab_switch_count >= 3 ? ' (auto-submitted)' : ''}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
