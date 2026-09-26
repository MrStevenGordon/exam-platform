'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { safePlayPath } from '@/lib/playNext'

// Opens Smart Play using the exam sign-in: no second password. If they are not signed in to the exam
// side, they are sent to the normal sign-in first.
export default function PlaySsoPage() {
  const router = useRouter()
  const [message, setMessage] = useState('Opening Smart Play…')
  const [failed, setFailed] = useState(false)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return  // one sign-in per visit, even when React runs the effect twice in development
    started.current = true
    async function run() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/login'); return }
      try {
        const res = await fetch('/api/play/sso', { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` } })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          setFailed(true)
          setMessage(data.error || 'Smart Play could not be opened. Please try again.')
          return
        }
        router.replace(safePlayPath(new URLSearchParams(window.location.search).get('next')))
      } catch {
        setFailed(true)
        setMessage('Could not reach the server. Check your connection and try again.')
      }
    }
    run()
  }, [router])

  return (
    <div className="page-container" style={{ maxWidth: 420, marginTop: 64 }}>
      <p className="portal-page-title" style={{ margin: 0 }}>Smart Assess Play</p>
      <p role={failed ? 'alert' : 'status'} className={failed ? 'banner banner-danger' : undefined} style={{ margin: '12px 0', fontSize: 14, color: failed ? undefined : 'var(--text-secondary)' }}>{message}</p>
      {failed && <Link href="/login" className="btn btn-secondary">Back to sign in</Link>}
    </div>
  )
}
