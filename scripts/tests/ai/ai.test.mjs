// Tests for src/lib/ai.ts: failure kinds, retries and timeouts, using a fake network.
// Run:  node --import ./scripts/tests/essay-marking/resolve-ts.mjs --experimental-strip-types --no-warnings --test scripts/tests/ai/ai.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { callClaudeChat, callClaude, classifyAiFailure, AI_MODEL, AI_USER_MESSAGES, NEEDS_ATTENTION } from '../../../src/lib/ai.ts'

const okBody = { content: [{ type: 'text', text: 'hello' }], stop_reason: 'end_turn' }
const reply = (status, body, headers = {}) => ({ ok: status >= 200 && status < 300, status, headers: { get: (k) => headers[k.toLowerCase()] ?? null }, text: async () => JSON.stringify(body), json: async () => body })
// a fetch that returns the next scripted outcome each time; counts calls
function script(outcomes) {
  const f = async (url, init) => { f.calls.push({ url, init }); const o = outcomes[Math.min(f.calls.length - 1, outcomes.length - 1)]; if (o instanceof Error) throw o; return o }
  f.calls = []; return f
}
const noSleep = () => { const s = async (ms) => { s.waits.push(ms) }; s.waits = []; return s }

test('classification of the failures that have been seen', () => {
  assert.equal(classifyAiFailure(401, 'invalid x-api-key'), 'invalid_key')
  assert.equal(classifyAiFailure(403, 'forbidden'), 'invalid_key')
  assert.equal(classifyAiFailure(400, 'Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing'), 'no_credit')
  assert.equal(classifyAiFailure(429, 'rate limited'), 'busy')
  assert.equal(classifyAiFailure(529, 'Overloaded'), 'busy')
  assert.equal(classifyAiFailure(404, 'model: claude-old'), 'bad_model')
  assert.equal(classifyAiFailure(400, 'The model claude-x is not available'), 'bad_model')
  assert.equal(classifyAiFailure(413, 'request too large'), 'too_large')
  assert.equal(classifyAiFailure(0, 'AbortError This operation was aborted'), 'timeout')
  assert.equal(classifyAiFailure(0, 'fetch failed'), 'network')
  assert.equal(classifyAiFailure(500, 'internal error'), 'other')
  assert.equal(classifyAiFailure(400, 'messages: text content blocks must be non-empty'), 'other')
})

test('every kind has a plain message that never shows the provider text', () => {
  for (const m of Object.values(AI_USER_MESSAGES)) assert.ok(m.length > 10 && !/api key|credit balance|anthropic/i.test(m))
  assert.deepEqual(NEEDS_ATTENTION.sort(), ['bad_model', 'invalid_key', 'no_credit'])
})

test('a good reply, the default model, and the request shape', async () => {
  const f = script([reply(200, okBody)])
  const r = await callClaudeChat({ system: 'sys', messages: [{ role: 'user', content: 'hi' }] }, { maxTokens: 50, apiKey: 'k', fetchImpl: f })
  assert.deepEqual(r, { ok: true, text: 'hello' })
  const sent = JSON.parse(f.calls[0].init.body)
  assert.equal(sent.model, AI_MODEL); assert.equal(sent.max_tokens, 50); assert.equal(sent.system, 'sys'); assert.equal(f.calls[0].init.headers['x-api-key'], 'k')
  assert.equal(f.calls.length, 1)
})

test('a route can keep its own model and send content blocks (a PDF)', async () => {
  const f = script([reply(200, okBody)])
  await callClaudeChat({ messages: [{ role: 'user', content: [{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: 'AAA' } }, { type: 'text', text: 'read' }] }] }, { maxTokens: 10, apiKey: 'k', model: 'claude-sonnet-4-6', fetchImpl: f })
  const sent = JSON.parse(f.calls[0].init.body)
  assert.equal(sent.model, 'claude-sonnet-4-6'); assert.equal(sent.messages[0].content[0].type, 'document')
})

test('busy twice then fine: the person never sees an error', async () => {
  const f = script([reply(529, { error: { message: 'Overloaded' } }), reply(429, { error: { message: 'slow down' } }), reply(200, okBody)])
  const sleep = noSleep()
  const r = await callClaude('hi', { maxTokens: 10, apiKey: 'k', fetchImpl: f, sleep })
  assert.deepEqual(r, { ok: true, text: 'hello' }); assert.equal(f.calls.length, 3); assert.deepEqual(sleep.waits, [800, 2500])
})

test('busy every time: gives up after three attempts and says busy', async () => {
  const f = script([reply(529, { error: { message: 'Overloaded' } })])
  const r = await callClaude('hi', { maxTokens: 10, apiKey: 'k', fetchImpl: f, sleep: noSleep() })
  assert.equal(r.ok, false); assert.equal(r.kind, 'busy'); assert.equal(r.status, 529); assert.equal(f.calls.length, 3)
})

