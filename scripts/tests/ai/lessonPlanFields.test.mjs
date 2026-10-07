import test from 'node:test'
import assert from 'node:assert/strict'
process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'http://localhost:54321'
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||= 'test-key'
const { cleanLesson, emptyLesson, normalizeGeneratedPlan, dokLabel, DOK_LEVELS, LESSON_FIELDS, UNIT_FIELDS } = await import('../../../src/lib/lessonPlan.ts')
const { lessonRows, overviewRows } = await import('../../../src/lib/lessonPlanContent.ts')

test('there are four DOK levels with plain names', () => {
  assert.deepEqual(DOK_LEVELS.map((d) => d.level), ['1', '2', '3', '4'])
  assert.equal(dokLabel('3'), 'DOK 3: Strategic thinking'); assert.equal(dokLabel(''), ''); assert.equal(dokLabel('7'), '')
})
test('the DOK level the AI writes is cleaned to a single digit 1 to 4, or dropped', () => {
  assert.equal(cleanLesson({ dok_level: '3' }).dok_level, '3')
  assert.equal(cleanLesson({ dok_level: 'DOK 2' }).dok_level, '2')
  assert.equal(cleanLesson({ dok_level: ' 4 ' }).dok_level, '4')
  assert.equal(cleanLesson({ dok_level: '5' }).dok_level, '')
  assert.equal(cleanLesson({ dok_level: 'high' }).dok_level, '')
  assert.equal(cleanLesson({}).dok_level, '')
})
test('a lesson has a general objective, specific objectives and a DOK level, in that order, before the 5E steps', () => {
  const keys = LESSON_FIELDS.map((f) => f.key)
  assert.deepEqual(keys.slice(0, 4), ['general_objective', 'learning_objectives', 'dok_level', 'engage'])
  assert.equal(LESSON_FIELDS[1].label, 'Specific Objectives')
  assert.deepEqual(Object.keys(emptyLesson()).slice(0, 4), ['title', 'general_objective', 'learning_objectives', 'dok_level'])
})
test('plans saved before these fields existed still open, with the new fields empty', () => {
  const old = cleanLesson({ title: 'Old', learning_objectives: 'Students should be able to: add', engage: 'x' })
  assert.equal(old.general_objective, ''); assert.equal(old.dok_level, ''); assert.equal(old.learning_objectives, 'Students should be able to: add')
})
test('an AI draft with the new fields goes through intact', () => {
  const plan = normalizeGeneratedPlan({ lessons: [{ title: 'L1', general_objective: 'Understand interest', learning_objectives: 'Students should be able to: a', dok_level: '2' }] }, 1)
  assert.equal(plan.lessons[0].general_objective, 'Understand interest'); assert.equal(plan.lessons[0].dok_level, '2')
})
test('the downloads show the DOK level in words, and no field is called Mathematical', () => {
  const rows = lessonRows(cleanLesson({ general_objective: 'Aim', learning_objectives: 'Spec', dok_level: '3' }))
  assert.deepEqual(rows.slice(0, 3), [['General Objective', 'Aim'], ['Specific Objectives', 'Spec'], ['Depth of Knowledge (DOK) level', 'DOK 3: Strategic thinking']])
  assert.ok(UNIT_FIELDS.every((f) => !/mathematical/i.test(f.label)))
  const ov = overviewRows({ subject: 'Mathematics', grade: 'Grade 9', topic: 'Interest', subject_practices: 'Reasoning' })
  assert.ok(ov.some(([l]) => l === 'Subject Practices')); assert.ok(ov.every(([l]) => !/mathematical/i.test(l)))
})
