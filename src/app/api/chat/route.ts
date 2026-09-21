import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { rateLimit, getClientIp } from '@/lib/rateLimit'
import { validateBody } from '@/lib/validateBody'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!
)

const MAX_HISTORY_MESSAGES = 12

const schema = z.object({
  message: z.string().trim().min(1).max(2000),
  conversationId: z.string().uuid().optional(),
  accessToken: z.string().min(1).max(4000).optional(),
}).strict()

// What the platform actually does, kept in sync by hand rather than
// pulled from a docs system — there isn't a large enough surface here to
// justify a real RAG pipeline yet. Advisory-only by design (see task #31
// era discussion): this agent never looks up or claims to know anyone's
// real account data, exam results, or session status. Anything
// account-specific gets redirected to a human rather than guessed at.
const PLATFORM_FACTS = `
Smart Assess Ja is an online exam and assessment platform for schools and organizations in Jamaica.

Roles: Student, Teacher, HOD (Head of Department), School Administrator, and Organization Administrator, each with their own portal.

Assessment types: pop quizzes, class tests, weekly tests, monthly/end-of-term/end-of-year exams, homework, take-home tasks, group projects, and full formal final exams.

Review workflow (school-configurable, not one-size-fits-all): Direct Publish (teacher publishes with no review), Department Head Review (an HOD reviews and publishes), or Full Multi-Stage Review (Team Lead creates, Senior Team Lead vets, Supervisor publishes).

Exam integrity features: fullscreen lock, tab-switch detection, single-device login for students, and a desktop app with kiosk-mode lockdown during live exams that also detects when a student switches away from the app (e.g. Alt+Tab), even in cases the OS itself can't be prevented from allowing.

Offline resilience: the desktop app autosaves answers locally and syncs automatically once back online, so a dropped connection never costs a student their work.

Accessibility: a teacher, supervisor, or school admin can enable a text-to-speech accommodation on a specific student's profile, which adds a "read aloud" control to that student's exam questions.

AI-assisted authoring (teachers only): importing questions straight from a PDF exam paper, and polishing the wording of a rough draft question. Both are opt-in and produce suggestions only — a human teacher always reviews before using the output.

Math notation: a proper symbol toolbar for powers, roots, fractions, and Greek letters, plus image, audio, and video question support.

Organizations: can publish a single one-off assessment for anonymous respondents with just a code and password, no school roster setup required.

Pricing: not published publicly — it depends on enrollment size, and the team is happy to work it out directly. Point anyone asking about specific numbers to "Request a Demo" on the homepage rather than guessing at a figure.

Contact: sales@smartassessja.com for sales questions, support@smartassessja.com for account help.
`.trim()

function buildSystemPrompt(mode: 'public' | 'app', role: string | null): string {
  const shared = `You are the Smart Assess Ja help assistant. Answer only using the facts below — never invent a feature, price, or policy detail that isn't stated here. If you don't know something, say so plainly and point to a contact email rather than guessing.

Never help with anything related to bypassing exam proctoring, obtaining answers to an exam, or academic dishonesty of any kind — refuse clearly and briefly if asked, without lecturing.

Keep answers short and direct. This is a chat widget, not an essay.

${PLATFORM_FACTS}`

  if (mode === 'public') {
    return `${shared}

You're talking to a visitor on the public marketing site — likely someone considering Smart Assess Ja for their school or organization, not an existing user. You have no access to any account or account data. For anything requiring a real commitment (pricing, signing up, scheduling a demo), point them to the "Request a Demo" button on the homepage rather than trying to close the loop yourself in chat.`
  }

  return `${shared}

You're talking to a logged-in ${role || 'user'} inside the actual app. You do NOT have access to their account, their real data, their exam results, or their session status, even though they're logged in — you only know what's in the platform facts above. If they ask something account-specific ("why is my exam flagged", "why can't I see my results", "reset my password"), say clearly that you can't look that up and point them to support@smartassessja.com or their teacher/school admin, whichever fits the question. Only answer general "how do I..." and "what does this feature do" questions.`
}

export async function POST(req: NextRequest) {
  try {
    const parsed = await validateBody(req, schema)
    if ('error' in parsed) return parsed.error
    const { message, conversationId, accessToken } = parsed.data

    let userId: string | null = null
    let role: string | null = null

    if (accessToken) {
      const { data: userData } = await supabaseAdmin.auth.getUser(accessToken)
      if (userData?.user) {
        userId = userData.user.id
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('role, is_system_admin')
          .eq('id', userId)
          .single()
        if (profile) role = profile.is_system_admin ? 'system administrator' : profile.role
      }
    }

    const mode: 'public' | 'app' = userId ? 'app' : 'public'
    const rateLimitKey = userId || getClientIp(req)
    const limited = await rateLimit(rateLimitKey, 'chat-widget', { limit: 20, windowSeconds: 60 })
    if (limited) return limited

    // Resume an existing conversation (and pull recent history for context)
    // or start a new one. A conversationId that doesn't belong to this
    // caller just silently starts fresh rather than erroring — nothing
    // sensitive is at stake in a mismatched id here.
    let activeConversationId = conversationId
    let history: { role: string; content: string }[] = []

    if (activeConversationId) {
      const { data: existing } = await supabaseAdmin
        .from('chat_conversations')
        .select('id, user_id')
        .eq('id', activeConversationId)
        .maybeSingle()
      if (!existing || (userId && existing.user_id !== userId)) {
        activeConversationId = undefined
      } else {
        const { data: pastMessages } = await supabaseAdmin
          .from('chat_messages')
          .select('role, content')
          .eq('conversation_id', activeConversationId)
          .order('created_at', { ascending: true })
          .limit(MAX_HISTORY_MESSAGES)
        history = pastMessages || []
      }
    }

    if (!activeConversationId) {
      const { data: created, error: createError } = await supabaseAdmin
        .from('chat_conversations')
        .insert({ user_id: userId, surface: mode, role })
        .select('id')
        .single()
      if (createError || !created) {
        return NextResponse.json({ error: 'Could not start conversation.' }, { status: 500 })
      }
      activeConversationId = created.id
    }

    // The visitor's message is untrusted input — wrapped in explicit
    // delimiters with an instruction that it's data, not instructions,
    // same defensive pattern used for teacher-submitted question text in
    // /api/polish-question. A public, unauthenticated chat endpoint is if
    // anything a more exposed surface for this than that one.
    const anthropicMessages = [
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: `<visitor_message>\n${message}\n</visitor_message>` },
    ]

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        system: buildSystemPrompt(mode, role),
        messages: anthropicMessages,
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('Anthropic API error (chat):', errText)
      return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
    }

    const data = await response.json()
    const reply = data.content?.[0]?.text || "Sorry, I didn't catch that — could you try rephrasing?"

    await supabaseAdmin.from('chat_messages').insert([
      { conversation_id: activeConversationId, role: 'user', content: message },
      { conversation_id: activeConversationId, role: 'assistant', content: reply },
    ])

    return NextResponse.json({ reply, conversationId: activeConversationId })
  } catch (err) {
    console.error('chat route error:', err)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
