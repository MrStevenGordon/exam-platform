'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function MfaSetupPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [qrCode, setQrCode] = useState('')
  const [secret, setSecret] = useState('')
  const [factorId, setFactorId] = useState('')
  const [code, setCode] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState('')
  const [role, setRole] = useState('')

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: profile } = await supabase.from('profiles').select('role, is_system_admin').eq('id', user.id).single()
    if (profile) setRole(profile.is_system_admin ? 'system_admin' : profile.role)

    const { data: factorsData } = await supabase.auth.mfa.listFactors()
    const verified = factorsData?.totp?.find((f) => f.status === 'verified')
    if (verified) {
      router.push('/mfa/challenge')
      return
    }

    const unverifiedFactors = factorsData?.totp?.filter((f) => f.status === 'unverified') || []
    for (const f of unverifiedFactors) {
      try { await supabase.auth.mfa.unenroll({ factorId: f.id }) } catch {}
    }

    const { data, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: `Authenticator-${Date.now()}`,
    })
    if (enrollError || !data) {
      setError(enrollError?.message || 'Could not start 2FA setup.')
      setLoading(false)
      return
    }

    setFactorId(data.id)
    setQrCode(data.totp.qr_code)
    setSecret(data.totp.secret)
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

    const destinations: Record<string, string> = {
      teacher: '/teacher',
      supervisor: '/supervisor',
      admin: '/school-admin',
      system_admin: '/school-admin',
    }
    router.push(destinations[role] || '/login')
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Setting up two-factor authentication…</div>

  return (
    <div style={{ maxWidth: 460, margin: '60px auto', padding: '0 20px' }}>
      <div className="card">
        <h1 style={{ marginBottom: 8 }}>Set up two-factor authentication</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 20 }}>
          This is required for all staff accounts. You'll need this every time you log in from now on.
        </p>

        {error && <div className="banner banner-danger" style={{ marginBottom: 16 }}>{error}</div>}

        <ol style={{ paddingLeft: 20, fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.8 }}>
          <li>Install an authenticator app if you don't have one — Google Authenticator, Microsoft Authenticator, or Authy all work</li>
          <li>Scan the QR code below with that app</li>
          <li>Enter the 6-digit code it shows you</li>
        </ol>

        {qrCode && (
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <img
              src={`data:image/svg+xml;utf8,${encodeURIComponent(qrCode)}`}
              alt="Scan with your authenticator app"
              style={{ width: 200, height: 200, border: '1px solid var(--border)', borderRadius: 8, padding: 8, background: 'white' }}
            />
          </div>
        )}

        {secret && (
          <details style={{ marginBottom: 16, fontSize: 13 }}>
            <summary style={{ cursor: 'pointer', color: 'var(--text-secondary)' }}>Can't scan the code?</summary>
            <p style={{ marginTop: 8 }}>Enter this key manually in your authenticator app:</p>
            <code style={{ display: 'block', padding: 10, background: 'var(--page-bg)', borderRadius: 6, wordBreak: 'break-all', fontSize: 13 }}>{secret}</code>
          </details>
        )}

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
        />

        <button onClick={handleVerify} disabled={verifying || code.length !== 6} className="btn btn-primary" style={{ width: '100%' }}>
          {verifying ? 'Verifying…' : 'Verify and continue'}
        </button>
      </div>
    </div>
  )
}
