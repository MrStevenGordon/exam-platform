'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { releaseDeviceLock } from '@/lib/studentDeviceLock'

const TIMEOUT_MS = 5 * 60 * 1000
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

  useEffect(() => {
    function reset() {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) await releaseDeviceLock(user.id)
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
    async function startHeartbeatIfStudent() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (profile?.role !== 'student') return

      heartbeatId = setInterval(async () => {
        const { data: { user: currentUser } } = await supabase.auth.getUser()
        if (!currentUser) return
        await supabase.from('profiles').update({ active_login_last_seen_at: new Date().toISOString() }).eq('id', currentUser.id)
      }, HEARTBEAT_MS)
    }
    startHeartbeatIfStudent()

    return () => {
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, reset))
      if (timerRef.current) clearTimeout(timerRef.current)
      if (heartbeatId) clearInterval(heartbeatId)
    }
  }, [router])

  return null
}
