'use client'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const BEAT_MS = 60000
// Someone counts as "active" if they touched the page in the last two minutes
// and the tab is in front. The database applies its own 3-minute window.
const ACTIVE_WINDOW_MS = 2 * 60 * 1000
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'] as const

// Invisible. Tells the server every minute that this person is here (and whether
// they are actively using the page), which is what makes their online dot green.
// Mounted inside every signed-in portal, including the exam page, so a student
// mid-exam still shows as online.
export default function PresenceHeartbeat() {
  useEffect(() => {
    let lastActivity = Date.now()
    let token: string | null = null
    let stopped = false

    const onActivity = () => { lastActivity = Date.now() }
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true }))

    async function beat() {
      if (stopped) return
      const active = document.visibilityState === 'visible' && Date.now() - lastActivity < ACTIVE_WINDOW_MS
      try {
        const { error } = await supabase.rpc('presence_heartbeat', { p_active: active })
        if (!error) {
          const { data: { session } } = await supabase.auth.getSession()
          token = session?.access_token ?? null
        }
      } catch {
        // Offline or not installed: try again next minute.
      }
    }

    beat()
    const timer = setInterval(beat, BEAT_MS)
    const onVisible = () => { if (document.visibilityState === 'visible') beat() }
    document.addEventListener('visibilitychange', onVisible)

    // Best effort when the tab or window is closed. The request has to be started
    // synchronously, so it uses the token remembered from the last heartbeat. If it
    // never arrives, the status simply times out after about two and a half minutes.
    const onHide = () => {
      if (!token) return
      fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/presence_signout`, {
        method: 'POST',
        keepalive: true,
        headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: '{}',
      }).catch(() => {})
    }
    window.addEventListener('pagehide', onHide)

    return () => {
      stopped = true
      clearInterval(timer)
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, onActivity))
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('pagehide', onHide)
    }
  }, [])

  return null
}
