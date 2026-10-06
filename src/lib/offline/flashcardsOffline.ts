import { supabase } from '@/lib/supabase'
import { loadDeck, loadDecks, pushCardState, type Deck } from '@/lib/flashcards'
import { nextState, type Card } from '@/lib/flashcardsPure'
import { idbKv } from '@/lib/offline/kv'
import { browserOffline } from '@/lib/offline/network'
import { getDeck, getDecks, pendingCount, queueReview, saveDeck, saveDecks, syncPending, type PendingReview, type PushResult } from '@/lib/offline/offlineCache'

// Flashcards that keep working without a connection. Online, everything behaves as before and a copy is kept on the device. Offline, the
// student studies from that copy and each answer is queued and sent when the connection returns. Adding, editing and deleting cards still
// need a connection (the pages say so). Only flashcards the student has opened or listed while online are available offline.

const LAST_USER = 'last-user'

// Who is signed in. Online this is the live session; offline (where the session cannot be refreshed) it is whoever was last signed in on
// this device. Signing out clears that, so it never names someone who has left.
export async function currentUserId(): Promise<string | null> {
  const kv = idbKv()
  if (!browserOffline()) {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const id = session?.user?.id ?? null
      if (id && kv) await kv.put(LAST_USER, id)
      if (id) return id
    } catch { /* fall through to the remembered person */ }
  }
  return kv ? (await kv.get<string>(LAST_USER)) ?? null : null
}
export async function forgetUser(): Promise<void> { await idbKv()?.delete(LAST_USER) }

export type DecksLoad = { ok: true; decks: Array<Deck & { total: number; due: number }>; fromCache: boolean; savedAt: string | null } | { ok: false }
export async function loadDecksResilient(): Promise<DecksLoad> {
  const kv = idbKv(); const uid = await currentUserId()
  const live = await loadDecks()
  if (live.ok) { if (kv && uid) await saveDecks(kv, uid, live.decks); return { ok: true, decks: live.decks, fromCache: false, savedAt: null } }
  if (live.network && kv && uid) {
    const cached = await getDecks(kv, uid)
    if (cached) return { ok: true, decks: cached.decks, fromCache: true, savedAt: cached.savedAt }
  }
  return { ok: false }
}

export type DeckLoad = { ok: true; deck: Deck; cards: Card[]; fromCache: boolean } | { ok: false; notFound: boolean }
export async function loadDeckResilient(id: string): Promise<DeckLoad> {
  const kv = idbKv(); const uid = await currentUserId()
  const live = await loadDeck(id)
  if (live.ok) { if (kv && uid) await saveDeck(kv, uid, live.deck, live.cards); return { ok: true, deck: live.deck, cards: live.cards, fromCache: false } }
  if (live.network && kv && uid) {
    const cached = await getDeck(kv, uid, id)
    if (cached) return { ok: true, deck: cached.deck, cards: cached.cards, fromCache: true }
  }
  return { ok: false, notFound: live.notFound }
}

// Saves one answer. Connected: sent straight away (and the device copy is kept in step). Not connected: queued on the device.
export async function recordReviewResilient(card: Card, knewIt: boolean, deckId: string): Promise<{ ok: true; queued: boolean } | { ok: false; error: string }> {
  const kv = idbKv(); const uid = await currentUserId(); const now = new Date()
  if (!browserOffline()) {
    const r = await pushCardState(card.id, nextState(card, knewIt, now))
    if (r.ok) { if (kv && uid) await keepInStep(kv, uid, deckId, card, knewIt, now); return { ok: true, queued: false } }
    if (!r.network) return { ok: false, error: r.error }
  }
  if (!kv || !uid) return { ok: false, error: 'You are offline and this device cannot keep your answer. Please reconnect.' }
  await queueReview(kv, uid, card, deckId, knewIt, now)
  return { ok: true, queued: true }
}

async function keepInStep(kv: NonNullable<ReturnType<typeof idbKv>>, uid: string, deckId: string, card: Card, knewIt: boolean, now: Date): Promise<void> {
  const cached = await getDeck(kv, uid, deckId)
  if (!cached) return
  const s = nextState(card, knewIt, now)
  await saveDeck(kv, uid, cached.deck, cached.cards.map((c) => (c.id === card.id ? { ...c, box: s.box, dueAt: s.dueAt, timesSeen: s.timesSeen, timesCorrect: s.timesCorrect, lastReviewedAt: s.lastReviewedAt } : c)), new Date(cached.savedAt))
}

async function push(p: PendingReview): Promise<PushResult> {
  const r = await pushCardState(p.cardId, p.state, p.at)
  if (r.ok) return r.changed > 0 ? 'done' : 'gone'      // 0 rows: the card is gone, or the server already has a later answer
  return r.network ? 'network' : 'error'
}

// Sends any answers given offline. Safe to call whenever: it does nothing when there is nothing to send or no connection.
// The banner, the page and the reconnect event can all ask at once; they share one run so no answer is sent twice.
let running: Promise<{ sent: number; left: number; stoppedOffline: boolean } | null> | null = null
export function syncFlashcards(): Promise<{ sent: number; left: number; stoppedOffline: boolean } | null> {
  if (running) return running
  running = (async () => {
    const kv = idbKv(); const uid = await currentUserId()
    if (!kv || !uid || browserOffline()) return null
    return syncPending(kv, uid, push)
  })().finally(() => { running = null })
  return running
}

export async function pendingFlashcardAnswers(): Promise<number> {
  const kv = idbKv(); const uid = await currentUserId()
  return kv && uid ? pendingCount(kv, uid) : 0
}
