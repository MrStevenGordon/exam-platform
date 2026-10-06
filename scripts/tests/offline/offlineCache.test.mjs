// Run: node --import ./scripts/tests/essay-marking/resolve-ts.mjs --experimental-strip-types --no-warnings --test scripts/tests/offline/offlineCache.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { memoryKv } from '../../../src/lib/offline/kv.ts'
import { isNetworkFailure } from '../../../src/lib/offline/network.ts'
import { saveDecks, getDecks, saveDeck, getDeck, queueReview, getPending, pendingCount, applyPending, syncPending, saveLesson, getLesson, cachedLessonIds, saveLessonList, getLessonList, saveRole, getRole, clearReadableData, clearEverything, MAX_TRIES, MAX_LESSONS } from '../../../src/lib/offline/offlineCache.ts'

const NOW = new Date('2026-10-07T15:00:00Z')
const at = (min) => new Date(NOW.getTime() + min * 60000)
const card = (id, o = {}) => ({ id, front: 'f' + id, back: 'b' + id, box: 1, dueAt: NOW.toISOString(), timesSeen: 0, timesCorrect: 0, lastReviewedAt: null, ...o })
const deck = { id: 'd1', title: 'Maths', subject: 'Mathematics', updatedAt: NOW.toISOString() }

test('the real network failures are recognised and server answers are not', () => {
  for (const e of [{ message: 'TypeError: Failed to fetch' }, { message: 'fetch failed' }, { name: 'TypeError', message: 'NetworkError when attempting to fetch resource.' }, { message: 'Load failed' }, new TypeError('Failed to fetch'), { message: 'net::ERR_INTERNET_DISCONNECTED' }]) assert.equal(isNetworkFailure(e), true, JSON.stringify(e))
  for (const e of [null, undefined, 'x', {}, { code: '42501', message: 'permission denied' }, { code: 'PGRST116', message: 'not found' }, { status: 401, message: 'Failed to fetch' }, { status: 500 }, { message: 'duplicate key value' }]) assert.equal(isNetworkFailure(e), false, JSON.stringify(e))
})

test('decks and a deck with its cards are kept and read back, separately for each person', async () => {
  const kv = memoryKv()
  await saveDecks(kv, 'ann', [{ ...deck, total: 2, due: 1 }], NOW)
  await saveDeck(kv, 'ann', deck, [card('c1'), card('c2')], NOW)
  assert.equal((await getDecks(kv, 'ann')).decks[0].title, 'Maths'); assert.equal((await getDeck(kv, 'ann', 'd1')).cards.length, 2)
  assert.equal(await getDecks(kv, 'bob'), undefined); assert.equal(await getDeck(kv, 'bob', 'd1'), undefined)       // Bob on the same device sees nothing of Ann's
  assert.equal(await getDeck(kv, 'ann', 'nope'), undefined)
})

test('an answer given offline is queued in order and changes the device copy of the card', async () => {
  const kv = memoryKv()
  await saveDeck(kv, 'ann', deck, [card('c1'), card('c2')], NOW)
  const e1 = await queueReview(kv, 'ann', card('c1'), 'd1', true, at(1))
  assert.equal(e1.state.box, 2); assert.equal(e1.state.timesSeen, 1); assert.equal(e1.tries, 0)
  const onDevice = (await getDeck(kv, 'ann', 'd1')).cards.find((c) => c.id === 'c1')
  assert.equal(onDevice.box, 2); assert.equal(onDevice.timesCorrect, 1); assert.equal(onDevice.lastReviewedAt, at(1).toISOString())
  // the same card answered again offline starts from where the first answer left it
  const second = await queueReview(kv, 'ann', onDevice, 'd1', false, at(2))
  assert.equal(second.state.box, 1); assert.equal(second.state.timesSeen, 2); assert.equal(second.state.timesCorrect, 1)
  assert.deepEqual((await getPending(kv, 'ann')).map((p) => p.state.box), [2, 1]); assert.equal(await pendingCount(kv, 'ann'), 2)
  assert.equal(await pendingCount(kv, 'bob'), 0)
})

test('replaying the queue over cards gives the same result as answering them one by one', () => {
  const cards = [card('a'), card('b')]
  const q = []
  let a = cards[0]
  for (const [i, knew] of [[1, true], [2, true], [3, false]]) { const s = { cardId: 'a', deckId: 'd', at: at(i).toISOString(), state: { box: knew ? Math.min(5, a.box + 1) : 1, dueAt: at(i).toISOString(), timesSeen: a.timesSeen + 1, timesCorrect: a.timesCorrect + (knew ? 1 : 0), lastReviewedAt: at(i).toISOString() }, tries: 0 }; q.push(s); a = { ...a, box: s.state.box, timesSeen: s.state.timesSeen, timesCorrect: s.state.timesCorrect } }
  const out = applyPending(cards, q)
  assert.equal(out[0].timesSeen, 3); assert.equal(out[0].box, 1); assert.equal(out[1].timesSeen, 0)             // card b untouched
  assert.equal(applyPending(cards, [{ ...q[0], cardId: 'missing' }]).length, 2)                                  // an answer for a card that is not here is ignored
  assert.equal(cards[0].timesSeen, 0)                                                                            // the input is not changed
})

const entry = (n, tries = 0) => ({ cardId: 'c' + n, deckId: 'd1', at: at(n).toISOString(), state: { box: 2, dueAt: at(n).toISOString(), timesSeen: 1, timesCorrect: 1, lastReviewedAt: at(n).toISOString() }, tries })
async function withQueue(kv, n) { await kv.put('u:ann:pending', Array.from({ length: n }, (_, i) => entry(i + 1))) }

