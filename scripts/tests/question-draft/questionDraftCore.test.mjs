// Run: node --import ./scripts/tests/essay-marking/resolve-ts.mjs --experimental-strip-types --no-warnings --test scripts/tests/question-draft/questionDraftCore.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { draftQuestions } from '../../../src/lib/questionDraftCore.ts'

const request = (o = {}) => ({ subject: 'Maths', grade: '10', topic: 'Fractions', counts: { multiple_choice: 1, true_false: 0, short_answer: 0, essay: 0 }, difficulty: 'standard', notes: '', ...o })
const goodText = JSON.stringify({ questions: [{ type: 'multiple_choice', question: 'What is 1/2 + 1/4?', options: ['1/6', '2/6', '3/4', '1/8'], correct_index: 2 }] })
function deps(over = {}) {
  const calls = { ai: 0, usage: 0 }
  const d = {
    authorize: async () => ({ ok: true, userId: 'u1' }),
    usedThisMonth: async () => 3,
    burstLimited: async () => false,
    callAi: async () => { calls.ai++; return { ok: true, text: goodText } },
    recordUsage: async () => { calls.usage++ },
    monthlyLimit: 20,
    random: () => 0.999999,
    ...over,
  }
  return { d, calls }
}
const run = (d, req = request()) => draftQuestions(d, { accessToken: 't', request: req })

test('the happy path: drafts, usage counted once, nothing else', async () => {
  const { d, calls } = deps()
  const out = await run(d)
  assert.equal(out.status, 200); assert.equal(out.body.drafts.length, 1); assert.equal(out.body.usage.used, 4); assert.equal(out.body.usage.remaining, 16)
  assert.equal(calls.ai, 1); assert.equal(calls.usage, 1)
})

test('someone not signed in or not a teacher gets the sign-in answer and the AI is never called', async () => {
  const { d, calls } = deps({ authorize: async () => ({ ok: false, status: 403, body: { error: 'Not authorized.' } }) })
  const out = await run(d)
  assert.equal(out.status, 403); assert.equal(calls.ai, 0); assert.equal(calls.usage, 0)
})

test('a bad request is refused before any AI call or usage', async () => {
  for (const [req, problem] of [[request({ topic: ' ' }), 'no_topic'], [request({ counts: { multiple_choice: 0, true_false: 0, short_answer: 0, essay: 0 } }), 'no_questions'], [request({ counts: { multiple_choice: 9, true_false: 9, short_answer: 0, essay: 0 } }), 'too_many']]) {
    const { d, calls } = deps(); const out = await run(d, req)
    assert.equal(out.status, 400); assert.equal(out.body.problem, problem); assert.equal(calls.ai, 0)
  }
})

test('too many requests in a minute is refused without using the AI', async () => {
  const { d, calls } = deps({ burstLimited: async () => true })
  assert.equal((await run(d)).status, 429); assert.equal(calls.ai, 0)
})

test('the monthly allowance: at the limit nothing is called or counted', async () => {
  const { d, calls } = deps({ usedThisMonth: async () => 20 })
  const out = await run(d)
  assert.equal(out.status, 429); assert.equal(out.body.limitReached, true); assert.equal(out.body.usage.remaining, 0); assert.equal(calls.ai, 0); assert.equal(calls.usage, 0)
  const one = deps({ usedThisMonth: async () => 19 }); assert.equal((await run(one.d)).status, 200)
})

test('AI trouble gives a plain message and costs the teacher nothing', async () => {
  for (const [ai, status, pattern, credit] of [
    [{ ok: false, status: 400, message: 'Your credit balance is too low' }, 503, /not available/, true],
    [{ ok: false, status: 401, message: 'invalid x-api-key' }, 503, /not available/, true],
    [{ ok: false, status: 529, message: 'Overloaded' }, 503, /busy/, undefined],
    [{ ok: false, status: 0, message: 'network down' }, 503, /busy/, undefined],
    [{ ok: false, status: 500, message: 'boom', kind: 'other' }, 502, /failed/, undefined],
  ]) {
    const { d, calls } = deps({ callAi: async () => ai }); const out = await run(d)
    assert.equal(out.status, status, ai.message); assert.match(out.body.error, pattern); assert.equal(out.body.creditProblem, credit); assert.equal(calls.usage, 0)
    assert.ok(!/credit balance|api key/i.test(out.body.error))
  }
})

test('a reply with nothing usable gives an error and costs nothing', async () => {
  for (const text of ['sorry, no', '{"questions":[]}', '{"questions":[{"type":"multiple_choice","question":"x"}]}']) {
    const { d, calls } = deps({ callAi: async () => ({ ok: true, text }) }); const out = await run(d)
    assert.equal(out.status, 502); assert.equal(calls.usage, 0)
  }
})

test('a partly usable reply keeps the good questions and says how many were dropped', async () => {
  const text = JSON.stringify({ questions: [{ type: 'true_false', question: 'Good?', answer: true }, { type: 'true_false', question: 'Bad?', answer: 'x' }] })
  const { d, calls } = deps({ callAi: async () => ({ ok: true, text }) })
  const out = await run(d, request({ counts: { multiple_choice: 0, true_false: 2, short_answer: 0, essay: 0 } }))
  assert.equal(out.status, 200); assert.equal(out.body.drafts.length, 1); assert.equal(out.body.dropped, 1); assert.equal(calls.usage, 1)
})

test('the AI is sent the request, and no student information exists in it', async () => {
  let seen
  const { d } = deps({ callAi: async (s, u) => { seen = { s, u }; return { ok: true, text: goodText } } })
  await run(d, request({ notes: 'Focus on word problems' }))
  assert.match(seen.u, /Topic: Fractions/); assert.match(seen.u, /Focus on word problems/)
})
