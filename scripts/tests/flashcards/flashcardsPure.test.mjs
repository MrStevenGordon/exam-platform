// Run: node --import ./scripts/tests/essay-marking/resolve-ts.mjs --experimental-strip-types --no-warnings --test scripts/tests/flashcards/flashcardsPure.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { nextState, dueCards, deckStats, startSession, answer, current, finished, summary, parseBulk, checkCard, toCard, nextDue, isDue, LIMITS, GAP_DAYS } from '../../../src/lib/flashcardsPure.ts'

const NOW = new Date('2026-10-06T12:00:00Z')
const DAY = 86400000
const card = (id, o = {}) => ({ id, front: 'f' + id, back: 'b' + id, box: 1, dueAt: new Date(NOW.getTime() - 1000).toISOString(), timesSeen: 0, timesCorrect: 0, lastReviewedAt: null, ...o })

test('getting a card right moves it up one box and sets the longer gap; the top box stays the top', () => {
  for (const [from, to] of [[1, 2], [2, 3], [3, 4], [4, 5], [5, 5]]) {
    const u = nextState(card('a', { box: from }), true, NOW)
    assert.equal(u.box, to)
    assert.equal(new Date(u.dueAt).getTime() - NOW.getTime(), GAP_DAYS[to] * DAY)
  }
  assert.deepEqual([1, 2, 3, 4, 5].map((b) => GAP_DAYS[b]), [0, 1, 3, 7, 21])
})

test('missing a card sends it back to box 1, due straight away, from any box', () => {
  for (const b of [1, 2, 3, 4, 5]) {
    const u = nextState(card('a', { box: b }), false, NOW)
    assert.equal(u.box, 1); assert.equal(u.dueAt, NOW.toISOString())
  }
})

test('every answer is counted, and only right answers count as correct', () => {
  const up = nextState(card('a', { timesSeen: 4, timesCorrect: 3 }), true, NOW)
  assert.equal(up.timesSeen, 5); assert.equal(up.timesCorrect, 4); assert.equal(up.lastReviewedAt, NOW.toISOString())
  const down = nextState(card('a', { timesSeen: 4, timesCorrect: 3 }), false, NOW)
  assert.equal(down.timesSeen, 5); assert.equal(down.timesCorrect, 3)
})

test('only due cards are studied: least known first, then longest waiting, capped', () => {
  const cards = [
    card('known', { box: 5, dueAt: new Date(NOW.getTime() - 5 * DAY).toISOString() }),
    card('later', { box: 2, dueAt: new Date(NOW.getTime() + DAY).toISOString() }),   // not due
    card('b2old', { box: 2, dueAt: new Date(NOW.getTime() - 3 * DAY).toISOString() }),
    card('b2new', { box: 2, dueAt: new Date(NOW.getTime() - 1 * DAY).toISOString() }),
    card('b1', { box: 1 }),
  ]
  assert.deepEqual(dueCards(cards, NOW).map((c) => c.id), ['b1', 'b2old', 'b2new', 'known'])
  assert.deepEqual(dueCards(cards, NOW, 2).map((c) => c.id), ['b1', 'b2old'])
  assert.equal(isDue(card('x', { dueAt: NOW.toISOString() }), NOW), true) // due exactly now counts
})

test('a round is capped at the session size', () => {
  const many = Array.from({ length: 50 }, (_, i) => card('c' + String(i).padStart(2, '0')))
  assert.equal(dueCards(many, NOW).length, LIMITS.sessionSize)
})

test('deck figures', () => {
  const cards = [card('n1'), card('n2'), card('l1', { box: 2, timesSeen: 2, timesCorrect: 1 }), card('k1', { box: 5, timesSeen: 6, timesCorrect: 6, dueAt: new Date(NOW.getTime() + 20 * DAY).toISOString() })]
  assert.deepEqual(deckStats(cards, NOW), { total: 4, due: 3, fresh: 2, learning: 1, known: 1 })
  assert.deepEqual(deckStats([], NOW), { total: 0, due: 0, fresh: 0, learning: 0, known: 0 })
})

