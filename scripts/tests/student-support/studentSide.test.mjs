import test from 'node:test'
import assert from 'node:assert/strict'
import { myProgress } from '../../../src/lib/myProgressPure.ts'
import { studentNudges } from '../../../src/lib/studentNudgesPure.ts'
import { readFileSync } from 'node:fs'

const r = (subject, pct, d) => ({ subject, pct, at: `2026-0${d}-15T10:00:00Z` })

test('with no results the page waits for the first one', () => { const p = myProgress([]); assert.equal(p.subjects.length, 0); assert.match(p.overall.headline, /will show here/) })
test('a first result is welcomed, not judged', () => { const p = myProgress([r('Mathematics', 48, 5)]); assert.match(p.subjects[0].message, /first Mathematics result is 48%/); assert.equal(p.subjects[0].trend, null) })
test('the latest three results are compared with the ones before them', () => {
  const p = myProgress([r('Mathematics', 40, 1), r('Mathematics', 45, 2), r('Mathematics', 60, 3), r('Mathematics', 62, 4), r('Mathematics', 64, 5)])
  const s = p.subjects[0]; assert.equal(s.earlierAvg, 42.5); assert.equal(Math.round(s.recentAvg), 62); assert.equal(s.trend, 'up'); assert.equal(s.first, 40); assert.equal(s.latest, 64); assert.equal(s.best, 64)
  assert.match(s.message, /up 20 points on before/)
})
test('a fall is described kindly', () => {
  const s = myProgress([r('English', 70, 1), r('English', 72, 2), r('English', 60, 3), r('English', 58, 4), r('English', 59, 5)]).subjects[0]
  assert.equal(s.trend, 'down'); assert.match(s.message, /a little lower than before/); assert.doesNotMatch(s.message, /fail|bad|poor/i)
})
test('with only two or three results, the latest half is compared with the first, so a fall is not missed', () => {
  const s = myProgress([r('English', 70, 1), r('English', 64, 2), r('English', 58, 3)]).subjects[0]
  assert.equal(s.recentAvg, 61); assert.equal(s.earlierAvg, 70); assert.equal(s.trend, 'down')
  assert.equal(myProgress([r('English', 50, 1), r('English', 60, 2)]).subjects[0].trend, 'up')
})
test('within three points is steady', () => assert.equal(myProgress([r('Science', 60, 1), r('Science', 61, 2), r('Science', 59, 3), r('Science', 62, 4)]).subjects[0].trend, 'steady'))
test('subjects are kept apart and listed alphabetically; the chart series is oldest first', () => {
  const p = myProgress([r('Science', 50, 2), r('Mathematics', 40, 1), r('Mathematics', 55, 3)])
  assert.deepEqual(p.subjects.map((s) => s.subject), ['Mathematics', 'Science']); assert.deepEqual(p.subjects[0].series, [40, 55])
})
test('the progress page logic takes only the student\'s own results (no benchmark or classmate data can reach it)', () => {
  const src = readFileSync(new URL('../../../src/lib/myProgressPure.ts', import.meta.url), 'utf8') + readFileSync(new URL('../../../src/lib/studentNudgesPure.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(src, /school_avg|schoolAvg|benchmark|classmate|supportPure|support_students/)
})

const base = { absentDays: 0, lessonsOverdue: 0, daysSinceActive: 1, hasLessons: true, cardsDue: 0, weakTopic: null }
test('nothing to say means no nudges', () => assert.deepEqual(studentNudges(base), []))
test('being away, overdue lessons and a quiet spell each get a kind nudge with somewhere to go', () => {
  const n = studentNudges({ ...base, absentDays: 3, lessonsOverdue: 2, daysSinceActive: 9 })
  assert.deepEqual(n.map((x) => x.id), ['away', 'overdue', 'quiet']); assert.match(n[0].text, /away 3 days recently/); assert.match(n[1].text, /2 lessons are past the date/); assert.equal(n[0].href, '/learning')
})
test('at most three, most useful first', () => {
  const n = studentNudges({ ...base, absentDays: 2, lessonsOverdue: 1, daysSinceActive: 8, cardsDue: 9, weakTopic: 'Ratios' })
  assert.equal(n.length, 3); assert.deepEqual(n.map((x) => x.id), ['away', 'overdue', 'quiet'])
})
test('one overdue lesson reads correctly, and a student with no lessons is not told to study', () => {
  assert.match(studentNudges({ ...base, lessonsOverdue: 1 })[0].text, /1 lesson is past the date/)
  assert.deepEqual(studentNudges({ ...base, hasLessons: false, daysSinceActive: 30 }), [])
})
test('a weak topic and flashcards are suggested', () => {
  const n = studentNudges({ ...base, cardsDue: 6, weakTopic: 'Simple interest' })
  assert.deepEqual(n.map((x) => x.id), ['cards', 'topic']); assert.match(n[1].text, /Simple interest is your next step/)
})
test('no nudge ever mentions other students or the school', () => {
  const all = studentNudges({ absentDays: 5, lessonsOverdue: 5, daysSinceActive: 20, hasLessons: true, cardsDue: 20, weakTopic: 'Ratios' }).map((x) => x.text).join(' ')
  assert.doesNotMatch(all, /class|everyone|average|school|others|behind/i)
})
