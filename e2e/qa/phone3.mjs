import { b, log, session, admin } from './lib.mjs'
const t = await session('teacher', 'testing.teacher@mhs.smartassess', { width: 390, height: 844 })
const ex = (await admin.from('draft_exams').select('id,access_password').eq('direct_published', true).limit(1)).data[0].id
await t.page.goto('http://localhost:3000/teacher/exam/' + ex, { waitUntil: 'domcontentloaded' }); await t.page.waitForTimeout(8000); await t.skip()
log((await t.page.evaluate(() => [...document.querySelectorAll('main button, main a, main input, main select')].filter((e) => { const rc = e.getBoundingClientRect(); return rc.width > 0 && rc.height > 0 && rc.height < 32 }).map((e) => `${e.tagName.toLowerCase()} "${(e.textContent || e.value || '').trim().slice(0, 30)}" h=${Math.round(e.getBoundingClientRect().height)} w=${Math.round(e.getBoundingClientRect().width)}`))).join('\n'))
await t.page.getByRole('button', { name: /reveal password/i }).first().scrollIntoViewIfNeeded().catch(() => {})
await t.page.screenshot({ path: 'out/phone3-reveal.png' }); log('shot')
await b.close()
