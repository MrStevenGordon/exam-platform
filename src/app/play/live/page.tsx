'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function JoinLiveGamePage() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function join(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const res = await fetch('/api/play/live/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 401) { router.push('/play/login'); return }
      if (!res.ok) throw new Error(data.error)
      router.push(data.kind === 'board' ? `/play/board/${data.code}` : data.kind === 'tug' ? `/play/tug/${data.code}` : `/play/live/${data.code}`)
    } catch (err: any) {
      setError(err?.message || 'Something went wrong joining. Please try again.')
      setBusy(false)
    }
  }

  return (
    <div className="page-container" style={{ maxWidth: 400, marginTop: 48 }}>
      <h1 className="portal-page-title" style={{ margin: 0 }}>Join a live game</h1>
      <p style={{ margin: '4px 0 20px', fontSize: 14, color: 'var(--text-secondary)' }}>Enter the 6-digit code shown on your teacher's screen.</p>
      <form onSubmit={join} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {error && <p className="banner banner-danger" role="alert" style={{ margin: 0 }}>{error}</p>}
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: 'var(--text-secondary)' }}>
          Game code
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            placeholder="123456"
            style={{ fontSize: 28, fontWeight: 800, letterSpacing: 6, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}
          />
        </label>
        <button type="submit" disabled={busy || code.length !== 6} className="btn btn-primary">{busy ? 'Joining…' : 'Join game'}</button>
      </form>
      <div style={{ marginTop: 16 }}>
        <Link href="/play/home" className="btn btn-secondary" style={{ fontSize: 13, padding: '6px 14px' }}>Back to games</Link>
      </div>
    </div>
  )
}
