import test from 'node:test'
import assert from 'node:assert/strict'
import { problemRef, recordAiProblem } from '../../../src/lib/aiProblems.ts'

const fake = () => { const calls = []; return { calls, from: (t) => ({ insert: async (row) => { calls.push(['insert', t, row]); return { error: null } }, delete: () => ({ lt: async (c, v) => { calls.push(['delete', t, c, v]); return { error: null } } }) }) } }

test('a failed reply is recorded with its reason, how it stopped, its length and the start and end', async () => {
  const a = fake(); const text = 'x'.repeat(1000)
  await recordAiProblem(a, { feature: 'lesson-plans', reason: 'truncated', stopReason: 'max_tokens', text, attempt: 2 })
  const row = a.calls[0][2]
  assert.equal(a.calls[0][1], 'ai_reply_problems'); assert.equal(row.reason, 'truncated'); assert.equal(row.stop_reason, 'max_tokens'); assert.equal(row.reply_length, 1000); assert.equal(row.attempt, 2)
  assert.equal(row.head.length, 300); assert.equal(row.tail.length, 300)
  assert.equal(a.calls[1][0], 'delete')   // old rows are cleared as it writes
})
test('a short reply is kept whole and has no separate tail', async () => {
  const a = fake(); await recordAiProblem(a, { feature: 'polish-question', reason: 'invalid', text: '{"a": "he said "hi""}' })
  assert.equal(a.calls[0][2].head, '{"a": "he said "hi""}'); assert.equal(a.calls[0][2].tail, null); assert.equal(a.calls[0][2].stop_reason, null)
})
test('record-keeping never breaks a request, even if the database call throws or the table is missing', async () => {
  await recordAiProblem({ from: () => { throw new Error('no such table') } }, { feature: 'x', reason: 'invalid', text: 'abc' })
  await recordAiProblem({ from: () => ({ insert: async () => ({ error: { message: 'relation does not exist' } }), delete: () => ({ lt: async () => ({ error: null }) }) }) }, { feature: 'x', reason: 'invalid', text: 'abc' })
})
test('the word a teacher can read out', () => { assert.equal(problemRef('truncated'), 'cut-off'); assert.equal(problemRef('empty'), 'empty'); assert.equal(problemRef('invalid'), 'unreadable') })
