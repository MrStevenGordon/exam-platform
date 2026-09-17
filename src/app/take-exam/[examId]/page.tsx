'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type RespondentField = { id: string; label: string; field_type: 'text' | 'number' | 'email'; required: boolean }

export default function TakeExamStartPage() {
  const router = useRouter()
  const params = useParams()
  const examId = params.examId as string

  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [instructions, setInstructions] = useState('')
  const [fields, setFields] = useState<RespondentField[]>([])
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({})
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [starting, setStarting] = useState(false)

  useEffect(() => { loadExam() }, [examId])

  async function loadExam() {
    try {
      const res = await fetch(`/api/org-exam-lookup?examId=${examId}`)
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Exam not found.'); return }
      setTitle(data.title)
      setInstructions(data.instructions || '')
      setFields(data.fields)
    } catch (err) {
      console.error('Failed to load exam', err)
      setError('Something went wrong loading this exam. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleStart(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setStarting(true)

    // Must be called synchronously from the user gesture (this form submit),
    // before any await, or browsers reject it as not user-initiated. Raced
    // against a timeout because some browsers/embedded contexts never
    // resolve or reject this promise at all rather than throwing — without
    // the race, that would hang the whole start flow indefinitely instead
    // of just skipping fullscreen and continuing.
    try {
      await Promise.race([
        document.documentElement.requestFullscreen(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('fullscreen timeout')), 1500)),
      ])
    } catch {
      // The exam still works, it just won't be locked to fullscreen until
      // the respondent enters manually.
    }

    const { data: anonData, error: anonError } = await supabase.auth.signInAnonymously()
    if (anonError || !anonData.session) {
      setError('Could not start your session. Please try again.')
      setStarting(false)
      return
    }

    const res = await fetch('/api/org-exam-start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ examId, password, fieldValues, accessToken: anonData.session.access_token }),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error || 'Something went wrong.')
      setStarting(false)
      return
    }

    router.push(`/take-exam/${examId}/questions`)
  }

  if (loading) return <div style={{ padding: 40 }}>Loading…</div>

  return (
    <div className="page-container" style={{ maxWidth: 480 }}>
      <h1>{title}</h1>
      {instructions && <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>{instructions}</p>}

      <div className="card">
        <form onSubmit={handleStart}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ width: '100%', marginTop: 6 }} />
          </div>

          {fields.map((f) => (
            <div key={f.id} style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                {f.label}{f.required && ' *'}
              </label>
              <input
                type={f.field_type === 'number' ? 'number' : f.field_type === 'email' ? 'email' : 'text'}
                value={fieldValues[f.id] || ''}
                onChange={(e) => setFieldValues((prev) => ({ ...prev, [f.id]: e.target.value }))}
                required={f.required}
                style={{ width: '100%', marginTop: 6 }}
              />
            </div>
          ))}

          {error && <div className="banner banner-danger" style={{ marginBottom: 16, fontSize: 13 }}>{error}</div>}

          <button type="submit" disabled={starting} className="btn btn-primary" style={{ width: '100%' }}>
            {starting ? 'Starting…' : 'Begin exam'}
          </button>
        </form>
      </div>
    </div>
  )
}