test('a round: known cards leave, missed ones return to the back at most twice', () => {
  let s = startSession([card('a'), card('b'), card('c')])
  assert.equal(current(s), 'a')
  s = answer(s, true)               // a known
  assert.deepEqual(s.queue, ['b', 'c'])
  s = answer(s, false)              // b missed: back of the line
  assert.deepEqual(s.queue, ['c', 'b'])
  s = answer(s, true)               // c known
  s = answer(s, false)              // b missed again
  assert.deepEqual(s.queue, ['b'])
  s = answer(s, false)              // b missed a third time: no more repeats this round
  assert.equal(finished(s), true); assert.equal(s.reviewed, 5)
  assert.deepEqual(summary(s), { cards: 3, knewFirstTime: 2, needMorePractice: 1 })
})

test('a card missed first and known later is not counted as known first time', () => {
  let s = startSession([card('a')])
  s = answer(s, false); s = answer(s, true)
  assert.equal(finished(s), true); assert.deepEqual(summary(s), { cards: 1, knewFirstTime: 0, needMorePractice: 1 })
})

test('answering an empty round does nothing', () => {
  const s = startSession([])
  assert.equal(finished(s), true); assert.equal(current(s), null); assert.deepEqual(answer(s, true), s)
})

test('bulk add: tab, pipe, or double colon; blanks and lines with no back are skipped', () => {
  const r = parseBulk('Photosynthesis | Plants make food using light\nCapital of Jamaica\tKingston\n  Mitosis :: cell division  \n\nno separator here\n| no front\nno back |\n')
  assert.deepEqual(r.cards, [
    { front: 'Photosynthesis', back: 'Plants make food using light' }, { front: 'Capital of Jamaica', back: 'Kingston' }, { front: 'Mitosis', back: 'cell division' },
  ])
  assert.equal(r.skipped, 3); assert.equal(r.tooLong, 0)
})

test('bulk add: a back may itself contain a pipe or colons after the first separator; too-long lines are counted; room is respected', () => {
  assert.deepEqual(parseBulk('a | b | c').cards, [{ front: 'a', back: 'b | c' }])
  const r = parseBulk(['x | ' + 'y'.repeat(LIMITS.maxBack + 1), 'p'.repeat(LIMITS.maxFront + 1) + ' | q', 'ok | fine'].join('\n'))
  assert.equal(r.tooLong, 2); assert.equal(r.cards.length, 1)
  const many = parseBulk(Array.from({ length: 10 }, (_, i) => `q${i} | a${i}`).join('\n'), 4)
  assert.equal(many.cards.length, 4); assert.equal(many.skipped, 6)
})

test('checking one card', () => {
  assert.equal(checkCard('front', 'back'), null)
  assert.match(checkCard(' ', 'b'), /front/); assert.match(checkCard('f', ''), /back/)
  assert.match(checkCard('f'.repeat(501), 'b'), /too long/); assert.match(checkCard('f', 'b'.repeat(1001)), /too long/)
})

test('rows from the database become cards, with safe defaults', () => {
  const c = toCard({ id: 'z', front: 'F', back: 'B', box: 3, due_at: '2026-10-07T00:00:00Z', times_seen: 2, times_correct: 1, last_reviewed_at: '2026-10-05T00:00:00Z' })
  assert.deepEqual(c, { id: 'z', front: 'F', back: 'B', box: 3, dueAt: '2026-10-07T00:00:00Z', timesSeen: 2, timesCorrect: 1, lastReviewedAt: '2026-10-05T00:00:00Z' })
  assert.equal(toCard({ id: 'q' }).box, 1)
})

test('when the next card falls due', () => {
  const cards = [card('a', { dueAt: new Date(NOW.getTime() + 3 * DAY).toISOString() }), card('b', { dueAt: new Date(NOW.getTime() + DAY).toISOString() }), card('c')]
  assert.equal(nextDue(cards, NOW).getTime(), NOW.getTime() + DAY)
  assert.equal(nextDue([card('c')], NOW), null)
})
