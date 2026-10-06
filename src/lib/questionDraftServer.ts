import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Server-only helpers for the AI question drafting routes: who is asking and how many drafts they have left this month.
// No student information is ever involved, so there is no per-school switch: every school has it.

export const MONTHLY_LIMIT = 20 // requests (each drafts up to 10 questions)
export const USAGE_FEATURE = 'question_drafting'
export const monthKey = () => new Date().toISOString().slice(0, 7)

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!
)

export type DraftCaller = { ok: true; userId: string } | { ok: false; response: NextResponse }

// A signed-in teacher, head of department or school admin with an active account.
export async function authorizeDrafter(accessToken: string): Promise<DraftCaller> {
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken)
  if (userError || !userData.user) return { ok: false, response: NextResponse.json({ error: 'Please sign in again.' }, { status: 401 }) }
  const { data: profile } = await supabaseAdmin.from('profiles').select('role, is_active').eq('id', userData.user.id).single()
  if (!profile || profile.is_active === false || !['teacher', 'supervisor', 'admin'].includes(profile.role)) {
    return { ok: false, response: NextResponse.json({ error: 'Not authorized.' }, { status: 403 }) }
  }
  return { ok: true, userId: userData.user.id }
}

export async function usedThisMonth(userId: string): Promise<number> {
  const { count } = await supabaseAdmin
    .from('ai_polish_usage').select('id', { count: 'exact', head: true })
    .eq('teacher_id', userId).eq('feature', USAGE_FEATURE).eq('month_year', monthKey())
  return count || 0
}

export const usageOf = (used: number) => ({ used, limit: MONTHLY_LIMIT, remaining: Math.max(0, MONTHLY_LIMIT - used) })