test('retry-after is honoured, up to five seconds', async () => {
  const f = script([reply(429, { error: { message: 'slow' } }, { 'retry-after': '2' }), reply(429, { error: { message: 'slow' } }, { 'retry-after': '99' }), reply(200, okBody)])
  const sleep = noSleep()
  await callClaude('hi', { maxTokens: 10, apiKey: 'k', fetchImpl: f, sleep })
  assert.deepEqual(sleep.waits, [2000, 5000])
})

test('things a retry cannot fix are not retried: bad key, no credit, bad model, too large', async () => {
  for (const [status, msg, kind] of [[401, 'invalid x-api-key', 'invalid_key'], [400, 'Your credit balance is too low', 'no_credit'], [404, 'model: nope', 'bad_model'], [413, 'request too large', 'too_large']]) {
    const f = script([reply(status, { error: { message: msg } })])
    const r = await callClaude('hi', { maxTokens: 10, apiKey: 'k', fetchImpl: f, sleep: noSleep() })
    assert.equal(r.kind, kind); assert.equal(f.calls.length, 1, kind + ' must not be retried')
  }
})

test('a dropped connection is retried, then reported as a network problem', async () => {
  const f = script([new Error('fetch failed'), new Error('fetch failed'), new Error('fetch failed')])
  const r = await callClaude('hi', { maxTokens: 10, apiKey: 'k', fetchImpl: f, sleep: noSleep() })
  assert.equal(r.kind, 'network'); assert.equal(f.calls.length, 3)
  const g = script([new Error('fetch failed'), reply(200, okBody)])
  assert.equal((await callClaude('hi', { maxTokens: 10, apiKey: 'k', fetchImpl: g, sleep: noSleep() })).ok, true)
})

test('server errors (500 and 503) are retried; a plain 400 is not', async () => {
  const a = script([reply(503, { error: { message: 'unavailable' } }), reply(200, okBody)])
  assert.equal((await callClaude('hi', { maxTokens: 10, apiKey: 'k', fetchImpl: a, sleep: noSleep() })).ok, true)
  const b = script([reply(400, { error: { message: 'messages: bad' } })])
  const r = await callClaude('hi', { maxTokens: 10, apiKey: 'k', fetchImpl: b, sleep: noSleep() })
  assert.equal(r.kind, 'other'); assert.equal(b.calls.length, 1)
})

test('retries can be switched off', async () => {
  const f = script([reply(529, { error: { message: 'Overloaded' } })])
  const r = await callClaude('hi', { maxTokens: 10, apiKey: 'k', fetchImpl: f, retries: 0 })
  assert.equal(r.ok, false); assert.equal(f.calls.length, 1)
})

test('a timeout aborts the attempt and is reported as a timeout', async () => {
  const slow = async (url, init) => new Promise((_, reject) => init.signal.addEventListener('abort', () => { const e = new Error('This operation was aborted'); e.name = 'AbortError'; reject(e) }))
  const r = await callClaude('hi', { maxTokens: 10, apiKey: 'k', fetchImpl: slow, timeoutMs: 20, retries: 0 })
  assert.equal(r.ok, false); assert.equal(r.kind, 'timeout')
})

test('a reply with no text (for example declined) is reported once, not retried', async () => {
  const f = script([reply(200, { content: [], stop_reason: 'refusal' })])
  const r = await callClaude('hi', { maxTokens: 10, apiKey: 'k', fetchImpl: f, sleep: noSleep() })
  assert.equal(r.ok, false); assert.equal(r.status, 502); assert.match(r.message, /refusal/); assert.equal(f.calls.length, 1)
})

test('text after a non-text block is still found', async () => {
  const f = script([reply(200, { content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: 'answer' }] })])
  assert.deepEqual(await callClaude('hi', { maxTokens: 10, apiKey: 'k', fetchImpl: f }), { ok: true, text: 'answer' })
})

test('a long call that timed out is not retried (no time left); a short one is', async () => {
  const slow = (n) => async (url, init) => { n.c++; return new Promise((_, reject) => init.signal.addEventListener('abort', () => { const e = new Error('aborted'); e.name = 'AbortError'; reject(e) })) }
  const a = { c: 0 }
  // timeoutMs above a minute: stub the timer by using a tiny real timeout is not possible, so check the rule through classification of a thrown abort
  const longRes = await callClaude('hi', { maxTokens: 10, apiKey: 'k', fetchImpl: async () => { a.c++; const e = new Error('aborted'); e.name = 'AbortError'; throw e }, timeoutMs: 61_000, sleep: noSleep() })
  assert.equal(longRes.kind, 'timeout'); assert.equal(a.c, 1)
  const b = { c: 0 }
  const shortRes = await callClaude('hi', { maxTokens: 10, apiKey: 'k', fetchImpl: async () => { b.c++; const e = new Error('aborted'); e.name = 'AbortError'; throw e }, timeoutMs: 20_000, sleep: noSleep() })
  assert.equal(shortRes.kind, 'timeout'); assert.equal(b.c, 3)
  void slow
})
