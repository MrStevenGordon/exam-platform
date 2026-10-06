import test from 'node:test'
import assert from 'node:assert/strict'
import { parseAiJson } from '../../../src/lib/aiJson.ts'
import { normalizeGeneratedPlan } from '../../../src/lib/lessonPlan.ts'

const ok = (r) => { assert.equal(r.ok, true, JSON.stringify(r)); return r }

test('a clean reply is read as it is and flagged as not repaired', () => {
  const r = ok(parseAiJson('{"a": "x", "b": [1, 2]}'))
  assert.deepEqual(r.value, { a: 'x', b: [1, 2] }); assert.equal(r.repaired, false)
})
test('a code fence and a sentence round the JSON are ignored', () => {
  assert.deepEqual(ok(parseAiJson('Here is the plan:\n```json\n{"a": "x"}\n```\nHope that helps!')).value, { a: 'x' })
})
test('a real line break inside a value (a numbered list) is repaired, not rejected', () => {
  const r = ok(parseAiJson('{"generalObjectives": "1. Add\n2. Subtract\n3. Multiply", "lessons": []}'))
  assert.equal(r.value.generalObjectives, '1. Add\n2. Subtract\n3. Multiply'); assert.equal(r.repaired, true)
})
test('a tab inside a value and a trailing comma are repaired', () => {
  assert.deepEqual(ok(parseAiJson('{"a": "x\ty", "b": [1, 2,], "c": {"d": 1,},}')).value, { a: 'x\ty', b: [1, 2], c: { d: 1 } })
})
test('text after the closing brace is ignored', () => {
  assert.deepEqual(ok(parseAiJson('{"a": 1}\n\nLet me know if you want changes {not json}')).value, { a: 1 })
})
test('braces and quotes inside a value do not confuse it', () => {
  assert.equal(ok(parseAiJson('{"a": "use {x} and \\"y\\" here\nnext"}')).value.a, 'use {x} and "y" here\nnext')
})
test('a reply cut off part way is reported as truncated, not as a vague format error', () => {
  const r = parseAiJson('{"subTopics": "Simple interest", "lessons": [{"title": "One", "engage": "Start with a story abo')
  assert.equal(r.ok, false); assert.equal(r.reason, 'truncated')
})
test('a complete-looking reply the model stopped at max_tokens for is still reported as truncated', () => {
  const r = parseAiJson('{"a": 1}  ', { stopReason: 'max_tokens' })
  assert.equal(r.ok, true) // complete JSON that merely hit the limit is fine
  const t = parseAiJson('{"a": [1, 2', { stopReason: 'max_tokens' })
  assert.equal(t.ok, false); assert.equal(t.reason, 'truncated')
})
test('empty and prose-only replies are rejected with a clear reason', () => {
  assert.equal(parseAiJson('').reason, 'empty')
  assert.equal(parseAiJson('Sorry, I cannot help with that.').reason, 'invalid')
  assert.equal(parseAiJson(null).reason, 'empty')
})
test('an unfixable slip (an unescaped quote in a value) is invalid, never a crash', () => {
  const r = parseAiJson('{"a": "he said "hello" to me"}')
  assert.equal(r.ok, false); assert.equal(r.reason, 'invalid')
})
test('a realistic multi-lesson draft with raw line breaks goes all the way through the plan normaliser', () => {
  const reply = '```json\n{"subTopics": "Simple interest", "prerequisiteKnowledge": "Percentages", "fourCs": "Communication", "subjectPractices": "Reasoning",\n"generalObjectives": "1. Calculate simple interest\n2. Find the rate\n3. Find the time", "keyTermsFormulae": "I = PRT/100", "specificObjective": "Calculate simple interest", "skills": "Calculation", "successCriteria": "I can use I = PRT/100",\n"lessons": [{"title": "Lesson 1", "learning_objectives": "Students should be able to:\n- find interest", "engage": "A savings story", "explore": "Work out 1 year", "explain": "I = PRT/100", "elaborate": "Mixed problems", "evaluate": "Exit ticket", "four_cs": "Collaboration", "resources": "Calculators", "assessment": "Exit ticket"}, {"title": "Lesson 2", "learning_objectives": "Students should be able to:\n- find the rate", "engage": "A loan", "explore": "Rearrange", "explain": "R = 100I/PT", "elaborate": "Practice", "evaluate": "Quiz", "four_cs": "Critical thinking", "resources": "Worksheet", "assessment": "Quiz"}]}\n```'
  const plan = normalizeGeneratedPlan(ok(parseAiJson(reply)).value, 2)
  assert.equal(JSON.stringify(plan).includes('Lesson 2'), true)
})
