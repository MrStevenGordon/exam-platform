import { supabase } from '@/lib/supabase'
import { addCards, createDeck, loadDecks } from '@/lib/flashcards'
import { GUIDE_LIMITS, type GuideCard, type GuideDraft } from '@/lib/lessonGuide'
import { LEVELS, MAX_PER_LEVEL, type CheckLevel } from '@/lib/checkLevelsPure'
import type { LessonRow } from '@/lib/learning'

// The browser side of lesson study guides (migration 100). Everything here goes through the signed-in person's own access, so the
// database decides what they may read or change.

let availability: Promise<boolean> | null = null
// Available when migration 100 is installed.
export function isGuidesAvailable(): Promise<boolean> {
  if (!availability) {
    availability = (async () => {
      try {
        const { data, error } = await supabase.rpc('learning_guides_ready')
        return !error && data === true
      } catch { return false }
    })()
  }
  return availability
}

export type GuideRow = {
  lesson_id: string
  key_points: string[]
  can_do: string[]
  cards: GuideCard[]
  status: 'draft' | 'on'
  drafted_by_ai: boolean
  generated_at: string | null
  approved_at: string | null
  updated_at: string
}

export async function loadGuide(lessonId: string): Promise<GuideRow | null> {
  const { data } = await supabase.from('learning_lesson_guides')
    .select('lesson_id, key_points, can_do, cards, status, drafted_by_ai, generated_at, approved_at, updated_at').eq('lesson_id', lessonId).maybeSingle()
  return (data as GuideRow | null) ?? null
}

export async function guideIsStale(lessonId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('learning_guide_stale', { p_lesson_id: lessonId })
  return !error && data === true
}

export async function saveGuide(lessonId: string, g: { keyPoints: string[]; canDo: string[]; cards: GuideCard[]; on: boolean; draftedByAi?: boolean }): Promise<{ ok: true } | { ok: false; error: string }> {
  const row: Record<string, unknown> = {
    lesson_id: lessonId, key_points: g.keyPoints, can_do: g.canDo,
    cards: g.cards.map((c) => ({ front: c.front, back: c.back, step: c.step })),
    status: g.on ? 'on' : 'draft',
  }
  if (g.draftedByAi) { row.drafted_by_ai = true; row.generated_at = new Date().toISOString() }
  const { error } = await supabase.from('learning_lesson_guides').upsert(row, { onConflict: 'lesson_id' })
  return error ? { ok: false, error: error.message || 'Could not save the guide. Please try again.' } : { ok: true }
}

export async function loadReportCounts(lessonId: string): Promise<Array<{ kind: 'key_point' | 'can_do' | 'card'; item_index: number; reports: number }>> {
  const { data, error } = await supabase.rpc('learning_guide_report_counts', { p_lesson_id: lessonId })
  return error || !Array.isArray(data) ? [] : data
}

export async function clearReports(lessonId: string): Promise<void> {
  await supabase.rpc('learning_guide_clear_reports', { p_lesson_id: lessonId })
}

export type DraftUsage = { used: number; limit: number; remaining: number }
export type GuideDraftResult = { ok: true; draft: GuideDraft; usage: DraftUsage; notes: string[] } | { ok: false; error: string; usage?: DraftUsage }

export async function requestGuideDraft(lesson: Pick<LessonRow, 'title' | 'subject' | 'grade' | 'key_terms' | 'steps'>, topicName?: string): Promise<GuideDraftResult> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return { ok: false, error: 'Please sign in again.' }
    const res = await fetch('/api/learning/guide-draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject: lesson.subject, grade: lesson.grade, title: lesson.title.trim() || 'Untitled lesson',
        ...(topicName ? { topic: topicName } : {}),
        ...(lesson.key_terms.trim() ? { keyTerms: lesson.key_terms } : {}),
        steps: lesson.steps.map((s) => ({ key: s.key, text: s.text })),
        accessToken: session.access_token,
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return { ok: false, error: typeof data.error === 'string' ? data.error : 'Could not make the guide. Please try again.', usage: data.used !== undefined ? { used: data.used, limit: data.limit, remaining: 0 } : undefined }
    }
    return {
      ok: true,
      draft: { keyPoints: data.keyPoints ?? [], canDo: data.canDo ?? [], cards: data.cards ?? [], questions: data.questions ?? [], removedLinks: data.removedLinks ?? 0, dropped: data.dropped ?? 0 },
      usage: data.usage,
      notes: Array.isArray(data.notes) ? data.notes.filter((n: unknown) => typeof n === 'string') : [],
    }
  } catch {
    return { ok: false, error: 'Could not reach the server. Check your connection and try again.' }
  }
}

