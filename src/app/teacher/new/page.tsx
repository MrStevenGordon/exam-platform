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
    <div style={{ padding: 40, fontFamily: 'sans-serif', maxWidth: 600, margin: '0 auto' }}>
      <h1>New Exam</h1>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 16 }}>
          <label>Exam Type</label><br />
          <select
            value={examKind}
            onChange={(e) => setExamKind(e.target.value)}
            style={{ width: '100%', padding: 8, fontSize: 16 }}
          >
            <option value="final_exam_submission">Final Exam Submission (sent for supervisor review)</option>
            <option value="mock">Mock Exam (publish directly to your class)</option>
            <option value="pop_quiz">Pop Quiz (publish directly to your class)</option>
            <option value="midterm">Midterm Exam (publish directly to your class)</option>
          </select>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label>Title</label><br />
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            style={{ width: '100%', padding: 8, fontSize: 16 }}
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label>Subject</label><br />
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
            style={{ width: '100%', padding: 8, fontSize: 16 }}
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label>Instructions (shown to students on the front page)</label><br />
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={4}
            style={{ width: '100%', padding: 8, fontSize: 16 }}
          />
        </div>
        {errorMsg && <p style={{ color: 'red' }}>{errorMsg}</p>}
        <button type="submit" disabled={saving} style={{ padding: '10px 20px', fontSize: 16 }}>
          {saving ? 'Creating...' : 'Create Exam'}
        </button>
      </form>
    </div>
  )
}
