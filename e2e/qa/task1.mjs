import { b, log, session } from './lib.mjs'
const t = await session('teacher', 'testing.teacher@mhs.smartassess')
await t.page.goto('http://localhost:3000/teacher/tasks', { waitUntil: 'domcontentloaded' }); await t.page.waitForTimeout(7000); await t.skip()
await t.page.getByRole('button', { name: /New Task/i }).first().click().catch(async () => { await t.page.getByText('+ New Task').first().click() }); await t.page.waitForTimeout(5000)
log('url:', new URL(t.page.url()).pathname, '\n', (await t.text()).slice(0, 900).replace(/\n/g, ' / '))
log('fields:', JSON.stringify(await t.page.evaluate(() => [...document.querySelectorAll('main input, main select, main textarea, main button')].map((e) => `${e.tagName.toLowerCase()}${e.type ? ':' + e.type : ''}${e.placeholder ? '[' + e.placeholder.slice(0, 25) + ']' : ''}${e.tagName === 'BUTTON' ? '(' + e.textContent.trim().slice(0, 25) + ')' : ''}`))))
await t.page.screenshot({ path: 'out/task-new.png', fullPage: true }); await b.close()
