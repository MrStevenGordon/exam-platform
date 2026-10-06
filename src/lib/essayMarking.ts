import { supabase } from '@/lib/supabase'
import { getSchoolFeatures } from '@/lib/schoolFeatures'
import type { Suggestion } from '@/lib/essayMarkingPure'

// The browser side of AI-suggested essay marking: is it on, ask for a suggestion, read stored ones, and record the marks the
// teacher finally gave. Nothing here writes a mark; the teacher's own save does that.

export type Usage = { used: number; limit: number; remaining: number }
export type SuggestResult =
  | { ok: true; suggestion: Suggestion; usage: Usage; reused: boolean }
  | { ok: false; error: string; status: number; limitReached?: boolean; creditProblem?: boolean; switchedOff?: boolean; usage?: Usage }

let availability: Promise<boolean> | null = null

// On when the school has switched AI marking on AND migration 082 is installed. Otherwise no AI button appears anywhere.
export function isEssayAiMarkingAvailable(): Promise<boolean> {
  if (!availability) {
    availability = (async () => {
      try {
        const features = await getSchoolFeatures()
        if (!features.aiMarkingEnabled) return false
        const { error } = await supabase.from('essay_ai_marking').select('response_id').limit(1)
        return !error
      } catch {
        return false
      }
    })()
  }
  return availability
}

async function token(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ?? null
}

export async function requestSuggestion(responseId: string, regenerate = false): Promise<SuggestResult> {
  const accessToken = await token()
  if (!accessToken) return { ok: false, status: 401, error: 'Please sign in again.' }
  try {
    const res = await fetch('/api/essay-marking', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ responseId, accessToken, ...(regenerate ? { regenerate: true } : {}) }),
    })
    const body = await res.json().catch(() => ({}))
    if (res.ok && body.suggestion) return { ok: true, suggestion: body.suggestion as Suggestion, usage: body.usage as Usage, reused: body.reused === true }
    return { ok: false, status: res.status, error: typeof body.error === 'string' ? body.error : 'Something went wrong. Please try again.', limitReached: body.limitReached === true, creditProblem: body.creditProblem === true, switchedOff: body.switchedOff === true, usage: body.usage }
  } catch {
    return { ok: false, status: 0, error: 'Could not reach the server. Please check your connection and try again.' }
  }
}

export async function loadSuggestions(responseIds: string[]): Promise<Record<string, Suggestion>> {
  if (responseIds.length === 0) return {}
  const { data, error } = await supabase.from('essay_ai_marking').select('response_id, suggestion').in('response_id', responseIds)
  if (error || !data) return {}
  const out: Record<string, Suggestion> = {}
  for (const row of data) out[row.response_id as string] = row.suggestion as Suggestion
  return out
}

export async function fetchUsage(): Promise<Usage | null> {
  const accessToken = await token()
  if (!accessToken) return null
  try {
    const res = await fetch('/api/essay-marking/usage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accessToken }) })
    const body = await res.json().catch(() => ({}))
    return res.ok && body.usage ? (body.usage as Usage) : null
  } catch {
    return null
  }
}

// Called after a teacher saves their own marks, so we can see how often they change a suggestion. Best effort: a failure here
// never affects the marks. marks is the per-point list (grade page) or null when only a total is known (review page).
export async function recordFinalMarks(responseId: string, marks: number[] | null, total: number): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('essay_ai_marking')
      .update({ final_marks: marks, final_total: total, finalized_by: user?.id ?? null, finalized_at: new Date().toISOString() })
      .eq('response_id', responseId)
  } catch (err) {
    console.error('recording final marks failed:', err)
  }
}
