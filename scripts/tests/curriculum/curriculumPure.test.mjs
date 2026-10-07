import test from 'node:test'
import assert from 'node:assert/strict'
process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'http://localhost:54321'
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||= 'test-key'
const { formatExcerpts, describeSources, searchQuery } = await import('../../../src/lib/curriculumPure.ts')
const { buildLessonPlanPrompt } = await import('../../../src/lib/lessonPlanPrompt.ts')

const row = (o = {}) => ({ title: 'Civics Guide', subject: 'Civics', page_from: 61, page_to: 62, grade: 7, heading: 'UNIT TITLE: VALUING HERITAGE', content: 'Students will examine how Free Villages such as Sturge Town were founded.', rank: 0.3, ...o })

test('excerpts are labelled with the guide, the pages and the unit', () => {
  const r = formatExcerpts([row()])
  assert.match(r.text, /^\[Civics Guide, pages 61 to 62, UNIT TITLE: VALUING HERITAGE\]\nStudents will examine/)
  assert.deepEqual(r.sources, [{ title: 'Civics Guide', pages: 'pages 61 to 62' }])
})
test('a single page reads "page 5", and a piece with no page numbers has no page text', () => {
  assert.match(formatExcerpts([row({ page_from: 5, page_to: 5 })]).text, /page 5,/)
  assert.deepEqual(formatExcerpts([row({ page_from: null, page_to: null })]).sources, [{ title: 'Civics Guide', pages: '' }])
})
test('the total is capped, whole pieces only, and the best piece is always kept', () => {
  const big = (n) => row({ page_from: n, page_to: n, content: 'x'.repeat(2000) })
  const r = formatExcerpts([big(1), big(2), big(3), big(4), big(5)], 5000)
  assert.equal(r.sources.length, 2); assert.ok(r.text.length <= 5000)
  assert.equal(formatExcerpts([row({ content: 'y'.repeat(4000) })], 100).sources.length, 1)      // even a piece over the cap is kept if it is the only one (trimmed to 2,200)
  assert.ok(formatExcerpts([row({ content: 'y'.repeat(4000) })], 100).text.length < 2400)
})
test('empty pieces are skipped and nothing found gives empty text', () => {
  assert.deepEqual(formatExcerpts([row({ content: '   ' })]), { text: '', sources: [] })
  assert.deepEqual(formatExcerpts([]), { text: '', sources: [] })
})
test('the "lined up with" list names each guide once with its pages', () => {
  assert.deepEqual(describeSources([{ title: 'A', pages: 'page 3' }, { title: 'A', pages: 'pages 5 to 6' }, { title: 'B', pages: '' }, { title: 'A', pages: 'page 3' }]), ['A (page 3; pages 5 to 6)', 'B'])
})
test('the search words are the topic, then the focus question and attainment target', () => {
  assert.equal(searchQuery({ topic: ' Free  villages ', focusQuestion: 'Why were they founded?', attainmentTarget: '' }), 'Free villages Why were they founded?')
  assert.equal(searchQuery({ topic: 'x'.repeat(900) }).length, 400)
})
test('curriculum text goes into the lesson prompt as reference material, with the rule not to invent outcomes', () => {
  const ex = formatExcerpts([row()])
  const p = buildLessonPlanPrompt({ subject: 'Civics', grade: 'Grade 7', topic: 'Free villages', lessonCount: 1, curriculum: ex.text })
  assert.match(p, /<curriculum>\n\[Civics Guide, pages 61 to 62/)
  assert.match(p, /rather than inventing any/)
  assert.ok(p.indexOf('<curriculum>') < p.indexOf('Draft a unit plan'))
})
