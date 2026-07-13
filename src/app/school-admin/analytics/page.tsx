'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts'

type SessionRow = {
  total_score: number
  max_possible_score: number
  completed_at: string
  subject: string
  pass_mark: number
  department_name: string
}

type MonthPoint = { key: string; label: string; avgPct: number; count: number }
type GroupStat = { name: string; avgPct: number; passRate: number; count: number }

export default function SchoolAnalyticsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<SessionRow[]>([])
  const [examTypeSplit, setExamTypeSplit] = useState({ direct: 0, final: 0 })

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('is_system_admin, role')
        .eq('id', user.id)
        .single()

      if (!profile?.is_system_admin && profile?.role !== 'admin') {
        router.push('/login')
        return
      }

      // Final-exam sessions (graded and completed)
      const { data: finalData } = await supabase
        .from('exam_sessions')
        .select('total_score, max_possible_score, completed_at, final_exams(subject, pass_mark, departments(name))')
        .eq('status', 'completed')
        .eq('fully_graded', true)
        .not('final_exam_id', 'is', null)

      // Direct-exam sessions (graded and completed)
      const { data: directData } = await supabase
        .from('exam_sessions')
        .select('total_score, max_possible_score, completed_at, draft_exams(subject, pass_mark, departments(name))')
        .eq('status', 'completed')
        .eq('fully_graded', true)
        .not('draft_exam_id', 'is', null)

      const finalRows: SessionRow[] = ((finalData as any) || [])
        .filter((r: any) => r.final_exams && r.max_possible_score > 0)
        .map((r: any) => ({
          total_score: r.total_score || 0,
          max_possible_score: r.max_possible_score,
          completed_at: r.completed_at,
          subject: r.final_exams.subject || 'Unknown',
          pass_mark: r.final_exams.pass_mark || 50,
          department_name: r.final_exams.departments?.name || 'Unassigned',
        }))

      const directRows: SessionRow[] = ((directData as any) || [])
        .filter((r: any) => r.draft_exams && r.max_possible_score > 0)
        .map((r: any) => ({
          total_score: r.total_score || 0,
          max_possible_score: r.max_possible_score,
          completed_at: r.completed_at,
          subject: r.draft_exams.subject || 'Unknown',
          pass_mark: r.draft_exams.pass_mark || 50,
          department_name: r.draft_exams.departments?.name || 'Unassigned',
        }))

      setExamTypeSplit({ direct: directRows.length, final: finalRows.length })
      setRows([...finalRows, ...directRows])
      setLoading(false)
    }
    load()
  }, [router])

  if (loading) return <div>Loading…</div>

  const withPct = rows.map((r) => {
    const pct = Math.round((r.total_score / r.max_possible_score) * 100)
    return { ...r, pct, passed: pct >= r.pass_mark }
  })

  const overallAvg = withPct.length ? Math.round(withPct.reduce((s, r) => s + r.pct, 0) / withPct.length) : 0
  const overallPassRate = withPct.length ? Math.round((withPct.filter((r) => r.passed).length / withPct.length) * 100) : 0
  const totalGraded = withPct.length

  // Trend by month
  const monthMap: Record<string, { sum: number; count: number; label: string }> = {}
  withPct.forEach((r) => {
    const d = new Date(r.completed_at)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
    if (!monthMap[key]) monthMap[key] = { sum: 0, count: 0, label }
    monthMap[key].sum += r.pct
    monthMap[key].count += 1
  })
  const trend: MonthPoint[] = Object.entries(monthMap)
    .map(([key, v]) => ({ key, label: v.label, avgPct: Math.round(v.sum / v.count), count: v.count }))
    .sort((a, b) => a.key.localeCompare(b.key))

  // By department
  const deptMap: Record<string, { sum: number; passed: number; count: number }> = {}
  withPct.forEach((r) => {
    if (!deptMap[r.department_name]) deptMap[r.department_name] = { sum: 0, passed: 0, count: 0 }
    deptMap[r.department_name].sum += r.pct
    if (r.passed) deptMap[r.department_name].passed += 1
    deptMap[r.department_name].count += 1
  })
  const byDept: GroupStat[] = Object.entries(deptMap)
    .map(([name, v]) => ({ name, avgPct: Math.round(v.sum / v.count), passRate: Math.round((v.passed / v.count) * 100), count: v.count }))
    .sort((a, b) => b.avgPct - a.avgPct)

  // By subject — worst pass rate first, so struggling subjects surface immediately
  const subjMap: Record<string, { sum: number; passed: number; count: number }> = {}
  withPct.forEach((r) => {
    if (!subjMap[r.subject]) subjMap[r.subject] = { sum: 0, passed: 0, count: 0 }
    subjMap[r.subject].sum += r.pct
    if (r.passed) subjMap[r.subject].passed += 1
    subjMap[r.subject].count += 1
  })
  const bySubject: GroupStat[] = Object.entries(subjMap)
    .map(([name, v]) => ({ name, avgPct: Math.round(v.sum / v.count), passRate: Math.round((v.passed / v.count) * 100), count: v.count }))
    .sort((a, b) => a.passRate - b.passRate)
    .slice(0, 10)

  return (
    <div>
      <p className="portal-page-title">School Analytics</p>
      <p className="portal-page-sub">Performance across all graded exams — direct and final</p>

      {totalGraded === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 32, marginTop: 20 }}>
          <p style={{ color: 'var(--text-secondary)' }}>No fully-graded exam sessions yet. Data will appear here once exams are completed and graded.</p>
        </div>
      ) : (
        <>
          <div className="stat-grid" style={{ marginTop: 16 }}>
            <div className={`stat-card ${overallAvg >= 50 ? 'stat-card-success' : 'stat-card-danger'}`}>
              <div className="stat-card-value">{overallAvg}%</div>
              <div className="stat-card-label">School average score</div>
            </div>
            <div className={`stat-card ${overallPassRate >= 50 ? 'stat-card-success' : 'stat-card-danger'}`}>
              <div className="stat-card-value">{overallPassRate}%</div>
              <div className="stat-card-label">Overall pass rate</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-value">{totalGraded}</div>
              <div className="stat-card-label">Graded exam sessions</div>
            </div>
            <div className="stat-card stat-card-accent">
              <div className="stat-card-value">{examTypeSplit.direct} / {examTypeSplit.final}</div>
              <div className="stat-card-label">Direct vs final exam sessions</div>
            </div>
          </div>

          {trend.length > 1 && (
            <div className="card" style={{ marginTop: 20 }}>
              <h2 style={{ marginBottom: 4 }}>Average score over time</h2>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>School-wide average score, by month graded</p>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={trend} margin={{ top: 8, right: 16, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: any, name: string) => name === 'avgPct' ? [`${v}%`, 'Average score'] : [v, name]} />
                  <Line type="monotone" dataKey="avgPct" stroke="var(--accent)" strokeWidth={2.5} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="card" style={{ marginTop: 20 }}>
            <h2 style={{ marginBottom: 4 }}>Performance by department</h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>Average score per department</p>
            <ResponsiveContainer width="100%" height={Math.max(180, byDept.length * 44)}>
              <BarChart data={byDept} layout="vertical" margin={{ top: 0, right: 24, left: 8, bottom: 0 }}>
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: any, name: string, props: any) => [`${v}% avg · ${props.payload.passRate}% pass rate · ${props.payload.count} sessions`, '']} />
                <Bar dataKey="avgPct" radius={[0, 4, 4, 0]}>
                  {byDept.map((d, i) => <Cell key={i} fill={d.avgPct >= 50 ? 'var(--success)' : 'var(--danger)'} opacity={0.8} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card" style={{ marginTop: 20 }}>
            <h2 style={{ marginBottom: 4 }}>Subjects to watch</h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>Lowest pass rates first — up to 10 subjects</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {bySubject.map((s) => (
                <div key={s.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{s.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{s.count} graded session{s.count !== 1 ? 's' : ''} · {s.avgPct}% avg score</div>
                  </div>
                  <span className={`badge ${s.passRate >= 50 ? 'badge-success' : 'badge-danger'}`}>{s.passRate}% pass rate</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
