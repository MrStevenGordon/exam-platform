import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

const POLL_MS = 60000

// Unread attendance alerts for a principal / school admin. Every minute it
// (1) runs the time-based check ("has this teacher started yet?"), then
// (2) reads how many alerts are unread. When the number goes up and the
// browser has notification permission, it pops a desktop notification, so the
// alert reaches them even when the tab is in the background.
export function useAttendanceAlerts(enabled = true): number {
  const [count, setCount] = useState(0)
  const previous = useRef<number | null>(null)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false

    async function tick() {
      try {
        await supabase.rpc('refresh_attendance_alerts')
        const { data, error } = await supabase.rpc('my_unread_alert_count')
        if (error || cancelled) return
        const next = typeof data === 'number' ? data : 0
        if (previous.current !== null && next > previous.current && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          const { data: latest } = await supabase.from('attendance_alerts').select('message').is('resolved_at', null).order('created_at', { ascending: false }).limit(1)
          const n = new Notification('Attendance alert', { body: latest?.[0]?.message || 'A new attendance alert needs your attention.', tag: 'attendance-alert' })
          n.onclick = () => { window.focus(); window.location.href = '/principal/alerts' }
        }
        previous.current = next
        setCount(next)
      } catch {
        // Attendance not installed yet, or offline: stay quiet.
      }
    }

    tick()
    const t = setInterval(tick, POLL_MS)
    return () => { cancelled = true; clearInterval(t) }
  }, [enabled])

  return count
}
