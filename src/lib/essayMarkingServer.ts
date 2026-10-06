import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Server-only helpers shared by the essay marking routes: who is asking, whether their school has switched the feature on,
// and how many suggestions they have left this month.

export const MONTHLY_LIMIT = 300
export const USAGE_FEATURE = 'essay_marking'
export const monthKey = () => new Date().toISOString().slice(0, 7) // e.g. '2026-10'

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!
)

export type MarkingCaller = { userId: string; role: string }
export type CallerCheck = { ok: true; caller: MarkingCaller } | { ok: false; response: NextResponse }

const fail = (status: number, error: string, extra: Record<string, unknown> = {}): CallerCheck => ({ ok: false, response: NextResponse.json({ error, ...extra }, { status }) })

// A signed-in teacher, head of department or school admin with an active account, in a school that has switched AI marking on.
export async function authorizeMarker(accessToken: string): Promise<CallerCheck> {
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken)
  if (userError || !userData.user) return fail(401, 'Please sign in again.')
  const { data: profile } = await supabaseAdmin.from('profiles').select('role, is_active').eq('id', userData.user.id).single()
  if (!profile || profile.is_active === false || !['teacher', 'supervisor', 'admin'].includes(profile.role)) return fail(403, 'Not authorized.')

  const { data: settings } = await supabaseAdmin.from('school_settings').select('enabled_features').limit(1).maybeSingle()
  const features = (settings?.enabled_features ?? null) as { ai_marking_enabled?: boolean } | null
  if (features?.ai_marking_enabled !== true) return fail(403, 'AI marking is not switched on for your school.', { switchedOff: true })
  return { ok: true, caller: { userId: userData.user.id, role: profile.role } }
}

export async function usedThisMonth(userId: string): Promise<number> {
  const { count } = await supabaseAdmin
    .from('ai_polish_usage').select('id', { count: 'exact', head: true })
    .eq('teacher_id', userId).eq('feature', USAGE_FEATURE).eq('month_year', monthKey())
  return count || 0
}

export const usageOf = (used: number) => ({ used, limit: MONTHLY_LIMIT, remaining: Math.max(0, MONTHLY_LIMIT - used) })

// Reads the caller's own view of one response (their sign-in, so row-level security decides). Returns null when they may not see it.
export function callerClient(accessToken: string) {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

