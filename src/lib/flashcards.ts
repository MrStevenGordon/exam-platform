import { supabase } from '@/lib/supabase'
import { checkCard, LIMITS, nextState, toCard, type Card } from '@/lib/flashcardsPure'

// The screen's side of Flashcards. Decks and cards belong to the student who made them; the database (migration 084) makes sure no
// one else can read or change them, so every call here simply uses the student's own sign-in.

export type Deck = { id: string; title: string; subject: string | null; updatedAt: string }

let availability: Promise<boolean> | null = null

// Flashcards need migration 084. Until it is applied, no Flashcards link is shown.
export function isFlashcardsAvailable(): Promise<boolean> {
  if (!availability) {
    availability = (async () => {
      try {
        const { error } = await supabase.rpc('flashcards_ready')
        return !error
      } catch {
        return false
      }
    })()
  }
  return availability
}

export async function loadDecks(): Promise<{ ok: true; decks: Array<Deck & { total: number; due: number }> } | { ok: false }> {
  try {
    const { data: decks, error } = await supabase.from('flashcard_decks').select('id, title, subject, updated_at').order('updated_at', { ascending: false })
    if (error) return { ok: false }
    const { data: cards, error: cardsError } = await supabase.from('flashcards').select('deck_id, due_at')
    if (cardsError) return { ok: false }
    const now = Date.now()
    const out = (decks || []).map((d) => {
      const mine = (cards || []).filter((c) => c.deck_id === d.id)
      return { id: d.id, title: d.title, subject: d.subject, updatedAt: d.updated_at, total: mine.length, due: mine.filter((c) => new Date(c.due_at).getTime() <= now).length }
    })
    return { ok: true, decks: out }
  } catch {
    return { ok: false }
  }
}

export async function loadDeck(id: string): Promise<{ ok: true; deck: Deck; cards: Card[] } | { ok: false; notFound: boolean }> {
  try {
    const { data: deck } = await supabase.from('flashcard_decks').select('id, title, subject, updated_at').eq('id', id).maybeSingle()
    if (!deck) return { ok: false, notFound: true }
    const { data: rows, error } = await supabase.from('flashcards').select('*').eq('deck_id', id).order('created_at', { ascending: true })
    if (error) return { ok: false, notFound: false }
    return { ok: true, deck: { id: deck.id, title: deck.title, subject: deck.subject, updatedAt: deck.updated_at }, cards: (rows || []).map(toCard) }
  } catch {
    return { ok: false, notFound: false }
  }
}

type Result = { ok: true } | { ok: false; error: string }
const fail = (error: { message?: string } | null): { ok: false; error: string } => ({ ok: false, error: error?.message || 'Something went wrong. Please try again.' })

export async function createDeck(title: string, subject: string): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const t = title.trim()
  if (!t) return { ok: false, error: 'Give the deck a name.' }
  if (t.length > LIMITS.maxTitle) return { ok: false, error: `Keep the name under ${LIMITS.maxTitle} characters.` }
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Please sign in again.' }
  const { data, error } = await supabase.from('flashcard_decks').insert({ student_id: user.id, title: t, subject: subject.trim() || null }).select('id').single()
  if (error || !data) return fail(error)
  return { ok: true, id: data.id }
}

export async function renameDeck(id: string, title: string): Promise<Result> {
  const t = title.trim()
  if (!t) return { ok: false, error: 'Give the deck a name.' }
  const { error } = await supabase.from('flashcard_decks').update({ title: t.slice(0, LIMITS.maxTitle) }).eq('id', id)
  return error ? fail(error) : { ok: true }
}

export async function deleteDeck(id: string): Promise<Result> {
  const { error } = await supabase.from('flashcard_decks').delete().eq('id', id)
  return error ? fail(error) : { ok: true }
}

export async function addCards(deckId: string, cards: Array<{ front: string; back: string }>): Promise<Result> {
  for (const c of cards) { const p = checkCard(c.front, c.back); if (p) return { ok: false, error: p } }
  const { error } = await supabase.from('flashcards').insert(cards.map((c) => ({ deck_id: deckId, front: c.front.trim(), back: c.back.trim() })))
  return error ? fail(error) : { ok: true }
}

export async function updateCard(id: string, front: string, back: string): Promise<Result> {
  const p = checkCard(front, back)
  if (p) return { ok: false, error: p }
  const { error } = await supabase.from('flashcards').update({ front: front.trim(), back: back.trim() }).eq('id', id)
  return error ? fail(error) : { ok: true }
}

export async function deleteCard(id: string): Promise<Result> {
  const { error } = await supabase.from('flashcards').delete().eq('id', id)
  return error ? fail(error) : { ok: true }
}

// Records one answer while studying: moves the card between boxes and sets when it is next due.
export async function recordReview(card: Card, knewIt: boolean): Promise<Result> {
  const u = nextState(card, knewIt, new Date())
  const { error } = await supabase.from('flashcards').update({ box: u.box, due_at: u.dueAt, times_seen: u.timesSeen, times_correct: u.timesCorrect, last_reviewed_at: u.lastReviewedAt }).eq('id', card.id)
  return error ? fail(error) : { ok: true }
}
