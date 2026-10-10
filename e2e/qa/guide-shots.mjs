import { b, log, session, admin } from './lib.mjs'
const LESSON = 'dd000000-0000-4000-8000-000000007002'
await admin.from('learning_lesson_guides').delete().eq('lesson_id', LESSON)
const fake = { keyPoints: ['Expanding means multiplying out the brackets.', 'Factorising is the reverse of expanding.', 'Always check by expanding your answer.'], canDo: ['I can expand a bracket.', 'I can factorise a simple expression.'],
  cards: [{ front: 'What does expanding mean?', back: 'Multiplying out the brackets.', step: 'explain', check: false }, { front: 'What is factorising?', back: 'Writing an expression as a product, the reverse of expanding.', step: 'explain', check: false }, { front: 'A card not from the lesson', back: 'Volcano eruption lava flows', step: null, check: true }],
  questions: [{ level: 'support', prompt: 'What is 2(x + 3) when expanded?', options: ['2x + 6', '2x + 3', 'x + 6', '2x + 5'], correctIndex: 0, explanation: 'Multiply both terms by 2.', step: 'elaborate', check: false }, { level: 'core', prompt: 'Factorise 6x + 9.', options: ['3(2x + 3)', '6(x + 9)', '3(x + 3)', '9(x + 1)'], correctIndex: 0, explanation: 'The common factor is 3.', step: 'elaborate', check: true }],
  removedLinks: 0, dropped: 1, usage: { used: 2, limit: 60, remaining: 58 } }
try {
  for (const [name, vp] of [['desktop', { width: 1280, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
    const t = await session('teacher', 'testing.teacher@mhs.smartassess', vp)
    await t.page.goto('http://localhost:3000/learning', { waitUntil: 'domcontentloaded' }); await t.page.waitForTimeout(8000); await t.skip()
    await t.page.screenshot({ path: `out/guide-list-${name}.png` })
    log(name, 'list shows draft-all card:', /Study guides for your lessons/.test(await t.text()))
    await t.page.route('**/api/learning/guide-draft', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fake) }))
    await t.page.goto(`http://localhost:3000/learning/lessons/${LESSON}?tab=guide`, { waitUntil: 'domcontentloaded' }); await t.page.waitForTimeout(7000); await t.skip()
    await t.page.getByRole('button', { name: /make a study guide with ai/i }).click(); await t.page.waitForTimeout(2500)
    await t.page.screenshot({ path: `out/guide-tab-${name}.png`, fullPage: true })
    log(name, 'sideways scroll:', await t.page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2))
  }
} finally { await b.close() }
