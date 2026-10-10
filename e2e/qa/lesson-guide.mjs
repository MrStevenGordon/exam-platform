// End to end: a teacher makes a study guide from a lesson, reads it, switches it on, and a student uses it.
// The AI's reply is supplied by the test (the key on this machine may not work; the real call is tried by scripts/tests/lesson-guides/live-try.mjs).
// Usage: node lesson-guide.mjs [lessonId]   (test project only; it cleans up after itself)
import { b, log, session, admin } from './lib.mjs'
const LESSON = process.argv[2] || 'dd000000-0000-4000-8000-000000007002'
let ok = true; const check = (n, p, x = '') => { if (!p) ok = false; log(p ? 'PASS' : 'FAIL', n, x) }
const lessonRow = (await admin.from('learning_lessons').select('title, subject').eq('id', LESSON).single()).data
const before = new Set(((await admin.from('learning_check_questions').select('id').eq('lesson_id', LESSON)).data || []).map((x) => x.id))
const S = (await admin.from('profiles').select('id').eq('student_id', '54328').single()).data.id
await admin.from('learning_lesson_guides').delete().eq('lesson_id', LESSON)
try {
  const t = await session('teacher', 'testing.teacher@mhs.smartassess')
  await t.page.goto(`http://localhost:3000/learning/lessons/${LESSON}?tab=guide`, { waitUntil: 'domcontentloaded' }); await t.page.waitForTimeout(8000); await t.skip()
  const tabs = await t.page.getByRole('tab').allInnerTexts()
  check('the lesson has a Study guide tab', tabs.some((x) => /study guide/i.test(x)), tabs.join(' | '))
  const draftBtn = t.page.getByRole('button', { name: /make a study guide with ai/i })
  check('the draft button is offered', await draftBtn.count() === 1)
  const fake = {
    keyPoints: ['Simple interest is the extra money earned on the money you save.', 'The formula is I = P x R x T.', 'The principal is the amount you start with.'],
    canDo: ['I can find the simple interest on a sum of money.', 'I can name the principal, the rate and the time.'],
    cards: [
      { front: 'What is the principal?', back: 'The amount of money you start with.', step: 'explain', check: false },
      { front: 'What is the formula for simple interest?', back: 'I = P x R x T', step: 'explain', check: false },
      { front: 'What does R stand for?', back: 'The rate, as a percentage for each year.', step: 'explain', check: false },
      { front: 'What does T stand for?', back: 'The time in years.', step: 'explain', check: false },
      { front: 'A made up item the lesson does not mention', back: 'Volcano eruption lava flows', step: null, check: true },
    ],
    questions: [
      { level: 'support', prompt: 'What does P stand for in I = P x R x T?', options: ['Principal', 'Percent', 'Price', 'Profit'], correctIndex: 0, explanation: 'P is the principal, the amount you start with.', step: 'explain', check: false },
      { level: 'core', prompt: 'Find the simple interest on $1000 at 5% for 2 years.', options: ['$50', '$100', '$150', '$10'], correctIndex: 1, explanation: 'I = 1000 x 0.05 x 2 = $100.', step: 'elaborate', check: false },
      { level: 'stretch', prompt: 'Which change doubles the interest?', options: ['Double the time', 'Halve the rate', 'Halve the principal', 'Nothing'], correctIndex: 0, explanation: 'Interest is proportional to the time.', step: 'elaborate', check: true },
    ],
    removedLinks: 1, dropped: 0, usage: { used: 1, limit: 60, remaining: 59 },
  }
  await t.page.route('**/api/learning/guide-draft', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fake) }))
  const t0 = Date.now(); await draftBtn.click()
  await Promise.race([t.page.locator('textarea[id^="gf-"]').first().waitFor({ timeout: 120000 }), t.page.locator('.banner-danger').first().waitFor({ timeout: 120000 })]).catch(() => {})
  log('   draft took', Math.round((Date.now() - t0) / 1000), 'seconds')
  const err = await t.page.locator('.banner-danger').allInnerTexts()
  check('the AI drafted a guide (no error banner)', err.length === 0, err.join(' ; '))
  const nCards = await t.page.locator('textarea[id^="gf-"]').count(); const nQ = await t.page.locator('input[id^="gq-"]').count(); const nKp = await t.page.locator('input[aria-label^="Key point"]').count()
  log('   draft has', nKp, 'key points,', nCards, 'cards,', nQ, 'questions')
  check('it has key points, cards and questions', nKp === 3 && nCards === 5 && nQ === 3)
  check('an item that is not from the lesson is marked for checking', (await t.page.getByText('Check this against your lesson').count()) >= 2)
  check('the question marked for checking starts unticked', (await t.page.locator('input[id^="gq-"]').nth(2).isChecked()) === false)
  check('a removed web address is reported to the teacher', /web address/.test(await t.text()))
  const flagged = await t.page.getByText('Check this against your lesson').count(); log('   items marked for checking:', flagged)
  check('nothing is visible to students before switching on', (await admin.from('learning_lesson_guides').select('status').eq('lesson_id', LESSON).maybeSingle()).data === null)
  await t.page.getByRole('button', { name: /save and switch on/i }).click(); await t.page.waitForTimeout(6000)
  const row = (await admin.from('learning_lesson_guides').select('status, cards, key_points, can_do, source_hash, approved_at').eq('lesson_id', LESSON).single()).data
  check('the guide is saved and on', row.status === 'on' && row.approved_at && row.cards.length >= 5, `cards=${row.cards.length} kp=${row.key_points.length}`)
  check('the guide holds no web addresses', !/https?:\/\/|www\./i.test(JSON.stringify(row)))
  const after = ((await admin.from('learning_check_questions').select('id, level').eq('lesson_id', LESSON)).data || []).filter((x) => !before.has(x.id))
  check('only the two ticked practice questions were added, at their levels', after.length === 2 && after.map((x) => x.level).sort().join(',') === 'core,support', `${after.length} added: ${after.map((x) => x.level).join(',')}`)
  const msg = await t.page.locator('[role=status]').allInnerTexts(); log('   teacher sees:', msg.join(' / ').slice(0, 200))

  // the student
  const s = await session('student', '54328@mhs.smartassess')
  await s.page.goto(`http://localhost:3000/learning/lesson/${LESSON}`, { waitUntil: 'domcontentloaded' }); await s.page.waitForTimeout(9000); await s.skip()
  const sum = s.page.getByText('Study guide for this lesson')
  check('the student sees the study guide', await sum.count() === 1)
  const panel = s.page.locator('details.card', { has: sum })
  const wasOpen = await panel.evaluate((el) => el.open)
  log('   panel open by itself (lesson finished):', wasOpen)
  if (!wasOpen) { await sum.click(); await s.page.waitForTimeout(800) }
  const txt = await s.text()
  check('the student sees key points and a can-do list', /Key points/.test(txt) && /What you should be able to do/.test(txt))
  await s.page.getByRole('button', { name: /add these to my flashcards/i }).click(); await s.page.waitForTimeout(3500)
  const deck = (await admin.from('flashcard_decks').select('id, title').eq('student_id', S).eq('title', lessonRow.title.slice(0, 120))).data
  check('a flashcard deck was made for the student', deck.length === 1)
  const cardCount = deck.length ? (await admin.from('flashcards').select('id', { count: 'exact', head: true }).eq('deck_id', deck[0].id)).count : 0
  check('it holds the guide cards', cardCount === row.cards.length, `${cardCount}`)
  await s.page.getByRole('button', { name: /add these to my flashcards/i }).click(); await s.page.waitForTimeout(2500)
  const deck2 = (await admin.from('flashcard_decks').select('id').eq('student_id', S).eq('title', lessonRow.title.slice(0, 120))).data
  check('adding again does not make a second deck', deck2.length === 1)
  await s.page.getByText('See the cards').click(); await s.page.waitForTimeout(500)
  await s.page.getByRole('button', { name: /looks wrong/i }).first().click(); await s.page.waitForTimeout(2500)
  const reps = (await admin.from('learning_guide_reports').select('kind, item_index').eq('lesson_id', LESSON)).data
  check('the student can report an item', reps.length === 1, JSON.stringify(reps))
  // the teacher sees the report
  await t.page.reload({ waitUntil: 'domcontentloaded' }); await t.page.waitForTimeout(7000)
  check('the teacher sees the student report', /said this looks wrong|report/i.test(await t.text()))
  log('page errors (teacher):', t.errs.filter((e) => !/401|404/.test(e)).join(' ; ') || 'none', '| (student):', s.errs.filter((e) => !/401|404/.test(e)).join(' ; ') || 'none')
  log(ok ? 'ALL PASS' : 'SOME FAILED')
} finally {
  await admin.from('learning_lesson_guides').delete().eq('lesson_id', LESSON)
  const now = ((await admin.from('learning_check_questions').select('id').eq('lesson_id', LESSON)).data || []).filter((x) => !before.has(x.id)).map((x) => x.id)
  if (now.length) await admin.from('learning_check_questions').delete().in('id', now)
  const decks = (await admin.from('flashcard_decks').select('id').eq('student_id', S).eq('title', lessonRow.title.slice(0, 120))).data || []
  for (const d of decks) { await admin.from('flashcards').delete().eq('deck_id', d.id); await admin.from('flashcard_decks').delete().eq('id', d.id) }
  await admin.from('profiles').update({ active_login_token: null }).eq('student_id', '54328')
  await b.close()
}
