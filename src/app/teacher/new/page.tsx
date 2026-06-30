'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function NewExamPage() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [subject, setSubject] = useState('')
  const [instructions, setInstructions] = useState('')
  const [examKind, setExamKind] = useState('final_exam_submission')
  const [errorMsg, setErrorMsg] = useState('')
  const [saving, setSaving] = useState(false)

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
      <h1>New exam</h1>
      <div className="card" style={{ marginTop: 20 }}>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>Exam type</label>
            <select
              value={examKind}
              onChange={(e) => setExamKind(e.target.value)}
              style={{ width: '100%', marginTop: 6 }}
            >
              <option value="final_exam_submission">Final exam submission (sent for supervisor review)</option>
              <option value="pop_quiz">Pop quiz (publish directly to your class)</option>
              <option value="midterm">Midterm exam (publish directly to your class)</option>
              <option value="end_of_year">End of year exam (publish directly to your class)</option>
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
          {errorMsg && <p className="banner banner-danger" style={{ marginBottom: 16 }}>{errorMsg}</p>}
          <button type="submit" disabled={saving} className="btn btn-primary">
            {saving ? 'Creating…' : 'Create exam'}
          </button>
        </form>
      </div>
    </div>
  )
}
