import { b, log, session, admin } from './lib.mjs'
const t = await session('teacher', 'testing.teacher@mhs.smartassess')
await t.page.goto('http://localhost:3000/teacher/grade', { waitUntil: 'domcontentloaded', timeout: 180000 }); await t.page.waitForSelector('text=Save all points', { timeout: 120000 }); await t.page.waitForTimeout(3000); await t.skip()
const before = (await admin.from('responses').select('id', { count: 'exact', head: true }).is('points_awarded', null).not('answer', 'is', null)).count
const nums = t.page.locator('input[type=number]'); log('number inputs on page:', await nums.count())
const first = (await t.page.locator('main').innerText()).match(/Monthly Test[^\n]*·\s*([^\n]+)/)?.[1]; log('marking the essay by:', first)
for (const [i, v] of [1, 1, 0, 1].entries()) await nums.nth(i).fill(String(v))
await t.page.getByRole('button', { name: 'Save all points' }).first().click(); await t.page.waitForTimeout(6000)
const txt = await t.text(); log('after save, header:', txt.slice(0, 160).replace(/\n/g, ' / '))
log('essays still waiting in the database:', before, '->', (await admin.from('responses').select('id', { count: 'exact', head: true }).is('points_awarded', null).not('answer', 'is', null)).count)
await t.page.getByRole('button', { name: 'Suggest marks' }).first().click(); await t.page.waitForTimeout(12000)
const t2 = await t.text(); const msg = t2.match(/.{0,60}(not set up|try again|unavailable|could not|not working|carry on by hand|AI service).{0,140}/i); log('AI suggest message:', msg ? msg[0].replace(/\n/g, ' ') : '(none found)')
log('errors:', t.errs.join(' ; ') || 'none'); await t.page.screenshot({ path: 'qa/out/essay.png' }); await b.close()
