// Exam autosave: work out which answers have changed since the last successful save, so the page sends only those instead of every
// answer every 15 seconds. No network, no database, no screen, so the rules can be tested (scripts/tests/exam-sync/examSyncPure.test.mjs).
//
// Safety rules: the FIRST save sends everything (nothing is known to be on the server yet); an answer is only recorded as sent after
// the server accepted it, so a failed save is retried next time; clearing an answer counts as a change; the final submit never
// uses this (it always sends every answer).

export type SyncRow = { question_id: string; answer: string; working?: string | null }

// What has been accepted by the server, by question: the answer and working as they were sent.
export type SentMap = Map<string, string>

const keyOf = (r: SyncRow): string => JSON.stringify([r.answer, r.working ?? null])

// The rows that differ from what the server last accepted. A question never sent before always counts as changed.
export function changedRows<T extends SyncRow>(rows: T[], sent: SentMap): T[] {
  return rows.filter((r) => sent.get(r.question_id) !== keyOf(r))
}

// Record rows as accepted. Call only after the save succeeded.
export function markSent(sent: SentMap, rows: SyncRow[]): void {
  for (const r of rows) sent.set(r.question_id, keyOf(r))
}
