// Run: node --import ./scripts/tests/essay-marking/resolve-ts.mjs --experimental-strip-types --no-warnings --test scripts/tests/student-topics/studentTopicsPure.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeTopics, parseRows, levelFor, topicKey, pickPractice, subjectsOf, parseLessons, lessonsForTopic, wantsLessons, RULES } from '../../../src/lib/studentTopicsPure.ts'

// helper: one row in the database's compact shape
const row = (o) => [o.subject ?? 'Maths', o.topicId ?? null, o.topicName ?? null, o.topicText ?? null, o.awarded, o.points ?? 2, o.at ?? '2026-09-01T10:00:00Z', o.exam ?? 'e1', o.q, o.type ?? 'multiple_choice']
const parsed = (rows) => parseRows({ rows: rows.map(row), untagged: 0 }).rows

test('a topic is the marks earned over the marks available, in whole percent', () => {
  const t = computeTopics(parsed([
    { topicId: 'a', topicName: 'Fractions', awarded: 2, q: 'q1' }, { topicId: 'a', topicName: 'Fractions', awarded: 1, q: 'q2' },
    { topicId: 'a', topicName: 'Fractions', awarded: 0, q: 'q3' }, { topicId: 'a', topicName: 'Fractions', awarded: 2, q: 'q4' },
  ]))
  assert.equal(t.length, 1)
  assert.equal(t[0].earned, 5); assert.equal(t[0].available, 8); assert.equal(t[0].pct, 63); assert.equal(t[0].questions, 4)
  assert.equal(t[0].level, 'getting_there')
})

test('levels: under 50 needs work, 75 and over is strong, fewer than 3 questions is not judged', () => {
  assert.equal(levelFor(49, 3), 'weak'); assert.equal(levelFor(50, 3), 'getting_there'); assert.equal(levelFor(74, 9), 'getting_there')
  assert.equal(levelFor(75, 3), 'strong'); assert.equal(levelFor(0, 2), 'too_few'); assert.equal(levelFor(100, 1), 'too_few')
})

test('weakest first, topics that cannot be judged last', () => {
  const t = computeTopics(parsed([
    ...[0, 1, 2].map((i) => ({ topicId: 'strong', topicName: 'Algebra', awarded: 2, q: 's' + i })),
    ...[0, 1, 2].map((i) => ({ topicId: 'weak', topicName: 'Geometry', awarded: 0, q: 'w' + i })),
    { topicId: 'few', topicName: 'Statistics', awarded: 0, q: 'f1' },
  ]))
  assert.deepEqual(t.map((x) => x.name), ['Geometry', 'Algebra', 'Statistics'])
  assert.deepEqual(t.map((x) => x.level), ['weak', 'strong', 'too_few'])
})

test('a free-text topic is matched without regard to case and spacing; the same name in two subjects stays apart', () => {
  assert.equal(topicKey(null, '  Cell  Division '), topicKey(null, 'cell division'))
  const t = computeTopics(parsed([
    ...[1, 2, 3].map((i) => ({ topicText: 'Cell Division', subject: 'Biology', awarded: 2, q: 'b' + i })),
    ...[4, 5, 6].map((i) => ({ topicText: 'cell  division', subject: 'Biology', awarded: 0, q: 'b' + i })),
    ...[1, 2, 3].map((i) => ({ topicText: 'Cell Division', subject: 'Integrated Science', awarded: 2, q: 'i' + i })),
  ]))
  assert.equal(t.length, 2)
  assert.equal(t.find((x) => x.subject === 'Biology').pct, 50)
  assert.equal(t.find((x) => x.subject === 'Integrated Science').pct, 100)
})

test('rows with no topic, bad numbers or no worth are dropped, and marks are held within the question', () => {
  const r = parseRows({ rows: [row({ awarded: 2, q: 'x' }), ['Maths', 'a', 'T', null, 'abc', 2, '2026-01-01', 'e', 'q', 't'], ['Maths', 'a', 'T', null, 1, 0, '2026-01-01', 'e', 'q', 't'], 'junk', row({ topicId: 'a', topicName: 'T', awarded: 9, points: 2, q: 'ok' })], untagged: 4 })
  assert.equal(r.untagged, 4); assert.equal(r.rows.length, 2) // the first has no topic but parse keeps it; computeTopics ignores it
  assert.equal(r.rows[1].awarded, 2)
  assert.equal(computeTopics(r.rows).length, 1)
  assert.deepEqual(parseRows(null), { rows: [], untagged: 0 }); assert.deepEqual(parseRows({ rows: 5 }), { rows: [], untagged: 0 })
})

test('the same question counted once, even if it appears in two exams', () => {
  const t = computeTopics(parsed([
    { topicId: 'a', topicName: 'T', awarded: 2, q: 'q1', exam: 'e1' }, { topicId: 'a', topicName: 'T', awarded: 2, q: 'q1', exam: 'e2' },
    { topicId: 'a', topicName: 'T', awarded: 2, q: 'q2', exam: 'e1' },
  ]))
  assert.equal(t[0].questions, 2); assert.equal(t[0].exams, 2); assert.equal(t[0].level, 'too_few')
})

