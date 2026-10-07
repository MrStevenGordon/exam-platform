import type { SupabaseClient } from '@supabase/supabase-js'

// Keeps a note of an AI reply that could not be read, so the cause can be found later (migration 090). Best effort: it must never
// break the request, and until 090 is applied it quietly does nothing.
export async function recordAiProblem(
  admin: Pick<SupabaseClient, 'from'>,
  p: { feature: string; reason: string; stopReason?: string; text: string; attempt?: number },
): Promise<void> {
  try {
    const text = p.text || ''
    await admin.from('ai_reply_problems').insert({
      feature: p.feature.slice(0, 60), reason: p.reason.slice(0, 40), stop_reason: p.stopReason ? p.stopReason.slice(0, 40) : null,
      reply_length: text.length, attempt: p.attempt ?? null, head: text.slice(0, 300), tail: text.length > 300 ? text.slice(-300) : null,
    })
    // Keep it small: drop anything older than 60 days.
    await admin.from('ai_reply_problems').delete().lt('created_at', new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString())
  } catch { /* never let record-keeping break a teacher's request */ }
}

// A short word a teacher can read out when they report a problem.
export function problemRef(reason: string): string {
  return reason === 'truncated' ? 'cut-off' : reason === 'empty' ? 'empty' : 'unreadable'
}
