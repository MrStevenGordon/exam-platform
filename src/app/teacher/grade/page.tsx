'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type UngradedResponse = {
  response_id: string
  session_id: string
  answer: string
  question_text: string
  points: number
  student_name: string
  exam_title: string
}

export default function GradeEssaysPage() {
  const router = useRouter()
  const [items, setItems] = useState<UngradedResponse[]>([])
  const [scores, setScores] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [savingId, setSavingId] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    const { data, error } = await supabase
      .from('responses')
      .select(`
        id, answer, session_id, points_awarded,
        questions(question_text, points, question_type, marking_points),
        exam_sessions(profiles!exam_sessions_student_id_fkey(full_name), final_exams(title))
      `)
      .is('points_awarded', null)

    if (error) {
      setErrorMsg(error.message)
      setLoading(false)
      return
    }

    const essayOnly = (data || [])
      .filter((r: any) => r.questions?.question_type === 'essay')
      .map((r: any) => ({
        response_id: r.id,
        session_id: r.session_id,
        marking_points: r.questions?.marking_points || null,
        answer: r.answer,
        question_text: r.questions.question_text,
        points: r.questions.points,
        student_name: r.exam_sessions?.profiles?.full_name || 'Unknown',
        exam_title: r.exam_sessions?.final_exams?.title || 'Unknown exam',
      }))

    setItems(essayOnly)
    setLoading(false)
  }

  function updateScore(responseId: string, value: string) {
    setScores({ ...scores, [responseId]: value })
  }

  async function handleSaveGrade(item: UngradedResponse) {
    const value = parseFloat(scores[item.response_id])
    if (isNaN(value) || value < 0 || value > item.points) {
      alert(`Enter a valid score between 0 and ${item.points}.`)
      return
    }

    setSavingId(item.response_id)
    const { data: { user } } = await supabase.auth.getUser()

    const { error } = await supabase
      .from('responses')
      .update({
        points_awarded: value,
        graded_by: user?.id,
        graded_at: new Date().toISOString(),
      })
      .eq('id', item.response_id)

    if (error) {
      alert(error.message)
      setSavingId('')
      return
    }

    // Check if all responses for this session are now graded; if so, recompute total and mark fully_graded
    const { data: allResponses } = await supabase
      .from('responses')
      .select('points_awarded')
      .eq('session_id', item.session_id)

    const stillUngraded = (allResponses || []).some((r) => r.points_awarded === null)

    if (!stillUngraded) {
      const totalScore = (allResponses || []).reduce((sum, r) => sum + (r.points_awarded || 0), 0)
      await supabase
        .from('exam_sessions')
        .update({ total_score: totalScore, fully_graded: true })
        .eq('id', item.session_id)
    }

    setSavingId('')
    loadData()
  }

  if (loading) return <div style={{ padding: 40 }}>Loading...</div>

  return (
    <div className="page-container">
      <h1>Grade essay responses</h1>

      {errorMsg && <p className="banner banner-danger" style={{ marginTop: 16 }}>{errorMsg}</p>}
      {items.length === 0 && !errorMsg && (
        <div className="card" style={{ marginTop: 20 }}>
          <p style={{ color: 'var(--text-secondary)' }}>No essay responses awaiting grading.</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {items.map((item) => (
          <div key={item.response_id} className="card">
            <p className="section-label" style={{ fontSize: 11, margin: 0 }}>
              {item.exam_title} — {item.student_name}
            </p>
            <p style={{ fontWeight: 700, margin: '8px 0' }}>{item.question_text}</p>
            <div style={{ padding: 12, background: 'var(--page-bg)', borderRadius: 8, marginBottom: 12, border: '1px solid var(--border)' }}>
              {item.answer || <em style={{ color: 'var(--text-secondary)' }}>No answer provided</em>}
            </div>

            {item.marking_points && item.marking_points.length > 0 ? (
              <div style={{ marginBottom: 12 }}>
                <div className="section-label" style={{ marginBottom: 8 }}>Marking points — award marks per point</div>
                {item.marking_points.map((point: any, pi: number) => {
                  const answerLower = (item.answer || '').toLowerCase()
                  const autoMatched = point.keywords?.some((kw: string) => answerLower.includes(kw.toLowerCase()))
                  const pointKey = `${item.response_id}_${pi}`
                  return (
                    <div key={pi} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, padding: '8px 12px', background: autoMatched ? 'var(--success-bg)' : 'var(--card-bg)', borderRadius: 8, border: `1px solid ${autoMatched ? 'var(--success)' : 'var(--border)'}` }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>Point {pi + 1}: {point.text}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                          Matched on: {point.keywords?.slice(0, 6).join(', ')}{point.keywords?.length > 6 ? '…' : ''} · {autoMatched ? '✓ Auto-matched' : '✗ Not matched'}
                        </div>
                      </div>
                      <input
                        type="number"
                        min={0}
                        max={point.marks}
                        step={0.5}
                        placeholder={`0-${point.marks}`}
                        value={scores[pointKey] ?? (autoMatched ? point.marks : 0)}
                        onChange={(e) => updateScore(pointKey, e.target.value)}
                        style={{ width: 70 }}
                      />
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>/ {point.marks} pt{point.marks !== 1 ? 's' : ''}</span>
                    </div>
                  )
                })}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
                  <button
                    onClick={() => {
                      const total = item.marking_points.reduce((sum: number, _: any, pi: number) => {
                        const pointKey = `${item.response_id}_${pi}`
                        return sum + Number(scores[pointKey] ?? 0)
                      }, 0)
                      updateScore(item.response_id, String(total))
                      handleSaveGrade({ ...item, overrideScore: total })
                    }}
                    disabled={savingId === item.response_id}
                    className="btn btn-primary"
                  >
                    {savingId === item.response_id ? 'Saving…' : 'Save all points'}
                  </button>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Total: {item.marking_points.reduce((s: number, p: any) => s + p.marks, 0)} pts</span>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="number"
                  min={0}
                  max={item.points}
                  step={0.5}
                  placeholder={`0 - ${item.points}`}
                  value={scores[item.response_id] || ''}
                  onChange={(e) => updateScore(item.response_id, e.target.value)}
                  style={{ width: 100 }}
                />
                <span style={{ color: 'var(--text-secondary)' }}>/ {item.points} pts</span>
                <button onClick={() => handleSaveGrade(item)} disabled={savingId === item.response_id} className="btn btn-primary">
                  {savingId === item.response_id ? 'Saving…' : 'Save grade'}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
