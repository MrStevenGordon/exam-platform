import type { Kv } from './kv'
import { nextState, type Card, type CardUpdate } from '../flashcardsPure'

// What is kept on a student's device so flashcards and lessons they have already opened still work without a connection.
// Everything is stored under the signed-in person's id, so a shared device never shows one student another's material. Pure rules: they
// take the store as a parameter, so every one of them is tested with an in-memory copy (scripts/tests/offline/offlineCache.test.mjs).
//
// Flashcard answers given offline are kept in a queue, in order, and sent when the connection returns (syncPending). Lessons are kept for
// reading only: nothing about a lesson can change while offline.

export type CachedDeck = { id: string; title: string; subject: string | null; updatedAt: string }
export type CachedDeckList = { decks: Array<CachedDeck & { total: number; due: number }>; savedAt: string }
export type CachedDeckFull = { deck: CachedDeck; cards: Card[]; savedAt: string }
export type PendingReview = { cardId: string; deckId: string; at: string; state: CardUpdate; tries: number }

export const MAX_TRIES = 5              // a queued answer the server keeps refusing is dropped after this many attempts
export const MAX_LESSONS = 40            // lessons kept on the device; the least recently opened go first

const k = (userId: string, rest: string) => `u:${userId}:${rest}`

// ---------- who is signed in on this device (so the lessons area can open offline) ----------
export const saveRole = (kv: Kv, userId: string, role: string) => kv.put(k(userId, 'role'), role)
export const getRole = (kv: Kv, userId: string) => kv.get<string>(k(userId, 'role'))

// ---------- flashcards ----------
export const saveDecks = (kv: Kv, userId: string, decks: CachedDeckList['decks'], now = new Date()) => kv.put(k(userId, 'decks'), { decks, savedAt: now.toISOString() } satisfies CachedDeckList)
export const getDecks = (kv: Kv, userId: string) => kv.get<CachedDeckList>(k(userId, 'decks'))
export const saveDeck = (kv: Kv, userId: string, deck: CachedDeck, cards: Card[], now = new Date()) => kv.put(k(userId, `deck:${deck.id}`), { deck, cards, savedAt: now.toISOString() } satisfies CachedDeckFull)
export const getDeck = (kv: Kv, userId: string, deckId: string) => kv.get<CachedDeckFull>(k(userId, `deck:${deckId}`))

// Replays queued answers over a deck's cards, in order, so the device's own schedule follows what the student did offline.
export function applyPending(cards: Card[], pending: PendingReview[]): Card[] {
  const byId = new Map(cards.map((c) => [c.id, { ...c }]))
  for (const p of pending) {
    const c = byId.get(p.cardId)
    if (!c) continue
    c.box = p.state.box; c.dueAt = p.state.dueAt; c.timesSeen = p.state.timesSeen; c.timesCorrect = p.state.timesCorrect; c.lastReviewedAt = p.state.lastReviewedAt
  }
  return cards.map((c) => byId.get(c.id) as Card)
}

export const getPending = async (kv: Kv, userId: string): Promise<PendingReview[]> => (await kv.get<PendingReview[]>(k(userId, 'pending'))) ?? []
export const pendingCount = async (kv: Kv, userId: string): Promise<number> => (await getPending(kv, userId)).length

// Records one answer given offline: the card's new schedule is worked out now (from the card as it stands on the device, including earlier
// offline answers), kept in the queue, and written into the device copy of the deck so the next card and the deck page agree.
export async function queueReview(kv: Kv, userId: string, card: Card, deckId: string, knewIt: boolean, now: Date): Promise<PendingReview> {
  const entry: PendingReview = { cardId: card.id, deckId, at: now.toISOString(), state: nextState(card, knewIt, now), tries: 0 }
  const pending = await getPending(kv, userId)
  await kv.put(k(userId, 'pending'), [...pending, entry])
  const cached = await getDeck(kv, userId, deckId)
  if (cached) await kv.put(k(userId, `deck:${deckId}`), { ...cached, cards: applyPending(cached.cards, [entry]) })
  return entry
}

