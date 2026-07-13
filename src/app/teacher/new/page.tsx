'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const TASK_OPTIONS = [
  { value: 'homework', label: 'Homework' },
  { value: 'assignment', label: 'Assignment' },
]

const TEST_OPTIONS = [
  { value: 'pop_quiz', label: 'Pop quiz' },
  { value: 'class_test', label: 'Class test' },
  { value: 'weekly_test', label: 'Weekly test' },
]

export default function NewExamPage() {
  return (
    <Suspense fallback={<div className="page-container">Loading…</div>}>
      <NewExamForm />
    </Suspense>
  )
}

function NewExamForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const mode = searchParams.get('kind') === 'task' ? 'task' : searchParams.get('kind') === 'test' ? 'test' : 'all'
  const options = mode === 'task' ? TASK_OPTIONS : mode === 'test' ? TEST_OPTIONS : [...TEST_OPTIONS, ...TASK_OPTIONS]
  const pageTitle = mode === 'task' ? 'New task' : mode === 'test' ? 'New test' : 'New exam'
  const returnPath = mode === 'task' ? '/teacher/tasks' : mode === 'test' ? '/teacher/tests' : '/teacher/tasks'

  const [title, setTitle] = useState('')
  const [subject, setSubject] = useState('')
  const [instructions, setInstructions] = useState('')
  const [examKind, setExamKind] = useState(options[0].value)
  const [errorMsg, setErrorMsg] = useState('')
  const [isTeamLead, setIsTeamLead] = useState(false)
  const [targetGrade, setTargetGrade] = useState<number | ''>('')
  const [questionsPerPage, setQuestionsPerPage] = useState(10)
  const [saving, setSaving] = useState(false)
  const [calculatorEnabled, setCalculatorEnabled] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setErrorMsg('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('department_id')
      .eq('id', user.id)
      .single()

    const { data, error } = await supabase
      .from('draft_exams')
      .insert({
        title,
        subject,
        instructions,
        created_by: user.id,
        department_id: profile?.department_id,
        exam_kind: examKind,
        questions_per_page: questionsPerPage,
        calculator_enabled: calculatorEnabled,
        target_grade: targetGrade || null,
      })
      .select()
      .single()

    if (error) {
      setErrorMsg(error.message)
      setSaving(false)
    } else {
      router.push(`/teacher/exam/${data.id}`)
    }
  }

  return (
    <div className="page-container" style={{ maxWidth: 520 }}>
      <Link href={returnPath} style={{ color: 'var(--text-secondary)', fontSize: 14 }}>&larr; Back</Link>
      <h1 style={{ marginTop: 12 }}>{pageTitle}</h1>
      <div className="card" style={{ marginTop: 20 }}>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>Exam type</label>
            <select
              value={examKind}
              onChange={(e) => setExamKind(e.target.value)}
              style={{ width: '100%', marginTop: 6 }}
            >
              {options.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} required style={{ width: '100%', marginTop: 6 }} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>Subject</label>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} required style={{ width: '100%', marginTop: 6 }} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>Instructions (shown to students on the front page)</label>
            <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={4} style={{ width: '100%', marginTop: 6 }} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>Year group (which grade is this exam for?)</label>
            <select
              value={targetGrade}
              onChange={(e) => setTargetGrade(e.target.value ? parseInt(e.target.value) : '')}
              style={{ width: '100%', marginTop: 6 }}
            >
              <option value="">Select year group…</option>
              <option value={7}>Grade 7</option>
              <option value={8}>Grade 8</option>
              <option value={9}>Grade 9</option>
              <option value={10}>Grade 10</option>
              <option value={11}>Grade 11</option>
            </select>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>Questions per page</label>
            <select
              value={questionsPerPage}
              onChange={(e) => setQuestionsPerPage(parseInt(e.target.value))}
              style={{ width: '100%', marginTop: 6 }}
            >
              <option value={5}>5 questions per page</option>
              <option value={10}>10 questions per page</option>
              <option value={20}>20 questions per page</option>
            </select>
          </div>

          <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'var(--accent-light)', borderRadius: 8 }}>
            <input
              type="checkbox"
              id="calc-enabled"
              checked={calculatorEnabled}
              onChange={(e) => setCalculatorEnabled(e.target.checked)}
              style={{ width: 'auto', accentColor: 'var(--accent)' }}
            />
            <label htmlFor="calc-enabled" style={{ cursor: 'pointer', fontSize: 14 }}>
              <span style={{ fontWeight: 600, color: 'var(--accent-dark)' }}>Enable scientific calculator</span>
              <span style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                Students will have access to a built-in calculator during this exam
              </span>
            </label>
          </div>

          {errorMsg && <p className="banner banner-danger" style={{ marginBottom: 16 }}>{errorMsg}</p>}
          <button type="submit" disabled={saving} className="btn btn-primary">
            {saving ? 'Creating…' : 'Create exam'}
          </button>
        </form>
      </div>
    </div>
  )
}
