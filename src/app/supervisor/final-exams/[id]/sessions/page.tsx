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
        .eq('id', finalExamId)
        .single()

      setExamTitle(examData?.title || '')

      const { data, error } = await supabase
        .from('exam_sessions')
        .select('id, status, started_at, completed_at, tab_switch_count, flagged, profiles(full_name)')
        .eq('final_exam_id', finalExamId)
        .order('started_at', { ascending: false })

      if (error) {
        setErrorMsg(error.message)
      } else {
        setSessions((data as any) || [])
      }
      setLoading(false)
    }
    loadData()
  }, [finalExamId, router])

  if (loading) return <div style={{ padding: 40 }}>Loading...</div>

  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif', maxWidth: 800, margin: '0 auto' }}>
      <Link href={`/supervisor/final-exams/${finalExamId}`} style={{ color: '#666' }}>&larr; Back to Exam</Link>

      <h1 style={{ marginTop: 16 }}>{examTitle} — Student Sessions</h1>

      {errorMsg && <p style={{ color: 'red' }}>{errorMsg}</p>}
      {sessions.length === 0 && !errorMsg && <p>No students have started this exam yet.</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
