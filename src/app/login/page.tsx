'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { getMfaRedirect } from '@/lib/mfaCheck'

const ROLE_OPTIONS = [
  { value: 'student', label: 'Student' },
  { value: 'teacher', label: 'Teacher' },
  { value: 'supervisor', label: 'HOD (Head of Department)' },
  { value: 'principal', label: 'Principal / Vice Principal' },
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
  principal: 'principal',
  school_admin: 'admin',
}

const ROLE_REDIRECTS: Record<string, string> = {
  student: '/student',
  teacher: '/teacher',
  supervisor: '/supervisor',
  principal: '/principal',
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
  const [desktopVersion, setDesktopVersion] = useState('')
  const [inactivityNotice, setInactivityNotice] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    const electronAPI = (window as unknown as { electronAPI?: { getAppVersion: () => Promise<string> } }).electronAPI
    if (electronAPI) electronAPI.getAppVersion().then(setDesktopVersion).catch(() => {})

    if (new URLSearchParams(window.location.search).get('reason') === 'inactivity') {
      setInactivityNotice(true)
    }
  }, [])

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

    // Verify the account/role/subscription BEFORE ever prompting for an
    // MFA code — previously this only ran after MFA verification
    // succeeded, so a wrong-role selection (e.g. a real admin picking
    // "Teacher") still walked the person through entering their
    // authenticator code before telling them anything was wrong. Someone
    // who already has valid credentials for an account isn't gaining any
    // new access this way, but there's no reason to make them go through
    // MFA just to be told they picked the wrong option.
    const ok = await verifyAccountAccess(data.user.id)
    if (!ok) return

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

  // Runs right after password auth, before any MFA prompt — checks the
  // account is active, its school's subscription is current, and the
  // selected role actually matches. Sets an error + signs the account back
  // out on any failure. Returns whether the account can proceed.
  async function verifyAccountAccess(userId: string): Promise<boolean> {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, is_system_admin, is_active')
      .eq('id', userId)
      .single()

    if (!profile) {
      setError('Account not found. Contact your administrator.')
      await supabase.auth.signOut()
      setLoading(false)
      return false
    }

    if (profile.is_active === false) {
      setError('This account has been deactivated. Contact your school administrator.')
      await supabase.auth.signOut()
      setLoading(false)
      return false
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
        return false
      }
    }

    if (isOwner && !selectedOwner) {
      setError('Please select "Administrator" and try again.')
      await supabase.auth.signOut()
      setLoading(false)
      return false
    }

    if (!isOwner && selectedOwner) {
      setError('This account is not an administrator.')
      await supabase.auth.signOut()
      setLoading(false)
      return false
    }

    if (!isOwner && profile.role !== SELECTION_TO_ROLE[selectedRole]) {
      const correctSelection = Object.keys(SELECTION_TO_ROLE).find((key) => SELECTION_TO_ROLE[key] === profile.role)
      const correctLabel = ROLE_OPTIONS.find((r) => r.value === correctSelection)?.label || profile.role
      setError(`Incorrect role selected. Please select "${correctLabel}" and try again.`)
      await supabase.auth.signOut()
      setLoading(false)
      return false
    }

    return true
  }

  async function completeLogin(userId: string) {
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

    // Students may only be logged in on one device at a time, always — not
    // just during an active exam. The lock is released on explicit logout
    // and on inactivity auto-logout (see releaseDeviceLock), so this binds
    // "one active session," not "one device forever."
    if (profile.role === 'student') {
      const { data: lockProfile } = await supabase
        .from('profiles')
        .select('active_login_token, active_login_last_seen_at')
        .eq('id', userId)
        .single()

      const myToken = localStorage.getItem(`device_lock_${userId}`)
      const dbToken = lockProfile?.active_login_token

      // The release above depends on that device's browser tab staying open
      // and online long enough for its own inactivity timer to fire — if it
      // was closed, crashed, or lost connectivity first, the lock never
      // gets released and would otherwise stay stuck forever. A heartbeat
      // (see InactivityLogout) keeps active_login_last_seen_at fresh while a
      // session is genuinely in use; if it's gone stale well past that
      // heartbeat interval, the session behind it is dead and shouldn't be
      // able to block a real login. (Deliberately not active_login_started_at
      // — that one is shown to school admins as "since {time}" and needs to
      // reflect the real session start, not the last heartbeat.)
      const STALE_LOCK_MS = 10 * 60 * 1000
      const lockAge = lockProfile?.active_login_last_seen_at
        ? Date.now() - new Date(lockProfile.active_login_last_seen_at).getTime()
        : Infinity
      const lockIsStale = lockAge > STALE_LOCK_MS

      if (dbToken && dbToken !== myToken && !lockIsStale) {
        setError('This account is already logged in on another device. Log out there first, or ask your school admin to release your session if this isn\'t you.')
        await supabase.auth.signOut()
        setLoading(false)
        return
      }

      // Reuse the existing token only when it's genuinely this same device
      // resuming its own still-valid lock; a stale lock being bypassed
      // means the device that set it is gone, so this is a fresh session
      // and gets a fresh token rather than inheriting a dead one.
      const newToken = dbToken && dbToken === myToken ? dbToken : crypto.randomUUID()
      localStorage.setItem(`device_lock_${userId}`, newToken)
      const now = new Date().toISOString()
      await supabase.from('profiles').update({
        active_login_token: newToken,
        active_login_started_at: now,
        active_login_last_seen_at: now,
      }).eq('id', userId)
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

        {inactivityNotice && (
          <div className="banner banner-warning" style={{ marginBottom: 16, fontSize: 13 }}>
            You were signed out after 5 minutes of inactivity.
          </div>
        )}

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
            <div style={{ position: 'relative', marginTop: 6 }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                style={{ width: '100%', paddingRight: 56 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                  color: 'var(--text-secondary)', padding: '4px 6px',
                }}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
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
        © {new Date().getFullYear()} Smart Assess Ja · All rights reserved{desktopVersion && ` · v${desktopVersion}`}
      </p>
    </div>
  )
}
