'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function OrgSignupPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setLoading(true)

    const { data, error: authError } = await supabase.auth.signUp({ email: contactEmail, password })
    if (authError || !data.user) {
      setError(authError?.message || 'Could not create your account.')
      setLoading(false)
      return
    }

    const { error: orgError } = await supabase
      .from('organizations')
      .insert({ auth_user_id: data.user.id, name: name.trim(), contact_email: contactEmail.trim() })

    if (orgError) {
      setError(orgError.message)
      setLoading(false)
      return
    }

    router.push('/org/dashboard')
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
          Smart Assess for Organizations
        </div>
      </Link>

      <div className="card" style={{ width: '100%', maxWidth: 400, padding: '32px 28px' }}>
        <h1 style={{ marginBottom: 4, fontSize: 18 }}>Create your organization account</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 24 }}>
          Publish a one-off exam or assessment — no roster setup required.
        </p>

        <form onSubmit={handleSignup}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: 0.5, textTransform: 'uppercase' }}>
              Organization name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Acme Recruiting"
              style={{ width: '100%', marginTop: 6 }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: 0.5, textTransform: 'uppercase' }}>
              Contact email
            </label>
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              required
              placeholder="you@organization.com"
              style={{ width: '100%', marginTop: 6 }}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: 0.5, textTransform: 'uppercase' }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              placeholder="At least 8 characters"
              style={{ width: '100%', marginTop: 6 }}
            />
          </div>

          {error && (
            <div className="banner banner-danger" style={{ marginBottom: 16, fontSize: 13 }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', fontSize: 14, padding: '12px 20px' }}
          >
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--text-secondary)' }}>
          Already have an organization account? <Link href="/org/login" style={{ color: 'var(--accent-dark)', fontWeight: 600 }}>Sign in</Link>
        </div>
      </div>
    </div>
  )
}
