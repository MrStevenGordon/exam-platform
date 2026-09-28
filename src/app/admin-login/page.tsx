'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { getMfaRedirect } from '@/lib/mfaCheck'

// The platform administrator's own sign-in, separate from every school's /login so that no
// school's site ever shows "Administrator" as something to pick from a list. Reached directly
// at admin.smartassessja.com (src/proxy.ts routes that domain's "/" here), and also reachable
// at this path on any deployment as a plain fallback.
export default function AdminLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [mfaRequired, setMfaRequired] = useState(false)
  const [mfaFactorId, setMfaFactorId] = useState('')
  const [mfaCode, setMfaCode] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) {
      setError('Invalid email or password.')
      setLoading(false)
      return
    }

    const { data: profile } = await supabase.from('profiles').select('is_system_admin, is_active').eq('id', data.user.id).single()

    if (!profile?.is_system_admin) {
      setError('This account is not an administrator.')
      await supabase.auth.signOut()
      setLoading(false)
      return
    }

    if (profile.is_active === false) {
      setError('This account has been deactivated.')
      await supabase.auth.signOut()
      setLoading(false)
      return
    }

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

    finishLogin()
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

    const { error: verifyError } = await supabase.auth.mfa.verify({ factorId: mfaFactorId, challengeId: challenge.id, code: mfaCode.trim() })
    if (verifyError) {
      setError('Incorrect code. Please check your authenticator app and try again.')
      setLoading(false)
      return
    }

    finishLogin()
  }

  async function finishLogin() {
    if (password === 'Staff.Default1' || password === 'Student.Test') {
      router.push('/change-password?first=true')
      return
    }
    const mfaRedirect = await getMfaRedirect('owner')
    if (mfaRedirect) { router.push(mfaRedirect); return }
    router.push('/owner')
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#1A0E06',
      padding: 24,
    }}>
      <Link href="/" style={{ textDecoration: 'none', marginBottom: 32, textAlign: 'center' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>
          Smart Assess Ja
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#FAC882', marginTop: 2 }}>
          Administrator
        </div>
      </Link>

      <div className="card" style={{ width: '100%', maxWidth: 380, padding: '32px 28px' }}>
        <h1 style={{ marginBottom: 4, fontSize: 18 }}>Platform sign-in</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 24 }}>
          For the Smart Assess Ja team only. Staff and students sign in at their own school&rsquo;s site.
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

            {error && <div className="banner banner-danger" style={{ marginBottom: 16, fontSize: 13 }}>{error}</div>}

            <button type="submit" disabled={loading || mfaCode.trim().length < 6} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', fontSize: 14, padding: '12px 20px' }}>
              {loading ? 'Verifying…' : 'Verify'}
            </button>

            <div style={{ textAlign: 'center', marginTop: 14 }}>
              <button type="button" onClick={() => { setMfaRequired(false); setMfaCode(''); setError(''); supabase.auth.signOut() }} style={{ fontSize: 13, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}>
                Back to sign-in
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                Email
              </label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="your@email.com" style={{ width: '100%', marginTop: 6 }} autoFocus />
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
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', padding: '4px 6px' }}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            {error && <div className="banner banner-danger" style={{ marginBottom: 16, fontSize: 13 }}>{error}</div>}

            <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', fontSize: 14, padding: '12px 20px' }}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>

            <div style={{ textAlign: 'center', marginTop: 14 }}>
              <Link href="/forgot-password" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Forgot password?</Link>
            </div>
          </form>
        )}
      </div>

      <p style={{ marginTop: 24, fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
        © {new Date().getFullYear()} Smart Assess Ja
      </p>
    </div>
  )
}
