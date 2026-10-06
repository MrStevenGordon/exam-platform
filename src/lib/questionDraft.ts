import { supabase } from '@/lib/supabase'
import { checkDraft, DRAFT_TYPES, toPayload, type Draft, type DraftRequest, type DraftType } from '@/lib/questionDraftPure'

// The screen's side of AI question drafting: asking for drafts, and saving the ones a teacher has approved. Nothing is saved
// until the teacher ticks questions and presses the add button.

export type Usage = { used: number; limit: number; remaining: number }
export type DraftsResult =
  | { ok: true; drafts: Draft[]; dropped: number; usage: Usage }
  | { ok: false; error: string; limitReached?: boolean; usage?: Usage }

async function token(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ?? null
}

export async function requestDrafts(request: DraftRequest): Promise<DraftsResult> {
  const accessToken = await token()
  if (!accessToken) return { ok: false, error: 'Please sign in again.' }
  try {
    const res = await fetch('/api/draft-questions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accessToken, ...request }) })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, error: typeof body.error === 'string' ? body.error : 'Something went wrong. Please try again.', limitReached: body.limitReached === true, usage: body.usage }
    return { ok: true, drafts: body.drafts as Draft[], dropped: Number(body.dropped) || 0, usage: body.usage as Usage }
  } catch {
    return { ok: false, error: 'Could not reach the server. Please check your connection and try again.' }
  }
}

export async function fetchDraftUsage(): Promise<Usage | null> {
  const accessToken = await token()
  if (!accessToken) return null
  try {
    const res = await fetch('/api/draft-questions/usage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accessToken }) })
    if (!res.ok) return null
    return ((await res.json()).usage as Usage) ?? null
  } catch {
    return null
  }
}

// Saves the approved drafts as ordinary questions on the exam, placed the same way Add question places them: each type sits in
// its section's own band, after the questions already there.
export async function saveDrafts(examId: string, drafts: Draft[], topic: { id: string; name: string } | null): Promise<{ ok: true; saved: number } | { ok: false; error: string }> {
  for (let i = 0; i < drafts.length; i++) {
    const problem = checkDraft(drafts[i])
    if (problem) return { ok: false, error: `Question ${i + 1}: ${problem}` }
  }
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Please sign in again.' }

  const { data: sections } = await supabase.from('exam_sections').select('id, question_type').eq('draft_exam_id', examId).order('order_index', { ascending: true })
  const { data: existing, error: existingError } = await supabase.from('questions').select('question_type').eq('draft_exam_id', examId)
  if (existingError) return { ok: false, error: 'Could not read the exam. Please try again.' }
  const have: Record<string, number> = {}
  for (const q of existing || []) have[q.question_type] = (have[q.question_type] || 0) + 1

  const rows = drafts.map((d) => {
    const band = sections ? Math.max(sections.findIndex((s) => s.question_type === d.type), 0) : 0
    const n = have[d.type] || 0
    have[d.type] = n + 1
    return toPayload(d, { examId, userId: user.id, topic, orderIndex: band * 100000 + n })
  })
  const { error } = await supabase.from('questions').insert(rows)
  if (error) return { ok: false, error: error.message }
  return { ok: true, saved: rows.length }
}

export const emptyCounts = (): Record<DraftType, number> => Object.fromEntries(DRAFT_TYPES.map((t) => [t, 0])) as Record<DraftType, number>
