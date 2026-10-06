// Run: node --import ./scripts/tests/essay-marking/resolve-ts.mjs --experimental-strip-types --no-warnings --test scripts/tests/learning-levels/checkLevelsPure.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { orderLevels, isLevel, findTopicFor, suggestLevel, startingLevel, difficultyFor, draftsToCheckRows, levelCounts, MAX_PER_LEVEL } from '../../../src/lib/checkLevelsPure.ts'

const topic = (o = {}) => ({ name: 'Fractions', subject: 'Mathematics', pct: 60, questions: 5, ...o })

test('levels are always in the order support, core, stretch and nothing else gets through', () => {
  assert.deepEqual(orderLevels(['stretch', 'support', 'core']), ['support', 'core', 'stretch'])
  assert.deepEqual(orderLevels(['stretch', 'expert', 7, null]), ['stretch'])
  assert.deepEqual(orderLevels(null), []); assert.deepEqual(orderLevels('core'), [])
  assert.equal(isLevel('core'), true); assert.equal(isLevel('Core'), false); assert.equal(isLevel(undefined), false)
})

test('the suggestion follows the topic result: needs work -> support, strong -> stretch, otherwise core', () => {
  assert.equal(suggestLevel(topic({ pct: 30 })).level, 'support')
  assert.equal(suggestLevel(topic({ pct: 49 })).level, 'support')
  assert.equal(suggestLevel(topic({ pct: 50 })).level, 'core')
  assert.equal(suggestLevel(topic({ pct: 74 })).level, 'core')
  assert.equal(suggestLevel(topic({ pct: 75 })).level, 'stretch')
  assert.equal(suggestLevel(topic({ pct: 100 })).level, 'stretch')
})

test('with too little work on the topic, or no topic at all, the suggestion is core and says why', () => {
  assert.equal(suggestLevel(topic({ pct: 10, questions: 2 })).level, 'core')
  assert.match(suggestLevel(topic({ pct: 10, questions: 2 })).reason, /not enough/)
  assert.equal(suggestLevel(null).level, 'core')
})

test('the reason names the topic and the score, so a student is never left guessing', () => {
  const s = suggestLevel(topic({ pct: 38 }))
  assert.match(s.reason, /38%/); assert.match(s.reason, /Fractions/)
})

test('the lesson topic is found by name and subject, ignoring capitals and spacing, and not by name alone across subjects', () => {
  const topics = [topic({ name: 'Cells', subject: 'Biology' }), topic({ name: 'Cells', subject: 'Integrated Science', pct: 20 }), topic()]
  assert.equal(findTopicFor(topics, { name: '  fractions ', subject: 'MATHEMATICS' }).name, 'Fractions')
  assert.equal(findTopicFor(topics, { name: 'Cells', subject: 'integrated  science' }).pct, 20)
  assert.equal(findTopicFor(topics, { name: 'Algebra', subject: 'Mathematics' }), null)
  assert.equal(findTopicFor(topics, null), null); assert.equal(findTopicFor([], { name: 'x', subject: 'y' }), null)
})

test('the level a student opens first: the suggestion if the lesson has it, else core, else the first it has', () => {
  assert.equal(startingLevel(['support', 'core', 'stretch'], 'support'), 'support')
  assert.equal(startingLevel(['core', 'stretch'], 'support'), 'core')
  assert.equal(startingLevel(['support', 'stretch'], 'core'), 'support')
  assert.equal(startingLevel(['stretch'], 'support'), 'stretch')
  assert.equal(startingLevel([], 'stretch'), 'core')
})

test('drafting difficulty follows the level', () => {
  assert.equal(difficultyFor('support'), 'easier'); assert.equal(difficultyFor('core'), 'standard'); assert.equal(difficultyFor('stretch'), 'harder')
})

const mc = (q, correctIndex = 1) => ({ type: 'multiple_choice', question: q, options: [' a ', 'b', 'c', 'd'], correctIndex })
test('AI drafts become check rows: multiple choice only, trimmed, at the chosen level, numbered after the existing ones', () => {
  const rows = draftsToCheckRows([mc(' Q1 '), { type: 'essay', question: 'E', points: [] }, { type: 'true_false', question: 'T', answer: true }, mc('Q2', 3)], 'support', 4, 10)
  assert.equal(rows.length, 2)
  assert.deepEqual(rows[0], { kind: 'multiple_choice', prompt: 'Q1', options: ['a', 'b', 'c', 'd'], correct_index: 1, explanation: '', level: 'support', position: 4 })
  assert.equal(rows[1].position, 5); assert.equal(rows[1].correct_index, 3)
})

test('no more rows than there is room for at that level, and positions never pass 50', () => {
  const many = Array.from({ length: 6 }, (_, i) => mc('Q' + i))
  assert.equal(draftsToCheckRows(many, 'core', 1, 3).length, 3)
  assert.equal(draftsToCheckRows(many, 'core', 1, 0).length, 0)
  assert.equal(draftsToCheckRows(many, 'core', 49, 6).at(-1).position, 50)
  assert.equal(MAX_PER_LEVEL, 10)
})

test('counting questions per level treats a missing level as core', () => {
  assert.deepEqual(levelCounts([{ level: 'support' }, { level: 'core' }, {}, { level: 'weird' }, { level: 'stretch' }, { level: 'stretch' }]), { support: 1, core: 3, stretch: 2 })
})
