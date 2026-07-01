'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

type SessionResult = {
  total_score: number
  max_possible_score: number
  student_name: string
}

type QuestionStat = {
  question_text: string
  question_type: string
  wrong_count: number
  total: number
  wrong_pct: number
}

export default function ExamAnalyticsPage() {
  const router = useRouter()
  const params = useParams()
  const examId = params.id as string

  const [examTitle, setExamTitle] = useState('')
  const [passMark, setPassMark] = useState(50)
  const [sessions, setSessions] = useState<SessionResult[]>([])
  const [questionStats, setQuestionStats] = useState<QuestionStat[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: examData } = await supabase
        .from('final_exams')
        .select('title, pass_mark')
        .eq('id', examId)
        .single()

      setExamTitle(examData?.title || '')
      setPassMark(examData?.pass_mark || 50)

      const { data: sessionData, error: sessionError } = await supabase
        .from('exam_sessions')
        .select('total_score, max_possible_score, profiles(full_name)')
        .eq('final_exam_id', examId)
        .eq('status', 'completed')
        .eq('fully_graded', true)

      if (sessionError) { setErrorMsg(sessionError.message); setLoading(false); return }

      const sessionsFlat: SessionResult[] = ((sessionData as any) || []).map((s: any) => ({
        total_score: s.total_score || 0,
        max_possible_score: s.max_possible_score || 0,
        student_name: s.profiles?.full_name || 'Unknown',
      }))
      setSessions(sessionsFlat)

      const { data: sessionIds } = await supabase
        .from('exam_sessions')
        .select('id')
        .eq('final_exam_id', examId)
        .eq('status', 'completed')

      const ids = (sessionIds || []).map((s) => s.id)

      if (ids.length > 0) {
        const { data: responseData } = await supabase
          .from('responses')
          .select('question_id, points_awarded, questions(question_text, question_type, points)')
          .in('session_id', ids)

        const qMap: Record<string, { text: string; type: string; wrong: number; total: number }> = {}
        ;(responseData || []).forEach((r: any) => {
          if (!r.questions) return
          const id = r.question_id
          if (!qMap[id]) qMap[id] = { text: r.questions.question_text, type: r.questions.question_type, wrong: 0, total: 0 }
          qMap[id].total++
          if ((r.points_awarded ?? 0) === 0) qMap[id].wrong++
        })

        const stats = Object.values(qMap)
          .filter((q) => q.type !== 'essay')
          .map((q) => ({
            question_text: q.text,
            question_type: q.type,
            wrong_count: q.wrong,
            total: q.total,
            wrong_pct: q.total > 0 ? Math.round((q.wrong / q.total) * 100) : 0,
          }))
          .sort((a, b) => b.wrong_pct - a.wrong_pct)

        setQuestionStats(stats)
      }

      setLoading(false)
    }
    loadData()
  }, [examId, router])

  if (loading) return <div className="page-container">Loading…</div>
  if (errorMsg) return <div className="page-container"><p className="banner banner-danger">{errorMsg}</p></div>

  const scores = sessions.map((s) =>
    s.max_possible_score > 0 ? Math.round((s.total_score / s.max_possible_score) * 100) : 0
  )
  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0
  const highest = scores.length ? Math.max(...scores) : 0
  const lowest = scores.length ? Math.min(...scores) : 0
  const passed = scores.filter((s) => s >= passMark).length
  const passRate = scores.length ? Math.round((passed / scores.length) * 100) : 0

  const bucketLabels = ['0-9','10-19','20-29','30-39','40-49','50-59','60-69','70-79','80-89','90-100']
  const distribution = bucketLabels.map((label, i) => ({
    label,
    count: scores.filter((s) => i === 9 ? s >= 90 : s >= i * 10 && s < (i + 1) * 10).length,
    passing: i * 10 >= passMark,
  }))

  const sortedStudents = [...sessions]
    .filter((s) => s.max_possible_score > 0)
    .map((s) => ({ ...s, pct: Math.round((s.total_score / s.max_possible_score) * 100) }))
    .sort((a, b) => b.pct - a.pct)

  return (
    <div className="page-container">
      <Link href={`/supervisor/final-exams/${examId}/sessions`} style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
        &larr; Back to sessions
      </Link>

      <h1 style={{ marginTop: 16 }}>{examTitle} — Analytics</h1>
      <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>
        {sessions.length} students graded · pass mark {passMark}%
      </p>

      {sessions.length === 0 && (
        <div className="card" style={{ marginTop: 20 }}>
          <p style={{ color: 'var(--text-secondary)' }}>No fully-graded sessions yet.</p>
        </div>
      )}

      {sessions.length > 0 && (
        <>
          <div style={{ display: 'flex', gap: 12, marginTop: 20, flexWrap: 'wrap' }}>
            {[
              { label: 'Class average', value: `${avg}%`, good: avg >= passMark },
              { label: 'Pass rate', value: `${passRate}%`, good: passRate >= 50 },
              { label: 'Highest score', value: `${highest}%`, good: true },
              { label: 'Lowest score', value: `${lowest}%`, good: lowest >= passMark },
            ].map((stat) => (
              <div key={stat.label} className="card" style={{ flex: '1 1 140px', textAlign: 'center', background: stat.good ? 'var(--success-bg)' : 'var(--danger-bg)' }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: stat.good ? 'var(--success)' : 'var(--danger)' }}>
                  {stat.value}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>{stat.label}</div>
              </div>
            ))}
          </div>

          <div className="card" style={{ marginTop: 20 }}>
            <h2 style={{ marginBottom: 16 }}>Score distribution</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={distribution} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [`${v} student(s)`, 'Count']} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {distribution.map((entry, i) => (
                    <Cell key={i} fill={entry.passing ? 'var(--success)' : 'var(--danger)'} opacity={0.75} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>
              Green = above pass mark ({passMark}%) · Red = below pass mark
            </p>
          </div>

          {questionStats.length > 0 && (
            <div className="card" style={{ marginTop: 20 }}>
              <h2 style={{ marginBottom: 16 }}>Question difficulty (most missed first)</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {questionStats.map((q, i) => (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 6 }}>
                      <span style={{ flex: 1, marginRight: 12, color: 'var(--text-primary)' }}>
                        {i + 1}. {q.question_text.length > 90 ? q.question_text.slice(0, 90) + '…' : q.question_text}
                      </span>
                      <span style={{ fontWeight: 700, color: q.wrong_pct >= 50 ? 'var(--danger)' : 'var(--success)', whiteSpace: 'nowrap' }}>
                        {q.wrong_pct}% wrong
                      </span>
                    </div>
                    <div style={{ background: 'var(--border)', borderRadius: 4, height: 8 }}>
                      <div style={{
                        background: q.wrong_pct >= 50 ? 'var(--danger)' : 'var(--success)',
                        width: `${q.wrong_pct}%`,
                        height: '100%',
                        borderRadius: 4,
                        opacity: 0.7,
                        transition: 'width 0.3s ease',
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card" style={{ marginTop: 20 }}>
            <h2 style={{ marginBottom: 16 }}>Student scores</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sortedStudents.map((s, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: i < sortedStudents.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 20 }}>#{i + 1}</span>
                    <span style={{ fontSize: 14 }}>{s.student_name}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{s.total_score}/{s.max_possible_score}</span>
                    <span className={`badge ${s.pct >= passMark ? 'badge-success' : 'badge-danger'}`}>{s.pct}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
