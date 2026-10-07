import { supabase } from '@/lib/supabase'
import type { SupportCase, SupportData } from '@/lib/supportPure'

// The Support screens' side. The database (migration 092) decides which students and plans each person may see; every call here just uses
// the signed-in person's own session.

let availability: Promise<boolean> | null = null

// Support needs migration 092. Until it is applied, no Support link is shown.
export function isSupportAvailable(): Promise<boolean> {
  if (!availability) {
    availability = (async () => {
      try {
        const { error } = await supabase.rpc('support_ready')
        return !error
      } catch {
        return false
      }
    })()
  }
  return availability
}

type Failure = { ok: false; error: string }
const fail = (e: { message?: string } | null): Failure => ({ ok: false, error: e?.message || 'Something went wrong. Please try again.' })

export async function loadSupport(days = 60): Promise<{ ok: true; data: SupportData } | Failure> {
  const { data, error } = await supabase.rpc('support_students', { p_days: days })
  if (error) return fail(error)
  return { ok: true, data: data as SupportData }
}

export async function loadCases(scope: 'active' | 'closed'): Promise<{ ok: true; cases: SupportCase[] } | Failure> {
  const { data, error } = await supabase.rpc('support_cases_list', { p_scope: scope })
  if (error) return fail(error)
  return { ok: true, cases: (data || []) as SupportCase[] }
}

export type NewPlan = { studentId: string; subject: string; reason: string; goal: string; reviewOn: string | null }

export async function openPlan(p: NewPlan): Promise<{ ok: true; id: string } | Failure> {
  const { data, error } = await supabase.rpc('support_case_open', { p_student: p.studentId, p_subject: p.subject || null, p_reason: p.reason, p_goal: p.goal, p_review_on: p.reviewOn || null })
  return error ? fail(error) : { ok: true, id: data as string }
}

export async function updatePlan(id: string, status: 'open' | 'monitoring', reviewOn: string | null, goal: string): Promise<{ ok: true } | Failure> {
  const { error } = await supabase.rpc('support_case_update', { p_case: id, p_status: status, p_review_on: reviewOn || null, p_goal: goal })
  return error ? fail(error) : { ok: true }
}

export async function closePlan(id: string, outcome: string, note: string): Promise<{ ok: true } | Failure> {
  const { error } = await supabase.rpc('support_case_close', { p_case: id, p_outcome: outcome, p_note: note || null })
  return error ? fail(error) : { ok: true }
}

export async function addAction(id: string, kind: string, note: string, doneOn: string | null): Promise<{ ok: true } | Failure> {
  const { error } = await supabase.rpc('support_action_add', { p_case: id, p_kind: kind, p_note: note || null, p_done_on: doneOn || null })
  return error ? fail(error) : { ok: true }
}

// Today's date at the school (Jamaica is UTC-5 all year), as YYYY-MM-DD.
export const schoolToday = (): string => new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10)
export const schoolDayPlus = (days: number): string => new Date(Date.now() - 5 * 3600 * 1000 + days * 86400000).toISOString().slice(0, 10)
