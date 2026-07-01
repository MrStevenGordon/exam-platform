'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function NewFinalExamPage() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [subject, setSubject] = useState('')
  const [instructions, setInstructions] = useState('')
  const [duration, setDuration] = useState(60)
  const [errorMsg, setErrorMsg] = useState('')
  const [questionsPerPage, setQuestionsPerPage] = useState(10)
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
      .from('final_exams')
      .insert({
        title,
        subject,
        instructions,
        duration_minutes: duration,
        questions_per_page: questionsPerPage,
        created_by: user.id,
        department_id: profile?.department_id,
      })
      .select()
      .single()

    if (error) {
      setErrorMsg(error.message)
      setSaving(false)
    } else {
      router.push(`/supervisor/final-exams/${data.id}`)
    }
  }

  return (
    <div className="page-container" style={{ maxWidth: 520 }}>
      <h1>New final exam</h1>
      <div className="card" style={{ marginTop: 20 }}>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>Title</label><br />
            <input value={title} onChange={(e) => setTitle(e.target.value)} required style={{ width: '100%', marginTop: 6 }} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>Subject</label><br />
            <input value={subject} onChange={(e) => setSubject(e.target.value)} required style={{ width: '100%', marginTop: 6 }} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>Instructions (shown to students on the front page)</label><br />
            <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={4} style={{ width: '100%', marginTop: 6 }} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>Duration (minutes)</label><br />
            <input
              type="number"
              min={1}
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value) || 60)}
              style={{ width: 120, marginTop: 6 }}
            />
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
          {errorMsg && <p className="banner banner-danger" style={{ marginBottom: 16 }}>{errorMsg}</p>}
          <button type="submit" disabled={saving} className="btn btn-primary">
            {saving ? 'Creating…' : 'Create final exam'}
          </button>
        </form>
      </div>
    </div>
  )
}
