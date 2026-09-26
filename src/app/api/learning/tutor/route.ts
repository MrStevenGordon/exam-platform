import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rateLimit } from '@/lib/rateLimit'
import { validateBody } from '@/lib/validateBody'
import { callClaudeChat } from '@/lib/ai'
import { handleTutor, tutorSchema, type LessonAccess } from '@/lib/tutorHandler'
import type { TutorLesson } from '@/lib/tutor'

export const maxDuration = 60

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!
)

// The student asks the tutor about one lesson. The lesson is read from the database as the student
// (so the database decides whether they may open it), never taken from the browser.
export async function POST(req: NextRequest) {
  try {
    const parsed = await validateBody(req, tutorSchema)
    if ('error' in parsed) return parsed.error

    const result = await handleTutor(parsed.data, {
      authenticate: async (token) => {
        const { data: userData, error } = await supabaseAdmin.auth.getUser(token)
        if (error || !userData.user) return null
        const { data: profile } = await supabaseAdmin.from('profiles').select('role, is_active').eq('id', userData.user.id).single()
        if (!profile) return { userId: userData.user.id, role: '', active: false }
        return { userId: userData.user.id, role: profile.role, active: profile.is_active !== false }
      },
      tutorEnabled: async () => {
        const { data } = await supabaseAdmin.from('school_settings').select('enabled_features').limit(1).maybeSingle()
        const f = data?.enabled_features as { ai_tutor_enabled?: boolean; smart_learning_enabled?: boolean } | null
        return f?.ai_tutor_enabled === true && f?.smart_learning_enabled === true
      },
      hasApiKey: () => !!process.env.ANTHROPIC_API_KEY,
      getLesson: async (token, lessonId): Promise<LessonAccess> => {
        const asStudent = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        })
        const { data, error } = await asStudent.rpc('learning_get_lesson', { p_lesson_id: lessonId })
        if (error) return { ok: false, reason: error.code === '42501' ? 'none' : error.code === 'P0001' ? 'closed' : 'error' }
        return { ok: true, lesson: data as TutorLesson }
      },
      burstLimited: async (userId) => !!(await rateLimit(userId, 'learning-tutor-burst', { limit: 8, windowSeconds: 60 })),
      store: {
        findConversation: async (lessonId, studentId) => {
          const { data } = await supabaseAdmin.from('learning_tutor_conversations').select('id').eq('lesson_id', lessonId).eq('student_id', studentId).maybeSingle()
          return data ? { id: data.id as string } : null
        },
        createConversation: async (lessonId, studentId) => {
          const { data, error } = await supabaseAdmin.from('learning_tutor_conversations').insert({ lesson_id: lessonId, student_id: studentId }).select('id').single()
          if (error || !data) {
            // Two messages sent at once can both try to start the conversation; use the one that won.
            const { data: again } = await supabaseAdmin.from('learning_tutor_conversations').select('id').eq('lesson_id', lessonId).eq('student_id', studentId).maybeSingle()
            if (again) return again.id as string
            throw new Error(error?.message || 'Could not start the conversation.')
          }
          return data.id as string
        },
        countStudentMessagesSince: async (studentId, sinceIso) => {
          const { data: convs } = await supabaseAdmin.from('learning_tutor_conversations').select('id').eq('student_id', studentId)
          const ids = (convs || []).map((c) => c.id as string)
          if (ids.length === 0) return 0
          const { count } = await supabaseAdmin.from('learning_tutor_messages').select('id', { count: 'exact', head: true }).in('conversation_id', ids).eq('role', 'student').gte('created_at', sinceIso)
          return count || 0
        },
        recentMessages: async (conversationId, limit) => {
          const { data } = await supabaseAdmin.from('learning_tutor_messages').select('role, content').eq('conversation_id', conversationId).order('created_at', { ascending: false }).limit(limit)
          return ((data || []) as { role: 'student' | 'tutor'; content: string }[]).reverse()
        },
        addMessage: async (conversationId, role, content) => {
          const { error } = await supabaseAdmin.from('learning_tutor_messages').insert({ conversation_id: conversationId, role, content })
          if (error) throw new Error(error.message)
          await supabaseAdmin.from('learning_tutor_conversations').update({ last_message_at: new Date().toISOString() }).eq('id', conversationId)
        },
        flag: async (conversationId, reason) => {
          await supabaseAdmin.from('learning_tutor_conversations').update({ flagged: true, flag_reason: reason, reviewed_at: null, reviewed_by: null }).eq('id', conversationId)
        },
      },
      callChat: (system, messages, maxTokens) => callClaudeChat({ system, messages }, { maxTokens, apiKey: process.env.ANTHROPIC_API_KEY! }),
      now: () => new Date(),
      log: (message, detail) => console.error(message, detail ?? ''),
    })
    return NextResponse.json(result.json, { status: result.status })
  } catch (err) {
    console.error('Tutor error:', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
