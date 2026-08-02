import { openDB, DBSchema, IDBPDatabase } from 'idb'

export type QueuedViolation = { reason: string; timestamp: string; count: number }

export type ExamSessionRecord = {
  sessionId: string
  examId: string
  answers: Record<string, string>
  workings: Record<string, string>
  lastLocalUpdate: number
  lastSyncedAt: number | null
  pendingSubmit: boolean
  queuedViolations: QueuedViolation[]
}

interface ExamOfflineDB extends DBSchema {
  examSessions: {
    key: string
    value: ExamSessionRecord
  }
}

let dbPromise: Promise<IDBPDatabase<ExamOfflineDB>> | null = null

// Guards every call, not just the module-level open: IndexedDB isn't
// available during SSR/build, and a student could be running this in a
// browser with it disabled entirely — every export here degrades to a
// harmless no-op rather than throwing, so offline support is additive and
// never a new way for the exam page to break.
function getDB() {
  if (typeof window === 'undefined' || !('indexedDB' in window)) return null
  if (!dbPromise) {
    dbPromise = openDB<ExamOfflineDB>('smart-assess-exam-offline', 1, {
      upgrade(db) {
        db.createObjectStore('examSessions', { keyPath: 'sessionId' })
      },
    })
  }
  return dbPromise
}

export async function getExamRecord(sessionId: string): Promise<ExamSessionRecord | undefined> {
  const db = await getDB()
  if (!db) return undefined
  return db.get('examSessions', sessionId)
}

export async function initExamRecord(sessionId: string, examId: string): Promise<ExamSessionRecord | undefined> {
  const db = await getDB()
  if (!db) return undefined
  const existing = await db.get('examSessions', sessionId)
  if (existing) return existing
  const fresh: ExamSessionRecord = {
    sessionId, examId, answers: {}, workings: {}, lastLocalUpdate: Date.now(), lastSyncedAt: null, pendingSubmit: false, queuedViolations: [],
  }
  await db.put('examSessions', fresh)
  return fresh
}

export async function saveAnswersLocally(sessionId: string, answers: Record<string, string>, workings: Record<string, string>) {
  const db = await getDB()
  if (!db) return
  const existing = await db.get('examSessions', sessionId)
  if (!existing) return
  await db.put('examSessions', { ...existing, answers, workings, lastLocalUpdate: Date.now() })
}

export async function markSynced(sessionId: string) {
  const db = await getDB()
  if (!db) return
  const existing = await db.get('examSessions', sessionId)
  if (!existing) return
  await db.put('examSessions', { ...existing, lastSyncedAt: Date.now() })
}

export async function setPendingSubmit(sessionId: string, pending: boolean) {
  const db = await getDB()
  if (!db) return
  const existing = await db.get('examSessions', sessionId)
  if (!existing) return
  await db.put('examSessions', { ...existing, pendingSubmit: pending })
}

export async function queueViolation(sessionId: string, violation: QueuedViolation) {
  const db = await getDB()
  if (!db) return
  const existing = await db.get('examSessions', sessionId)
  if (!existing) return
  await db.put('examSessions', { ...existing, queuedViolations: [...existing.queuedViolations, violation] })
}

export async function clearQueuedViolations(sessionId: string) {
  const db = await getDB()
  if (!db) return
  const existing = await db.get('examSessions', sessionId)
  if (!existing) return
  await db.put('examSessions', { ...existing, queuedViolations: [] })
}

export async function clearExamRecord(sessionId: string) {
  const db = await getDB()
  if (!db) return
  await db.delete('examSessions', sessionId)
}
