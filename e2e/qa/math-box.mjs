// Teacher: math box in the question editor puts \( \) math in the text and shows a preview; student view typesets it.
import { session, admin, b, log } from './lib.mjs'
const { data: teacher } = await admin.from('profiles').select('id').eq('email', 'testing.teacher@mhs.smartassess').maybeSingle()
let { data: ex } = await admin.from('draft_exams').select('id, subject').eq('created_by', teacher?.id ?? '00000000-0000-0000-0000-000000000000').order('created_at', { ascending: false }).limit(1)
if (!ex?.length) { const r = await admin.from('draft_exams').select('id, subject, created_by').limit(1); ex = r.data; log('fallback exam', ex?.[0]) }
const EXAM = ex[0].id
const s = await session('teacher', 'testing.teacher@mhs.smartassess')
const p = s.page
await p.goto(`http://localhost:3000/teacher/exam/${EXAM}/add-question`, { waitUntil: 'domcontentloaded', timeout: 180000 })
await p.waitForSelector('#question-text', { timeout: 120000 }); await p.waitForTimeout(1500); await s.skip()
await p.fill('#question-text', 'Simplify ')
await p.click('text=ƒx Math box')
await p.waitForSelector('math-field', { timeout: 30000 })
await p.locator('math-field').click(); await p.waitForTimeout(600)
for (const k of ['1', '/', '2', 'ArrowRight', '+', 'x', '^', '2']) { await p.keyboard.press(k); await p.waitForTimeout(80) }
await p.waitForTimeout(500)
await p.screenshot({ path: '/tmp/mb-open.png' })
await p.getByRole('button', { name: 'Insert', exact: true }).click()
await p.waitForTimeout(800)
log('textarea:', JSON.stringify(await p.inputValue('#question-text')))
log('preview:', await p.locator('text=Students will see').first().innerText())
log('katex nodes:', await p.locator('.katex').count())
await p.screenshot({ path: '/tmp/mb-after.png', fullPage: true })
// plain-answer mode (what a student's answer box uses), via the single-answer field on a short answer question
await p.selectOption('select >> nth=0', 'short_answer')
await p.waitForSelector('#exact-answer')
await p.fill('#exact-answer', 'Ans: ')
await p.locator('#exact-answer').locator('xpath=following-sibling::*').first().click()
await p.waitForSelector('math-field')
await p.locator('math-field').click(); await p.waitForTimeout(600)
for (const k of ['1', '/', '2', 'ArrowRight', '+', 'x', '^', '2']) { await p.keyboard.press(k); await p.waitForTimeout(80) }
log('reads:', await p.locator('text=Your answer will read').innerText())
await p.getByRole('button', { name: 'Insert', exact: true }).click(); await p.waitForTimeout(500)
log('exact:', JSON.stringify(await p.inputValue('#exact-answer')))
log('errs:', s.errs); await b.close()
