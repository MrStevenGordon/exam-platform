import { b, log, session } from './lib.mjs'
const t = await session('teacher', 'testing.teacher@mhs.smartassess')
await t.page.goto('http://localhost:3000/teacher/new', { waitUntil: 'domcontentloaded' }); await t.page.waitForTimeout(7000); await t.skip()
const sels = t.page.locator('main select'); await sels.nth(0).selectOption({ label: 'Homework' }).catch(async (e) => log('select1 err', e.message.slice(0, 80)))
await t.page.waitForTimeout(1500)
log('url', new URL(t.page.url()).pathname, '| buttons:', (await t.page.locator('button').allInnerTexts()).map((x) => x.trim()).filter(Boolean).join(' | '))
log('main inputs:', await t.page.locator('main input:not([type=checkbox])').count(), 'selects:', await sels.count())
log((await t.text()).slice(0, 400).replace(/\n/g, ' / '))
await t.page.screenshot({ path: 'out/task-form.png', fullPage: true }); await b.close()
