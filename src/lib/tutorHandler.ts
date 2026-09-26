import { z } from 'zod'
import type { AiReply, ChatMessage } from '@/lib/ai'
import { friendlyAiError } from '@/lib/studentDraft'
import {
  TUTOR_DAILY_LIMIT, TUTOR_HISTORY_MESSAGES, TUTOR_MESSAGE_MAX, buildTutorSystemPrompt, cleanTutorReply, keywordFlag,
  parseTutorReply, startOfJamaicaDay, toChatMessages, type StoredMessage, type TutorFlag, type TutorLesson,
} from '@/lib/tutor'

export const tutorSchema = z.object({
  lessonId: z.string().uuid(),
  message: z.string().max(TUTOR_MESSAGE_MAX * 3),   // the handler trims and gives a friendlier message
  accessToken: z.string().min(1).max(4000),
}).strict()
export type TutorBody = z.infer<typeof tutorSchema>

export type LessonAccess = { ok: true; lesson: TutorLesson } | { ok: false; reason: 'none' | 'closed' | 'error' }

export type TutorStore = {
  findConversation: (lessonId: string, studentId: string) => Promise<{ id: string } | null>
  createConversation: (lessonId: string, studentId: string) => Promise<string>
  countStudentMessagesSince: (studentId: string, sinceIso: string) => Promise<number>
  recentMessages: (conversationId: string, limit: number) => Promise<StoredMessage[]>
  addMessage: (conversationId: string, role: 'student' | 'tutor', content: string) => Promise<void>
  // Marks the conversation for an adult to read, and clears any earlier "reviewed" mark.
  flag: (conversationId: string, reason: 'wellbeing' | 'inappropriate') => Promise<void>
}

export type TutorDeps = {
  authenticate: (token: string) => Promise<{ userId: string; role: string; active: boolean } | null>
  tutorEnabled: () => Promise<boolean>
  hasApiKey: () => boolean
  // Reads the lesson AS THE STUDENT, so the database decides whether they may open it.
  getLesson: (token: string, lessonId: string) => Promise<LessonAccess>
  burstLimited: (userId: string) => Promise<boolean>
  store: TutorStore
  callChat: (system: string, messages: ChatMessage[], maxTokens: number) => Promise<AiReply>
  now: () => Date
  log: (message: string, detail?: unknown) => void
}

export type TutorResponse = { status: number; json: Record<string, unknown> }

// One student message in, one tutor reply out. The student's message is saved before the AI is
// asked, so a worrying message is on record even if the AI is unavailable.
export async function handleTutor(body: TutorBody, deps: TutorDeps): Promise<TutorResponse> {
  const who = await deps.authenticate(body.accessToken)
  if (!who) return { status: 401, json: { error: 'Please sign in again.' } }
  if (who.role !== 'student' || !who.active) return { status: 403, json: { error: 'The tutor is for students.' } }

  if (!(await deps.tutorEnabled())) return { status: 403, json: { error: 'The AI tutor isn’t switched on for your school.' } }
  if (!deps.hasApiKey()) return { status: 503, json: { error: 'The tutor isn’t available right now. Please ask your teacher.' } }

  const message = body.message.trim()
  if (!message) return { status: 400, json: { error: 'Type a question first.' } }
  if (message.length > TUTOR_MESSAGE_MAX) return { status: 400, json: { error: `Please keep your message under ${TUTOR_MESSAGE_MAX} characters.` } }

  const access = await deps.getLesson(body.accessToken, body.lessonId)
  if (!access.ok) {
    if (access.reason === 'closed') return { status: 403, json: { error: 'This lesson has closed, so the tutor can’t help with it any more.' } }
    if (access.reason === 'none') return { status: 403, json: { error: 'This lesson isn’t available to you.' } }
    return { status: 502, json: { error: 'Could not open the lesson. Please try again.' } }
  }

  if (await deps.burstLimited(who.userId)) return { status: 429, json: { error: 'You’re sending messages very quickly. Wait a minute and try again.' } }

  const since = startOfJamaicaDay(deps.now())
  const today = await deps.store.countStudentMessagesSince(who.userId, since)
  if (today >= TUTOR_DAILY_LIMIT) {
    return { status: 429, json: { error: `You’ve used all ${TUTOR_DAILY_LIMIT} tutor messages for today. Come back tomorrow, or ask your teacher.`, limit_reached: true, used: today, limit: TUTOR_DAILY_LIMIT } }
  }

  const existing = await deps.store.findConversation(body.lessonId, who.userId)
  const conversationId = existing?.id ?? (await deps.store.createConversation(body.lessonId, who.userId))
  const history = existing ? await deps.store.recentMessages(conversationId, TUTOR_HISTORY_MESSAGES) : []

  // Saved first, and checked against the safety phrases, whatever happens next.
  await deps.store.addMessage(conversationId, 'student', message)
  let flagged: 'wellbeing' | 'inappropriate' | null = null
  const byKeyword = keywordFlag(message)
  if (byKeyword) { await deps.store.flag(conversationId, byKeyword); flagged = byKeyword }

  const system = buildTutorSystemPrompt(access.lesson)
  const reply = await deps.callChat(system, toChatMessages(history, message), 600)
  if (!reply.ok) {
    deps.log('AI tutor request failed', { status: reply.status, message: reply.message })
    return { status: 502, json: { error: friendlyAiError(reply.status, reply.message, 'student'), conversationId } }
  }

  const parsed = parseTutorReply(reply.text)
  const text = parsed ? cleanTutorReply(parsed.reply) : ''
  if (!parsed || !text) {
    deps.log('AI tutor reply could not be read')
    return { status: 502, json: { error: 'The tutor couldn’t answer that. Please try asking a different way.', conversationId } }
  }

  await deps.store.addMessage(conversationId, 'tutor', text)
  const aiFlag: TutorFlag = parsed.flag
  // "wellbeing" outranks "inappropriate"; a flag already set by a safety phrase is not downgraded.
  if (aiFlag !== 'none' && !(flagged === 'wellbeing') && !(flagged === aiFlag)) await deps.store.flag(conversationId, aiFlag)

  return { status: 200, json: { reply: text, conversationId, usage: { used: today + 1, limit: TUTOR_DAILY_LIMIT } } }
}
