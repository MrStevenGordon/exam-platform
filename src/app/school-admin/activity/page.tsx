'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type ViolationEntry = {
  reason: string
  timestamp: string
  count: number
}

type SessionItem = {
  id: string
  status: string
  started_at: string
  completed_at: string | null
  tab_switch_count: number
  flagged: boolean
  student_name: string
  exam_title: string
  total_score: number | null
  max_possible_score: number | null
  violation_log: ViolationEntry[]
}

export default function ActivityPage() {
  const router = useRouter()
  const [flagged, setFlagged] = useState<SessionItem[]>([])
  const [recent, setRecent] = useState<SessionItem[]>([])
  const [stats, setStats] = useState({ total: 0, completed: 0, flaggedCount: 0, inProgress: 0 })
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'flagged' | 'recent'>('flagged')

  useEffect(() => {
    async function load() {
      const { data: flaggedData } = await supabase
        .from('exam_sessions')
        .select('id, status, started_at, completed_at, tab_switch_count, flagged, total_score, max_possible_score, violation_log, profiles!exam_sessions_student_id_fkey(full_name), final_exams(title), draft_exams(title)')
        .eq('flagged', true)
        .order('started_at', { ascending: false })
        .limit(50)

      const { data: recentData } = await supabase
        .from('exam_sessions')
        .select('id, status, started_at, completed_at, tab_switch_count, flagged, total_score, max_possible_score, violation_log, profiles!exam_sessions_student_id_fkey(full_name), final_exams(title), draft_exams(title)')
        .order('started_at', { ascending: false })
        .limit(30)

      const mapSession = (s: any): SessionItem => ({
        id: s.id,
        status: s.status,
        started_at: s.started_at,
        completed_at: s.completed_at,
        tab_switch_count: s.tab_switch_count || 0,
        flagged: s.flagged,
        student_name: s.profiles?.full_name || 'Unknown',
        exam_title: s.final_exams?.title || s.draft_exams?.title || 'Unknown exam',
        total_score: s.total_score,
        max_possible_score: s.max_possible_score,
        violation_log: s.violation_log || [],
      })

      const f = (flaggedData || []).map(mapSession)
      const r = (recentData || []).map(mapSession)
      setFlagged(f)
      setRecent(r)
      setStats({
        total: r.length,
        completed: r.filter(s => s.status === 'completed').length,
        flaggedCount: f.length,
        inProgress: r.filter(s => s.status === 'in_progress').length,
      })
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div>Loading…</div>

  const renderSession = (s: SessionItem) => (
    <div key={s.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: s.flagged ? '3px solid var(--danger)' : '3px solid var(--border)' }}>
      <div>
        <div style={{ fontWeight: 700, fontSize: 14 }}>{s.student_name}</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
          {s.exam_title} · {new Date(s.started_at).toLocaleDateString()} {new Date(s.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
        {s.tab_switch_count > 0 && (
          <div style={{ marginTop: 6 }}>
            <div style={{ fontSize: 12, color: 'var(--danger)', fontWeight: 700 }}>
              ⚠ {s.tab_switch_count} violation{s.tab_switch_count !== 1 ? 's' : ''} — {
                s.tab_switch_count >= 3
                  ? 'Exam auto-submitted'
                  : `${3 - s.tab_switch_count} warning${3 - s.tab_switch_count !== 1 ? 's' : ''} remaining`
              }
            </div>
            {s.violation_log.length > 0 && (
              <div style={{ marginTop: 4, paddingLeft: 8, borderLeft: '2px solid var(--danger)' }}>
                {s.violation_log.map((v, i) => (
                  <div key={i} style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2 }}>
                    #{v.count} · {v.reason} · {new Date(v.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <div style={{ textAlign: 'right' }}>
        <span className={`badge ${s.status === 'completed' ? 'badge-success' : s.flagged ? 'badge-danger' : 'badge-warning'}`}>
          {s.status}
        </span>
        {s.total_score !== null && s.max_possible_score && (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
            {s.total_score}/{s.max_possible_score} pts
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div>
      <p className="portal-page-title">Activity Monitor</p>
      <p className="portal-page-sub">Exam sessions and integrity monitoring</p>

      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card"><div className="stat-card-value">{stats.total}</div><div className="stat-card-label">Recent sessions</div></div>
        <div className="stat-card stat-card-success"><div className="stat-card-value">{stats.completed}</div><div className="stat-card-label">Completed</div></div>
        <div className={`stat-card ${stats.flaggedCount > 0 ? 'stat-card-danger' : 'stat-card-success'}`}><div className="stat-card-value">{stats.flaggedCount}</div><div className="stat-card-label">Flagged</div></div>
        <div className={`stat-card ${stats.inProgress > 0 ? 'stat-card-accent' : ''}`}><div className="stat-card-value">{stats.inProgress}</div><div className="stat-card-label">In progress</div></div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['flagged', 'recent'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={activeTab === tab ? 'btn btn-primary' : 'btn btn-ghost'}
            style={{ fontSize: 12 }}
          >
            {tab === 'flagged' ? `Flagged (${flagged.length})` : `All recent (${recent.length})`}
          </button>
        ))}
      </div>

      {activeTab === 'flagged' && (
        <div>
          {flagged.length === 0 && <div className="card"><p style={{ color: 'var(--text-secondary)' }}>No flagged sessions.</p></div>}
          {(() => {
            const byDate: Record<string, typeof flagged> = {}
            flagged.forEach((s) => {
              const date = new Date(s.started_at).toLocaleDateString('en-JM', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
              if (!byDate[date]) byDate[date] = []
              byDate[date].push(s)
            })
            return Object.entries(byDate).map(([date, sessions]) => (
              <div key={date} style={{ marginBottom: 20 }}>
                <div className="section-label" style={{ marginBottom: 10 }}>{date} · {sessions.length} flagged</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {sessions.map(renderSession)}
                </div>
              </div>
            ))
          })()}
        </div>
      )}

      {activeTab === 'recent' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {recent.length === 0 && <div className="card"><p style={{ color: 'var(--text-secondary)' }}>No recent sessions.</p></div>}
          {recent.map(renderSession)}
        </div>
      )}
    </div>
  )
}
