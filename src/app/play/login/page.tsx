'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function PlayLoginPage() {
  const router = useRouter()
  const [studentId, setStudentId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch('/api/play/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Something went wrong. Please try again.')
        return
      }
      router.push('/play/home')
    } catch {
      setError('Could not reach the server. Check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page-container" style={{ maxWidth: 400, marginTop: 64 }}>
      <p className="portal-page-title" style={{ margin: 0 }}>Smart Assess Play</p>
      <p style={{ margin: '4px 0 24px', fontSize: 14, color: 'var(--text-secondary)' }}>
        Sign in with your student ID# and your game password.
      </p>

      <form onSubmit={handleSubmit} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {error && <p className="banner banner-danger" role="alert" style={{ margin: 0 }}>{error}</p>}
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: 'var(--text-secondary)' }}>
          Student ID#
          <input value={studentId} onChange={(e) => setStudentId(e.target.value)} inputMode="numeric" autoComplete="username" required maxLength={32} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: 'var(--text-secondary)' }}>
          Game password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required maxLength={128} />
        </label>
        <button type="submit" disabled={submitting} className="btn btn-primary">
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12 }}>
        This is separate from your exam login. Your game password only works here.
      </p>
    </div>
  )
}
