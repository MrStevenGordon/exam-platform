'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// Only questions from exams the current student has personally completed
// are eligible for self-mock practice. This intentionally does NOT use
// "published" as the bar — a published-but-not-yet-taken exam would let a
// student preview real questions before sitting it. Completion is checked
// per exam type since direct exams and final exams use different linking:
// direct exams via exam_sessions.draft_exam_id -> questions.draft_exam_id,
// final exams via exam_sessions.final_exam_id -> final_exam_questions.
async function getEligibleQuestions(userId: string) {
  const { data: directSessions } = await supabase
    .from('exam_sessions')
    .select('draft_exam_id')
    .eq('student_id', userId)
    .eq('status', 'completed')
    .not('draft_exam_id', 'is', null)
  const completedDraftIds = Array.from(new Set((directSessions || []).map((s: any) => s.draft_exam_id)))

  const { data: finalSessions } = await supabase
    .from('exam_sessions')
    .select('final_exam_id')
    .eq('student_id', userId)
    .eq('status', 'completed')
    .not('final_exam_id', 'is', null)
  const completedFinalIds = Array.from(new Set((finalSessions || []).map((s: any) => s.final_exam_id)))

  let finalQuestionIds: string[] = []
  if (completedFinalIds.length > 0) {
    const { data: feq } = await supabase
      .from('final_exam_questions')
      .select('question_id')
      .in('final_exam_id', completedFinalIds)
    finalQuestionIds = (feq || []).map((r: any) => r.question_id)
  }

  let directQuestions: any[] = []
  if (completedDraftIds.length > 0) {
    const { data: dq } = await supabase
      .from('questions')
      .select('id, draft_exams(subject)')
      .neq('question_type', 'essay')
      .in('draft_exam_id', completedDraftIds)
    directQuestions = dq || []
  }

  let finalQuestions: any[] = []
  if (finalQuestionIds.length > 0) {
    const { data: fq } = await supabase
      .from('questions')
      .select('id, draft_exams(subject)')
      .neq('question_type', 'essay')
      .in('id', finalQuestionIds)
    finalQuestions = fq || []
  }

  const merged = new Map<string, any>()
  ;[...directQuestions, ...finalQuestions].forEach((q) => merged.set(q.id, q))
  return Array.from(merged.values())
}

export default function GenerateSelfMockPage() {
  const router = useRouter()
  const [subjects, setSubjects] = useState<string[]>([])
  const [subject, setSubject] = useState('')
  const [count, setCount] = useState(10)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    async function loadSubjects() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const rows = await getEligibleQuestions(user.id)

      const subjectSet = new Set<string>()
      rows.forEach((row: any) => {
        if (row.draft_exams?.subject) subjectSet.add(row.draft_exams.subject)
      })
      setSubjects(Array.from(subjectSet))
      if (subjectSet.size > 0) setSubject(Array.from(subjectSet)[0])
      setLoading(false)
    }
    loadSubjects()
  }, [router])

  async function handleGenerate() {
    if (!subject) {
      alert('Pick a subject first.')
      return
    }

    setGenerating(true)
    setErrorMsg('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const candidateQuestions = await getEligibleQuestions(user.id)
    const filtered = candidateQuestions.filter((q: any) => q.draft_exams?.subject === subject)

    if (filtered.length === 0) {
      setErrorMsg('No questions found for this subject yet.')
      setGenerating(false)
      return
    }

    const shuffled = [...filtered].sort(() => Math.random() - 0.5)
    const picked = shuffled.slice(0, Math.min(count, shuffled.length))

    const { data: mock, error: mockError } = await supabase
      .from('self_mocks')
      .insert({ student_id: user.id, subject, question_count: picked.length })
      .select()
      .single()

    if (mockError) {
      setErrorMsg(mockError.message)
      setGenerating(false)
      return
    }

    const rows = picked.map((q: any, i: number) => ({
      self_mock_id: mock.id,
      question_id: q.id,
      order_index: i,
    }))

    const { error: linkError } = await supabase.from('self_mock_questions').insert(rows)

    if (linkError) {
      setErrorMsg(linkError.message)
      setGenerating(false)
      return
    }

    router.push(`/student/self-mock/${mock.id}`)
  }

  if (loading) return <div className="page-container">Loading…</div>

  return (
    <div className="page-container" style={{ maxWidth: 480 }}>
      <h1>Practice mock exam</h1>
      <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>
        Pulls real past questions for self-practice. No proctoring — this is just for you.
      </p>

      {errorMsg && <p className="banner banner-danger" style={{ marginTop: 16 }}>{errorMsg}</p>}

      {subjects.length === 0 && !errorMsg && <p style={{ marginTop: 16, color: 'var(--text-secondary)' }}>No practice questions available yet.</p>}

      {subjects.length > 0 && (
        <div className="card" style={{ marginTop: 20 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>Subject</label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              style={{ width: '100%', marginTop: 6 }}
            >
              {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>Number of questions</label>
            <input
              type="number"
              min={1}
              max={50}
              value={count}
              onChange={(e) => setCount(parseInt(e.target.value) || 10)}
              style={{ width: 100, marginTop: 6 }}
            />
          </div>

          <button onClick={handleGenerate} disabled={generating} className="btn btn-primary">
            {generating ? 'Generating…' : 'Generate mock exam'}
          </button>
        </div>
      )}
    </div>
  )
}
