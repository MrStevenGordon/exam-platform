import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rateLimit } from '@/lib/rateLimit'
import { validateBody } from '@/lib/validateBody'
import { callClaude } from '@/lib/ai'
import { STUDENT_DRAFT_FEATURE, handleStudentDraft, studentDraftSchema } from '@/lib/studentDraftHandler'

// A five-step rewrite is a long reply.
export const maxDuration = 60

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!
)

// Returns a draft student version of a lesson for the teacher to review. Saves nothing.
export async function POST(req: NextRequest) {
  try {
    const parsed = await validateBody(req, studentDraftSchema)
    if ('error' in parsed) return parsed.error

    const result = await handleStudentDraft(parsed.data, {
      authenticate: async (token) => {
        const { data: userData, error } = await supabaseAdmin.auth.getUser(token)
        if (error || !userData.user) return null
        const { data: profile } = await supabaseAdmin.from('profiles').select('role, is_active').eq('id', userData.user.id).single()
        if (!profile) return { userId: userData.user.id, role: '', active: false }
        return { userId: userData.user.id, role: profile.role, active: profile.is_active !== false }
      },
      hasApiKey: () => !!process.env.ANTHROPIC_API_KEY,
      burstLimited: async (userId) => !!(await rateLimit(userId, 'learning-student-draft-burst', { limit: 3, windowSeconds: 60 })),
      usedThisMonth: async (userId, monthYear) => {
        const { count } = await supabaseAdmin.from('ai_polish_usage').select('id', { count: 'exact', head: true })
          .eq('teacher_id', userId).eq('feature', STUDENT_DRAFT_FEATURE).eq('month_year', monthYear)
        return count || 0
      },
      recordUse: async (userId, monthYear) => {
        await supabaseAdmin.from('ai_polish_usage').insert({ teacher_id: userId, feature: STUDENT_DRAFT_FEATURE, month_year: monthYear })
      },
      callAi: (prompt, maxTokens) => callClaude(prompt, { maxTokens, apiKey: process.env.ANTHROPIC_API_KEY! }),
      now: () => new Date(),
      log: (message, detail) => console.error(message, detail ?? ''),
    })
    return NextResponse.json(result.json, { status: result.status })
  } catch (err) {
    console.error('Student draft error:', err)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
