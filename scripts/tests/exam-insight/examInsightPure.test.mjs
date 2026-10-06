// Worked-example tests for src/lib/examInsightPure.ts. Run:  node --experimental-strip-types --test scripts/tests/exam-insight/
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeInsight, reasonText, csvCell, insightToCsv, RULES } from '../../../src/lib/examInsightPure.ts'

// ---- builders ----
const exam = (o = {}) => ({ kind: 'direct', id: 'E', title: 'Class Test', subject: 'Mathematics', exam_kind: 'class_test', pass_mark: 50, target_grade: null, date: '2026-10-01T10:00:00Z', classes: [], sees_all: true, topics_available: true, ...o })
const q = (id, type, points, o = {}) => ({ id, type, text: 'Question ' + id, points, options: null, correct: null, topic_id: null, topic_name: null, topic_code: null, topic_text: null, ...o })
const stu = (i, o = {}) => ({ id: 's' + i, name: 'Student ' + i, number: 'S' + i, class: '4-2', status: 'completed', fully_graded: true, total: 0, max: 10, completed_at: '2026-10-01T10:00:00Z', ...o })

// ---- the Class Test fixture, worked out by hand (the same numbers the database tests use) ----
function classTest() {
  const questions = [
    q('Q1', 'multiple_choice', 1, { correct: 'B', topic_text: 'Simple interest' }),
    q('Q2', 'multiple_choice', 1, { correct: 'C', topic_text: 'Percentages' }),
    q('Q3', 'true_false', 1, { correct: 'True', topic_text: 'Rate and time' }),
    q('Q4', 'essay', 4, { topic_text: 'Simple interest' }),
    q('Q5', 'short_answer', 2, { correct: '1200' }),
  ]
  const totals = [9, 8, 4, 3, 2, 3, null]
  const students = totals.map((t, i) => stu(i + 1, { total: t, max: t === null ? null : 9, fully_graded: i !== 6 }))
  students[6] = stu(7, { total: 5, max: 9, fully_graded: false })       // essay still unmarked
  students.push(stu(8, { status: 'not_started', fully_graded: false, total: null, max: null, completed_at: null }))
  const a1 = ['B', 'B', 'B', 'A', 'A', 'A', 'B'], a2 = ['C', 'C', 'C', 'C', 'C', 'D', 'A'], a3 = ['True', 'True', 'False', 'True', 'True', 'True', 'True']
  const essay = [4, 3, 2, 1, 0, 2, null], a5 = [2, 2, 0, 0, 0, 0, 2]
  const marks = []
  for (let i = 0; i < 7; i++) {
    marks.push([i, 0, a1[i] === 'B' ? 1 : 0], [i, 1, a2[i] === 'C' ? 1 : 0], [i, 2, a3[i] === 'True' ? 1 : 0], [i, 3, essay[i]], [i, 4, a5[i]])
  }
  const answers = [
    { q: 0, items: [{ a: 'B', n: 4 }, { a: 'A', n: 3 }] },
    { q: 1, items: [{ a: 'C', n: 5 }, { a: 'A', n: 1 }, { a: 'D', n: 1 }] },
    { q: 2, items: [{ a: 'True', n: 6 }, { a: 'False', n: 1 }] },
  ]
  const history = []
  const d0 = [8, 7, 6, 5, 4, 3], f0 = [9, 8, 7, 6, 5, 4, 3, 2]
  d0.forEach((pts, i) => history.push([i, 'D0', 'Earlier fractions test', 'direct', '2026-09-01T10:00:00Z', pts, 10]))
  f0.forEach((pts, i) => history.push([i, 'F0', 'September Monthly', 'final', '2026-09-15T10:00:00Z', pts, 10]))
  return { version: 1, exam: exam(), questions, students, marks, answers, history }
}