test('trend: latest exam against the earlier ones, only with enough questions on both sides', () => {
  const mk = (exam, at, awarded, n, prefix) => Array.from({ length: n }, (_, i) => ({ topicId: 'a', topicName: 'T', awarded, q: `${prefix}${i}`, exam, at }))
  const up = computeTopics(parsed([...mk('e1', '2026-06-01T00:00:00Z', 0, 3, 'a'), ...mk('e2', '2026-09-01T00:00:00Z', 2, 2, 'b')]))
  assert.equal(up[0].trend, 'improving')
  const down = computeTopics(parsed([...mk('e1', '2026-06-01T00:00:00Z', 2, 3, 'a'), ...mk('e2', '2026-09-01T00:00:00Z', 0, 2, 'b')]))
  assert.equal(down[0].trend, 'slipping')
  const same = computeTopics(parsed([...mk('e1', '2026-06-01T00:00:00Z', 1, 3, 'a'), ...mk('e2', '2026-09-01T00:00:00Z', 1, 2, 'b')]))
  assert.equal(same[0].trend, 'steady')
  const thin = computeTopics(parsed([...mk('e1', '2026-06-01T00:00:00Z', 0, 3, 'a'), ...mk('e2', '2026-09-01T00:00:00Z', 2, 1, 'b')]))
  assert.equal(thin[0].trend, null)
  const one = computeTopics(parsed(mk('e1', '2026-06-01T00:00:00Z', 1, 4, 'a')))
  assert.equal(one[0].trend, null)
})

test('practice questions never include essays and are unique', () => {
  const t = computeTopics(parsed([
    { topicId: 'a', topicName: 'T', awarded: 0, q: 'q1' }, { topicId: 'a', topicName: 'T', awarded: 0, q: 'q2' },
    { topicId: 'a', topicName: 'T', awarded: 0, q: 'q3', type: 'essay' }, { topicId: 'a', topicName: 'T', awarded: 0, q: 'q1', exam: 'e2' },
  ]))
  assert.deepEqual(t[0].practiceQuestionIds, ['q1', 'q2'])
})

test('pickPractice takes at most the limit, without repeats, from what it is given', () => {
  const ids = Array.from({ length: 25 }, (_, i) => 'q' + i)
  const p = pickPractice(ids)
  assert.equal(p.length, RULES.practiceMax); assert.equal(new Set(p).size, p.length); assert.ok(p.every((x) => ids.includes(x)))
  assert.deepEqual(pickPractice(['a', 'b']).sort(), ['a', 'b']); assert.deepEqual(pickPractice([]), [])
  assert.deepEqual(pickPractice(ids, 3, () => 0).length, 3)
})

test('subjects are listed once, in order', () => {
  const t = computeTopics(parsed([...[1, 2, 3].map((i) => ({ topicId: 'a', topicName: 'A', subject: 'Maths', awarded: 1, q: 'm' + i })), ...[1, 2, 3].map((i) => ({ topicId: 'b', topicName: 'B', subject: 'English', awarded: 1, q: 'e' + i }))]))
  assert.deepEqual(subjectsOf(t), ['English', 'Maths'])
})

test('a topic remembers its id when it came from the school list, and has none when typed as free text', () => {
  const t = computeTopics(parsed([
    ...[1, 2, 3].map((i) => ({ topicId: 'abc', topicName: 'Fractions', awarded: 1, q: 'a' + i })),
    ...[1, 2, 3].map((i) => ({ topicText: 'Percentages', awarded: 1, q: 'b' + i })),
  ]))
  assert.equal(t.find((x) => x.name === 'Fractions').topicId, 'abc'); assert.equal(t.find((x) => x.name === 'Percentages').topicId, null)
})

test('lessons are read safely from the database and matched to a topic by id only', () => {
  const lessons = parseLessons([
    { id: 'l1', title: 'B lesson', subject: 'Maths', topic_id: 't1', done: false }, { id: 'l2', title: 'A lesson', subject: 'Maths', topic_id: 't1', done: false },
    { id: 'l3', title: 'Done lesson', subject: 'Maths', topic_id: 't1', done: true }, { id: 'l4', title: 'Other', subject: 'Maths', topic_id: 't2', done: false },
    { id: 'bad', title: 5, topic_id: 't1' }, null, 'junk', { id: 'x', title: 'no topic' },
  ])
  assert.equal(lessons.length, 4)
  assert.deepEqual(lessonsForTopic({ topicId: 't1' }, lessons).map((l) => l.id), ['l2', 'l1', 'l3'])   // unfinished first, then by title
  assert.deepEqual(lessonsForTopic({ topicId: 't1' }, lessons, 2).map((l) => l.id), ['l2', 'l1'])
  assert.deepEqual(lessonsForTopic({ topicId: null }, lessons), [])
  assert.deepEqual(lessonsForTopic({ topicId: 'nope' }, lessons), [])
  assert.deepEqual(parseLessons(null), []); assert.deepEqual(parseLessons({}), [])
})

test('only topics that are not yet strong get lesson links', () => {
  assert.equal(wantsLessons({ level: 'weak' }), true); assert.equal(wantsLessons({ level: 'getting_there' }), true)
  assert.equal(wantsLessons({ level: 'strong' }), false); assert.equal(wantsLessons({ level: 'too_few' }), false)
})
