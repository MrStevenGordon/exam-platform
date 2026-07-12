'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

type StudentProfile = {
  full_name: string
  student_id: string | null
  grade_level: number | null
}

type RecentResult = {
  title: string
  pct: number
  kind: string
  date: string
  examId: string
  examType: string
}

type UpcomingExam = {
  id: string
  title: string
  subject: string
  kind: string
  examType: string
}

export default function StudentHome() {
  const router = useRouter()
  const [profile, setProfile] = useState<StudentProfile | null>(null)
  const [recentResults, setRecentResults] = useState<RecentResult[]>([])
  const [upcomingExams, setUpcomingExams] = useState<UpcomingExam[]>([])
  const [classRank, setClassRank] = useState<number | null>(null)
  const [totalStudents, setTotalStudents] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('full_name, student_id, grade_level')
      .eq('id', user.id)
      .single()
    setProfile(profileData)

    const { data: finalSessions } = await supabase
      .from('exam_sessions')
      .select('total_score, max_possible_score, completed_at, results_released, final_exam_id, final_exams(title, exam_category)')
      .eq('student_id', user.id)
      .eq('status', 'completed')
      .eq('results_released', true)
      .not('final_exam_id', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(5)

    const { data: directSessions } = await supabase
      .from('exam_sessions')
      .select('total_score, max_possible_score, completed_at, results_released, draft_exam_id')
      .eq('student_id', user.id)
      .eq('status', 'completed')
      .eq('results_released', true)
      .not('draft_exam_id', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(5)

    const kindLabels: Record<string, string> = {
      pop_quiz: 'Pop Quiz', midterm: 'Mid Term',
      end_of_year: 'End of Year', final_exam_submission: 'End of Year',
    }

    const results: RecentResult[] = [
      ...((finalSessions as any) || []).filter((s: any) => s.max_possible_score > 0).map((s: any) => ({
        title: s.final_exams?.title || 'Exam',
        pct: Math.round((s.total_score / s.max_possible_score) * 100),
        kind: kindLabels[s.final_exams?.exam_category] || 'Exam',
        date: s.completed_at,
        examId: s.final_exam_id,
        examType: 'final',
      })),
      ...((directSessions as any) || []).filter((s: any) => s.max_possible_score > 0).map((s: any) => ({
        title: 'Exam',
        pct: Math.round((s.total_score / s.max_possible_score) * 100),
        kind: 'Exam',
        date: s.completed_at,
        examId: s.draft_exam_id,
        examType: 'direct',
      })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 4)

    setRecentResults(results)

    const { data: finalExams } = await supabase
      .from('final_exams')
      .select('id, title, subject, exam_category')
      .order('published_at', { ascending: false })
      .limit(3)

    // Get student's class first for filtering
    const { data: studentEnrollment } = await supabase
      .from('enrollments')
      .select('class_group_id')
      .eq('student_id', user.id)
      .single()

    const { data: directExams } = studentEnrollment ? await supabase
      .from('draft_exam_class_groups')
      .select('draft_exams!draft_exam_class_groups_draft_exam_id_fkey(id, title, subject, exam_kind)')
      .eq('class_group_id', studentEnrollment.class_group_id)
      .limit(3) : { data: [] }

    const { data: takenSessions } = await supabase
      .from('exam_sessions')
      .select('final_exam_id, draft_exam_id')
      .eq('student_id', user.id)

    const takenFinalIds = new Set((takenSessions || []).filter((s: any) => s.final_exam_id).map((s: any) => s.final_exam_id))
    const takenDirectIds = new Set((takenSessions || []).filter((s: any) => s.draft_exam_id).map((s: any) => s.draft_exam_id))

    const upcoming: UpcomingExam[] = [
      ...((finalExams || []).filter((e) => !takenFinalIds.has(e.id)).map((e) => ({
        id: e.id, title: e.title, subject: e.subject,
        kind: kindLabels[e.exam_category] || 'Exam', examType: 'final',
      }))),
      ...((directExams || []).filter((e: any) => e.draft_exams && !takenDirectIds.has(e.draft_exams.id)).map((e: any) => ({
        id: e.draft_exams.id, title: e.draft_exams.title, subject: e.draft_exams.subject,
        kind: kindLabels[e.draft_exams.exam_kind] || 'Exam', examType: 'direct',
      }))),
    ].slice(0, 3)

    setUpcomingExams(upcoming)
    setLoading(false)
  }

  if (loading) return <div>Loading…</div>

  const avg = recentResults.length
    ? Math.round(recentResults.reduce((a, b) => a + b.pct, 0) / recentResults.length)
    : null

  const chartData = recentResults.slice().reverse().map((r, i) => ({ name: `#${i + 1}`, pct: r.pct, title: r.title }))

  const firstName = profile?.full_name?.split(' ')[0] || 'there'
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div>
      <p className="portal-page-title">{greeting}, {firstName}</p>
      <p className="portal-page-sub">Academic year 2026–2027 · Manchester High School</p>

      {/* Stats */}
      <div className="stat-grid">
        <div className={`stat-card ${avg !== null && avg >= 50 ? 'stat-card-success' : avg !== null ? 'stat-card-danger' : ''}`}>
          <div className="stat-card-value">{avg !== null ? `${avg}%` : '—'}</div>
          <div className="stat-card-label">Overall avg</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-value">{recentResults.length}</div>
          <div className="stat-card-label">Results released</div>
        </div>
        <div className="stat-card stat-card-success">
          <div className="stat-card-value">{recentResults.filter((r) => r.pct >= 50).length}</div>
          <div className="stat-card-label">Passed</div>
        </div>
        <div className="stat-card stat-card-accent">
          <div className="stat-card-value">{upcomingExams.length}</div>
          <div className="stat-card-label">Upcoming</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Recent results */}
        <div>
          <div className="section-label" style={{ marginBottom: 10 }}>Recent results</div>
          {recentResults.length === 0 && (
            <div className="card"><p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>No released results yet.</p></div>
          )}
          {recentResults.map((r, i) => (
            <Link key={i} href={`/student/${r.examType === 'final' ? 'exam' : 'direct-exam'}/${r.examId}/results`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="card card-clickable" style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{r.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{r.kind} · {new Date(r.date).toLocaleDateString()}</div>
                </div>
                <span className={`badge ${r.pct >= 50 ? 'badge-success' : 'badge-danger'}`}>{r.pct}%</span>
              </div>
            </Link>
          ))}
          {recentResults.length > 0 && (
            <Link href="/student/history" style={{ fontSize: 12, color: 'var(--accent-dark)' }}>View all results →</Link>
          )}
        </div>

        {/* Upcoming exams */}
        <div>
          <div className="section-label" style={{ marginBottom: 10 }}>Upcoming exams</div>
          {upcomingExams.length === 0 && (
            <div className="card"><p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>No upcoming exams right now.</p></div>
          )}
          {upcomingExams.map((e) => (
            <Link key={e.id} href={`/student/${e.examType === 'final' ? 'exam' : 'direct-exam'}/${e.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="card card-clickable" style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{e.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{e.subject} · {e.kind}</div>
                </div>
                <span className="badge badge-warning">Begin</span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Score trend */}
      {chartData.length > 1 && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="section-label" style={{ marginBottom: 12 }}>Score trend</div>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={chartData} margin={{ top: 0, right: 0, left: -24, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: any, _: any, p: any) => [`${v}%`, p.payload.title]} />
              <ReferenceLine y={50} stroke="var(--danger)" strokeDasharray="4 4" />
              <Line type="monotone" dataKey="pct" stroke="var(--accent)" strokeWidth={2} dot={{ fill: 'var(--accent)', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
