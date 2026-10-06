// Run: node --import ./scripts/tests/essay-marking/resolve-ts.mjs --experimental-strip-types --no-warnings --test scripts/tests/week-summary/weekSummaryPure.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { jamaicaDate, daysBetween, dayLabel, dueText, closesText, averagePct, weekResults, resultsHeadline, studentWeek, buildReminders, teacherWeek } from '../../../src/lib/weekSummaryPure.ts'

// Wednesday 7 October 2026, 10:00 in Jamaica (15:00 UTC)
const NOW = new Date('2026-10-07T15:00:00Z')
const ago = (days, hour = 15) => new Date(NOW.getTime() - days * 86400000 + (hour - 15) * 3600000).toISOString()
const ahead = (days, hour = 15) => ago(-days, hour)
const res = (pct, days, title = 'T') => ({ title, subject: 'Maths', pct, at: ago(days) })

test('Jamaica dates ignore the time zone of the server, and late evening in Jamaica is still the same day', () => {
  assert.equal(jamaicaDate(NOW), '2026-10-07')
  assert.equal(jamaicaDate(new Date('2026-10-08T03:30:00Z')), '2026-10-07')   // 22:30 on the 7th in Jamaica
  assert.equal(jamaicaDate(new Date('2026-10-08T05:00:00Z')), '2026-10-08')   // midnight in Jamaica
  assert.equal(daysBetween('2026-10-07', '2026-10-10'), 3); assert.equal(daysBetween('2026-10-07', '2026-10-05'), -2)
  assert.equal(daysBetween('2026-12-30', '2027-01-02'), 3)
})

test('dates read the way a student would say them', () => {
  assert.equal(dayLabel('2026-10-10'), 'Saturday 10 Oct'); assert.equal(dayLabel('2026-10-07'), 'Wednesday 7 Oct')
  assert.equal(dueText('2026-10-05', '2026-10-07'), 'Overdue by 2 days'); assert.equal(dueText('2026-10-06', '2026-10-07'), 'Overdue by 1 day')
  assert.equal(dueText('2026-10-07', '2026-10-07'), 'Due today'); assert.equal(dueText('2026-10-08', '2026-10-07'), 'Due tomorrow')
  assert.equal(dueText('2026-10-10', '2026-10-07'), 'Due Saturday 10 Oct')
  assert.equal(closesText('2026-10-07', '2026-10-07'), 'Closes today'); assert.equal(closesText('2026-10-08', '2026-10-07'), 'Closes tomorrow'); assert.equal(closesText('2026-10-09', '2026-10-07'), 'Closes Friday 9 Oct')
})

test('this week is the last 7 days and the week before is the 7 days before that; the change is whole points', () => {
  const w = weekResults([res(80, 1), res(60, 3), res(50, 8), res(40, 12), res(90, 15), res(70, -1)], NOW)
  assert.equal(w.thisWeek.length, 2); assert.equal(w.previous.length, 2)          // 15 days ago and a result dated in the future are in neither
  assert.equal(w.avgThis, 70); assert.equal(w.avgPrev, 45); assert.equal(w.change, 25)
  assert.deepEqual(w.thisWeek.map((r) => r.pct), [80, 60])                        // newest first
  assert.equal(averagePct([]), null); assert.equal(averagePct([{ pct: 33 }, { pct: 34 }]), 34)
})

test('exactly seven days ago belongs to last week, not this week', () => {
  const w = weekResults([res(10, 7)], NOW)
  assert.equal(w.thisWeek.length, 0); assert.equal(w.previous.length, 1)
})

test('the headline says what changed, or that nothing new came in', () => {
  assert.equal(resultsHeadline(weekResults([], NOW)), 'No new results this week.')
  assert.equal(resultsHeadline(weekResults([res(70, 1)], NOW)), 'Your average on results shared this week is 70%.')
  assert.match(resultsHeadline(weekResults([res(80, 1), res(50, 9)], NOW)), /80%, up 30 points on last week/)
  assert.match(resultsHeadline(weekResults([res(50, 1), res(51, 9)], NOW)), /50%, down 1 point on last week/)
  assert.match(resultsHeadline(weekResults([res(60, 1), res(60, 9)], NOW)), /the same as last week/)
})

