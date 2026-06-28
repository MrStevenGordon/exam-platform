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
        questions(question_text, points, question_type),
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
    <div style={{ padding: 40, fontFamily: 'sans-serif', maxWidth: 800, margin: '0 auto' }}>
      <h1>Grade Essay Responses</h1>

      {errorMsg && <p style={{ color: 'red' }}>{errorMsg}</p>}
      {items.length === 0 && !errorMsg && <p>No essay responses awaiting grading.</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {items.map((item) => (
          <div key={item.response_id} style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16 }}>
            <p style={{ fontSize: 13, color: '#888', margin: 0 }}>
              {item.exam_title} — {item.student_name}
            </p>
            <p style={{ fontWeight: 600, margin: '8px 0' }}>{item.question_text}</p>
            <div style={{ padding: 12, background: '#f8f8f8', borderRadius: 6, marginBottom: 12 }}>
              {item.answer || <em>No answer provided</em>}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="number"
                min={0}
                max={item.points}
                step={0.5}
                placeholder={`0 - ${item.points}`}
                value={scores[item.response_id] || ''}
                onChange={(e) => updateScore(item.response_id, e.target.value)}
                style={{ width: 100, padding: 8, fontSize: 16 }}
              />
              <span style={{ color: '#888' }}>/ {item.points} pts</span>
              <button
                onClick={() => handleSaveGrade(item)}
                disabled={savingId === item.response_id}
                style={{ padding: '8px 16px', fontSize: 14, background: '#2563eb', color: 'white', border: 'none', borderRadius: 6 }}
              >
                {savingId === item.response_id ? 'Saving...' : 'Save Grade'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
