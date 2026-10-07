import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseVideoLink, embedUrl, thumbnailUrl, gradeLabel, forGrade, subjectsOf, bySubject, splitForStaff, defaultLowData } from '../../../src/lib/videosPure.ts'

const cases = JSON.parse(readFileSync(new URL('./links.json', import.meta.url), 'utf8'))

test('every link in the shared list parses (or is refused) as expected', () => {
  for (const c of cases) {
    const p = parseVideoLink(c.url)
    if (c.provider === null) { assert.equal(p, null, `should refuse: ${c.url}`); continue }
    assert.ok(p, `should accept: ${c.url}`)
    assert.equal(p.provider, c.provider, c.url); assert.equal(p.url, c.norm, c.url)
    if (c.id !== undefined) assert.equal(p.id, c.id, c.url)
  }
})
test('players are built from the checked id only', () => {
  assert.equal(embedUrl({ provider: 'youtube', external_id: 'dQw4w9WgXcQ' }), 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&playsinline=1&modestbranding=1&autoplay=1')
  assert.equal(embedUrl({ provider: 'vimeo', external_id: '123456789' }), 'https://player.vimeo.com/video/123456789?autoplay=1&dnt=1')
  assert.equal(embedUrl({ provider: 'khan', external_id: 'abc' }), null)
  assert.equal(embedUrl({ provider: 'youtube', external_id: 'x"onload="alert(1)' }), null)
  assert.equal(thumbnailUrl({ provider: 'youtube', external_id: 'dQw4w9WgXcQ' }), 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg'); assert.equal(thumbnailUrl({ provider: 'vimeo', external_id: '123456789' }), null)
})
test('grade wording and matching', () => {
  assert.equal(gradeLabel(null, null), 'All grades'); assert.equal(gradeLabel(9, 9), 'Grade 9'); assert.equal(gradeLabel(7, 9), 'Grades 7 to 9'); assert.equal(gradeLabel(10, null), 'Grade 10 and up'); assert.equal(gradeLabel(null, 8), 'Up to Grade 8')
  assert.ok(forGrade({ grade_from: null, grade_to: null }, 9)); assert.ok(forGrade({ grade_from: 7, grade_to: 9 }, 9)); assert.ok(!forGrade({ grade_from: 7, grade_to: 8 }, 9)); assert.ok(!forGrade({ grade_from: 10, grade_to: null }, 9)); assert.ok(forGrade({ grade_from: 10, grade_to: null }, null))
})
const v = (o) => ({ id: 'x', provider: 'youtube', external_id: 'dQw4w9WgXcQ', url: '', title: 't', note: null, subject: 'Mathematics', topic_id: null, topic: null, grade_from: null, grade_to: null, added_by: 'a', added_by_name: 'A', status: 'approved', created_at: '', reports: 0, can_edit: false, can_manage: false, ...o })
test('subjects are listed once whatever the capitals, and filtering ignores them', () => {
  const vs = [v({ subject: 'Mathematics' }), v({ subject: 'mathematics ' }), v({ subject: 'English Language' })]
  assert.deepEqual(subjectsOf(vs), ['English Language', 'Mathematics']); assert.equal(bySubject(vs, 'MATHEMATICS').length, 2); assert.equal(bySubject(vs, '').length, 3)
})
test('staff see only what they may decide as waiting, plus what they added', () => {
  const vs = [v({ id: '1', status: 'pending', can_manage: true }), v({ id: '2', status: 'pending', can_manage: false, added_by: 'me' }), v({ id: '3', status: 'hidden', can_manage: true, reports: 2 }), v({ id: '4' })]
  const s = splitForStaff(vs, 'me')
  assert.deepEqual(s.pending.map((x) => x.id), ['1']); assert.deepEqual(s.hidden.map((x) => x.id), ['3']); assert.deepEqual(s.approved.map((x) => x.id), ['4']); assert.deepEqual(s.mine.map((x) => x.id), ['2'])
})
test('low-data defaults', () => {
  assert.equal(defaultLowData(null), false); assert.equal(defaultLowData({ saveData: true }), true); assert.equal(defaultLowData({ effectiveType: '3g' }), true); assert.equal(defaultLowData({ effectiveType: '4g' }), false)
})
