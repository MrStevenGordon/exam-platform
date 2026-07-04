'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type FlaggedSession = {
  id: string
  tab_switch_count: number
  completed_at: string | null
  status: string
  student_name: string
  exam_title: string
}

export default function ActivityPage() {
  const router = useRouter()
  const [flaggedSessions, setFlaggedSessions] = useState<FlaggedSession[]>([])
  const [recentSessions, setRecentSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: flagged } = await supabase
        .from('exam_sessions')
        .select('id, tab_switch_count, completed_at, status, profiles!exam_sessions_student_id_fkey(full_name), final_exams(title), draft_exams(title)')
        .eq('flagged', true)
        .order('completed_at', { ascending: false })
        .limit(20)

      setFlaggedSessions((flagged || []).map((s: any) => ({
        id: s.id,
        tab_switch_count: s.tab_switch_count,
        completed_at: s.completed_at,
        status: s.status,
        student_name: s.profiles?.full_name || 'Unknown',
        exam_title: s.final_exams?.title || s.draft_exams?.title || 'Unknown exam',
      })))

      const { data: recent } = await supabase
        .from('exam_sessions')
        .select('id, status, started_at, completed_at, profiles!exam_sessions_student_id_fkey(full_name), final_exams(title), draft_exams(title)')
        .order('started_at', { ascending: false })
        .limit(10)

      setRecentSessions((recent || []).map((s: any) => ({
        id: s.id,
        status: s.status,
        started_at: s.started_at,
        completed_at: s.completed_at,
        student_name: s.profiles?.full_name || 'Unknown',
        exam_title: s.final_exams?.title || s.draft_exams?.title || 'Unknown',
      })))

      setLoading(false)
    }
    load()
  }, [router])

  if (loading) return <div>Loading…</div>

  return (
    <div>
      <p className="portal-page-title">Activity Monitor</p>
      <p className="portal-page-sub">Flagged sessions and recent exam activity</p>

      <div className="section-label" style={{ marginBottom: 10 }}>
        Flagged sessions ({flaggedSessions.length})
      </div>

      {flaggedSessions.length === 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <p style={{ color: 'var(--text-secondary)' }}>No flagged sessions.</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
        {flaggedSessions.map((s) => (
          <div key={s.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: '3px solid var(--danger)' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{s.student_name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                {s.exam_title} · {s.tab_switch_count} violation{s.tab_switch_count !== 1 ? 's' : ''} · {s.status}
              </div>
            </div>
            <span className="badge badge-danger">{s.tab_switch_count} violations</span>
          </div>
        ))}
      </div>

      <div className="section-label" style={{ marginBottom: 10 }}>Recent exam activity</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {recentSessions.map((s) => (
          <div key={s.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{s.student_name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                {s.exam_title} · {new Date(s.started_at).toLocaleDateString()}
              </div>
            </div>
            <span className={`badge ${s.status === 'completed' ? 'badge-success' : 'badge-warning'}`}>{s.status}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
