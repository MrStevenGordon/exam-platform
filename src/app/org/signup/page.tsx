'use client'

import { useState } from 'react'
import Link from 'next/link'
import TurnstileWidget from '@/components/TurnstileWidget'

export default function OrgSignupPage() {
  const [orgName, setOrgName] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [notes, setNotes] = useState('')
  const [website, setWebsite] = useState('') // honeypot — real users never see or fill this
  const [turnstileToken, setTurnstileToken] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const res = await fetch('/api/org-requests/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgName, contactName, contactEmail, notes, honeypot: website, turnstileToken }),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error || 'Something went wrong. Please try again.')
      setLoading(false)
      return
    }

    setSubmitted(true)
    setLoading(false)
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

      {submitted ? (
        <div className="card" style={{ width: '100%', maxWidth: 400, padding: '32px 28px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
          <h1 style={{ marginBottom: 8, fontSize: 18 }}>Request received</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            Thanks. We&apos;ll review your request and email {contactEmail} with next steps.
          </p>
          <Link href="/" style={{ display: 'inline-block', marginTop: 16, color: 'var(--accent-dark)', fontWeight: 600 }}>&larr; Back to home</Link>
        </div>
      ) : (
        <div className="card" style={{ width: '100%', maxWidth: 400, padding: '32px 28px' }}>
          <h1 style={{ marginBottom: 4, fontSize: 18 }}>Request an organization account</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 24 }}>
            Publish a one-off exam or assessment. No roster setup required. We review each request before setting up your account.
          </p>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                Organization name
              </label>
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                required
                placeholder="Acme Recruiting"
                style={{ width: '100%', marginTop: 6 }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                Your name
              </label>
              <input
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                required
                placeholder="Jane Brown"
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
                What will you use it for? (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="e.g. Screening assessment for job applicants"
                style={{ width: '100%', marginTop: 6 }}
              />
            </div>

            {/* Honeypot — visually hidden from real users, but a naive bot that
                autofills every field will fill this one and get silently rejected. */}
            <div style={{ display: 'none' }} aria-hidden="true">
              <label htmlFor="website">Website</label>
              <input
                type="text"
                id="website"
                name="website"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                tabIndex={-1}
                autoComplete="off"
              />
            </div>

            <TurnstileWidget onToken={setTurnstileToken} />

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
              {loading ? 'Submitting…' : 'Submit request'}
            </button>

            <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginTop: 12 }}>
              By submitting, you agree to our{' '}
              <Link href="/terms" style={{ color: 'var(--text-secondary)' }}>Terms of Service</Link> and{' '}
              <Link href="/privacy" style={{ color: 'var(--text-secondary)' }}>Privacy Policy</Link>.
            </p>
          </form>

          <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--text-secondary)' }}>
            Already have an organization account? <Link href="/org/login" style={{ color: 'var(--accent-dark)', fontWeight: 600 }}>Sign in</Link>
          </div>
        </div>
      )}
    </div>
  )
}
