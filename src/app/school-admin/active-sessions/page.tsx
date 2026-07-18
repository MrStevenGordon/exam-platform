'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type LockedStudent = {
  id: string
  full_name: string
  student_id: string | null
  active_login_started_at: string | null
  examTitle: string
}

export default function ActiveSessionsPage() {
  const router = useRouter()
  const [students, setStudents] = useState<LockedStudent[]>([])
  const [loading, setLoading] = useState(true)
  const [releasing, setReleasing] = useState<string | null>(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: locked } = await supabase
      .from('profiles')
      .select('id, full_name, student_id, active_login_started_at')
      .eq('role', 'student')
      .not('active_login_token', 'is', null)
      .order('active_login_started_at', { ascending: true })

    const enriched: LockedStudent[] = []
    for (const s of locked || []) {
      const { data: sessions } = await supabase
        .from('exam_sessions')
        .select('draft_exams(title), final_exams(title)')
        .eq('student_id', s.id)
        .eq('status', 'in_progress')
        .limit(1)

      const session = sessions?.[0] as any
      const examTitle = session?.draft_exams?.title || session?.final_exams?.title || 'Unknown exam'

      enriched.push({ ...s, examTitle })
    }

    setStudents(enriched)
    setLoading(false)
  }

  async function handleRelease(studentId: string, name: string) {
    if (!confirm(`Release ${name}'s session? This lets them log in from a new device. Only do this if you're sure the original device was genuinely left logged in by mistake.`)) return
    setReleasing(studentId)
    await supabase.from('profiles').update({ active_login_token: null, active_login_started_at: null }).eq('id', studentId)
    setReleasing(null)
    loadData()
  }

  if (loading) return <div>Loading…</div>

  return (
    <div>
      <p className="portal-page-title">Active Sessions</p>
      <p className="portal-page-sub">Students currently locked to one device during an in-progress exam</p>

      {students.length === 0 && (
        <div className="card">
          <p style={{ color: 'var(--text-secondary)' }}>No students are currently locked to a device.</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {students.map((s) => (
          <div key={s.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{s.full_name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                {s.student_id && `ID: ${s.student_id} · `}
                {s.examTitle}
                {s.active_login_started_at && ` · Since ${new Date(s.active_login_started_at).toLocaleString()}`}
              </div>
            </div>
            <button
              onClick={() => handleRelease(s.id, s.full_name)}
              disabled={releasing === s.id}
              className="btn btn-secondary"
            >
              {releasing === s.id ? 'Releasing…' : 'Force logout'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
