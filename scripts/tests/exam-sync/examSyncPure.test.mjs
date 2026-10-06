// Run: node --import ./scripts/tests/essay-marking/resolve-ts.mjs --experimental-strip-types --no-warnings --test scripts/tests/exam-sync/examSyncPure.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { changedRows, markSent } from '../../../src/lib/examSyncPure.ts'

const row = (q, answer = '', working = null) => ({ session_id: 's1', question_id: q, answer, working })

test('the first save sends everything, including blank answers', () => {
  const sent = new Map()
  const rows = [row('a'), row('b', 'x'), row('c', '', 'sum')]
  assert.deepEqual(changedRows(rows, sent).map((r) => r.question_id), ['a', 'b', 'c'])
})

test('after a successful save, an unchanged exam sends nothing', () => {
  const sent = new Map(); const rows = [row('a', '1'), row('b', 'x')]
  markSent(sent, changedRows(rows, sent))
  assert.deepEqual(changedRows(rows, sent), [])
})

test('only the answers that changed are sent', () => {
  const sent = new Map(); markSent(sent, [row('a', '1'), row('b', 'x'), row('c', 'long essay')])
  const now = [row('a', '1'), row('b', 'xy'), row('c', 'long essay')]
  assert.deepEqual(changedRows(now, sent).map((r) => r.question_id), ['b'])
})

test('clearing an answer is a change and is sent', () => {
  const sent = new Map(); markSent(sent, [row('a', 'something')])
  assert.deepEqual(changedRows([row('a', '')], sent).map((r) => r.question_id), ['a'])
})

test('a change to the working alone is a change', () => {
  const sent = new Map(); markSent(sent, [row('a', '5', null)])
  assert.deepEqual(changedRows([row('a', '5', '2 + 3')], sent).map((r) => r.question_id), ['a'])
  markSent(sent, [row('a', '5', '2 + 3')])
  assert.deepEqual(changedRows([row('a', '5', '2 + 3')], sent), [])
})

test('a failed save is not recorded, so the same rows are sent again next time', () => {
  const sent = new Map(); const rows = [row('a', '1')]
  const first = changedRows(rows, sent)                // the save is attempted and fails: markSent is NOT called
  assert.equal(first.length, 1)
  assert.equal(changedRows(rows, sent).length, 1)      // next tick still sees it as changed
})

test('only the rows that were saved are recorded when a save covers some of them', () => {
  const sent = new Map(); markSent(sent, [row('a', '1')])
  assert.deepEqual(changedRows([row('a', '1'), row('b', '2')], sent).map((r) => r.question_id), ['b'])
})

test('an answer typed back to the old value after a failed save is still correct', () => {
  const sent = new Map(); markSent(sent, [row('a', 'one')])
  // changed to "two" (a failed save), then typed back to "one": the server still has "one", so nothing to send
  assert.deepEqual(changedRows([row('a', 'one')], sent), [])
})

test('undefined working and null working are the same, and answers with quotes or newlines compare exactly', () => {
  const sent = new Map(); markSent(sent, [{ question_id: 'a', answer: 'line1\n"quoted"' }])
  assert.deepEqual(changedRows([{ question_id: 'a', answer: 'line1\n"quoted"', working: null }], sent), [])
  assert.equal(changedRows([{ question_id: 'a', answer: 'line1\n"quoted" ' }], sent).length, 1)
})
