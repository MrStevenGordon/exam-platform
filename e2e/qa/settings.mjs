import { b, log, session } from './lib.mjs'
const a = await session('school_admin', 'testing.admin@mhs.smartassess')
await a.page.goto('http://localhost:3000/school-admin/settings', { waitUntil: 'domcontentloaded' }); await a.page.waitForTimeout(8000); await a.skip()
log((await a.text()).slice(0, 1800).replace(/\n/g, ' / '))
log('controls:', JSON.stringify(await a.page.evaluate(() => [...document.querySelectorAll('main input, main select, main textarea, main button')].map((e) => `${e.tagName.toLowerCase()}${e.type ? ':' + e.type : ''}${e.checked ? '(on)' : ''}${e.tagName === 'BUTTON' ? '(' + e.textContent.trim().slice(0, 28) + ')' : ''}`))))
log('errors:', a.errs.join(' ; ') || 'none'); await a.page.screenshot({ path: 'out/settings.png', fullPage: true }); await b.close()