export type PushResult = 'done' | 'gone' | 'network' | 'error'

// Sends queued answers one at a time, oldest first. "done" and "gone" (the card no longer exists, or the server already has a newer
// answer) remove the entry; "network" stops and keeps everything for next time; "error" keeps it for a few more tries, then drops it so one
// bad entry can never block the rest. The queue is saved after every entry, so an interruption never sends anything twice.
export async function syncPending(kv: Kv, userId: string, push: (p: PendingReview) => Promise<PushResult>): Promise<{ sent: number; left: number; stoppedOffline: boolean }> {
  let queue = await getPending(kv, userId)
  let sent = 0
  const save = (q: PendingReview[]) => kv.put(k(userId, 'pending'), q)
  for (let i = 0; i < queue.length; ) {
    const result = await push(queue[i])
    if (result === 'network') return { sent, left: queue.length, stoppedOffline: true }
    if (result === 'done' || result === 'gone') { if (result === 'done') sent++; queue = [...queue.slice(0, i), ...queue.slice(i + 1)]; await save(queue); continue }
    const tries = queue[i].tries + 1
    if (tries >= MAX_TRIES) queue = [...queue.slice(0, i), ...queue.slice(i + 1)]
    else { queue = queue.map((q, j) => (j === i ? { ...q, tries } : q)); i++ }
    await save(queue)
  }
  return { sent, left: queue.length, stoppedOffline: false }
}

// ---------- lessons (read only) ----------
export type CachedLesson = { lesson: unknown; savedAt: string; openedAt: string }
export type CachedLessonList = { rows: unknown[]; savedAt: string }

export async function saveLesson(kv: Kv, userId: string, lessonId: string, lesson: unknown, now = new Date()): Promise<void> {
  await kv.put(k(userId, `lesson:${lessonId}`), { lesson, savedAt: now.toISOString(), openedAt: now.toISOString() } satisfies CachedLesson)
  // keep to the most recently opened lessons
  const keys = await kv.keys(k(userId, 'lesson:'))
  if (keys.length > MAX_LESSONS) {
    const all = await Promise.all(keys.map(async (key) => ({ key, openedAt: (await kv.get<CachedLesson>(key))?.openedAt ?? '' })))
    all.sort((a, b) => (a.openedAt < b.openedAt ? -1 : a.openedAt > b.openedAt ? 1 : 0))
    for (const old of all.slice(0, keys.length - MAX_LESSONS)) await kv.delete(old.key)
  }
}
export const getLesson = (kv: Kv, userId: string, lessonId: string) => kv.get<CachedLesson>(k(userId, `lesson:${lessonId}`))
export const cachedLessonIds = async (kv: Kv, userId: string): Promise<string[]> => (await kv.keys(k(userId, 'lesson:'))).map((key) => key.slice(k(userId, 'lesson:').length))
export const saveLessonList = (kv: Kv, userId: string, rows: unknown[], now = new Date()) => kv.put(k(userId, 'lessonlist'), { rows, savedAt: now.toISOString() } satisfies CachedLessonList)
export const getLessonList = (kv: Kv, userId: string) => kv.get<CachedLessonList>(k(userId, 'lessonlist'))

// ---------- signing out ----------
// Everything readable (decks, cards, lessons, who the person is) is wiped. The queue of unsent flashcard answers is kept for the same
// person: it holds only card ids and times, no card text, and wiping it would lose the answers; it is sent after their next sign-in.
export async function clearReadableData(kv: Kv, userId: string): Promise<void> {
  for (const key of await kv.keys(`u:${userId}:`)) if (key !== k(userId, 'pending')) await kv.delete(key)
}
export async function clearEverything(kv: Kv): Promise<void> {
  for (const key of await kv.keys('u:')) if (!key.endsWith(':pending')) await kv.delete(key)
}
