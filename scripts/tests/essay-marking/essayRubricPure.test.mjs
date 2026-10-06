// Tests for src/lib/essayRubricPure.ts. Run:  node --experimental-strip-types --no-warnings --test scripts/tests/essay-marking/essayRubricPure.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkRubric, cleanRubric, parseStoredRubric, rubricTotal, writtenPoints, RUBRIC_LIMITS } from '../../../src/lib/essayRubricPure.ts'

test('no marking points is allowed: blank rows are ignored', () => {
  assert.equal(checkRubric([{ text: '', marks: 1 }]), null)
  assert.equal(cleanRubric([{ text: '   ', marks: 1 }]), null)
  assert.equal(checkRubric([]), null)
  assert.equal(cleanRubric([]), null)
})

test('a good list is accepted, trimmed and totalled', () => {
  const rows = [{ text: '  Simple interest uses the original amount ', marks: '2' }, { text: 'Compound interest adds earlier interest', marks: 2 }, { text: '', marks: 1 }]
  assert.equal(checkRubric(rows), null)
  const clean = cleanRubric(rows)
  assert.deepEqual(clean, [{ text: 'Simple interest uses the original amount', marks: 2 }, { text: 'Compound interest adds earlier interest', marks: 2 }])
  assert.equal(rubricTotal(clean), 4)
})

test('marks must be whole numbers from 1 to 20', () => {
  assert.match(checkRubric([{ text: 'a', marks: 0 }]), /whole number of marks/)
  assert.match(checkRubric([{ text: 'a', marks: '' }]), /whole number of marks/)
  assert.match(checkRubric([{ text: 'a', marks: 1.5 }]), /whole number of marks/)
  assert.match(checkRubric([{ text: 'a', marks: 'abc' }]), /whole number of marks/)
  assert.match(checkRubric([{ text: 'a', marks: -2 }]), /whole number of marks/)
  assert.match(checkRubric([{ text: 'a', marks: 21 }]), /too many marks/)
  assert.equal(checkRubric([{ text: 'a', marks: 20 }]), null)
})

test('the error names the point that is wrong, counting only written points', () => {
  const msg = checkRubric([{ text: '', marks: 1 }, { text: 'first', marks: 2 }, { text: 'second', marks: 0 }])
  assert.match(msg, /Marking point 2 /)
})

test('limits on count, length and total', () => {
  const many = Array.from({ length: RUBRIC_LIMITS.maxPoints + 1 }, (_, i) => ({ text: 'p' + i, marks: 1 }))
  assert.match(checkRubric(many), /at most 12/)
  assert.equal(checkRubric(many.slice(0, 12)), null)
  assert.match(checkRubric([{ text: 'x'.repeat(301), marks: 1 }]), /too long/)
  assert.equal(checkRubric([{ text: 'x'.repeat(300), marks: 1 }]), null)
  const heavy = Array.from({ length: 6 }, (_, i) => ({ text: 'p' + i, marks: 20 }))
  assert.match(checkRubric(heavy), /add up to 120/)
})

test('reading back from the database is forgiving', () => {
  assert.deepEqual(parseStoredRubric(null), [])
  assert.deepEqual(parseStoredRubric('nope'), [])
  assert.deepEqual(parseStoredRubric({ a: 1 }), [])
  assert.deepEqual(parseStoredRubric([{ text: ' ok ', marks: 3 }, { text: '', marks: 1 }, { text: 'bad', marks: 'x' }, null, 5, { text: 'zero', marks: 0 }]), [{ text: 'ok', marks: 3 }])
})

test('writtenPoints keeps marks as typed so the check can explain', () => {
  assert.deepEqual(writtenPoints([{ text: ' a ', marks: '3' }, { text: '', marks: 2 }]), [{ text: 'a', marks: '3' }])
})
