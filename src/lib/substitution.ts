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
