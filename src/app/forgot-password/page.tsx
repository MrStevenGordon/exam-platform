'use client'

import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const USER_TYPE_OPTIONS = [
  { value: 'student', label: 'Student' },
  { value: 'teacher', label: 'Teacher' },
  { value: 'supervisor', label: 'Supervisor / HOD' },
]

export default function ForgotPasswordPage() {
  const [fullName, setFullName] = useState('')
  const [identifier, setIdentifier] = useState('')
  const [userType, setUserType] = useState('student')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!fullName.trim() || !identifier.trim()) {
      setError('Please fill in your full name and email / ID.')
      return
    }

    setLoading(true)
    const { error: insertError } = await supabase.from('password_reset_requests').insert({
      full_name: fullName.trim(),
      identifier: identifier.trim(),
      user_type: userType,
    })
    setLoading(false)

    if (insertError) {
      setError('Something went wrong submitting your request. Please try again.')
      return
    }

    setSubmitted(true)
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
          Smart Assess
        </div>
      </Link>

      <div className="card" style={{ width: '100%', maxWidth: 400, padding: '32px 28px' }}>
        {submitted ? (
          <>
            <h1 style={{ marginBottom: 4, fontSize: 18 }}>Request submitted</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 20 }}>
              Your school admin has been notified and will reset your password to the default.
              Once that's done, you can log in with the default password for your role and change it right away.
            </p>
            <Link href="/login">
              <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                Back to login
              </button>
            </Link>
          </>
        ) : (
          <>
            <h1 style={{ marginBottom: 4, fontSize: 18 }}>Forgot password?</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 24 }}>
              Submit your details below and your school admin will reset your password for you.
            </p>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                  I am a
                </label>
                <select
                  value={userType}
                  onChange={(e) => setUserType(e.target.value)}
                  style={{ marginTop: 4 }}
                >
                  {USER_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                  Full name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your full name"
                  style={{ marginTop: 4 }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                  Email or student/staff ID
                </label>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="you@school.edu or ID number"
                  style={{ marginTop: 4 }}
                />
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  This helps your admin find your account — it's not used to log you in.
                </p>
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
                {loading ? 'Submitting…' : 'Submit request'}
              </button>

              <div style={{ textAlign: 'center', marginTop: 14 }}>
                <Link href="/login" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  ← Back to login
                </Link>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
