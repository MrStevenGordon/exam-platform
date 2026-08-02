'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { getMfaRedirect } from '@/lib/mfaCheck'

const ROLE_OPTIONS = [
  { value: 'student', label: 'Student' },
  { value: 'teacher', label: 'Teacher' },
  { value: 'supervisor', label: 'Supervisor / HOD' },
  { value: 'school_admin', label: 'School Admin' },
  { value: 'owner', label: 'Administrator' },
]

// 'owner' isn't a profiles.role value at all — it's the is_system_admin
// flag, handled as its own branch below (see isOwner). Every other
// selection maps to a real role value; 'school_admin' is a friendlier label
// for role='admin' (a single school's own admin — departments/staff/
// students), which is distinct from the platform owner.
const SELECTION_TO_ROLE: Record<string, string> = {
  student: 'student',
  teacher: 'teacher',
  supervisor: 'supervisor',
  school_admin: 'admin',
}

const ROLE_REDIRECTS: Record<string, string> = {
  student: '/student',
  teacher: '/teacher',
  supervisor: '/supervisor',
  admin: '/school-admin',
}

export default function LoginPage() {
  const router = useRouter()
  const [selectedRole, setSelectedRole] = useState('student')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [mfaRequired, setMfaRequired] = useState(false)
  const [mfaFactorId, setMfaFactorId] = useState('')
  const [mfaCode, setMfaCode] = useState('')

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

    // Check if this account has 2FA enabled — if so, pause here and require
    // the authenticator code before completing login.
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (aal && aal.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') {
      const { data: factors } = await supabase.auth.mfa.listFactors()
      const verifiedFactor = factors?.totp?.find((f) => f.status === 'verified')
      if (verifiedFactor) {
        setMfaFactorId(verifiedFactor.id)
        setMfaRequired(true)
        setLoading(false)
        return
      }
    }

    await completeLogin(data.user.id)
  }

  async function handleVerifyMfa(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: mfaFactorId })
    if (challengeError) {
      setError(challengeError.message)
      setLoading(false)
      return
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: mfaFactorId,
      challengeId: challenge.id,
      code: mfaCode.trim(),
    })

    if (verifyError) {
      setError('Incorrect code. Please check your authenticator app and try again.')
      setLoading(false)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('Something went wrong. Please try signing in again.')
      setLoading(false)
      return
    }

    await completeLogin(user.id)
  }

  async function completeLogin(userId: string) {
    // Verify their actual role matches what they selected
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, is_system_admin, is_active')
      .eq('id', userId)
      .single()

    if (!profile) {
      setError('Account not found. Contact your administrator.')
      await supabase.auth.signOut()
      setLoading(false)
      return
    }

    if (profile.is_active === false) {
      setError('This account has been deactivated. Contact your school administrator.')
      await supabase.auth.signOut()
      setLoading(false)
      return
    }

    // Owner check — is_system_admin is the platform-owner flag, entirely
    // separate from any school's own role='admin' staff.
    const isOwner = profile.is_system_admin === true
    const selectedOwner = selectedRole === 'owner'

    // Subscription gate — replaces the desktop app's old license-key
    // screen. Every account here belongs to this one school (each school
    // runs its own separate database), so a single subscription flag on
    // school_settings blocks every login uniformly, on web or desktop,
    // the moment it lapses — no per-account key needed. The owner is
    // exempt: they're not "this school's" account, they're the platform
    // owner, who happens to share this database only because Manchester
    // High predates full multi-tenant provisioning.
    if (!isOwner) {
      const { data: settings } = await supabase
        .from('school_settings')
        .select('subscription_active, subscription_expires_at')
        .limit(1)
        .maybeSingle()

      const expired = settings?.subscription_expires_at ? new Date(settings.subscription_expires_at) < new Date() : false
      if (settings && (settings.subscription_active === false || expired)) {
        setError('This school\'s subscription is not currently active. Contact your school administrator.')
        await supabase.auth.signOut()
        setLoading(false)
        return
      }
    }

    if (isOwner && !selectedOwner) {
      setError('Please select "Administrator" and try again.')
      await supabase.auth.signOut()
      setLoading(false)
      return
    }

    if (!isOwner && selectedOwner) {
      setError('This account is not an administrator.')
      await supabase.auth.signOut()
      setLoading(false)
      return
    }

    if (!isOwner && profile.role !== SELECTION_TO_ROLE[selectedRole]) {
      const correctSelection = Object.keys(SELECTION_TO_ROLE).find((key) => SELECTION_TO_ROLE[key] === profile.role)
      const correctLabel = ROLE_OPTIONS.find((r) => r.value === correctSelection)?.label || profile.role
      setError(`Incorrect role selected. Please select "${correctLabel}" and try again.`)
      await supabase.auth.signOut()
      setLoading(false)
      return
    }

    // Students: while a TEST or FINAL exam is in progress, only one device
    // may be logged in at a time. Homework/Assignment are deliberately
    // excluded — they're untimed, take-home work, so a session left open
    // overnight shouldn't block login the next day for an unrelated exam.
    if (profile.role === 'student') {
      const { data: draftSessions } = await supabase
        .from('exam_sessions')
        .select('id, draft_exams(exam_kind)')
        .eq('student_id', userId)
        .eq('status', 'in_progress')
        .not('draft_exam_id', 'is', null)

      const { data: finalSessions } = await supabase
        .from('exam_sessions')
        .select('id')
        .eq('student_id', userId)
        .eq('status', 'in_progress')
        .not('final_exam_id', 'is', null)

      const lockingDraftSessions = (draftSessions || []).filter((s: any) => {
        const kind = s.draft_exams?.exam_kind
        return kind !== 'homework' && kind !== 'assignment'
      })
      const activeSessions = [...lockingDraftSessions, ...(finalSessions || [])]

      const { data: lockProfile } = await supabase
        .from('profiles')
        .select('active_login_token')
        .eq('id', userId)
        .single()

      if (activeSessions && activeSessions.length > 0) {
        const myToken = localStorage.getItem(`exam_lock_${userId}`)
        const dbToken = lockProfile?.active_login_token

        if (dbToken && dbToken !== myToken) {
          setError('You appear to already be logged in on another device with an exam in progress. Ask your school admin to release your session if this isn\'t you.')
          await supabase.auth.signOut()
          setLoading(false)
          return
        }

        const newToken = dbToken || crypto.randomUUID()
        localStorage.setItem(`exam_lock_${userId}`, newToken)
        await supabase.from('profiles').update({ active_login_token: newToken, active_login_started_at: new Date().toISOString() }).eq('id', userId)
      } else if (lockProfile?.active_login_token) {
        await supabase.from('profiles').update({ active_login_token: null, active_login_started_at: null }).eq('id', userId)
      }
    }

    // Platform owner goes to the owner portal — separate from every school's
    // own admin, which is handled by ROLE_REDIRECTS.admin below instead.
    if (profile.is_system_admin) {
      if (password === 'Staff.Default1' || password === 'Student.Test') {
        router.push('/change-password?first=true')
        return
      }
      const mfaRedirect = await getMfaRedirect('owner')
      if (mfaRedirect) { router.push(mfaRedirect); return }
      router.push('/owner')
      return
    }

    const defaultPasswords = ['Staff.Default1', 'Student.Test', 'Demo.Default']
    if (defaultPasswords.includes(password)) {
      router.push('/change-password?first=true')
      return
    }

    const mfaRedirect = await getMfaRedirect(profile.role)
    if (mfaRedirect) { router.push(mfaRedirect); return }

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

        {mfaRequired ? (
          <form onSubmit={handleVerifyMfa}>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
              Enter the 6-digit code from your authenticator app.
            </p>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                Authentication code
              </label>
              <input
                type="text"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                required
                maxLength={6}
                placeholder="123456"
                style={{ width: '100%', marginTop: 6 }}
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
              disabled={loading || mfaCode.trim().length < 6}
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', fontSize: 14, padding: '12px 20px' }}
            >
              {loading ? 'Verifying…' : 'Verify'}
            </button>

            <div style={{ textAlign: 'center', marginTop: 14 }}>
              <button
                type="button"
                onClick={() => { setMfaRequired(false); setMfaCode(''); setError(''); supabase.auth.signOut() }}
                style={{ fontSize: 13, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Back to login
              </button>
            </div>
          </form>
        ) : (
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: 0.5, textTransform: 'uppercase' }}>
              I am a
            </label>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              style={{ width: '100%', marginTop: 8 }}
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

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

          <div style={{ textAlign: 'center', marginTop: 14 }}>
            <Link href="/forgot-password" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Forgot password?
            </Link>
          </div>
        </form>
        )}
      </div>

      <p style={{ marginTop: 24, fontSize: 12, color: 'var(--text-muted)' }}>
        © {new Date().getFullYear()} Smart Assess Ja · All rights reserved
      </p>
    </div>
  )
}
