import { supabase } from '@/lib/supabase'

// All school dates and times are Jamaica time, whatever the viewer's device says.
export const SCHOOL_TZ = 'America/Jamaica'

// YYYY-MM-DD in Jamaica.
export function jamaicaDate(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: SCHOOL_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}

// Monday = 1 ... Sunday = 7, for a Jamaica calendar date (matches timetable day_of_week).
export function isoWeekday(date: string): number {
  const dow = new Date(`${date}T12:00:00Z`).getUTCDay()
  return dow === 0 ? 7 : dow
}

export function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function formatTime(ts: string | null | undefined): string {
  if (!ts) return ''
  return new Intl.DateTimeFormat('en-JM', { timeZone: SCHOOL_TZ, hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(ts))
}

export function formatDay(date: string): string {
  return new Intl.DateTimeFormat('en-JM', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${date}T12:00:00Z`))
}

// Same rule as the database: the academic year starts in August.
export function schoolYear(date: string): string {
  const [y, m] = date.split('-').map(Number)
  return m >= 8 ? `${y}-${y + 1}` : `${y - 1}-${y}`
}

export type TeacherStatus = 'on_time' | 'late' | 'due' | 'not_started' | 'missed' | 'upcoming'

export const TEACHER_STATUS: Record<TeacherStatus, { label: string; badge: string }> = {
  on_time: { label: 'On time', badge: 'badge-success' },
  late: { label: 'Late', badge: 'badge-warning' },
  due: { label: 'Starting now', badge: 'badge-default' },
  not_started: { label: 'Not started', badge: 'badge-danger' },
  missed: { label: 'No class recorded', badge: 'badge-danger' },
  upcoming: { label: 'Upcoming', badge: 'badge-default' },
}

export function teacherStatusLabel(status: TeacherStatus, minutesLate: number | null): string {
  if (status === 'late' && minutesLate) return `Late · ${minutesLate} min`
  return TEACHER_STATUS[status]?.label ?? status
}

export type MarkStatus = 'present' | 'late' | 'absent'
export const MARK_LABEL: Record<MarkStatus, string> = { present: 'Present', late: 'Late', absent: 'Absent' }

// Friendly text for an error coming back from an attendance function.
export function attendanceError(err: unknown): string {
  const message = (err as { message?: string } | null)?.message
  return message && !/^(JWT|fetch|Failed)/i.test(message) ? message : 'Something went wrong. Please try again.'
}

let availability: Promise<boolean> | null = null

// Attendance needs its database tables (migration 055). Until they exist, the
// menu entry stays hidden so nobody lands on a page that cannot work. Checked
// once per page load.
export function isAttendanceAvailable(): Promise<boolean> {
  if (!availability) {
    availability = (async () => {
      try {
        const { error } = await supabase.from('class_sessions').select('id').limit(1)
        return !error
      } catch {
        return false
      }
    })()
  }
  return availability
}
