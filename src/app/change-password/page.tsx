'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function ChangePasswordPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isFirst = searchParams.get('first') === 'true'

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [profile, setProfile] = useState<any>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data } = await supabase.from('profiles').select('role, is_system_admin').eq('id', user.id).single()
      setProfile(data)
    }
    load()
  }, [])

  async function handleSave() {
    setError('')
    if (!newPassword || !confirmPassword) { setError('Please fill in all fields.'); return }
    if (newPassword === 'Staff.Default1' || newPassword === 'Student.Test') {
      setError('Please choose a different password — not the default one.'); return
    }
    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return }
    if (newPassword.length < 8) { setError('Password must be at least 8 characters.'); return }

    setSaving(true)
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
    if (updateError) { setError(updateError.message); setSaving(false); return }

    // Redirect to correct portal
    if (profile?.is_system_admin) { router.push('/school-admin'); return }
    const redirects: Record<string, string> = {
      student: '/student', teacher: '/teacher', supervisor: '/supervisor', admin: '/dashboard'
    }
    router.push(redirects[profile?.role] || '/dashboard')
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--page-bg)', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Smart Assess Ja</div>
          <h1 style={{ fontSize: 22, marginBottom: 8 }}>
            {isFirst ? 'Set your password' : 'Change password'}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            {isFirst
              ? 'You are logged in with a default password. Please set a new password to continue.'
              : 'Enter your new password below.'}
          </p>
        </div>

        <div className="card">
          {error && <div className="banner banner-danger" style={{ marginBottom: 14 }}>{error}</div>}

          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>New password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              style={{ width: '100%', marginTop: 6 }}
              placeholder="Minimum 8 characters"
              autoFocus
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Confirm new password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              style={{ width: '100%', marginTop: 6 }}
              placeholder="Repeat your new password"
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
          </div>

          <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ width: '100%' }}>
            {saving ? 'Saving…' : isFirst ? 'Set password and continue' : 'Save new password'}
          </button>
        </div>
      </div>
    </div>
  )
}
