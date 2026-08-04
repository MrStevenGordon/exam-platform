'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function OrgSetupPage() {
  const router = useRouter()
  const params = useParams()
  const token = params.token as string

  const [checking, setChecking] = useState(true)
  const [valid, setValid] = useState(false)
  const [orgName, setOrgName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    async function verify() {
      const res = await fetch(`/api/org-setup/verify-token?token=${encodeURIComponent(token)}`)
      const data = await res.json()
      setValid(!!data.valid)
      if (data.valid) {
        setOrgName(data.orgName || '')
        setContactEmail(data.contactEmail || '')
      }
      setChecking(false)
    }
    verify()
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setSubmitting(true)

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email: contactEmail, password })
    if (signUpError || !signUpData.session) {
      setError(signUpError?.message || 'Could not create your account.')
      setSubmitting(false)
      return
    }

    const res = await fetch('/api/org-setup/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, accessToken: signUpData.session.access_token, orgName }),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error || 'Could not complete setup.')
      setSubmitting(false)
      return
    }

    router.push('/org/dashboard')
  }

  const pageWrapperStyle: React.CSSProperties = {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--page-bg)',
    padding: 24,
  }

  if (checking) return <div style={pageWrapperStyle}>Checking your link…</div>

  if (!valid) {
    return (
      <div style={pageWrapperStyle}>
        <div className="card" style={{ width: '100%', maxWidth: 400, padding: '32px 28px', textAlign: 'center' }}>
          <h1 style={{ marginBottom: 8, fontSize: 18 }}>This link isn&apos;t valid</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            It may have already been used, or the link may be incorrect.{' '}
            <a href="mailto:onboarding@smartassessja.com" style={{ color: 'var(--accent-dark)', fontWeight: 600 }}>Contact us</a> if you need a new one.
          </p>
          <Link href="/" style={{ display: 'inline-block', marginTop: 16, color: 'var(--accent-dark)', fontWeight: 600 }}>&larr; Back to home</Link>
        </div>
      </div>
    )
  }

  return (
    <div style={pageWrapperStyle}>
      <div style={{ marginBottom: 32, textAlign: 'center' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
          Smart Assess Ja
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginTop: 2 }}>
          Set Up Your Organization
        </div>
      </div>

      <div className="card" style={{ width: '100%', maxWidth: 400, padding: '32px 28px' }}>
        <h1 style={{ marginBottom: 4, fontSize: 18 }}>Create your account</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 24 }}>
          You&apos;ll be the administrator for your organization&apos;s account.
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: 0.5, textTransform: 'uppercase' }}>Organization name</label>
            <input type="text" value={orgName} onChange={(e) => setOrgName(e.target.value)} required style={{ width: '100%', marginTop: 6 }} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: 0.5, textTransform: 'uppercase' }}>Email</label>
            <input type="email" value={contactEmail} readOnly style={{ width: '100%', marginTop: 6, background: 'var(--page-bg)', color: 'var(--text-secondary)' }} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: 0.5, textTransform: 'uppercase' }}>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} placeholder="At least 8 characters" style={{ width: '100%', marginTop: 6 }} />
          </div>

          {error && <div className="banner banner-danger" style={{ marginBottom: 16, fontSize: 13 }}>{error}</div>}

          <button type="submit" disabled={submitting} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', fontSize: 14, padding: '12px 20px' }}>
            {submitting ? 'Setting up…' : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  )
}
