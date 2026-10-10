// Run: node --import ./scripts/tests/essay-marking/resolve-ts.mjs --experimental-strip-types --no-warnings --test scripts/tests/timetable-form/timetableFormPure.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { gradeNumber, sortClassGroups, groupClassGroups, departmentTeachers, teacherGroups, studentsToOffer, createSummary } from '../../../src/lib/timetableFormPure.ts'

const cg = (id, name, year_grade) => ({ id, name, year_grade })
const GROUPS = [cg('a', '4-1', 'Grade 10'), cg('b', '1-10', 'Grade 7'), cg('c', '1-2', 'Grade 7'), cg('d', '6A1', 'Grade 12'), cg('e', '3-1', 'Grade 9'), cg('f', '5-1', 'Grade 11'), cg('g', '2-1', 'Grade 8'), cg('h', 'Mystery', ''), cg('i', '1-1', 'Grade 7')]

test('grade numbers are read from the grade text', () => {
  assert.equal(gradeNumber('Grade 10'), 10); assert.equal(gradeNumber('Form 4'), 4); assert.equal(gradeNumber(''), null); assert.equal(gradeNumber(null), null)
})

test('classes run Grade 7 to Grade 12, then any with no grade, and 2 comes before 10 inside a grade', () => {
  const s = sortClassGroups(GROUPS)
  assert.deepEqual(s.map((g) => g.name), ['1-1', '1-2', '1-10', '2-1', '3-1', '4-1', '5-1', '6A1', 'Mystery'])
  assert.deepEqual(GROUPS.map((g) => g.id).join(''), 'abcdefghi')   // the original list is not changed
})

test('classes are grouped under their grade in order', () => {
  const g = groupClassGroups(GROUPS)
  assert.deepEqual(g.map((x) => x.label), ['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12', 'Other classes'])
  assert.deepEqual(g[0].items.map((x) => x.name), ['1-1', '1-2', '1-10'])
})

const T = (id, n) => ({ id, full_name: n })
test('department teachers combine the subject records and the department profile, once each, in name order', () => {
  const rows = [{ teacher_id: '2', profile: T('2', 'Zed Brown') }, { teacher_id: '9', profile: null }, { teacher_id: '2', profile: T('2', 'Zed Brown') }]
  const staff = [T('1', 'Ann Lee'), T('2', 'Zed Brown'), T('3', 'Mia Chen')]
  assert.deepEqual(departmentTeachers(rows, staff).map((t) => t.full_name), ['Ann Lee', 'Mia Chen', 'Zed Brown'])
  assert.deepEqual(departmentTeachers([], []), [])
})

test('a teacher with no subject record still appears (the case that left the list empty)', () => {
  const list = departmentTeachers([], [T('1', 'Ann Lee')])
  const g = teacherGroups(list, undefined, '', 'Mathematics')
  assert.equal(g.length, 1); assert.equal(g[0].items[0].full_name, 'Ann Lee')
})

test('people who teach the chosen subject come first, then the rest of the department, then other teachers', () => {
  const dept = [T('1', 'Ann Lee'), T('2', 'Bob Ray'), T('3', 'Cy Dunn')]
  const g = teacherGroups(dept, new Set(['2']), 'Algebra', 'Mathematics', [T('2', 'Bob Ray'), T('8', 'Eve Fox'), T('7', 'Dan Gray')])
  assert.deepEqual(g.map((x) => x.label), ['Teaches Algebra', 'Other Mathematics staff', 'Other teachers'])
  assert.deepEqual(g[0].items.map((t) => t.id), ['2']); assert.deepEqual(g[1].items.map((t) => t.id), ['1', '3']); assert.deepEqual(g[2].items.map((t) => t.full_name), ['Dan Gray', 'Eve Fox'])
})

test('when nobody is recorded for the subject the whole department is one list', () => {
  const g = teacherGroups([T('1', 'Ann Lee')], new Set(), 'Algebra', 'Mathematics')
  assert.deepEqual(g.map((x) => x.label), ['Mathematics staff'])
})

test('the student list hides people already on the roster, filters by typing and says how many more there are', () => {
  const all = Array.from({ length: 100 }, (_, i) => ({ id: `s${i}`, full_name: i === 5 ? 'Alicia Francis' : `Student ${i}` }))
  assert.equal(studentsToOffer(all, ['s0'], '').items.length, 60); assert.equal(studentsToOffer(all, ['s0'], '').more, 39)
  assert.deepEqual(studentsToOffer(all, [], 'alic').items.map((s) => s.id), ['s5'])
  assert.equal(studentsToOffer(all, ['s5'], 'alic').items.length, 0)
})

test('the message after creating several days says which worked', () => {
  assert.deepEqual(createSummary(1, []), { ok: true, text: 'Section created.' })
  assert.deepEqual(createSummary(3, []), { ok: true, text: '3 sections created.' })
  const r = createSummary(2, [{ day: 'Friday', reason: 'That teacher is already booked.' }])
  assert.equal(r.ok, false); assert.match(r.text, /2 sections created, but not all/); assert.match(r.text, /Friday: That teacher is already booked/)
  assert.equal(createSummary(0, [{ day: 'Monday', reason: 'No room.' }]).text, 'Monday: No room.')
})
