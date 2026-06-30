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
