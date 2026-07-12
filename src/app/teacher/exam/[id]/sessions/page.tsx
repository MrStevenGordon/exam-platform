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
  profiles: { full_name: string; student_id: string | null } | null
}

export default function ExamSessionsPage() {
  const router = useRouter()
  const params = useParams()
  const examId = params.id as string

  const [examTitle, setExamTitle] = useState('')
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [releasing, setReleasing] = useState<string | null>(null)

  useEffect(() => { loadData() }, [examId])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: examData } = await supabase
      .from('draft_exams')
      .select('title')
      .eq('id', examId)
      .single()
    setExamTitle(examData?.title || '')

    const { data, error } = await supabase
      .from('exam_sessions')
      .select('id, status, started_at, completed_at, tab_switch_count, flagged, total_score, max_possible_score, fully_graded, results_released, profiles!exam_sessions_student_id_fkey(full_name, student_id)')
      .eq('draft_exam_id', examId)
      .order('started_at', { ascending: false })

    if (error) setErrorMsg(error.message)
    else setSessions((data as any) || [])
    setLoading(false)
  }

  async function handleReleaseOne(sessionId: string) {
    setReleasing(sessionId)
    await supabase.from('exam_sessions').update({ results_released: true }).eq('id', sessionId)
    loadData()
    setReleasing(null)
  }

  async function handleReleaseAll() {
    const eligible = sessions.filter(s => s.status === 'completed' && !s.results_released)
    if (eligible.length === 0) { alert('No unreleased results to release.'); return }
    if (!confirm(`Release results for ${eligible.length} student(s)?`)) return
    setReleasing('all')
    await supabase.from('exam_sessions')
      .update({ results_released: true })
      .eq('draft_exam_id', examId)
      .eq('status', 'completed')
    loadData()
    setReleasing(null)
  }

  if (loading) return <div style={{ padding: 40 }}>Loading...</div>

  const completed = sessions.filter(s => s.status === 'completed')
  const unreleased = completed.filter(s => !s.results_released)
  const inProgress = sessions.filter(s => s.status === 'in_progress')

  return (
    <div className="page-container">
      <Link href={`/teacher/exam/${examId}`} style={{ color: 'var(--text-secondary)', fontSize: 14 }}>← Back to exam</Link>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 16, marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>{examTitle}</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0 }}>
            {completed.length} submitted · {inProgress.length} in progress · {unreleased.length} results pending release
          </p>
        </div>
        {unreleased.length > 0 && (
          <button onClick={handleReleaseAll} disabled={releasing === 'all'} className="btn btn-primary">
            {releasing === 'all' ? 'Releasing…' : `Release all results (${unreleased.length})`}
          </button>
        )}
      </div>

      {errorMsg && <div className="banner banner-danger" style={{ marginBottom: 16 }}>{errorMsg}</div>}

      {sessions.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 32 }}>
          <p style={{ color: 'var(--text-secondary)' }}>No students have started this exam yet.</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {sessions.map((s) => {
          const pct = s.total_score !== null && s.max_possible_score ? Math.round((s.total_score / s.max_possible_score) * 100) : null
          return (
            <div key={s.id} className="card" style={{ background: s.flagged ? 'var(--danger-bg)' : 'var(--card-bg)', borderLeft: s.flagged ? '3px solid var(--danger)' : '3px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{(s.profiles as any)?.full_name || 'Unknown student'}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                    ID: {(s.profiles as any)?.student_id || '—'}
                    {s.completed_at && ` · Submitted ${new Date(s.completed_at).toLocaleString()}`}
                  </div>
                  {s.status === 'completed' && (
                    <div style={{ marginTop: 6, fontSize: 14 }}>
                      {s.total_score !== null
                        ? <span style={{ fontWeight: 700 }}>{s.total_score} / {s.max_possible_score} ({pct}%)</span>
                        : <span style={{ color: 'var(--text-muted)' }}>Awaiting grading</span>
                      }
                      {s.results_released && <span style={{ marginLeft: 8, color: 'var(--success)', fontSize: 12, fontWeight: 700 }}>✓ Released</span>}
                    </div>
                  )}
                  {s.flagged && (
                    <div style={{ marginTop: 4, fontSize: 12, color: 'var(--danger)', fontWeight: 600 }}>
                      ⚠ {s.tab_switch_count} violation{s.tab_switch_count !== 1 ? 's' : ''} detected
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                  <span className={`badge ${s.status === 'completed' ? 'badge-success' : s.status === 'in_progress' ? 'badge-warning' : 'badge-default'}`}>
                    {s.status === 'in_progress' ? 'In progress' : s.status}
                  </span>
                  {s.status === 'completed' && (
                    <>
                      <Link href={`/teacher/exam/${examId}/review/${s.id}`} style={{ fontSize: 12, color: 'var(--accent-dark)', fontWeight: 600 }}>
                        Review responses
                      </Link>
                      {!s.results_released && (
                        <button
                          onClick={() => handleReleaseOne(s.id)}
                          disabled={releasing === s.id}
                          className="btn btn-ghost"
                          style={{ fontSize: 11, padding: '4px 10px' }}
                        >
                          {releasing === s.id ? 'Releasing…' : 'Release result'}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
