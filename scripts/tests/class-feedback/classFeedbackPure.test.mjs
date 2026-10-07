import test from 'node:test'
import assert from 'node:assert/strict'
import { mondayOf, addWeeks, weekLabel, isOpenWeek, responseRate, adviceFor, trendOf, groupByClass, classTitle, reflectionWritten, MIN_RESPONSES } from '../../../src/lib/classFeedbackPure.ts'

const row = (o = {}) => ({ week_start: '2026-10-05', teacher_id: 't1', teacher_name: 'Mr. A', department_id: 'd', subject: 'Mathematics', class_group_id: 'c1', class_name: '3-1', enrolled: 30, responded: 20, hidden: false,
  understanding_avg: 3.0, engagement_avg: 3.2, clarity_avg: 3.2, support_avg: 3.2, pace: { too_slow: 2, just_right: 15, too_fast: 3 }, hardest_topics: [], helped: [], improve: [], needs_attention: [], reflection: null, lessons_taught: [], ...o })
const tones = (a) => a.map((x) => x.tone)
const text = (a) => a.map((x) => x.text).join(' | ')

test('the school week starts on Monday, whichever weekday the date is', () => {
  assert.equal(mondayOf('2026-10-07'), '2026-10-05'); assert.equal(mondayOf('2026-10-05'), '2026-10-05'); assert.equal(mondayOf('2026-10-11'), '2026-10-05'); assert.equal(mondayOf('2026-10-12'), '2026-10-12')
  assert.equal(addWeeks('2026-10-05', -1), '2026-09-28'); assert.equal(addWeeks('2026-12-28', 1), '2027-01-04')
})
test('a week reads as Monday to Friday', () => assert.match(weekLabel('2026-10-05'), /Mon.*5 Oct.* to Fri.*9 Oct/))
test('this week and last week are open; older and future weeks are not', () => {
  assert.equal(isOpenWeek('2026-10-05', '2026-10-07'), true); assert.equal(isOpenWeek('2026-09-28', '2026-10-07'), true)
  assert.equal(isOpenWeek('2026-09-21', '2026-10-07'), false); assert.equal(isOpenWeek('2026-10-12', '2026-10-07'), false)
  assert.equal(isOpenWeek('2026-09-28', '2026-10-11'), true)       // Sunday still counts as that week
})
test('the response rate is a whole percentage, or nothing for an empty class', () => {
  assert.equal(responseRate({ responded: 6, enrolled: 30 }), 20); assert.equal(responseRate({ responded: 1, enrolled: 3 }), 33); assert.equal(responseRate({ responded: 0, enrolled: 0 }), null)
})
test('the threshold matches the database', () => assert.equal(MIN_RESPONSES, 5))
test('nobody has answered: one gentle reminder, nothing else', () => {
  const a = adviceFor(row({ responded: 0, understanding_avg: null, pace: null }))
  assert.equal(a.length, 1); assert.match(a[0].text, /Nobody has answered/)
})
test('a class that did not follow gets a reteach suggestion; a class that did gets praise', () => {
  assert.ok(tones(adviceFor(row({ understanding_avg: 2.1 }))).includes('concern')); assert.match(text(adviceFor(row({ understanding_avg: 2.1 }))), /going back over the main idea/)
  assert.ok(tones(adviceFor(row({ understanding_avg: 3.6 }))).includes('good'))
})
test('too fast is flagged at 40% of answers, and too slow is only noted', () => {
  assert.match(text(adviceFor(row({ pace: { too_slow: 0, just_right: 12, too_fast: 8 } }))), /8 of 20 students said the lessons went too fast/)
  assert.doesNotMatch(text(adviceFor(row({ pace: { too_slow: 1, just_right: 16, too_fast: 3 } }))), /too fast/)
  assert.match(text(adviceFor(row({ pace: { too_slow: 9, just_right: 10, too_fast: 1 } }))), /too slow/)
})
test('unclear explanations, no help, low involvement each get their own advice', () => {
  const a = adviceFor(row({ clarity_avg: 2.0, support_avg: 2.0, engagement_avg: 2.0 }))
  assert.match(text(a), /unclear/); assert.match(text(a), /ask for help/); assert.match(text(a), /not very involved/)
})
test('a small response rate is noted', () => assert.match(text(adviceFor(row({ responded: 6, enrolled: 30 }))), /Only 6 of 30 students answered \(20%\)/))
test('compared with last week: a fall is a concern, a rise is good', () => {
  assert.match(text(adviceFor(row({ understanding_avg: 2.4 }), row({ understanding_avg: 3.1 }))), /fell compared with last week \(3\.1 to 2\.4/)
  assert.match(text(adviceFor(row({ understanding_avg: 3.4 }), row({ understanding_avg: 2.8 }))), /rose compared with last week/)
  assert.doesNotMatch(text(adviceFor(row({ understanding_avg: 3.0 }), row({ understanding_avg: 3.1 }))), /fell|rose/)
})
test('the hardest topic and the help list are mentioned', () => {
  const a = adviceFor(row({ hardest_topics: [{ topic: 'Simple interest', count: 4 }], needs_attention: [{ student_id: 'x', name: 'A', understanding: 1, needs_help: true, topic: null }] }))
  assert.match(text(a), /4 students named Simple interest as the hardest topic/); assert.match(text(a), /1 student asked for help or understood little/)
  assert.doesNotMatch(text(adviceFor(row({ hardest_topics: [{ topic: 'Ratios', count: 1 }] }))), /hardest topic/)
})
test('behind plan and struggling: suggest a support session', () => {
  assert.match(text(adviceFor(row({ understanding_avg: 2.6, reflection: { pace_vs_plan: 'behind', covered: null, went_well: null, difficult: null, support_needed: null, next_steps: null } }))), /behind plan and students are finding it hard/)
})
test('what a principal sees (hidden figures) never produces advice that needs figures', () => {
  const a = adviceFor(row({ hidden: true, understanding_avg: null, pace: null, engagement_avg: null, clarity_avg: null, support_avg: null, hardest_topics: null, needs_attention: null, responded: 3 }))
  assert.ok(a.every((x) => x.tone === 'info'))
})
test('trend words', () => { assert.equal(trendOf(3.5, 3.0), 'up'); assert.equal(trendOf(2.5, 3.0), 'down'); assert.equal(trendOf(3.1, 3.0), 'same'); assert.equal(trendOf(null, 3), null) })
test('a reflection counts as written only if something is in it', () => {
  assert.equal(reflectionWritten({ reflection: null }), false)
  assert.equal(reflectionWritten({ reflection: { pace_vs_plan: null, covered: null, went_well: null, difficult: null, support_needed: null, next_steps: null } }), false)
  assert.equal(reflectionWritten({ reflection: { pace_vs_plan: 'on_track', covered: null, went_well: null, difficult: null, support_needed: null, next_steps: null } }), true)
})
test('classes are grouped, the one students struggle with most comes first, and weeks run newest first', () => {
  const g = groupByClass([row({ week_start: '2026-09-28', understanding_avg: 3.5 }), row({ week_start: '2026-10-05', understanding_avg: 3.3 }),
    row({ teacher_id: 't2', subject: 'English Language', class_name: '3-1', understanding_avg: 2.2 }), row({ teacher_id: 't3', subject: 'Science', class_name: null, understanding_avg: null, responded: 0 })])
  assert.deepEqual(g.map((x) => x.title), ['English Language, 3-1', 'Mathematics, 3-1', 'Science'])
  assert.deepEqual(g[1].weeks.map((w) => w.week_start), ['2026-10-05', '2026-09-28'])
  assert.equal(classTitle({ subject: 'Spanish', class_name: null }), 'Spanish')
})

import { buildSummaryPrompt, normalizeSummary } from '../../../src/lib/classFeedbackPrompt.ts'
test('the AI prompt carries the figures and comments but never a student name', () => {
  const p = buildSummaryPrompt(row({ needs_attention: [{ student_id: 'x', name: 'Zadie Secret', understanding: 1, needs_help: true, topic: null }], helped: ['The worked examples'], improve: ['More time'] }), row({ understanding_avg: 3.4 }))
  assert.match(p, /Mathematics, 3-1/); assert.match(p, /answered: 20/); assert.match(p, /The worked examples/); assert.match(p, /Students who asked for help or understood little: 1/)
  assert.doesNotMatch(p, /Zadie|Secret/); assert.match(p, /never instructions/)
})
test('the AI prompt says "not shown" when a principal sees hidden figures', () => {
  const p = buildSummaryPrompt(row({ hidden: true, understanding_avg: null, pace: null, needs_attention: null, helped: null, improve: null, hardest_topics: null }))
  assert.match(p, /Understood this week \(average\): not shown/); assert.match(p, /Pace: not shown/); assert.match(p, /understood little: not shown/)
})
test('a summary reply is tidied; one with no overview is refused', () => {
  const s = normalizeSummary({ overview: ' Good week. ', going_well: ['a', '', 'b', 'c', 'd'], concerns: 'oops', next_steps: ['x'] })
  assert.deepEqual(s, { overview: 'Good week.', going_well: ['a', 'b', 'c'], concerns: [], next_steps: ['x'] })
  assert.equal(normalizeSummary({ overview: '  ' }), null); assert.equal(normalizeSummary(null), null)
})
