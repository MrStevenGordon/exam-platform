import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'

let availability: Promise<boolean> | null = null

// Substitution needs its database tables (migration 073). Until they exist, the
// menu entry stays hidden so nobody lands on a page that cannot work. Checked
// once per page load, same pattern as isAttendanceAvailable.
export function isSubstitutionAvailable(): Promise<boolean> {
  if (!availability) {
    availability = (async () => {
      try {
        const { error } = await supabase.from('teacher_absences').select('id').limit(1)
        return !error
      } catch {
        return false
      }
    })()
  }
  return availability
}

// Friendly text for an error coming back from submit_teacher_absence.
export function substitutionError(err: unknown): string {
  const message = (err as { message?: string } | null)?.message
  return message && !/^(JWT|fetch|Failed)/i.test(message) ? message : 'Something went wrong. Please try again.'
}

// The HOD and admin tools need migration 074. Until it is applied they are not offered anywhere.
let toolsAvailability: Promise<boolean> | null = null
export function isSubstitutionToolsAvailable(): Promise<boolean> {
  if (!toolsAvailability) {
    toolsAvailability = (async () => {
      try {
        const { error } = await supabase.rpc('substitution_unfilled_count')
        return !error
      } catch {
        return false
      }
    })()
  }
  return toolsAvailability
}

// Fired after anything that changes who is covering a class, so the menu badge can refresh without a page change.
export const SUBSTITUTION_CHANGED_EVENT = 'substitution-changed'

// How many upcoming classes in the person's scope (an HOD's department, or the whole school for an admin) still
// have no substitute. Shown as a menu badge.
export function useSubstitutionUnfilledCount(enabled: boolean): number {
  const pathname = usePathname()
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    function refresh() {
      supabase.rpc('substitution_unfilled_count').then(({ data, error }) => {
        if (!cancelled && !error) setCount(typeof data === 'number' ? data : 0)
      })
    }
    refresh()
    window.addEventListener(SUBSTITUTION_CHANGED_EVENT, refresh)
    return () => { cancelled = true; window.removeEventListener(SUBSTITUTION_CHANGED_EVENT, refresh) }
  }, [enabled, pathname])

  return enabled ? count : 0
}

// Asks the server to email the absent teacher's HOD about any class that could not be covered. Best effort: the
// screen and the menu badge show the same thing, and each class is only ever announced once.
export async function notifyUnfilled(absenceId: string): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    await fetch('/api/substitution/notify-unfilled', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ absence_id: absenceId, accessToken: session?.access_token }),
    })
  } catch {
    // Nothing to do: the board still lists the class.
  }
}
