import test from 'node:test'
import assert from 'node:assert/strict'
import { reasonsFor, supportRows, filterRows, summarise, planDefaults, reviewState, caseProgress, outcomeSummary, daysSince, NO_FILTERS } from '../../../src/lib/supportPure.ts'

const NOW = new Date('2026-10-10T12:00:00Z')
const stu = (o = {}) => ({ id: 's1', name: 'Alex Brown', grade: 9, classes: ['3-1'], overall: { avg: 62, n: 4, prev: 62 }, subjects: [{ subject: 'Mathematics', avg: 62, n: 3, prev: 62 }],
  absent: 0, late: 0, marked: 10, lessons_due: 0, lessons_done: 0, last_seen: '2026-10-09T10:00:00Z', help_weeks: 0, asked_help: false, plan: null, ...o })
const data = (students = [], o = {}) => ({ scope: 'classes', days: 60, school_avg: 63, subjects: [{ subject: 'Mathematics', avg: 63, n: 30 }, { subject: 'English Language', avg: 60, n: 25 }], students, ...o })
const kinds = (rs) => rs.map((r) => r.kind)

test('a student near the school average has no reasons', () => assert.deepEqual(reasonsFor(stu(), data(), NOW), []))
test('ten or more points under the school average in a subject is a reason, and says by how much', () => {
  const r = reasonsFor(stu({ subjects: [{ subject: 'Mathematics', avg: 45, n: 3, prev: 46 }], overall: { avg: 45, n: 3, prev: 46 } }), data(), NOW)
  assert.ok(kinds(r).includes('below_average')); assert.match(r.find((x) => x.kind === 'below_average').text, /Mathematics: averaging 45%, 18 points below the school average \(63%\)/)
  assert.equal(r.find((x) => x.kind === 'below_average').weight, 2)
})
test('twenty points under counts for more', () => assert.equal(reasonsFor(stu({ subjects: [{ subject: 'Mathematics', avg: 40, n: 3, prev: 40 }] }), data(), NOW).find((x) => x.kind === 'below_average').weight, 3))
test('nine points under is not below average', () => assert.ok(!kinds(reasonsFor(stu({ subjects: [{ subject: 'Mathematics', avg: 54, n: 3, prev: 54 }] }), data(), NOW)).includes('below_average')))
test('one result is too few to compare with the school average', () => assert.ok(!kinds(reasonsFor(stu({ subjects: [{ subject: 'Mathematics', avg: 52, n: 1, prev: null }], overall: { avg: 52, n: 1, prev: null } }), data(), NOW)).includes('below_average')))
test('a subject with no school average (too few students sat it) is not compared', () => assert.ok(!kinds(reasonsFor(stu({ subjects: [{ subject: 'Science', avg: 55, n: 3, prev: 55 }], overall: { avg: 55, n: 3, prev: 55 } }), data(), NOW)).includes('below_average')))
test('overall is compared only when no subject is already flagged', () => {
  const none = reasonsFor(stu({ subjects: [{ subject: 'Science', avg: 40, n: 3, prev: 40 }], overall: { avg: 40, n: 3, prev: 40 } }), data(), NOW)
  assert.match(none.find((x) => x.kind === 'below_average').text, /overall/)
  const some = reasonsFor(stu({ subjects: [{ subject: 'Mathematics', avg: 40, n: 3, prev: 40 }], overall: { avg: 40, n: 3, prev: 40 } }), data(), NOW)
  assert.equal(some.filter((x) => x.kind === 'below_average').length, 1); assert.doesNotMatch(some[0].text, /overall/)
})
test('an average under 50% is low even when the whole school is low; one result is enough, and it says so', () => {
  const r = reasonsFor(stu({ subjects: [{ subject: 'Science', avg: 42, n: 1, prev: null }], overall: { avg: 42, n: 1, prev: null } }), data(), NOW)
  assert.match(r.find((x) => x.kind === 'low_marks').text, /Science: averaging 42% \(one result so far\)/)
})
test('a fall of 8 points on the period before is a reason', () => {
  const r = reasonsFor(stu({ subjects: [{ subject: 'Mathematics', avg: 62, n: 2, prev: 75 }] }), data(), NOW)
  assert.match(r.find((x) => x.kind === 'falling').text, /Mathematics: down 13 points on the period before \(75% to 62%\)/)
  assert.ok(!kinds(reasonsFor(stu({ subjects: [{ subject: 'Mathematics', avg: 62, n: 2, prev: 68 }] }), data(), NOW)).includes('falling'))
})
test('three absences in 14 days is a reason; five weighs more; lateness alone needs five', () => {
  assert.ok(kinds(reasonsFor(stu({ absent: 3 }), data(), NOW)).includes('absent')); assert.equal(reasonsFor(stu({ absent: 5 }), data(), NOW).find((x) => x.kind === 'absent').weight, 3)
  assert.ok(!kinds(reasonsFor(stu({ absent: 2 }), data(), NOW)).includes('absent'))
  assert.ok(kinds(reasonsFor(stu({ late: 5 }), data(), NOW)).includes('late')); assert.ok(!kinds(reasonsFor(stu({ late: 4 }), data(), NOW)).includes('late'))
})
test('lessons past due and not finished, and a long gap since signing in', () => {
  assert.match(reasonsFor(stu({ lessons_due: 4, lessons_done: 1 }), data(), NOW).find((x) => x.kind === 'lessons').text, /3 lessons past the due date/)
  assert.ok(!kinds(reasonsFor(stu({ lessons_due: 4, lessons_done: 3 }), data(), NOW)).includes('lessons'))
  assert.match(reasonsFor(stu({ last_seen: '2026-09-28T10:00:00Z' }), data(), NOW).find((x) => x.kind === 'not_seen').text, /12 days/)
  assert.ok(!kinds(reasonsFor(stu({ last_seen: null }), data(), NOW)).includes('not_seen'))
})
test('asking for help counts, and so does two weeks of not following', () => {
  assert.ok(kinds(reasonsFor(stu({ asked_help: true }), data(), NOW)).includes('asked_help'))
  assert.ok(kinds(reasonsFor(stu({ help_weeks: 2 }), data(), NOW)).includes('asked_help')); assert.ok(!kinds(reasonsFor(stu({ help_weeks: 1 }), data(), NOW)).includes('asked_help'))
})
test('only students whose reasons add up to 2 are listed; a student with a plan always is', () => {
  const d = data([stu({ id: 'a', name: 'Quiet', late: 5 }), stu({ id: 'b', name: 'Planned', plan: { id: 'p', status: 'open', review_on: null, subject: null } }), stu({ id: 'c', name: 'Absent', absent: 3 }), stu({ id: 'd', name: 'Fine' })])
  assert.deepEqual(supportRows(d, NOW).map((r) => r.student.name), ['Absent', 'Planned'])
})
test('the neediest come first, with students already on a plan after the others', () => {
  const d = data([stu({ id: 'a', name: 'A', absent: 3 }), stu({ id: 'b', name: 'B', absent: 5, subjects: [{ subject: 'Mathematics', avg: 35, n: 3, prev: 60 }], overall: { avg: 35, n: 3, prev: 60 } }),
    stu({ id: 'c', name: 'C', absent: 6, plan: { id: 'p', status: 'open', review_on: null, subject: null } })])
  const rows = supportRows(d, NOW)
  assert.deepEqual(rows.map((r) => r.student.name), ['B', 'A', 'C']); assert.equal(rows[0].level, 'high'); assert.equal(rows[1].level, 'watch')
  assert.equal(rows[0].subject, 'Mathematics'); assert.equal(rows[0].gap, 28)
})
test('filters narrow the list', () => {
  const d = data([stu({ id: 'a', name: 'Ann Lee', absent: 3, grade: 9, classes: ['3-1'] }), stu({ id: 'b', name: 'Bo Ray', absent: 3, grade: 7, classes: ['1-1'], asked_help: true })])
  const rows = supportRows(d, NOW)
  assert.equal(filterRows(rows, { ...NO_FILTERS, query: 'ray' }).length, 1); assert.equal(filterRows(rows, { ...NO_FILTERS, grade: '9' })[0].student.name, 'Ann Lee')
  assert.equal(filterRows(rows, { ...NO_FILTERS, cls: '1-1' }).length, 1); assert.equal(filterRows(rows, { ...NO_FILTERS, kind: 'asked_help' }).length, 1)
  assert.equal(filterRows(rows, { ...NO_FILTERS, plan: 'with' }).length, 0); assert.equal(filterRows(rows, { ...NO_FILTERS, plan: 'without' }).length, 2)
  assert.deepEqual(summarise(rows), { listed: 2, high: 1, withPlan: 0, withoutPlan: 2 })
})
test('the plan form starts with the reasons and a sensible goal', () => {
  const d = data([stu({ subjects: [{ subject: 'Mathematics', avg: 40, n: 3, prev: 40 }], absent: 4 })])
  const row = supportRows(d, NOW)[0]; const f = planDefaults(row, d)
  assert.equal(f.subject, 'Mathematics'); assert.match(f.reason, /18 points|23 points/); assert.match(f.reason, /Absent 4/); assert.equal(f.goal, 'Raise the Mathematics average from 40% to 50% by the next test')
  const att = planDefaults(supportRows(data([stu({ absent: 4 })]), NOW)[0], data()); assert.equal(att.subject, ''); assert.match(att.goal, /in school and on time/)
})
test('review dates: overdue, within a week, later, none', () => {
  assert.equal(reviewState('2026-10-09', '2026-10-10'), 'overdue'); assert.equal(reviewState('2026-10-10', '2026-10-10'), 'soon'); assert.equal(reviewState('2026-10-17', '2026-10-10'), 'soon')
  assert.equal(reviewState('2026-10-18', '2026-10-10'), 'later'); assert.equal(reviewState(null, '2026-10-10'), 'none')
})
test('how a plan is going: up, down, the same, or no new results', () => {
  assert.equal(caseProgress({ baseline_pct: 30, since_pct: 50, subject: 'Mathematics' }).tone, 'up'); assert.match(caseProgress({ baseline_pct: 30, since_pct: 50, subject: 'Mathematics' }).text, /Up 20 points in Mathematics: 30% to 50%/)
  assert.equal(caseProgress({ baseline_pct: 50, since_pct: 42, subject: null }).tone, 'down'); assert.equal(caseProgress({ baseline_pct: 50, since_pct: 51, subject: null }).tone, 'same')
  assert.equal(caseProgress({ baseline_pct: 50, since_pct: null, subject: null }).tone, 'unknown'); assert.equal(caseProgress({ baseline_pct: null, since_pct: 45, subject: null }).tone, 'unknown')
})
test('a plan in a subject the viewer does not teach shows no marks', () => {
  const p = caseProgress({ baseline_pct: null, since_pct: null, subject: 'English Language', progress_visible: false })
  assert.equal(p.tone, 'unknown'); assert.match(p.text, /shown only to staff who teach this subject/)
  assert.equal(caseProgress({ baseline_pct: 30, since_pct: 50, subject: 'Mathematics', progress_visible: true }).tone, 'up')
})
test('outcomes are counted', () => assert.deepEqual(outcomeSummary([{ outcome: 'improved' }, { outcome: 'improved' }, { outcome: 'no_change' }, { outcome: 'referred' }]), { total: 4, improved: 2, noChange: 1, other: 1 }))
test('days since a date', () => { assert.equal(daysSince('2026-10-07T12:00:00Z', NOW), 3); assert.equal(daysSince(null, NOW), null); assert.equal(daysSince('nonsense', NOW), null) })
