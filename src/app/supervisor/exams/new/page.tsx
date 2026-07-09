'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function SupervisorNewExamPage() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [subject, setSubject] = useState('')
  const [instructions, setInstructions] = useState('')
  const [duration, setDuration] = useState(30)
  const [questionsPerPage, setQuestionsPerPage] = useState(10)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  async function handleCreate() {
    if (!title.trim()) { setErrorMsg('Please enter a title.'); return }
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('department_id')
      .eq('id', user.id)
      .single()

    const { data, error } = await supabase
      .from('draft_exams')
      .insert({
        title: title.trim(),
        subject: subject.trim(),
        instructions: instructions.trim(),
        exam_kind: 'pop_quiz',
        status: 'draft',
        duration_minutes: duration,
        questions_per_page: questionsPerPage,
        created_by: user.id,
        department_id: profile?.department_id,
        direct_published: false,
      })
      .select()
      .single()

    if (error) { setErrorMsg(error.message); setSaving(false); return }

    router.push(`/teacher/exam/${data.id}`)
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <Link href="/supervisor/exams" style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
        ← Back to my exams
      </Link>

      <h1 style={{ marginTop: 16, marginBottom: 4 }}>New exam</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: 13 }}>
        Create a pop quiz or class test for your students.
      </p>

      {errorMsg && <div className="banner banner-danger" style={{ marginBottom: 16 }}>{errorMsg}</div>}

      <div className="card">
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: '100%', marginTop: 4 }} placeholder="e.g. Chapter 3 Pop Quiz" />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Subject</label>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} style={{ width: '100%', marginTop: 4 }} placeholder="e.g. Mathematics" />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Instructions</label>
          <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={3} style={{ width: '100%', marginTop: 4 }} placeholder="Instructions shown to students at the start…" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Duration (minutes)</label>
            <input type="number" value={duration} onChange={(e) => setDuration(parseInt(e.target.value))} min={5} style={{ width: '100%', marginTop: 4 }} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Questions per page</label>
            <select value={questionsPerPage} onChange={(e) => setQuestionsPerPage(parseInt(e.target.value))} style={{ width: '100%', marginTop: 4 }}>
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
            </select>
          </div>
        </div>
        <button onClick={handleCreate} disabled={saving || !title.trim()} className="btn btn-primary">
          {saving ? 'Creating…' : 'Create and add questions'}
        </button>
      </div>
    </div>
  )
}
