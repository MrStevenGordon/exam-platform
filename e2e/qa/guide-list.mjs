// A student sees which lessons have a study guide (badge + "Study guides" list) and the link opens the guide.
// The list function (migration 102) is supplied by the test so it can run before 102 is on the test project.
import { b, log, session, admin } from './lib.mjs'
const LESSON = 'dd000000-0000-4000-8000-000000007002'
let ok = true; const check = (n, p, x = '') => { if (!p) ok = false; log(p ? 'PASS' : 'FAIL', n, x) }
await admin.from('learning_lesson_guides').delete().eq('lesson_id', LESSON)
const ins = await admin.from('learning_lesson_guides').insert({
  lesson_id: LESSON, status: 'on', key_points: ['Simple interest is I = P x R x T.'], can_do: ['I can find simple interest.'],
  cards: [{ front: 'What is the principal?', back: 'The money saved.', step: 'explain' }],
})
log('guide row:', ins.error?.message ?? 'inserted')
try {
  const s = await session('student', '54328@mhs.smartassess')
  await s.page.route('**/rest/v1/rpc/learning_student_guides*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ lesson_id: LESSON }]) }))
  await s.page.goto('http://localhost:3000/learning', { waitUntil: 'domcontentloaded' }); await s.page.waitForTimeout(8000); await s.skip()
  const text = await s.text()
  check('a "Study guides" list is shown', /study guides/i.test(text))
  check('the lesson card has a Study guide badge', (await s.page.locator('.badge', { hasText: /^study guide$/i }).count()) >= 1)
  await s.page.getByText('Open the study guide').first().click()
  await s.page.waitForURL(/\/learning\/lesson\//, { timeout: 60000 }); await s.page.waitForTimeout(6000)
  const details = s.page.locator('details#study-guide')
  check('the guide panel is there', await details.count() === 1)
  check('and it is open', await details.evaluate((d) => d.open))
  await s.page.screenshot({ path: '/tmp/guide-list.png', fullPage: false })
  log('errs:', s.errs)
} finally {
  await admin.from('learning_lesson_guides').delete().eq('lesson_id', LESSON)
  await b.close()
}
log(ok ? 'ALL PASS' : 'SOME FAILED')
