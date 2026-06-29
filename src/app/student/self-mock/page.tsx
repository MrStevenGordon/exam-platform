'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

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

      const { data, error } = await supabase
        .from('questions')
        .select('draft_exams(subject)')
        .neq('question_type', 'essay')

      if (error) {
        setErrorMsg(error.message)
        setLoading(false)
        return
      }

      const subjectSet = new Set<string>()
      ;(data || []).forEach((row: any) => {
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

    const { data: candidateQuestions, error: qError } = await supabase
      .from('questions')
      .select('id, draft_exams(subject)')
      .neq('question_type', 'essay')

    if (qError) {
      setErrorMsg(qError.message)
      setGenerating(false)
      return
    }

    const filtered = (candidateQuestions || []).filter((q: any) => q.draft_exams?.subject === subject)

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

  if (loading) return <div style={{ padding: 40 }}>Loading...</div>

  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif', maxWidth: 600, margin: '0 auto' }}>
      <h1>Generate a Practice Mock Exam</h1>
      <p style={{ color: '#666' }}>
        Pulls real past questions for self-practice. No proctoring — this is just for you.
      </p>

      {errorMsg && <p style={{ color: 'red' }}>{errorMsg}</p>}

      {subjects.length === 0 && !errorMsg && <p>No practice questions available yet.</p>}

      {subjects.length > 0 && (
        <>
          <div style={{ marginBottom: 16 }}>
            <label>Subject</label><br />
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              style={{ width: '100%', padding: 8, fontSize: 16 }}
            >
              {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label>Number of Questions</label><br />
            <input
              type="number"
              min={1}
              max={50}
              value={count}
              onChange={(e) => setCount(parseInt(e.target.value) || 10)}
              style={{ width: 100, padding: 8, fontSize: 16 }}
            />
          </div>

          <button
            onClick={handleGenerate}
            disabled={generating}
            style={{ padding: '12px 24px', fontSize: 16, background: '#2563eb', color: 'white', border: 'none', borderRadius: 6 }}
          >
            {generating ? 'Generating...' : 'Generate Mock Exam'}
          </button>
        </>
      )}
    </div>
  )
}
