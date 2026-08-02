'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

function TakeExamCodeForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const prefill = searchParams.get('code')
    if (prefill) setCode(prefill.toUpperCase())
  }, [searchParams])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const res = await fetch(`/api/org-exam-lookup?code=${encodeURIComponent(code.trim())}`)
    const data = await res.json()

    if (!res.ok) {
      setError(data.error || 'Exam not found.')
      setLoading(false)
      return
    }

    router.push(`/take-exam/${data.examId}`)
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--page-bg)',
      padding: 24,
    }}>
      <Link href="/" style={{ textDecoration: 'none', marginBottom: 32, textAlign: 'center' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
          Smart Assess Ja
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginTop: 2 }}>
          Take an Exam
        </div>
      </Link>

      <div className="card" style={{ width: '100%', maxWidth: 400, padding: '32px 28px' }}>
        <h1 style={{ marginBottom: 4, fontSize: 18 }}>Enter your exam code</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 24 }}>
          Your organization should have shared this with you.
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: 0.5, textTransform: 'uppercase' }}>
              Exam code
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              required
              placeholder="ABC123"
              style={{ width: '100%', marginTop: 6, fontFamily: 'monospace', fontSize: 16, letterSpacing: 2, textAlign: 'center' }}
              autoFocus
            />
          </div>

          {error && (
            <div className="banner banner-danger" style={{ marginBottom: 16, fontSize: 13 }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !code.trim()}
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', fontSize: 14, padding: '12px 20px' }}
          >
            {loading ? 'Checking…' : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function TakeExamPage() {
  return (
    <Suspense fallback={<div>Loading…</div>}>
      <TakeExamCodeForm />
    </Suspense>
  )
}
