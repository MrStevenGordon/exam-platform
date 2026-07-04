'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const ROLE_OPTIONS = [
  { value: 'student', label: 'Student' },
  { value: 'teacher', label: 'Teacher' },
  { value: 'supervisor', label: 'Supervisor / HOD' },
  { value: 'system_admin', label: 'System Admin' },
  { value: 'admin', label: 'Administrator' },
]

const ROLE_REDIRECTS: Record<string, string> = {
  student: '/student',
  teacher: '/teacher',
  supervisor: '/supervisor',
  admin: '/dashboard',
}

export default function LoginPage() {
  const router = useRouter()
  const [selectedRole, setSelectedRole] = useState('student')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError('Invalid email or password. Please try again.')
      setLoading(false)
      return
    }

    // Verify their actual role matches what they selected
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, is_system_admin')
      .eq('id', data.user.id)
      .single()

    if (!profile) {
      setError('Account not found. Contact your administrator.')
      await supabase.auth.signOut()
      setLoading(false)
      return
    }

    // System admin check — is_system_admin flag overrides role for login
    const isSystemAdmin = profile.is_system_admin === true
    const selectedSystemAdmin = selectedRole === 'system_admin'

    if (isSystemAdmin && !selectedSystemAdmin) {
      setError('Please select "System Admin" and try again.')
      await supabase.auth.signOut()
      setLoading(false)
      return
    }

    if (!isSystemAdmin && selectedSystemAdmin) {
      setError('This account is not a system administrator.')
      await supabase.auth.signOut()
      setLoading(false)
      return
    }

    if (!isSystemAdmin && profile.role !== selectedRole) {
      const correctLabel = profile.role === 'supervisor' ? 'Supervisor / HOD' :
        profile.role.charAt(0).toUpperCase() + profile.role.slice(1)
      setError(`Incorrect role selected. Please select "${correctLabel}" and try again.`)
      await supabase.auth.signOut()
      setLoading(false)
      return
    }

    // System admin goes to school-admin portal
    if (profile.is_system_admin) {
      router.push('/school-admin')
      return
    }
    router.push(ROLE_REDIRECTS[profile.role] || '/dashboard')
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
      {/* Brand header */}
      <Link href="/" style={{ textDecoration: 'none', marginBottom: 32, textAlign: 'center' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
          Smart Assess Ja
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginTop: 2 }}>
          Smart Assess
        </div>
      </Link>

      <div className="card" style={{ width: '100%', maxWidth: 400, padding: '32px 28px' }}>
        <h1 style={{ marginBottom: 4, fontSize: 18 }}>Welcome Back</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 24 }}>
          Sign in to your portal
        </p>

        <form onSubmit={handleLogin}>
          {/* Role selector */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: 0.5, textTransform: 'uppercase' }}>
              I am a
            </label>
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              {ROLE_OPTIONS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setSelectedRole(r.value)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 20,
                    border: `1.5px solid ${selectedRole === r.value ? 'var(--accent)' : 'var(--border-strong)'}`,
                    background: selectedRole === r.value ? 'var(--accent-light)' : 'white',
                    color: selectedRole === r.value ? 'var(--accent-dark)' : 'var(--text-secondary)',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    letterSpacing: 0.3,
                    textTransform: 'uppercase',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Email */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: 0.5, textTransform: 'uppercase' }}>
              Email / Student ID
            </label>
            <input
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder={selectedRole === 'student' ? '12345@mhs.smartassess' : 'your@email.com'}
              style={{ width: '100%', marginTop: 6 }}
            />
          </div>

          {/* Password */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: 0.5, textTransform: 'uppercase' }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
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
            {loading ? 'Signing in…' : `Sign in as ${ROLE_OPTIONS.find(r => r.value === selectedRole)?.label}`}
          </button>
        </form>
      </div>

      <p style={{ marginTop: 24, fontSize: 12, color: 'var(--text-muted)' }}>
        © {new Date().getFullYear()} Smart Assess Ja · All rights reserved
      </p>
    </div>
  )
}
