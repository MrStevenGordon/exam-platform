// Flashcards: when a card is due, what happens when a student gets it right or wrong, how a study round runs, and how pasted text
// becomes cards. No network, no database, no screen, so every rule can be tested (scripts/tests/flashcards/flashcardsPure.test.mjs).
//
// The method is the Leitner boxes. A card starts in box 1. "Got it" moves it up a box and it comes back after a longer gap;
// "Not yet" sends it back to box 1 to be seen again straight away. Box 5 is "known well".

export type Card = {
  id: string
  front: string
  back: string
  box: number
  dueAt: string            // ISO time
  timesSeen: number
  timesCorrect: number
  lastReviewedAt: string | null
}

export const LIMITS = { maxDecks: 50, maxCards: 500, maxFront: 500, maxBack: 1000, maxTitle: 120, sessionSize: 20, maxRepeats: 2 } as const

// Days until a card comes back, by the box it has just moved into.
export const GAP_DAYS: Record<number, number> = { 1: 0, 2: 1, 3: 3, 4: 7, 5: 21 }
export const TOP_BOX = 5
const DAY = 24 * 60 * 60 * 1000

export type CardUpdate = { box: number; dueAt: string; timesSeen: number; timesCorrect: number; lastReviewedAt: string }

export function nextState(card: Pick<Card, 'box' | 'timesSeen' | 'timesCorrect'>, knewIt: boolean, now: Date): CardUpdate {
  const box = knewIt ? Math.min(TOP_BOX, card.box + 1) : 1
  return {
    box,
    dueAt: new Date(now.getTime() + GAP_DAYS[box] * DAY).toISOString(),
    timesSeen: card.timesSeen + 1,
    timesCorrect: card.timesCorrect + (knewIt ? 1 : 0),
    lastReviewedAt: now.toISOString(),
  }
}

export const isDue = (card: Pick<Card, 'dueAt'>, now: Date): boolean => new Date(card.dueAt).getTime() <= now.getTime()

// The cards to study now: only the ones that are due, the least known first, then the longest waiting.
export function dueCards(cards: Card[], now: Date, limit: number = LIMITS.sessionSize): Card[] {
  return cards
    .filter((c) => isDue(c, now))
    .sort((a, b) => a.box - b.box || new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime() || a.id.localeCompare(b.id))
    .slice(0, limit)
}

export type DeckStats = { total: number; due: number; fresh: number; learning: number; known: number }
export function deckStats(cards: Card[], now: Date): DeckStats {
  return {
    total: cards.length,
    due: cards.filter((c) => isDue(c, now)).length,
    fresh: cards.filter((c) => c.timesSeen === 0).length,
    known: cards.filter((c) => c.box === TOP_BOX).length,
    learning: cards.filter((c) => c.timesSeen > 0 && c.box < TOP_BOX).length,
  }
}

// ---------- a study round ----------
export type Session = {
  queue: string[]                      // card ids still to show, first is current
  repeats: Record<string, number>      // how many times a missed card has been put back this round
  firstTry: Record<string, boolean>    // whether each card was known the first time it was shown
  reviewed: number                     // answers given
}
export const startSession = (cards: Card[]): Session => ({ queue: cards.map((c) => c.id), repeats: {}, firstTry: {}, reviewed: 0 })
export const current = (s: Session): string | null => s.queue[0] ?? null
export const finished = (s: Session): boolean => s.queue.length === 0

// A card that is not yet known goes to the back of the line, up to twice, so a missed card is seen again before the round ends.
export function answer(s: Session, knewIt: boolean): Session {
  const id = s.queue[0]
  if (id === undefined) return s
  const rest = s.queue.slice(1)
  const firstTry = id in s.firstTry ? s.firstTry : { ...s.firstTry, [id]: knewIt }
  const used = s.repeats[id] ?? 0
  const requeue = !knewIt && used < LIMITS.maxRepeats
  return {
    queue: requeue ? [...rest, id] : rest,
    repeats: requeue ? { ...s.repeats, [id]: used + 1 } : s.repeats,
    firstTry, reviewed: s.reviewed + 1,
  }
}
export function summary(s: Session): { cards: number; knewFirstTime: number; needMorePractice: number } {
  const ids = Object.keys(s.firstTry)
  const knew = ids.filter((i) => s.firstTry[i]).length
  return { cards: ids.length, knewFirstTime: knew, needMorePractice: ids.length - knew }
}

// ---------- adding many cards at once ----------
export type BulkResult = { cards: Array<{ front: string; back: string }>; skipped: number; tooLong: number }

// One card per line, the front and back separated by a tab, a pipe (|) or " :: ". Lines with no separator are skipped.
export function parseBulk(text: string, room: number = LIMITS.maxCards): BulkResult {
  const cards: Array<{ front: string; back: string }> = []
  let skipped = 0, tooLong = 0
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue
    const m = /^(.*?)(?:\t|\s*\|\s*|\s+::\s+)(.+)$/.exec(line)
    const front = m?.[1]?.trim() ?? '', back = m?.[2]?.trim() ?? ''
    if (!m || !front || !back) { skipped++; continue }
    if (front.length > LIMITS.maxFront || back.length > LIMITS.maxBack) { tooLong++; continue }
    if (cards.length >= room) { skipped++; continue }
    cards.push({ front, back })
  }
  return { cards, skipped, tooLong }
}

export function checkCard(front: string, back: string): string | null {
  if (!front.trim()) return 'Write the front of the card.'
  if (!back.trim()) return 'Write the back of the card.'
  if (front.length > LIMITS.maxFront) return `The front is too long. Keep it under ${LIMITS.maxFront} characters.`
  if (back.length > LIMITS.maxBack) return `The back is too long. Keep it under ${LIMITS.maxBack} characters.`
  return null
}

export function toCard(row: Record<string, unknown>): Card {
  return {
    id: String(row.id), front: String(row.front ?? ''), back: String(row.back ?? ''), box: Number(row.box) || 1,
    dueAt: String(row.due_at ?? new Date(0).toISOString()), timesSeen: Number(row.times_seen) || 0, timesCorrect: Number(row.times_correct) || 0,
    lastReviewedAt: typeof row.last_reviewed_at === 'string' ? row.last_reviewed_at : null,
  }
}

// When the next card falls due, for "come back tomorrow" messages. null when nothing is waiting.
export function nextDue(cards: Card[], now: Date): Date | null {
  const later = cards.filter((c) => !isDue(c, now)).map((c) => new Date(c.dueAt).getTime())
  return later.length ? new Date(Math.min(...later)) : null
}
