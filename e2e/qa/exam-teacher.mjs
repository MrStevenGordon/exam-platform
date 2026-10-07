import { b, log, session } from './lib.mjs'
const EXAM = process.argv[2]
const t = await session('teacher', 'testing.teacher@mhs.smartassess')
await t.page.goto(`http://localhost:3000/teacher/exam/${EXAM}/sessions`, { waitUntil: 'domcontentloaded', timeout: 180000 }); await t.page.waitForTimeout(9000); await t.skip()
log('sessions page:', (await t.text()).slice(0, 700).replace(/\n/g, ' / '))
log('buttons:', (await t.page.locator('main button, main a').allInnerTexts()).map((x) => x.replace(/\s+/g, ' ')).filter(Boolean).join(' | '))
await t.page.getByRole('button', { name: /Release all results/i }).click(); await t.page.waitForTimeout(6000); log('after release:', (await t.text()).slice(0, 380).replace(/\n/g, ' / ')); await t.page.screenshot({ path: 'qa/out/teacher-sessions.png', fullPage: true }); log('errors:', t.errs.join(' ; ') || 'none'); await b.close()