test('sending the queue: everything accepted is sent in order and the queue empties', async () => {
  const kv = memoryKv(); await withQueue(kv, 3)
  const order = []
  const r = await syncPending(kv, 'ann', async (p) => { order.push(p.cardId); return 'done' })
  assert.deepEqual(order, ['c1', 'c2', 'c3']); assert.deepEqual(r, { sent: 3, left: 0, stoppedOffline: false }); assert.equal(await pendingCount(kv, 'ann'), 0)
})

test('losing the connection part-way stops, keeps the rest, and what was sent is not sent again next time', async () => {
  const kv = memoryKv(); await withQueue(kv, 4)
  let calls = 0
  const r1 = await syncPending(kv, 'ann', async () => (++calls <= 2 ? 'done' : 'network'))
  assert.deepEqual(r1, { sent: 2, left: 2, stoppedOffline: true }); assert.deepEqual((await getPending(kv, 'ann')).map((p) => p.cardId), ['c3', 'c4'])
  const seen = []
  const r2 = await syncPending(kv, 'ann', async (p) => { seen.push(p.cardId); return 'done' })
  assert.deepEqual(seen, ['c3', 'c4']); assert.equal(r2.left, 0)
})

test('an answer for a card that is gone is dropped quietly, and a repeatedly refused one is dropped after a few tries without blocking the rest', async () => {
  const kv = memoryKv(); await withQueue(kv, 3)
  const r = await syncPending(kv, 'ann', async (p) => (p.cardId === 'c1' ? 'gone' : p.cardId === 'c2' ? 'error' : 'done'))
  assert.deepEqual(r, { sent: 1, left: 1, stoppedOffline: false })                                                // c3 sent, c1 dropped, c2 kept for another try
  const left = await getPending(kv, 'ann'); assert.deepEqual(left.map((p) => [p.cardId, p.tries]), [['c2', 1]])
  for (let i = 1; i < MAX_TRIES; i++) await syncPending(kv, 'ann', async () => 'error')
  assert.equal(await pendingCount(kv, 'ann'), 0)
})

test('a failed push on an earlier entry does not stop later ones from being sent', async () => {
  const kv = memoryKv(); await withQueue(kv, 3); const seen = []
  await syncPending(kv, 'ann', async (p) => { seen.push(p.cardId); return p.cardId === 'c1' ? 'error' : 'done' })
  assert.deepEqual(seen, ['c1', 'c2', 'c3']); assert.deepEqual((await getPending(kv, 'ann')).map((p) => p.cardId), ['c1'])
})

test('lessons are kept for reading, listed, and only the most recently opened are kept', async () => {
  const kv = memoryKv()
  await saveLesson(kv, 'ann', 'L1', { title: 'One' }, at(0)); await saveLesson(kv, 'ann', 'L2', { title: 'Two' }, at(1))
  assert.equal((await getLesson(kv, 'ann', 'L1')).lesson.title, 'One'); assert.deepEqual((await cachedLessonIds(kv, 'ann')).sort(), ['L1', 'L2']); assert.deepEqual(await cachedLessonIds(kv, 'bob'), [])
  for (let i = 0; i < MAX_LESSONS; i++) await saveLesson(kv, 'ann', 'M' + String(i).padStart(2, '0'), { i }, at(10 + i))
  const ids = await cachedLessonIds(kv, 'ann')
  assert.equal(ids.length, MAX_LESSONS); assert.ok(!ids.includes('L1') && !ids.includes('L2')); assert.ok(ids.includes('M' + String(MAX_LESSONS - 1)))
  await saveLessonList(kv, 'ann', [{ lesson_id: 'x' }], NOW); assert.equal((await getLessonList(kv, 'ann')).rows.length, 1)
})

test('signing out wipes what can be read but keeps the unsent answers; wiping everyone keeps them too', async () => {
  const kv = memoryKv()
  await saveRole(kv, 'ann', 'student'); await saveDecks(kv, 'ann', [], NOW); await saveDeck(kv, 'ann', deck, [card('c1')], NOW); await saveLesson(kv, 'ann', 'L1', {}, NOW)
  await queueReview(kv, 'ann', card('c1'), 'd1', true, at(1))
  await saveRole(kv, 'bob', 'student')
  await clearReadableData(kv, 'ann')
  assert.equal(await getRole(kv, 'ann'), undefined); assert.equal(await getDecks(kv, 'ann'), undefined); assert.equal(await getDeck(kv, 'ann', 'd1'), undefined); assert.deepEqual(await cachedLessonIds(kv, 'ann'), [])
  assert.equal(await pendingCount(kv, 'ann'), 1); assert.equal(await getRole(kv, 'bob'), 'student')                     // Bob's data was not touched
  await clearEverything(kv)
  assert.equal(await getRole(kv, 'bob'), undefined); assert.equal(await pendingCount(kv, 'ann'), 1)
  assert.ok(Object.keys(kv.dump()).every((key) => key.endsWith(':pending')))                                            // nothing readable is left anywhere
})

test('the in-memory store hands back copies, like the real one, so a stored value cannot be changed from outside', async () => {
  const kv = memoryKv(); const v = { a: [1] }
  await kv.put('k', v); v.a.push(2)
  assert.deepEqual(await kv.get('k'), { a: [1] })
  const got = await kv.get('k'); got.a.push(3); assert.deepEqual(await kv.get('k'), { a: [1] })
})
