import test from 'node:test'
import assert from 'node:assert/strict'
import { cleanPage, buildChunks, headingGrade, parseGrades } from '../../lib/curriculumChunks.mjs'

test('page furniture is removed and split words are rejoined', () => {
  const lines = cleanPage('56\n© Ministry of Education and Youth, NSC Civics Grades 7-9\nStudents will docu-\nment the plan.\nNATIONAL STANDARDS CURRICULUM\n  Second   line  ')
  assert.deepEqual(lines, ['Students will document the plan.', 'Second line'])
})
test('a heading names the grade', () => {
  assert.equal(headingGrade('GRADE 7, TERM 1, UNIT 2'), 7); assert.equal(headingGrade('Grade 9 Unit 4'), 9); assert.equal(headingGrade('UNIT 2'), null); assert.equal(headingGrade('Upgrade 7'), null)
})
test('grades parse from a range or a single grade, and only 7 to 13', () => {
  assert.deepEqual(parseGrades('7-9'), [7, 9]); assert.deepEqual(parseGrades('8'), [8, 8]); assert.deepEqual(parseGrades('10 to 11'), [10, 11])
  assert.equal(parseGrades('6'), null); assert.equal(parseGrades('9-7'), null); assert.equal(parseGrades('abc'), null)
})
const sentence = (n) => `Students will explore idea number ${n} and explain it in their own words using local examples. `
const longText = (start, n) => Array.from({ length: n }, (_, i) => sentence(start + i)).join('')
test('text is cut into pieces of about 2,000 characters, none above the limit, and no text is lost', () => {
  const pages = [longText(1, 40), longText(41, 40)]
  const chunks = buildChunks(pages)
  assert.ok(chunks.length >= 3)
  for (const c of chunks) assert.ok(c.content.length <= 2400, `chunk ${c.position} is ${c.content.length}`)
  const joined = chunks.map((c) => c.content).join(' ').replace(/\s+/g, ' ')
  for (const n of [1, 20, 40, 41, 80]) assert.ok(joined.includes(`idea number ${n} `), `idea ${n} was lost`)
  assert.deepEqual(chunks.map((c) => c.position), chunks.map((_, i) => i))
})
test('each piece records its pages, and the grade and heading the text sits under', () => {
  const pages = [
    `GRADE 7, TERM 1, UNIT 1\n${longText(1, 12)}`,
    `${longText(13, 12)}`,
    `GRADE 8, TERM 1, UNIT 3\n${longText(25, 12)}`,
  ]
  const chunks = buildChunks(pages)
  assert.equal(chunks[0].grade, 7); assert.equal(chunks[0].heading, 'GRADE 7, TERM 1, UNIT 1'); assert.equal(chunks[0].page_from, 1)
  const g8 = chunks.filter((c) => c.grade === 8)
  assert.ok(g8.length > 0); assert.ok(g8.every((c) => c.heading === 'GRADE 8, TERM 1, UNIT 3' && c.page_from >= 3))
  assert.ok(chunks.some((c) => c.grade === 7 && c.page_from <= 2 && c.page_to >= 2))   // page 2 has no heading of its own and stays in Grade 7
})
test('a guide with no grade headings gives pieces with no grade, and near-empty pages are skipped', () => {
  const chunks = buildChunks(['Cover', longText(1, 10), '', 'Page 3'])
  assert.ok(chunks.length >= 1); assert.ok(chunks.every((c) => c.grade === null && c.heading === null))
  assert.ok(chunks.every((c) => c.page_from === 2))
})
test('a very long single paragraph is split at sentence ends, not mid-word', () => {
  const chunks = buildChunks([sentence(1).repeat(80)])
  assert.ok(chunks.length >= 3); for (const c of chunks) assert.ok(c.content.length <= 2400); assert.ok(chunks.every((c) => /[.]$/.test(c.content)))
})
test('a mention of a grade outside the guide\'s range is not taken as a section', () => {
  const chunks = buildChunks([`GRADE 7, TERM 1, UNIT 1\n${longText(1, 6)}`, `GRADE 10 students may extend this work\n${longText(7, 6)}`], { gradeFrom: 7, gradeTo: 9 })
  assert.ok(chunks.every((c) => c.grade === 7))
})
test('a sentence that begins with the word unit is not a heading', () => {
  const chunks = buildChunks([`unit. It may also include information that gives more detail.\n${longText(1, 8)}`])
  assert.equal(chunks[0].heading, null)
  const real = buildChunks([`UNIT TITLE: Valuing heritage\n${longText(1, 8)}`, `Unit 4: Parts of speech\n${longText(9, 8)}`])
  assert.equal(real[0].heading, 'UNIT TITLE: Valuing heritage'); assert.ok(real.some((c) => c.heading === 'Unit 4: Parts of speech'))
})