test('summary numbers match the hand-worked class test', () => {
  const s = computeInsight(classTest()).summary
  assert.equal(s.expected, 8); assert.equal(s.sat, 7); assert.equal(s.notStarted, 1); assert.equal(s.inProgress, 0)
  assert.equal(s.fullyMarked, 6); assert.equal(s.waitingForMarking, 1)
  assert.equal(s.averagePct, 53.7)           // (100 + 88.9 + 44.4 + 33.3 + 22.2 + 33.3) / 6
  assert.equal(s.belowPass, 4); assert.equal(s.passMark, 50); assert.equal(s.showPercent, true)
})

test('questions come hardest first, with the right share and wording', () => {
  const qs = computeInsight(classTest()).questions
  assert.deepEqual(qs.map((x) => x.number), [5, 4, 1, 2, 3])
  const byNo = Object.fromEntries(qs.map((x) => [x.number, x]))
  assert.equal(byNo[1].difficulty, 0.57); assert.equal(byNo[1].metric, 'right'); assert.equal(byNo[1].fullMarks, 4)
  assert.deepEqual(byNo[1].wrongAnswer, { text: 'A', n: 3 })        // 3 students, 3/7 of the class
  assert.equal(byNo[2].wrongAnswer, null)                           // D and A one student each
  assert.equal(byNo[3].difficulty, 0.86)
  assert.equal(byNo[4].metric, 'marks'); assert.equal(byNo[4].difficulty, 0.5); assert.equal(byNo[4].waiting, 1); assert.equal(byNo[4].graded, 6)
  assert.equal(byNo[5].metric, 'marks'); assert.equal(byNo[5].difficulty, 0.43)
  assert.ok(qs.every((x) => !x.mostMissed), 'only 7 sat, too few to call anything most missed')
})

test('topics: grouped by tag, weakest first, untagged counted', () => {
  const r = computeInsight(classTest())
  assert.deepEqual(r.topics.map((t) => [t.name, t.pct]), [['Simple interest', 51.6], ['Percentages', 71.4], ['Rate and time', 85.7]])
  assert.equal(r.untaggedQuestions, 1)
})

test('support list: reasons, order, and the student still waiting for marking is not judged', () => {
  const r = computeInsight(classTest())
  assert.deepEqual(r.support.map((s) => s.number), ['S5', 'S4', 'S3', 'S6', 'S8'])
  const get = (n) => r.students.find((s) => s.number === n)
  assert.deepEqual(get('S3').reasons.map((x) => x.kind), ['below_pass', 'dropped'])
  assert.deepEqual(get('S6').reasons.map((x) => x.kind), ['below_pass'])      // 33% against an average of 35%: not a drop
  assert.deepEqual(get('S8').reasons.map((x) => x.kind), ['did_not_sit'])
  assert.deepEqual(get('S1').reasons, []); assert.deepEqual(get('S2').reasons, [])
  assert.equal(get('S7').waitingForMarking, true); assert.equal(get('S7').pct, null); assert.deepEqual(get('S7').reasons, [])
  assert.equal(reasonText(get('S3').reasons[1]), 'Down 21 points on their average (65%)')
  assert.equal(reasonText(get('S3').reasons[0]), 'Below the pass mark (44% against 50%)')
  assert.equal(get('S3').earlierAverage, 65); assert.deepEqual(get('S3').earlier.map((e) => e.pct), [60, 70])
})

test('class over time: oldest first, ends with this test, did-not-sit students ignored, change against the last test', () => {
  const r = computeInsight(classTest())
  assert.deepEqual(r.trend.map((t) => [t.title, t.averagePct, t.isThis]), [['Earlier fractions test', 55, false], ['September Monthly', 60, false], ['Class Test', 53.7, true]])
  assert.equal(r.summary.previousAveragePct, 60); assert.equal(r.summary.deltaVsPrevious, -6)
})

test('a very small group gets counts, not percentages', () => {
  const p = { version: 1, exam: exam(), questions: [q('Q1', 'multiple_choice', 1, { correct: 'A' })], students: [stu(1, { total: 1, max: 1 }), stu(2, { total: 0, max: 1 }), stu(3, { total: 1, max: 1 })], marks: [[0, 0, 1], [1, 0, 0], [2, 0, 1]], answers: [], history: [] }
  assert.equal(computeInsight(p).summary.showPercent, false)
  assert.equal(computeInsight(p).summary.sat, 3)
})

