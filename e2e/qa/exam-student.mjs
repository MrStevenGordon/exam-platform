import { b, log, session } from './lib.mjs'
const [STUDENT, PASSWORD_EXAM] = [process.argv[2] || '54326', process.argv[3]]
const s = await session('student', `${STUDENT}@mhs.smartassess`)
await s.page.goto('http://localhost:3000/student/tests', { waitUntil: 'domcontentloaded' }); await s.page.waitForTimeout(7000); await s.skip()
log('1. tests page:', (await s.text()).slice(0, 400).replace(/\n/g, ' / '))
await s.page.getByRole('link', { name: /Begin/ }).first().click({ timeout: 30000 }).catch(async () => { await s.page.getByText('Begin', { exact: true }).first().click({ timeout: 30000 }) }); await s.page.waitForTimeout(7000)
log('2. after opening the test ->', new URL(s.page.url()).pathname, '|', (await s.text()).slice(0, 500).replace(/\n/g, ' / '))
log('   errors so far:', s.errs.join(' ; ') || 'none')
await s.page.locator('input').first().fill(PASSWORD_EXAM); await s.page.getByRole('button', { name: 'Unlock' }).click(); await s.page.waitForTimeout(5000)
const dump = async (label) => { const t = await s.text(); const btn = await s.page.evaluate(() => [...document.querySelectorAll('main button, main a')].map((e) => e.textContent.trim().replace(/\s+/g, ' ')).filter(Boolean).slice(0, 14)); log(`3. ${label} -> ${new URL(s.page.url()).pathname}\n   ${t.slice(0, 420).replace(/\n/g, ' / ')}\n   buttons: ${btn.join(' | ')}`) }
await dump('after the password')
await s.page.getByRole('button', { name: /Begin pop quiz/i }).click(); await s.page.waitForURL((u) => /\/take/.test(u.pathname), { timeout: 120000 }).catch(() => log('   (did not reach the take page in 2 minutes)')); await s.page.waitForTimeout(6000); await dump('after Begin')
await s.page.screenshot({ path: 'qa/out/student-take.png', fullPage: true })
const opts = await s.page.evaluate(() => [...document.querySelectorAll('input[type=radio], label')].slice(0, 12).map((e) => e.tagName + ':' + (e.textContent || e.value || '').trim().slice(0, 30)))
log('   options:', opts.join(' | ')); log('   errors:', s.errs.join(' ; ') || 'none')
await b.close()