const topic = (o) => ({ key: 'k' + o.name, topicId: 't', subject: 'Maths', name: 'Fractions', pct: 60, earned: 6, available: 10, questions: 5, exams: 2, level: 'getting_there', trend: null, lastAt: ago(1), practiceQuestionIds: [], ...o })
const lesson = (o) => ({ id: 'l1', title: 'Lesson', subject: 'Maths', dueDate: null, completedAt: null, ...o })

test('reminders: overdue first, then soonest, only the next 7 days, finished and closed things left out', () => {
  const r = buildReminders({
    now: NOW,
    lessons: [
      lesson({ id: 'a', title: 'Overdue lesson', dueDate: '2026-10-05' }),
      lesson({ id: 'b', title: 'Due Friday', dueDate: '2026-10-09' }),
      lesson({ id: 'c', title: 'Done already', dueDate: '2026-10-08', completedAt: ago(1) }),
      lesson({ id: 'd', title: 'Next month', dueDate: '2026-11-20' }),
      lesson({ id: 'e', title: 'No due date' }),
    ],
    upcoming: [
      { kind: 'test', title: 'Test tomorrow', subject: 'Maths', dueAt: ahead(1), href: '/student/direct-exam/1' },
      { kind: 'exam', title: 'Closed yesterday', subject: 'Maths', dueAt: ago(1), href: '/x' },
      { kind: 'task', title: 'Far away', subject: 'Maths', dueAt: ahead(20), href: '/y' },
      { kind: 'task', title: 'Open task', subject: 'Maths', dueAt: null, href: '/student/tasks' },
    ],
  })
  assert.deepEqual(r.map((x) => x.title), ['Overdue lesson', 'Test tomorrow', 'Due Friday', 'Open task'])
  assert.deepEqual(r.map((x) => x.detail), ['Overdue by 2 days', 'Closes tomorrow', 'Due Friday 9 Oct', 'Open now'])
  assert.deepEqual(r.map((x) => x.urgent), [true, true, false, false])
  assert.equal(r[0].href, '/learning/lesson/a')
})

test('reminders are capped', () => {
  const lessons = Array.from({ length: 12 }, (_, i) => lesson({ id: 'x' + i, title: 'L' + String(i).padStart(2, '0'), dueDate: '2026-10-09' }))
  assert.equal(buildReminders({ now: NOW, lessons, upcoming: [] }).length, 8)
  assert.equal(buildReminders({ now: NOW, lessons, upcoming: [] }, 3).length, 3)
})

