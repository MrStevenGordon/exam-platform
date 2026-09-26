import { supabase } from '@/lib/supabase'

// One flagged conversation as the principal team and admins see it (no message text; open it to read).
export type FlaggedRow = {
  conversation_id: string
  lesson_id: string
  lesson_title: string
  lesson_subject: string
  teacher_name: string | null
  student_id: string
  student_name: string
  student_code: string | null
  class_name: string | null
  flag_reason: 'wellbeing' | 'inappropriate'
  flagged_at: string | null
  last_message_at: string
  student_messages: number
  reviewed_at: string | null
  reviewed_by_name: string | null
}

export type FlagCounts = {
  open_total: number
  open_wellbeing: number
  open_inappropriate: number
  oldest_open_at: string | null
  read_last_30_days: number
}

// Whole days since something was flagged (0 = today).
export function waitingDays(flaggedAt: string | null, now: number = Date.now()): number {
  if (!flaggedAt) return 0
  return Math.max(0, Math.floor((now - new Date(flaggedAt).getTime()) / 86400000))
}

export function waitingLabel(flaggedAt: string | null, now: number = Date.now()): string {
  const d = waitingDays(flaggedAt, now)
  return d === 0 ? 'Flagged today' : d === 1 ? 'Waiting 1 day' : `Waiting ${d} days`
}

// A flag left unread this long is shown as overdue.
export const OVERDUE_DAYS = 2

// The header numbers, or null when the list is not there (migration 065 not applied) or not allowed.
// Used both to decide whether to offer the page and to show the count in the menu.
export async function loadFlagCounts(): Promise<FlagCounts | null> {
  try {
    const { data, error } = await supabase.rpc('learning_tutor_flagged_counts')
    if (error) return null
    const row = (Array.isArray(data) ? data[0] : data) as FlagCounts | undefined
    return row ?? null
  } catch {
    return null
  }
}

// Fired after someone marks a conversation read, so the menu badge updates straight away.
export const FLAGS_CHANGED_EVENT = 'tutor-flags-changed'
