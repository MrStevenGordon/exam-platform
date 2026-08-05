'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// getMfaRedirect() (see lib/mfaCheck.ts) sends staff here whenever they have
// a verified authenticator but their current session hasn't cleared AAL2
// yet — e.g. a token refresh, a new tab, or navigating straight to a
// protected URL rather than through the login form's own inline challenge.
// This page didn't exist until now, so every one of those cases 404'd and
// locked the person out of their own account with no way back in.
export default function MfaChallengePage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: 'center' }}>Loading…</div>}>
      <MfaChallengeForm />
    </Suspense>
  )
}

function MfaChallengeForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const from = searchParams.get('from')

  const [loading, setLoading] = useState(true)
  const [factorId, setFactorId] = useState('')
  const [code, setCode] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState('')
  const [role, setRole] = useState('')

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (aal?.currentLevel === 'aal2') {
      router.push(from || '/login')
      return
    }

    const { data: profile } = await supabase.from('profiles').select('role, is_system_admin').eq('id', user.id).single()
    if (profile) setRole(profile.is_system_admin ? 'system_admin' : profile.role)

    const { data: factorsData } = await supabase.auth.mfa.listFactors()
    const verified = factorsData?.totp?.find((f) => f.status === 'verified')
    if (!verified) {
      router.push('/mfa/setup')
      return
    }

    setFactorId(verified.id)
    setLoading(false)
  }

  async function handleVerify() {
    if (code.trim().length !== 6) {
      setError('Enter the 6-digit code from your authenticator app.')
      return
    }
    setVerifying(true)
    setError('')

    const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({ factorId })
    if (challengeError || !challengeData) {
      setError(challengeError?.message || 'Could not start verification.')
      setVerifying(false)
      return
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challengeData.id,
      code: code.trim(),
    })

    if (verifyError) {
      setError('Incorrect code. Check your authenticator app and try again.')
      setVerifying(false)
      return
    }

    if (from) {
      router.push(from)
      return
    }

    const destinations: Record<string, string> = {
      teacher: '/teacher',
      supervisor: '/supervisor',
      admin: '/school-admin',
      system_admin: '/school-admin',
    }
    router.push(destinations[role] || '/login')
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Loading…</div>

  return (
    <div style={{ maxWidth: 460, margin: '60px auto', padding: '0 20px' }}>
      <div className="card">
        <h1 style={{ marginBottom: 8 }}>Enter your authentication code</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 20 }}>
          Enter the 6-digit code from your authenticator app to continue.
        </p>

        {error && <div className="banner banner-danger" style={{ marginBottom: 16 }}>{error}</div>}

        <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
          6-digit code
        </label>
        <input
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          placeholder="123456"
          style={{ width: '100%', fontSize: 20, textAlign: 'center', letterSpacing: 4, marginBottom: 16 }}
          onKeyDown={(e) => { if (e.key === 'Enter') handleVerify() }}
          autoFocus
        />

        <button onClick={handleVerify} disabled={verifying || code.length !== 6} className="btn btn-primary" style={{ width: '100%' }}>
          {verifying ? 'Verifying…' : 'Verify'}
        </button>
      </div>
    </div>
  )
}