test('a student week brings the results, topics, lessons, checks, flashcards and reminders together', () => {
  const w = studentWeek({
    now: NOW,
    results: [res(80, 2, 'Fractions test'), res(50, 9, 'Earlier test')],
    topics: [topic({ name: 'Fractions', trend: 'improving', lastAt: ago(2), pct: 75, level: 'strong' }), topic({ name: 'Algebra', pct: 30, level: 'weak', lastAt: ago(20) }), topic({ name: 'Old topic', trend: 'improving', lastAt: ago(30) })],
    lessons: [lesson({ id: 'a', title: 'Done this week', completedAt: ago(1) }), lesson({ id: 'b', title: 'Done long ago', completedAt: ago(30) }), lesson({ id: 'c', title: 'Due Thursday', dueDate: '2026-10-08' })],
    checks: [{ lessonId: 'a', attemptNo: 1, score: 3, max: 4, submittedAt: ago(1) }, { lessonId: 'a', attemptNo: 2, score: 4, max: 4, submittedAt: ago(1) }, { lessonId: 'z', attemptNo: 1, score: 1, max: 4, submittedAt: ago(10) }],
    cards: [{ dueAt: ago(1), lastReviewedAt: ago(1) }, { dueAt: ago(2), lastReviewedAt: ago(3) }, { dueAt: ahead(5), lastReviewedAt: ago(3, 20) }, { dueAt: ago(1), lastReviewedAt: null }],
    upcoming: [],
  })
  assert.match(w.headline, /80%, up 30 points/)
  assert.deepEqual(w.improvedTopics.map((t) => t.name), ['Fractions'])         // improving AND recent; "Old topic" is not recent
  assert.deepEqual(w.workOnTopics.map((t) => t.name), ['Algebra'])
  assert.deepEqual(w.lessonsDone.map((l) => l.title), ['Done this week'])
  assert.deepEqual(w.checks, { count: 2, avgPct: 75 })                          // first tries only: 3 of 4
  assert.equal(w.flashcards.reviewed, 3); assert.equal(w.flashcards.daysStudied, 2); assert.equal(w.flashcards.dueNow, 3)
  assert.deepEqual(w.reminders.map((r) => r.title), ['Due Thursday'])
  assert.equal(w.quiet, false)
  assert.ok(w.nextSteps.length >= 3 && w.nextSteps.length <= 4)
  assert.match(w.nextSteps[0], /"Due Thursday": due tomorrow/); assert.ok(w.nextSteps.some((x) => /Practise Algebra/.test(x))); assert.ok(w.nextSteps.some((x) => /3 cards are due/.test(x)))
})

test('a week with nothing in it is recognised, and an overdue item leads the next steps', () => {
  const empty = studentWeek({ now: NOW, results: [], topics: [], lessons: [], checks: [], cards: [], upcoming: [] })
  assert.equal(empty.quiet, true); assert.deepEqual(empty.nextSteps, []); assert.equal(empty.checks.avgPct, null)
  const late = studentWeek({ now: NOW, results: [], topics: [], lessons: [lesson({ title: 'Late one', dueDate: '2026-10-01' })], checks: [], cards: [], upcoming: [] })
  assert.match(late.nextSteps[0], /Finish "Late one"\. It is overdue by 6 days\./)
})

