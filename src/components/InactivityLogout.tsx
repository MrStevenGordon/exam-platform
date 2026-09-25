'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { releaseDeviceLock } from '@/lib/studentDeviceLock'
import { presenceSignOut } from '@/lib/presence'

const TIMEOUT_MS = 5 * 60 * 1000
const WARNING_MS = 15 * 1000
const HEARTBEAT_MS = 2 * 60 * 1000
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'] as const

// Deliberately never mounted on the exam take page — a student thinking
// through a long essay question for a few minutes without touching the
// mouse or keyboard is normal, not inactivity, and getting force-logged-out
// mid-exam would be genuinely harmful. That page already has its own
// dedicated integrity checks (fullscreen, tab-switch detection) suited to
// the exam context specifically.
export default function InactivityLogout() {
  const router = useRouter()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)

  useEffect(() => {
    function clearAllTimers() {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current)
      if (countdownRef.current) clearInterval(countdownRef.current)
    }

    function reset() {
      clearAllTimers()
      setSecondsLeft(null)

      // Surface a visible countdown for the last WARNING_MS of the timeout,
      // rather than logging a student out with no notice at all.
      warningTimerRef.current = setTimeout(() => {
        setSecondsLeft(Math.round(WARNING_MS / 1000))
        countdownRef.current = setInterval(() => {
          setSecondsLeft((s) => (s !== null ? Math.max(s - 1, 0) : s))
        }, 1000)
      }, TIMEOUT_MS - WARNING_MS)

      timerRef.current = setTimeout(async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) await releaseDeviceLock(user.id)
        await presenceSignOut()
        await supabase.auth.signOut()
        router.push('/login?reason=inactivity')
      }, TIMEOUT_MS)
    }

    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, reset))
    reset()

    // The device lock (see studentDeviceLock.ts) is only ever cleared by
    // this component's own release call above, or by an explicit logout —
    // both require this tab's JS to still be alive and online at that
    // moment. If it's closed, crashes, or loses connectivity first, neither
    // ever runs and the lock is stuck until an admin steps in. A periodic
    // heartbeat keeps active_login_last_seen_at fresh while a session is
    // genuinely still around; login.tsx treats a lock as expired once that
    // timestamp goes stale well past this interval, so a session that
    // silently died can't permanently block a real login elsewhere. This
    // deliberately writes a separate field from active_login_started_at —
    // that one is shown to school admins on /school-admin/active-sessions
    // as "since {time}" to help them judge whether a lock looks genuinely
    // stuck, and bumping it every couple of minutes would make it always
    // read "a few minutes ago" regardless of how long the lock has really
    // been held. Only students carry a device lock at all, so this is
    // skipped for every other role.
    let heartbeatId: ReturnType<typeof setInterval> | null = null
    let unmounted = false
    async function startHeartbeatIfStudent() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (profile?.role !== 'student') return
      // The component can unmount while this in-flight lookup was still
      // pending (logout, navigating out of the portal) — the cleanup below
      // would already have run and found heartbeatId still null, so without
      // this check the interval below would start anyway and never get
      // cleared, leaking it into an unmounted component.
      if (unmounted) return

      heartbeatId = setInterval(async () => {
        const { data: { user: currentUser } } = await supabase.auth.getUser()
        if (!currentUser) return
        await supabase.from('profiles').update({ active_login_last_seen_at: new Date().toISOString() }).eq('id', currentUser.id)
      }, HEARTBEAT_MS)
    }
    startHeartbeatIfStudent()

    return () => {
      unmounted = true
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, reset))
      clearAllTimers()
      if (heartbeatId) clearInterval(heartbeatId)
    }
  }, [router])

  if (secondsLeft === null) return null

  return (
    <div
      role="alert"
      style={{
        position: 'fixed',
        bottom: 20,
        left: 20,
        zIndex: 9999,
        background: 'var(--card-bg, white)',
        border: '1.5px solid var(--warning, #D4762A)',
        borderRadius: 10,
        padding: '12px 16px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
        fontSize: 13,
        maxWidth: 280,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <span style={{ fontSize: 20 }}>⏱️</span>
      <span>
        You&apos;ll be logged out in <strong>{secondsLeft}s</strong> due to inactivity. Move your mouse or press a key to stay signed in.
      </span>
    </div>
  )
}
