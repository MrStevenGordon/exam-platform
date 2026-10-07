import test from 'node:test'
import assert from 'node:assert/strict'
import { toMinutes, toTimeString, clock12, range12, sectionSpan, dayBounds, sectionTimes, periodsCovered, blockTimes, blocksOn, findClashes, generatePeriods, weekItems, jamaicaMinutes, dayEntries, nowAndNext, timesOverlap } from '../../../src/lib/schoolDayPure.ts'

// the day Manchester described: seven one-hour periods from 8 to 3
const P = Array.from({ length: 7 }, (_, i) => ({ id: 'p' + (i + 1), name: 'P' + (i + 1), start_time: `${String(8 + i).padStart(2, '0')}:00:00`, end_time: `${String(9 + i).padStart(2, '0')}:00:00`, order_index: i }))
const lunch79 = { id: 'l1', kind: 'lunch', title: 'Lunch', grades: [7, 8, 9], days: [1, 2, 3, 4, 5], date_from: null, date_to: null, start_time: '11:00:00', end_time: '12:00:00' }
const lunch1012 = { id: 'l2', kind: 'lunch', title: 'Lunch', grades: [10, 11, 12], days: [1, 2, 3, 4, 5], date_from: null, date_to: null, start_time: '12:00', end_time: '13:00' }
const devotion = { id: 'e1', kind: 'event', title: 'General devotion', grades: null, days: [1], date_from: null, date_to: null, start_time: '08:00', end_time: '09:00' }
const clubs = { id: 'e2', kind: 'event', title: 'Clubs and societies', grades: null, days: [3], date_from: null, date_to: null, start_time: '08:00', end_time: '09:00' }
const sports = { id: 'e3', kind: 'event', title: 'Sports day', grades: [7, 8, 9, 10, 11], days: null, date_from: '2026-11-12', date_to: '2026-11-12', start_time: null, end_time: null }
const BL = [lunch79, lunch1012, devotion, clubs, sports]

