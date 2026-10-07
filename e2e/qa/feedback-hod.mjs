import { b, log, session } from './lib.mjs'
const s = await session('supervisor', 'testing.hod@mhs.smartassess')
const t0 = Date.now(); s.page.on('response', async (r) => { if (/rest\/v1\/questions|api\/review-exam/.test(r.url())) log(`  ${r.request().method()} ${r.url().replace(/\?.*/, '').replace(/^https:\/\/[^/]+/, '').slice(0, 60)} -> ${r.status()} after ${Date.now() - t0}ms ${r.status() >= 400 ? (await r.text()).slice(0, 160) : ''}`) })
await s.page.goto('http://localhost:3000/supervisor/exam/dd000000-0000-4000-8000-000000001300', { waitUntil: 'domcontentloaded', timeout: 180000 }); await s.page.waitForSelector('text=Send feedback', { timeout: 120000 }); await s.page.waitForTimeout(3000); await s.skip()
await s.page.locator('textarea').first().fill('Please add a worked example for question 1.')
await s.page.getByRole('button', { name: 'Send feedback' }).click(); await s.page.waitForTimeout(40000)
log('page now:', (await s.text()).slice(0, 160).replace(/\n/g, ' / ')); await b.close()
