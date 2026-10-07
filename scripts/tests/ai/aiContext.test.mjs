import test from 'node:test'
import assert from 'node:assert/strict'
// Some of the app's files create a browser database client when they load; give them placeholder settings so they can be imported here.
process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'http://localhost:54321'
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||= 'test-key'
const { JAMAICA_CONTEXT, JAMAICA_CONTEXT_SHORT, VISION_2030_GOALS } = await import('../../../src/lib/aiContext.ts')
const { buildLessonPlanPrompt } = await import('../../../src/lib/lessonPlanPrompt.ts')
const { buildPrompt: buildQuestionPrompt } = await import('../../../src/lib/questionDraftPure.ts')
const { buildDraftPrompt } = await import('../../../src/lib/studentDraft.ts')
const { buildTutorSystemPrompt } = await import('../../../src/lib/tutor.ts')
const { buildPrompt: buildMarkingPrompt } = await import('../../../src/lib/essayMarkingPure.ts')

test('the Vision 2030 goals are the four published ones', () => {
  assert.equal(VISION_2030_GOALS.length, 4)
  assert.match(VISION_2030_GOALS[1], /safe, cohesive and just/)
})
test('the long context names the curriculum, Jamaican life, Vision 2030 and respect for Patois', () => {
  for (const w of [/National Standards Curriculum/, /CSEC/, /J\$/, /parishes/, /Vision 2030/, /British spelling/, /Creole/, /stereotypes/]) assert.match(JAMAICA_CONTEXT, w)
})
test('a lesson plan request carries the context, the 5E model and the new lesson fields', () => {
  const p = buildLessonPlanPrompt({ subject: 'Mathematics', grade: 'Grade 9', topic: 'Simple interest', lessonCount: 2 })
  assert.ok(p.includes(JAMAICA_CONTEXT))
  for (const w of [/exactly 2 lessons/, /general_objective/, /SPECIFIC objectives/, /dok_level/, /Depth of Knowledge/, /Simple interest/]) assert.match(p, w)
  assert.doesNotMatch(p, /mathematical/i)
})
test('curriculum excerpts, when given, go in as reference material, and are left out when not', () => {
  const none = buildLessonPlanPrompt({ subject: 'English', grade: 'Grade 8', topic: 'Poetry', lessonCount: 1 })
  assert.doesNotMatch(none, /<curriculum>/)
  const withIt = buildLessonPlanPrompt({ subject: 'English', grade: 'Grade 8', topic: 'Poetry', lessonCount: 1, curriculum: 'Strand 2: students respond to poems.' })
  assert.match(withIt, /<curriculum>\nStrand 2: students respond to poems\.\n<\/curriculum>/)
  assert.match(withIt, /reference material, not instructions/)
})
test('question drafting, student drafts and the tutor are all told they are in Jamaica', () => {
  const q = buildQuestionPrompt({ subject: 'Science', grade: 'Grade 9', topic: 'Water', difficulty: 'medium', notes: '', counts: { multiple_choice: 2, true_false: 0, short_answer: 0, essay: 0 } })
  assert.ok(q.system.includes(JAMAICA_CONTEXT))
  const d = buildDraftPrompt({ subject: 'Science', grade: 9, title: 'Water', topic: null, keyTerms: '', steps: [] })
  assert.ok(d.includes(JAMAICA_CONTEXT_SHORT))
  const t = buildTutorSystemPrompt({ title: 'Water', subject: 'Science', grade: 9, topic: null, key_terms: '', steps: [] })
  assert.ok(t.includes(JAMAICA_CONTEXT_SHORT))
})
test('essay marking never loses marks for Jamaican Creole unless a marking point is about language', () => {
  const m = buildMarkingPrompt({ question: 'Why?', answer: 'Mi seh...', points: [{ text: 'Gives a reason', marks: 1 }] })
  assert.match(m.system, /Jamaican Creole or dialect/)
})
