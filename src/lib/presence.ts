import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export type PresenceState = 'online' | 'away' | 'offline'
export type PresenceInfo = { state: PresenceState; lastSeen: string | null }

const REFRESH_MS = 60000

// Marks the signed-in person offline right away. Call it just before signing out
// (needs the session, so it has to run first). Never blocks or breaks a sign-out.
export async function presenceSignOut(): Promise<void> {
  try {
    await supabase.rpc('presence_signout')
  } catch {
    // Not installed yet, or offline: the status times out by itself after a few minutes.
  }
}

// The status of a list of people, refreshed every minute while the page is in
// view. Anyone the viewer is not allowed to see is simply absent from the
// result (the database decides), so callers show a dot only when there is one.
export function usePresence(ids: string[]): Record<string, PresenceInfo> {
  const key = [...new Set(ids.filter(Boolean))].sort().join(',')
  const [map, setMap] = useState<Record<string, PresenceInfo>>({})

  useEffect(() => {
    if (!key) return
    let cancelled = false
    const list = key.split(',').slice(0, 500)

    async function load() {
      if (document.hidden) return
      try {
        const { data, error } = await supabase.rpc('presence_for', { p_ids: list })
        if (error || cancelled) return
        setMap(Object.fromEntries(((data || []) as { user_id: string; state: PresenceState; last_seen_at: string | null }[]).map((r) => [r.user_id, { state: r.state, lastSeen: r.last_seen_at }])))
      } catch {
        // Presence is a nicety: never let it disturb the page.
      }
    }

    load()
    const t = setInterval(load, REFRESH_MS)
    document.addEventListener('visibilitychange', load)
    return () => { cancelled = true; clearInterval(t); document.removeEventListener('visibilitychange', load) }
  }, [key])

  return map
}

// "3 min ago", "2 hours ago", "yesterday", ... for a last-seen tooltip.
export function timeAgo(ts: string | null | undefined, now: number = Date.now()): string {
  if (!ts) return ''
  const s = Math.max(0, Math.round((now - new Date(ts).getTime()) / 1000))
  if (s < 90) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`
  const d = Math.round(h / 24)
  return d === 1 ? 'yesterday' : `${d} days ago`
}
