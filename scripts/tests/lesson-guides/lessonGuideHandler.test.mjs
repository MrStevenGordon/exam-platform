// Run: node --import ./scripts/tests/essay-marking/resolve-ts.mjs --experimental-strip-types --no-warnings --test scripts/tests/lesson-guides/lessonGuideHandler.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
// The lesson library creates a database client when it is loaded; a placeholder address is enough because nothing here connects.
process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'http://127.0.0.1:54321'
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||= 'test-key'
const { handleLessonGuide, lessonGuideSchema, LESSON_GUIDE_MONTHLY_LIMIT } = await import('../../../src/lib/lessonGuideHandler.ts')

const STEPS = ['engage', 'explore', 'explain', 'elaborate', 'evaluate']
const body = (over = {}) => ({
  subject: 'Mathematics', grade: 9, title: 'Simple interest',
  steps: STEPS.map((key) => ({ key, text: key === 'explain' ? 'Simple interest is I = P x R x T. The principal is the money saved. The rate is a percentage each year.' : `Some words for the ${key} step of the lesson.` })),
  accessToken: 'tok', ...over,
})
const goodReply = JSON.stringify({
  key_points: ['Simple interest is I = P x R x T.', 'The principal is the money saved.'], can_do: ['I can find simple interest.'],
  cards: [{ front: 'What is the principal?', back: 'The money saved.', step: 'explain' }, { front: 'What is the rate?', back: 'A percentage each year.', step: 'explain' }],
  questions: [{ level: 'core', prompt: 'What is simple interest worked out with?', options: ['I = P x R x T', 'I = P + R', 'I = R / T', 'I = T - P'], correct_index: 0, explanation: 'Simple interest is I = P x R x T.', step: 'explain' }],
})
function deps(over = {}) {
  const calls = { recorded: 0, ai: 0, logs: [] }
  const d = {
    authenticate: async () => ({ userId: 't1', role: 'teacher', active: true }),
    hasApiKey: () => true,
    burstLimited: async () => false,
    usedThisMonth: async () => 3,
    recordUse: async () => { calls.recorded++ },
    callAi: async () => { calls.ai++; return { ok: true, text: goodReply } },
    now: () => new Date('2026-10-10T12:00:00Z'),
    log: (m) => calls.logs.push(m),
    ...over,
  }
  return { d, calls }
}

test('a teacher gets a draft, usage is counted once, and the answer carries what is left', async () => {
  const { d, calls } = deps()
  const r = await handleLessonGuide(body(), d)
  assert.equal(r.status, 200)
  assert.equal(r.json.cards.length, 2); assert.equal(r.json.questions.length, 1)
  assert.deepEqual(r.json.usage, { used: 4, limit: LESSON_GUIDE_MONTHLY_LIMIT, remaining: LESSON_GUIDE_MONTHLY_LIMIT - 4 })
  assert.equal(calls.recorded, 1)
})

test('a bad or missing session is refused before anything else', async () => {
  const { d, calls } = deps({ authenticate: async () => null })
  assert.equal((await handleLessonGuide(body(), d)).status, 401); assert.equal(calls.ai, 0)
})

test('students and deactivated staff cannot make guides', async () => {
  assert.equal((await handleLessonGuide(body(), deps({ authenticate: async () => ({ userId: 's', role: 'student', active: true }) }).d)).status, 403)
  assert.equal((await handleLessonGuide(body(), deps({ authenticate: async () => ({ userId: 't', role: 'teacher', active: false }) }).d)).status, 403)
})

test('a lesson with almost nothing written is refused without calling the AI', async () => {
  const { d, calls } = deps()
  const r = await handleLessonGuide(body({ steps: STEPS.map((key) => ({ key, text: key === 'engage' ? 'Hi' : '' })) }), d)
  assert.equal(r.status, 400); assert.equal(calls.ai, 0)
})

test('a lesson that is too long is refused', async () => {
  const { d, calls } = deps()
  const r = await handleLessonGuide(body({ steps: STEPS.map((key) => ({ key, text: 'x'.repeat(7000) })) }), d)
  assert.equal(r.status, 400); assert.equal(calls.ai, 0)
})

test('no API key, a burst, and the monthly limit each stop the request and cost nothing', async () => {
  let x = deps({ hasApiKey: () => false }); assert.equal((await handleLessonGuide(body(), x.d)).status, 503); assert.equal(x.calls.ai, 0)
  x = deps({ burstLimited: async () => true }); assert.equal((await handleLessonGuide(body(), x.d)).status, 429); assert.equal(x.calls.ai, 0)
  x = deps({ usedThisMonth: async () => LESSON_GUIDE_MONTHLY_LIMIT }); const r = await handleLessonGuide(body(), x.d)
  assert.equal(r.status, 429); assert.equal(r.json.limit_reached, true); assert.equal(x.calls.ai, 0); assert.equal(x.calls.recorded, 0)
})

test('an AI failure gives the plain message and is not counted', async () => {
  const x = deps({ callAi: async () => ({ ok: false, message: 'The AI assistant is busy right now. Please try again in a minute.', httpStatus: 503 }) })
  const r = await handleLessonGuide(body(), x.d)
  assert.equal(r.status, 503); assert.match(r.json.error, /busy/); assert.equal(x.calls.recorded, 0)
})

test('a reply that cannot be used is reported and not counted', async () => {
  const x = deps({ callAi: async () => ({ ok: true, text: 'Sorry, I cannot do that.' }) })
  const r = await handleLessonGuide(body(), x.d)
  assert.equal(r.status, 502); assert.equal(x.calls.recorded, 0)
})

test('the request shape is strict: extra fields and missing steps are refused', () => {
  assert.equal(lessonGuideSchema.safeParse(body()).success, true)
  assert.equal(lessonGuideSchema.safeParse({ ...body(), extra: 1 }).success, false)
  assert.equal(lessonGuideSchema.safeParse(body({ steps: body().steps.slice(0, 4) })).success, false)
  assert.equal(lessonGuideSchema.safeParse(body({ grade: 3 })).success, false)
})

test('the two halves are asked for side by side, in two separate requests', async () => {
  const prompts = []
  const { d } = deps({ callAi: async (prompt) => { prompts.push(prompt); return { ok: true, text: goodReply } } })
  const r = await handleLessonGuide(body(), d)
  assert.equal(r.status, 200); assert.equal(prompts.length, 2)
  assert.ok(prompts.some((p) => /"key_points"/.test(p) && !/"questions": \[/.test(p))); assert.ok(prompts.some((p) => /Make the practice questions/.test(p)))
})

test('if the questions request fails the guide still arrives, with a note, and the use is counted once', async () => {
  let n = 0
  const x = deps({ callAi: async () => { n++; return n === 1 ? { ok: true, text: goodReply } : { ok: false, message: 'The AI took too long to answer. Please try again.', httpStatus: 503 } } })
  const r = await handleLessonGuide(body(), x.d)
  assert.equal(r.status, 200); assert.ok(r.json.cards.length >= 1); assert.equal(r.json.notes.length, r.json.questions.length === 0 ? 1 : 0)
  assert.equal(x.calls.recorded, 1)
})

test('if the main request fails nothing is delivered or counted', async () => {
  let n = 0
  const x = deps({ callAi: async () => { n++; return n === 1 ? { ok: false, message: 'busy', httpStatus: 503 } : { ok: true, text: goodReply } } })
  const r = await handleLessonGuide(body(), x.d)
  assert.equal(r.status, 503); assert.equal(x.calls.recorded, 0)
})
