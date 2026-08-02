'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { releaseDeviceLock } from '@/lib/studentDeviceLock'

const TIMEOUT_MS = 5 * 60 * 1000
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

    return () => {
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, reset))
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [router])

  return null
}