test('no exam answers yet: nothing divides by zero', () => {
  const p = { version: 1, exam: exam(), questions: [q('Q1', 'essay', 4)], students: [stu(1, { status: 'not_started', fully_graded: false, total: null, max: null })], marks: [], answers: [], history: [] }
  const r = computeInsight(p)
  assert.equal(r.summary.averagePct, null); assert.equal(r.questions[0].difficulty, null); assert.deepEqual(r.trend, [])
  assert.deepEqual(r.support.map((s) => s.reasons[0].kind), ['did_not_sit'])
})

test('most missed needs 8 students and under 40%', () => {
  const build = (right) => {
    const students = Array.from({ length: 10 }, (_, i) => stu(i + 1, { total: i < right ? 1 : 0, max: 1 }))
    return { version: 1, exam: exam(), questions: [q('Q1', 'multiple_choice', 1, { correct: 'A' })], students, marks: students.map((_, i) => [i, 0, i < right ? 1 : 0]), answers: [], history: [] }
  }
  assert.equal(computeInsight(build(3)).questions[0].mostMissed, true)      // 30%
  assert.equal(computeInsight(build(4)).questions[0].mostMissed, false)     // exactly 40% is not under 40%
  const small = build(0); small.students = small.students.slice(0, 7); small.marks = small.marks.slice(0, 7)
  assert.equal(computeInsight(small).questions[0].mostMissed, false)        // 0% but only 7 students
})

test('a missing answer counts as zero, a waiting answer is left out', () => {
  const students = Array.from({ length: 8 }, (_, i) => stu(i + 1, { total: 0, max: 2 }))
  const marks = [[0, 0, 1], [1, 0, null]]                                    // 6 students have no saved answer, one is waiting
  const p = { version: 1, exam: exam(), questions: [q('Q1', 'essay', 2)], students, marks, answers: [], history: [] }
  const x = computeInsight(p).questions[0]
  assert.equal(x.waiting, 1); assert.equal(x.graded, 7); assert.equal(x.difficulty, 0.07)   // 1 of 2 marks, shared across 7 students
})

test('common wrong answer needs 3 students and a quarter of the class', () => {
  const build = (nWrong, total) => {
    const students = Array.from({ length: total }, (_, i) => stu(i + 1, { total: 0, max: 1 }))
    return { version: 1, exam: exam(), questions: [q('Q1', 'multiple_choice', 1, { correct: 'B' })], students, marks: students.map((_, i) => [i, 0, 0]),
      answers: [{ q: 0, items: [{ a: 'A', n: nWrong }, { a: 'B', n: 0 }] }], history: [] }
  }
  assert.deepEqual(computeInsight(build(3, 12)).questions[0].wrongAnswer, { text: 'A', n: 3 })   // 3 of 12 = 25%
  assert.equal(computeInsight(build(2, 6)).questions[0].wrongAnswer, null)                        // only 2 students
  assert.equal(computeInsight(build(3, 13)).questions[0].wrongAnswer, null)                       // 3 of 13 is under a quarter
})

test('"check this question" fires only when the strongest students did no better than the weakest', () => {
  const run = (topDoesBetter) => {
    const n = 20
    const students = Array.from({ length: n }, (_, i) => stu(i + 1, { total: 20 - i, max: 20 }))        // student 1 has the top total
    const marks = students.map((_, i) => {
      const inTop = i < 5, inBottom = i >= 15
      const right = topDoesBetter ? (inTop ? 1 : 0) : (inBottom ? 1 : 0)                                // 5 students get it right in either case
      return [i, 0, right]
    })
    return computeInsight({ version: 1, exam: exam(), questions: [q('Q1', 'multiple_choice', 1, { correct: 'A' })], students, marks, answers: [], history: [] }).questions[0]
  }
  assert.equal(run(true).checkQuestion, false)
  assert.equal(run(false).checkQuestion, true)
  assert.equal(run(false).difficulty, 0.25)
})

