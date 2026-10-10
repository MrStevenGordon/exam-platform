import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rateLimit } from '@/lib/rateLimit'
import { validateBody } from '@/lib/validateBody'
import { askClaude } from '@/lib/aiCall'
import { LESSON_GUIDE_FEATURE, handleLessonGuide, lessonGuideSchema } from '@/lib/lessonGuideHandler'

// A guide is a long reply (cards and questions).
export const maxDuration = 60

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!
)

// Returns a draft study guide for a lesson, for the teacher to review. Saves nothing.
export async function POST(req: NextRequest) {
  try {
    const parsed = await validateBody(req, lessonGuideSchema)
    if ('error' in parsed) return parsed.error

    const result = await handleLessonGuide(parsed.data, {
      authenticate: async (token) => {
        const { data: userData, error } = await supabaseAdmin.auth.getUser(token)
        if (error || !userData.user) return null
        const { data: profile } = await supabaseAdmin.from('profiles').select('role, is_active').eq('id', userData.user.id).single()
        if (!profile) return { userId: userData.user.id, role: '', active: false }
        return { userId: userData.user.id, role: profile.role, active: profile.is_active !== false }
      },
      hasApiKey: () => !!process.env.ANTHROPIC_API_KEY,
      burstLimited: async (userId) => !!(await rateLimit(userId, 'learning-lesson-guide-burst', { limit: 4, windowSeconds: 60 })),
      usedThisMonth: async (userId, monthYear) => {
        const { count } = await supabaseAdmin.from('ai_polish_usage').select('id', { count: 'exact', head: true })
          .eq('teacher_id', userId).eq('feature', LESSON_GUIDE_FEATURE).eq('month_year', monthYear)
        return count || 0
      },
      recordUse: async (userId, monthYear) => {
        await supabaseAdmin.from('ai_polish_usage').insert({ teacher_id: userId, feature: LESSON_GUIDE_FEATURE, month_year: monthYear })
      },
      callAi: async (prompt, maxTokens) => {
        // Two of these run side by side and the hosting allows 60 seconds in all, so each gets 40 and at most one quick retry.
        const r = await askClaude({ label: 'lesson-study-guide', messages: [{ role: 'user', content: prompt }], maxTokens, timeoutMs: 40_000, retries: 1 })
        return r.ok ? { ok: true, text: r.text, stopReason: r.stopReason } : { ok: false, message: r.message, httpStatus: r.httpStatus }
      },
      now: () => new Date(),
      log: (message, detail) => console.error(message, detail ?? ''),
    })
    return NextResponse.json(result.json, { status: result.status })
  } catch (err) {
    console.error('Lesson guide error:', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
