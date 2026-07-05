'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type DraftExam = {
  id: string
  title: string
  subject: string
  exam_kind: string
  term: string | null
  target_grade: number | null
  status: string
  created_at: string
  profiles: { full_name: string } | null
}

export default function VettingPage() {
  const router = useRouter()
  const [exams, setExams] = useState<DraftExam[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      // Check if this teacher is a senior team lead
      const { data: stlData } = await supabase
        .from('senior_team_lead_appointments')
        .select('department_id, subject, year_grade')
        .eq('teacher_id', user.id)

      if (!stlData || stlData.length === 0) { router.push('/teacher'); return }

      // Load exams matching this senior team lead's subject and year grade appointments
      const { data } = await supabase
        .from('draft_exams')
        .select('id, title, subject, exam_kind, term, target_grade, status, created_at, profiles!draft_exams_created_by_fkey(full_name)')
        .eq('status', 'submitted')
        .in('exam_kind', ['monthly', 'midterm', 'end_of_term', 'end_of_year'])
        .order('created_at', { ascending: false })

      // Filter to only show exams matching appointments
      const filteredData = (data || []).filter((exam: any) =>
        stlData.some((appt) =>
          appt.subject === exam.subject &&
          (!appt.year_grade || appt.year_grade === exam.target_grade)
        )
      )

      setExams((filteredData as any) || [])
      setLoading(false)
    }
    load()
  }, [router])

  async function handleApprove(examId: string) {
    await supabase.from('draft_exams').update({ status: 'approved' }).eq('id', examId)
    setExams((prev) => prev.map((e) => e.id === examId ? { ...e, status: 'approved' } : e))
  }

  async function handleRequestChanges(examId: string) {
    const feedback = prompt('Enter feedback for the team lead:')
    if (!feedback) return
    await supabase.from('draft_exams').update({ status: 'draft', supervisor_notes: feedback } as any).eq('id', examId)
    setExams((prev) => prev.filter((e) => e.id !== examId))
  }

  if (loading) return <div>Loading…</div>

  const kindLabels: Record<string, string> = {
    monthly: 'Monthly', midterm: 'Midterm',
    end_of_term: 'End of Term', end_of_year: 'End of Year',
  }

  const termLabels: Record<string, string> = {
    christmas: 'Christmas', easter: 'Easter', summer: 'Summer',
  }

  return (
    <div>
      <p className="portal-page-title">Vetting</p>
      <p className="portal-page-sub">Exams submitted for senior team lead review</p>

      {exams.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 32 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>✓</div>
          <p style={{ fontWeight: 700, margin: 0 }}>No exams awaiting vetting</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {exams.map((exam) => (
          <div key={exam.id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{exam.title}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                  {exam.subject} · Grade {exam.target_grade} · {kindLabels[exam.exam_kind]}
                  {exam.term && ` · ${termLabels[exam.term]} term`}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  Set by {(exam.profiles as any)?.full_name || 'Unknown'} · {new Date(exam.created_at).toLocaleDateString()}
                </div>
              </div>
              <span className="badge badge-warning">Awaiting vetting</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Link href={`/supervisor/exam/${exam.id}`}>
                <button className="btn btn-ghost" style={{ fontSize: 12 }}>Review questions</button>
              </Link>
              <button onClick={() => handleApprove(exam.id)} className="btn btn-primary" style={{ fontSize: 12 }}>
                ✓ Approve
              </button>
              <button onClick={() => handleRequestChanges(exam.id)} className="btn btn-danger" style={{ fontSize: 12 }}>
                Request changes
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