test('weak topic: needs 3 questions on the topic and under 40% for that student', () => {
  const questions = [1, 2, 3].map((i) => q('Q' + i, 'multiple_choice', 1, { correct: 'A', topic_id: 't1', topic_name: 'Ratios' })).concat([q('Q4', 'multiple_choice', 1, { correct: 'A', topic_id: 't2', topic_name: 'Fractions' })])
  const students = [stu(1, { total: 1, max: 4 }), stu(2, { total: 4, max: 4 })]
  const marks = [[0, 0, 0], [0, 1, 0], [0, 2, 1], [0, 3, 0], [1, 0, 1], [1, 1, 1], [1, 2, 1], [1, 3, 1]]
  const r = computeInsight({ version: 1, exam: exam({ pass_mark: 20 }), questions, students, marks, answers: [], history: [] })
  const kinds = r.students[0].reasons.map((x) => x.kind)
  assert.deepEqual(kinds, ['weak_topic'])                                    // Ratios 1 of 3 = 33%; Fractions has only one question so is not judged
  assert.equal(reasonText(r.students[0].reasons[0]), 'Weak on Ratios (33%)')
  assert.deepEqual(r.students[1].reasons, [])
})

test('"down on their average" needs at least two earlier tests', () => {
  const base = (nEarlier) => {
    const history = Array.from({ length: nEarlier }, (_, k) => [0, 'H' + k, 'Test ' + k, 'direct', `2026-09-0${k + 1}T10:00:00Z`, 9, 10])   // 90% each time
    return computeInsight({ version: 1, exam: exam({ pass_mark: 10 }), questions: [q('Q1', 'multiple_choice', 1, { correct: 'A' })], students: [stu(1, { total: 5, max: 10 })], marks: [[0, 0, 1]], answers: [], history })
  }
  assert.deepEqual(base(1).students[0].reasons, [])
  assert.deepEqual(base(2).students[0].reasons.map((x) => x.kind), ['dropped'])
})

test('earlier tests: only the latest six per student feed the average', () => {
  const history = Array.from({ length: 8 }, (_, k) => [0, 'H' + k, 'Test ' + k, 'direct', `2026-09-${String(k + 1).padStart(2, '0')}T10:00:00Z`, k < 2 ? 0 : 10, 10])
  const r = computeInsight({ version: 1, exam: exam(), questions: [], students: [stu(1, { total: 10, max: 10 })], marks: [], answers: [], history })
  assert.equal(r.students[0].earlierAverage, 100)                            // the two oldest (0%) are dropped
})

test('a page with no rows at all still computes', () => {
  const r = computeInsight({ version: 1, exam: exam(), questions: [], students: [], marks: [], answers: [], history: [] })
  assert.equal(r.summary.expected, 0); assert.deepEqual(r.questions, []); assert.deepEqual(r.support, [])
})

test('spreadsheet export is safe against formula injection and quotes', () => {
  assert.equal(csvCell('=SUM(A1)'), `"'=SUM(A1)"`); assert.equal(csvCell('+1'), `"'+1"`); assert.equal(csvCell('@x'), `"'@x"`); assert.equal(csvCell('-3'), `"'-3"`)
  assert.equal(csvCell('say "hi"'), '"say ""hi"""'); assert.equal(csvCell(null), '""'); assert.equal(csvCell(12), '"12"')
  const p = classTest(); p.students[0].name = '=HYPERLINK("http://x")'
  const csv = insightToCsv(p, computeInsight(p))
  assert.ok(csv.includes(`"'=HYPERLINK(""http://x"")"`)); assert.ok(csv.split('\r\n').length > 15)
  assert.ok(csv.includes('Did not sit'))
})

test('the rules are the ones in the blueprint', () => {
  assert.deepEqual([RULES.minForPercent, RULES.minForMostMissed, RULES.mostMissedBelow, RULES.minForCheckQuestion, RULES.wrongAnswerMin, RULES.wrongAnswerShare, RULES.dropPoints, RULES.weakTopicBelow, RULES.weakTopicMinQuestions],
    [5, 8, 0.4, 15, 3, 0.25, 15, 0.4, 3])
})