test('times become minutes and read back as a clock', () => {
  assert.equal(toMinutes('08:00:00'), 480); assert.equal(toMinutes('15:05'), 905); assert.equal(toMinutes(null), null); assert.equal(toMinutes('nonsense'), null)
  assert.equal(toTimeString(480), '08:00'); assert.equal(clock12(480), '8:00 am'); assert.equal(clock12(720), '12:00 pm'); assert.equal(clock12(13 * 60 + 5), '1:05 pm'); assert.equal(clock12(0), '12:00 am')
  assert.equal(range12(480, 540), '8:00 am to 9:00 am')
})
test('the school day runs from the first period to the last', () => assert.deepEqual(dayBounds(P), { start: 480, end: 15 * 60 }))
test('a normal class runs for one period, a double for two, and cannot run off the end of the day', () => {
  assert.deepEqual(sectionTimes({ id: 'a', day_of_week: 1, period_id: 'p2' }, P), { start: 540, end: 600 })
  assert.deepEqual(sectionTimes({ id: 'a', day_of_week: 1, period_id: 'p2', span: 2 }, P), { start: 540, end: 660 })
  assert.deepEqual(sectionTimes({ id: 'a', day_of_week: 1, period_id: 'p7', span: 2 }, P), { start: 14 * 60, end: 15 * 60 })
  assert.equal(sectionTimes({ id: 'a', day_of_week: 1, period_id: 'gone' }, P), null)
  assert.equal(sectionSpan({ span: 9 }), 4); assert.equal(sectionSpan({}), 1); assert.equal(sectionSpan({ span: 0 }), 1)
  assert.deepEqual(periodsCovered({ id: 'a', day_of_week: 1, period_id: 'p3', span: 2 }, P).map((p) => p.id), ['p3', 'p4'])
})
test('a block with no times lasts the whole school day', () => assert.deepEqual(blockTimes(sports, P), { start: 480, end: 900 }))
test('lunch follows the grade: Grade 9 lunches 11 to 12, Grade 10 lunches 12 to 1, and everyone gets devotion on Monday', () => {
  assert.deepEqual(blocksOn(BL, { dow: 1, grade: 9 }).map((b) => b.id), ['l1', 'e1'])
  assert.deepEqual(blocksOn(BL, { dow: 1, grade: 10 }).map((b) => b.id), ['l2', 'e1'])
  assert.deepEqual(blocksOn(BL, { dow: 3, grade: 12 }).map((b) => b.id), ['l2', 'e2'])
  assert.deepEqual(blocksOn(BL, { dow: 2, grade: 9 }).map((b) => b.id), ['l1'])
})
test('a teacher (no grade) sees every lunch window and event for the day', () => assert.deepEqual(blocksOn(BL, { dow: 1 }).map((b) => b.id), ['l1', 'l2', 'e1']))
test('a one-off event appears only on its date, and only for its grades', () => {
  assert.deepEqual(blocksOn(BL, { dow: 4, date: '2026-11-12', grade: 9 }).map((b) => b.id), ['l1', 'e3'])
  assert.deepEqual(blocksOn(BL, { dow: 4, date: '2026-11-12', grade: 12 }).map((b) => b.id), ['l2'])
  assert.deepEqual(blocksOn(BL, { dow: 4, date: '2026-11-19', grade: 9 }).map((b) => b.id), ['l1'])
  assert.deepEqual(blocksOn(BL, { dow: 4, grade: 9 }).map((b) => b.id), ['l1'])   // no date given: one-offs are not guessed at
})
test('clashes: a class on top of devotion, of its grade\'s lunch, or of a double running into lunch; not another grade\'s lunch', () => {
  const grades = { s1: 9, s2: 9, s3: 9, s4: 10, s5: 9 }
  const secs = [
    { id: 's1', day_of_week: 1, period_id: 'p1' },              // Monday 8-9: devotion
    { id: 's2', day_of_week: 2, period_id: 'p4' },              // Tuesday 11-12 for Grade 9: lunch
    { id: 's3', day_of_week: 2, period_id: 'p3', span: 2 },     // Tuesday 10-12 double for Grade 9: runs into lunch
    { id: 's4', day_of_week: 2, period_id: 'p4' },             // Tuesday 11-12 for Grade 10: not their lunch
    { id: 's5', day_of_week: 3, period_id: 'p2' },              // Wednesday 9-10: clear
  ]
  const c = findClashes(secs, P, BL, (s) => grades[s.id])
  assert.deepEqual(c.map((x) => `${x.sectionId}:${x.blockId}`).sort(), ['s1:e1', 's2:l1', 's3:l1'])
  assert.equal(c.find((x) => x.sectionId === 's3').when, '11:00 am to 12:00 pm')
})
test('a class whose grade is unknown is only checked against events for every grade', () => {
  const c = findClashes([{ id: 'u', day_of_week: 1, period_id: 'p1' }, { id: 'v', day_of_week: 2, period_id: 'p4' }], P, BL, () => null)
  assert.deepEqual(c.map((x) => x.sectionId), ['u'])
})
test('one-off events clash only when the dates are given', () => {
  const secs = [{ id: 'x', day_of_week: 4, period_id: 'p2' }]
  assert.equal(findClashes(secs, P, [sports], () => 9).length, 0)
  assert.equal(findClashes(secs, P, [sports], () => 9, { 4: '2026-11-12' }).length, 1)
  assert.equal(findClashes(secs, P, [sports], () => 12, { 4: '2026-11-12' }).length, 0)
})
test('generating periods: hourly from 8 to 3 gives seven; 40 minutes fits fewer; a short last piece is dropped', () => {
  const h = generatePeriods(480, 900, 60)
  assert.equal(h.length, 7); assert.deepEqual(h[0], { name: 'Period 1', start_time: '08:00', end_time: '09:00', order_index: 0 }); assert.equal(h[6].end_time, '15:00')
  assert.equal(generatePeriods(480, 900, 40).length, 10); assert.equal(generatePeriods(480, 900, 40)[9].end_time, '14:40')
  assert.deepEqual(generatePeriods(900, 480, 60), []); assert.deepEqual(generatePeriods(480, 900, 5), [])
})
test('a week laid out for a Grade 9 student: devotion and lunch in place, a double drawn as one block', () => {
  const secs = [
    { id: 'm', day_of_week: 1, period_id: 'p2' }, { id: 'sc', day_of_week: 2, period_id: 'p2', span: 2 }, { id: 'e', day_of_week: 3, period_id: 'p5' },
  ]
  const w = weekItems(secs, P, BL, { grade: 9, dates: ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13'] })
  assert.equal(w.length, 5)
  assert.deepEqual(w[0].blocks.map((b) => b.block.title), ['General devotion', 'Lunch'])
  assert.deepEqual(w[0].blocks.map((b) => b.start), [480, 660])
  assert.deepEqual(w[1].classes.map((c) => [c.start, c.end]), [[540, 660]])
  assert.deepEqual(w[3].blocks.map((b) => b.block.title), ['Sports day', 'Lunch'])
  assert.ok(w[3].blocks.some((b) => b.block.title === 'Sports day'))     // Thursday 12 November
})
test('Jamaica time is five hours behind UTC all year', () => {
  assert.equal(jamaicaMinutes(new Date('2026-10-07T15:25:00Z')), 10 * 60 + 25)
  assert.equal(jamaicaMinutes(new Date('2026-10-07T03:00:00Z')), 22 * 60)
})
test('now and next: a class is on now, then lunch is next; an event takes the place of a clashing class', () => {
  const secs = [{ id: 'm', day_of_week: 3, period_id: 'p3' }, { id: 'c', day_of_week: 3, period_id: 'p1' }]
  const day = weekItems(secs, P, BL, { grade: 9 })[2]
  const entries = dayEntries(day)
  const at1025 = nowAndNext(entries, 10 * 60 + 25)
  assert.equal(at1025.now.kind, 'class'); assert.equal(at1025.now.ref.id, 'm'); assert.equal(at1025.next.kind, 'lunch')
  const at0830 = nowAndNext(entries, 8 * 60 + 30)
  assert.equal(at0830.now.kind, 'event'); assert.equal(at0830.now.ref.title, 'Clubs and societies')
  const after = nowAndNext(entries, 16 * 60)
  assert.equal(after.now, null); assert.equal(after.next, null)
  assert.equal(nowAndNext(entries, 7 * 60).now, null)
  assert.equal(nowAndNext(entries, 7 * 60).next.kind, 'event')
})
test('overlap is exclusive at the edges: a class ending at 11:00 does not clash with lunch from 11:00', () => assert.equal(timesOverlap({ start: 600, end: 660 }, { start: 660, end: 720 }), false))
