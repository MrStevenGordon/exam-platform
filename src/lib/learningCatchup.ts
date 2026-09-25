import { supabase } from '@/lib/supabase'

// One student on a lesson's catch-up list, as the teacher sees it.
export type CatchupRow = {
  student_id: string
  student_name: string
  student_code: string | null
  class_group_id: string
  class_name: string
  taught_on: string | null
  // period = absent from that teacher's class, school_day = absent from school, added = the teacher added them
  reason: 'period' | 'school_day' | 'added'
  // The teacher took them off the list.
  dismissed: boolean
  steps_done: number
  completed_at: string | null
}

// What a student is told: which lesson, and the day they were away (null when the teacher added them).
export type StudentCatchup = { lesson_id: string; taught_on: string | null }

export const REASON_LABEL: Record<CatchupRow['reason'], string> = {
  period: 'Absent from class',
  school_day: 'Absent from school',
  added: 'Added by you',
}

// "Tue, 22 Sept" for a plain date like 2026-09-22.
export function niceDay(iso: string): string {
  const d = Date.parse(`${iso}T12:00:00Z`)
  if (Number.isNaN(d)) return iso
  return new Intl.DateTimeFormat('en-JM', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(d))
}

// The line a student reads. Never says why, and never names a day unless the register showed them away.
export function catchupMessage(c: StudentCatchup | undefined): string | null {
  if (!c) return null
  return c.taught_on ? `You were away on ${niceDay(c.taught_on)}. Work through this lesson to catch up.` : 'Your teacher would like you to catch up on this lesson.'
}

// Which lessons a student needs to catch up on, keyed by lesson. If catch-up is not installed
// (migration 062) or anything goes wrong, this is just empty: the lesson list must never break.
export async function loadStudentCatchup(): Promise<Record<string, StudentCatchup>> {
  try {
    const { data, error } = await supabase.rpc('learning_student_catchup')
    if (error || !Array.isArray(data)) return {}
    return Object.fromEntries((data as StudentCatchup[]).map((r) => [r.lesson_id, r]))
  } catch {
    return {}
  }
}

let availability: Promise<boolean> | null = null

// Catch-up needs migration 062. Until it is applied, every catch-up screen stays hidden.
export function isCatchupAvailable(): Promise<boolean> {
  if (!availability) {
    availability = (async () => {
      try {
        const { error } = await supabase.from('learning_catchup_overrides').select('lesson_id').limit(1)
        return !error || error.code === '42501'
      } catch {
        return false
      }
    })()
  }
  return availability
}
