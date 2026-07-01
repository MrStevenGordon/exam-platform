'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

type ScoreEntry = {
  title: string
  pct: number
  date: string
  kind: string
}

export default function ScoreHistoryPage() {
  const router = useRouter()
  const [entries, setEntries] = useState<ScoreEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: finalSessions } = await supabase
        .from('exam_sessions')
        .select('total_score, max_possible_score, completed_at, results_released, final_exams(title, exam_category)')
        .eq('student_id', user.id)
        .eq('status', 'completed')
        .eq('results_released', true)
        .not('final_exam_id', 'is', null)

      const { data: directSessions } = await supabase
        .from('exam_sessions')
        .select('total_score, max_possible_score, completed_at, results_released, draft_exams(title, exam_kind)')
        .eq('student_id', user.id)
        .eq('status', 'completed')
        .eq('results_released', true)
        .not('draft_exam_id', 'is', null)

      const kindLabels: Record<string, string> = {
        pop_quiz: 'Pop quiz', midterm: 'Mid term',
        end_of_year: 'End of year', final_exam_submission: 'End of year',
      }

      const combined: ScoreEntry[] = [
        ...((finalSessions as any) || [])
          .filter((s: any) => s.max_possible_score > 0)
          .map((s: any) => ({
            title: s.final_exams?.title || 'Exam',
            pct: Math.round((s.total_score / s.max_possible_score) * 100),
            date: s.completed_at,
            kind: kindLabels[s.final_exams?.exam_category] || 'Exam',
          })),
        ...((directSessions as any) || [])
          .filter((s: any) => s.max_possible_score > 0)
          .map((s: any) => ({
            title: s.draft_exams?.title || 'Exam',
            pct: Math.round((s.total_score / s.max_possible_score) * 100),
            date: s.completed_at,
            kind: kindLabels[s.draft_exams?.exam_kind] || 'Exam',
          })),
      ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

      setEntries(combined)
      setLoading(false)
    }
    loadData()
  }, [router])

  if (loading) return <div className="page-container">Loading…</div>
  if (errorMsg) return <div className="page-container"><p className="banner banner-danger">{errorMsg}</p></div>

  const avg = entries.length ? Math.round(entries.reduce((a, b) => a + b.pct, 0) / entries.length) : 0
  const chartData = entries.map((e, i) => ({ name: `#${i + 1}`, pct: e.pct, title: e.title }))

  return (
    <div className="page-container" style={{ maxWidth: 700 }}>
      <Link href="/student" style={{ color: 'var(--text-secondary)', fontSize: 14 }}>&larr; Back to my exams</Link>

      <h1 style={{ marginTop: 16 }}>My score history</h1>
      <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>{entries.length} released results</p>

      {entries.length === 0 && (
        <div className="card" style={{ marginTop: 20 }}>
          <p style={{ color: 'var(--text-secondary)' }}>No released results yet. Complete and have some exams graded first.</p>
        </div>
      )}

      {entries.length > 0 && (
        <>
          <div style={{ display: 'flex', gap: 12, marginTop: 20, flexWrap: 'wrap' }}>
            {[
              { label: 'Overall average', value: `${avg}%`, good: avg >= 50 },
              { label: 'Best score', value: `${Math.max(...entries.map(e => e.pct))}%`, good: true },
              { label: 'Exams taken', value: `${entries.length}`, good: true },
            ].map((stat) => (
              <div key={stat.label} className="card" style={{ flex: '1 1 140px', textAlign: 'center', background: stat.good ? 'var(--success-bg)' : 'var(--danger-bg)' }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: stat.good ? 'var(--success)' : 'var(--danger)' }}>{stat.value}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>{stat.label}</div>
              </div>
            ))}
          </div>

          {entries.length > 1 && (
            <div className="card" style={{ marginTop: 20 }}>
              <h2 style={{ marginBottom: 16 }}>Score trend</h2>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: any, _: any, props: any) => [`${v}%`, props.payload.title]} />
                  <ReferenceLine y={50} stroke="var(--danger)" strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="pct" stroke="var(--accent)" strokeWidth={2} dot={{ fill: 'var(--accent)', r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>Dashed line = pass mark (50%)</p>
            </div>
          )}

          <div className="card" style={{ marginTop: 20 }}>
            <h2 style={{ marginBottom: 16 }}>All results</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[...entries].reverse().map((e, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: i < entries.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{e.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{e.kind} · {new Date(e.date).toLocaleDateString()}</div>
                  </div>
                  <span className={`badge ${e.pct >= 50 ? 'badge-success' : 'badge-danger'}`}>{e.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