// ---- adding the drafted questions to the lesson's check ---------------------------------------------------------------------

export type QuestionToAdd = { level: CheckLevel; prompt: string; options: string[]; correctIndex: number; explanation: string }

// The room left at each level of the lesson's check, and the next position to use.
export async function checkRoom(lessonId: string): Promise<{ room: Record<CheckLevel, number>; nextPosition: number }> {
  const { data } = await supabase.from('learning_check_questions').select('level, position').eq('lesson_id', lessonId)
  const rows = (data ?? []) as Array<{ level?: string; position: number }>
  const used: Record<CheckLevel, number> = { support: 0, core: 0, stretch: 0 }
  let maxPos = 0
  for (const r of rows) {
    const l = (LEVELS as readonly string[]).includes(r.level ?? '') ? (r.level as CheckLevel) : 'core'
    used[l]++
    if (r.position > maxPos) maxPos = r.position
  }
  return { room: { support: MAX_PER_LEVEL - used.support, core: MAX_PER_LEVEL - used.core, stretch: MAX_PER_LEVEL - used.stretch }, nextPosition: maxPos + 1 }
}

export async function addQuestionsToCheck(lessonId: string, questions: QuestionToAdd[]): Promise<{ ok: true; added: number; skipped: number } | { ok: false; error: string }> {
  const { room, nextPosition } = await checkRoom(lessonId)
  const left = { ...room }
  let pos = nextPosition
  const rows: Array<Record<string, unknown>> = []
  let skipped = 0
  for (const q of questions) {
    if (left[q.level] <= 0) { skipped++; continue }
    left[q.level]--
    rows.push({ lesson_id: lessonId, level: q.level, position: Math.min(50, pos++), kind: 'multiple_choice', prompt: q.prompt, options: q.options, correct_index: q.correctIndex, explanation: q.explanation })
  }
  if (rows.length === 0) return { ok: true, added: 0, skipped }
  const { error } = await supabase.from('learning_check_questions').insert(rows)
  return error ? { ok: false, error: error.message || 'Could not add the questions. Please try again.' } : { ok: true, added: rows.length, skipped }
}

// ---- the student side -------------------------------------------------------------------------------------------------------

export type StudentGuide = { key_points: string[]; can_do: string[]; cards: GuideCard[] }

export async function getStudentGuide(lessonId: string): Promise<StudentGuide | null> {
  const { data, error } = await supabase.rpc('learning_get_guide', { p_lesson_id: lessonId })
  if (error || !data) return null
  return data as StudentGuide
}

export async function reportGuideItem(lessonId: string, kind: 'key_point' | 'can_do' | 'card', index: number): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.rpc('learning_report_guide_item', { p_lesson_id: lessonId, p_kind: kind, p_index: index, p_note: '' })
  return error ? { ok: false, error: error.message || 'Could not send that. Please try again.' } : { ok: true }
}

// Puts the guide's cards into a flashcard deck named after the lesson. If the student already has that deck the cards are not
// added a second time.
export async function addGuideToFlashcards(lessonTitle: string, subject: string, cards: GuideCard[]): Promise<{ ok: true; deckId: string; already: boolean } | { ok: false; error: string }> {
  const title = lessonTitle.trim().slice(0, 120)
  const decks = await loadDecks()
  if (decks.ok) {
    const existing = decks.decks.find((d) => d.title === title)
    if (existing) return { ok: true, deckId: existing.id, already: true }
  }
  const made = await createDeck(title, subject)
  if (!made.ok) return made
  const added = await addCards(made.id, cards.slice(0, GUIDE_LIMITS.cards).map((c) => ({ front: c.front, back: c.back })))
  if (!added.ok) return added
  return { ok: true, deckId: made.id, already: false }
}