// ---------- the teacher ----------
const st = (id, name, classId = 'c1') => ({ id, name, classId })
const ses = (studentId, pct, days) => ({ studentId, title: 'T', subject: 'Maths', pct, at: ago(days) })
test('a class week: how results moved, which students may need support and why, lessons still open, what closes soon', () => {
  const out = teacherWeek({
    now: NOW,
    classes: [{ id: 'c1', name: '4-1' }, { id: 'c2', name: '4-2' }],
    students: [st('a', 'Ann'), st('b', 'Bob'), st('c', 'Cy'), st('d', 'Di'), st('z', 'Zed', 'c2')],
    sessions: [
      ses('a', 40, 2), ses('a', 45, 9),                       // Ann: under 50 both weeks
      ses('b', 50, 2), ses('b', 80, 9),                       // Bob: down 30 points
      ses('c', 90, 3), ses('c', 85, 10),                      // Cy: fine
      ses('z', 20, 1),                                        // Zed is in the other class
    ],
    lessons: [
      { lessonId: 'L1', title: 'Late lesson', classId: 'c1', dueDate: '2026-10-05' },
      { lessonId: 'L2', title: 'Finished lesson', classId: 'c1', dueDate: '2026-10-08' },
      { lessonId: 'L3', title: 'Soon lesson', classId: 'c1', dueDate: '2026-10-09' },
      { lessonId: 'L4', title: 'Far lesson', classId: 'c1', dueDate: '2026-12-01' },
    ],
    completions: [{ lessonId: 'L1', studentId: 'a' }, { lessonId: 'L2', studentId: 'a' }, { lessonId: 'L2', studentId: 'b' }, { lessonId: 'L2', studentId: 'c' }, { lessonId: 'L2', studentId: 'd' }, { lessonId: 'L3', studentId: 'z' }],
    upcoming: [{ title: 'Undated old test', subject: 'Maths', classId: 'c1', dueAt: null, href: '/z' }, { title: 'Unit test', subject: 'Maths', classId: 'c1', dueAt: ahead(2), href: '/teacher/exam/1' }, { title: 'Other class test', subject: 'Maths', classId: 'c2', dueAt: ahead(2), href: '/x' }, { title: 'Too far', subject: 'Maths', classId: 'c1', dueAt: ahead(30), href: '/y' }],
  })
  const c1 = out[0], c2 = out[1]
  assert.equal(c1.name, '4-1'); assert.equal(c1.students, 4)
  assert.deepEqual(c1.exams, { sat: 3, avgThis: 60, avgPrev: 70, change: -10 })      // this week 40, 50, 90; the week before 45, 80, 85
  // Ann averages 43% over the fortnight; Bob fell 30 points; Cy is fine; Di sat nothing; Zed is in another class
  assert.deepEqual(c1.support.map((x) => [x.name, x.reasons]), [['Ann', ['Averaging 43% over the last two weeks']], ['Bob', ['Down 30 points on last week']]])
  // L1 is overdue with 1 of 4 done; L2 is finished by everyone; L3 is due soon with nobody in this class done (the one done was Zed, in the other class); L4 is far away
  assert.deepEqual(c1.lessons.map((l) => [l.title, l.detail, l.done, l.total, l.overdue]), [['Late lesson', 'Overdue by 2 days', 1, 4, true], ['Soon lesson', 'Due Friday 9 Oct', 0, 4, false]])
  assert.deepEqual(c1.upcoming.map((u) => [u.title, u.detail]), [['Unit test', 'Closes Friday 9 Oct']])
  assert.equal(c2.students, 1); assert.equal(c2.exams.sat, 1); assert.equal(c2.exams.change, null)
  assert.deepEqual(c2.support.map((x) => x.name), ['Zed']); assert.deepEqual(c2.lessons, []); assert.deepEqual(c2.upcoming.map((u) => u.title), ['Other class test'])
})

test('a student with no results is not flagged for support, and a class with no students does not break', () => {
  const out = teacherWeek({ now: NOW, classes: [{ id: 'c1', name: '4-1' }, { id: 'c9', name: 'Empty' }], students: [st('a', 'Ann')], sessions: [], lessons: [{ lessonId: 'L', title: 'x', classId: 'c9', dueDate: null }], completions: [], upcoming: [] })
  assert.deepEqual(out[0].support, []); assert.deepEqual(out[0].exams, { sat: 0, avgThis: null, avgPrev: null, change: null })
  assert.equal(out[1].students, 0); assert.deepEqual(out[1].lessons, [])   // an undated lesson with nobody to finish it is not a worry
})

test('support reasons: a drop is not flagged on a first result, a missing week is not a drop, and exactly 15 points counts', () => {
  const one = teacherWeek({ now: NOW, classes: [{ id: 'c1', name: 'x' }], students: [st('a', 'A'), st('b', 'B')], sessions: [ses('a', 80, 2), ses('b', 60, 2), ses('b', 75, 9)], lessons: [], completions: [], upcoming: [] })[0]
  assert.deepEqual(one.support.map((x) => x.name), ['B']); assert.deepEqual(one.support[0].reasons, ['Down 15 points on last week'])
})

test('only a few undated "open now" things are offered as reminders, and dated ones are never crowded out', () => {
  const upcoming = Array.from({ length: 6 }, (_, i) => ({ kind: 'task', title: 'Old task ' + i, subject: 'Maths', dueAt: null, href: '/student/tasks' }))
  upcoming.push({ kind: 'test', title: 'Dated test', subject: 'Maths', dueAt: ahead(3), href: '/t' })
  const r = buildReminders({ now: NOW, lessons: [], upcoming })
  assert.equal(r.length, 4); assert.equal(r[0].title, 'Dated test'); assert.equal(r.filter((x) => x.detail === 'Open now').length, 3)
})
