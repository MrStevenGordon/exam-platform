// Drives the teacher exam-creation pages step by step and prints each page's fields, so the real flow can be scripted. (exploration helper)
import { chromium } from 'playwright-core'
import fs from 'node:fs'; import path from 'node:path'
import { totp } from '../../scripts/lib/totp.mjs'
const ROOT = path.resolve(import.meta.dirname, '../..')
const PASSWORD = fs.readFileSync(path.join(ROOT, 'scripts/dev-test-school.mjs'), 'utf8').match(/const PASSWORD = '([^']+)'/)[1]
const SECRETS = JSON.parse(fs.readFileSync(path.join(ROOT, '.qa-totp.json'), 'utf8'))
const email = 'testing.teacher@mhs.smartassess'
const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
const page = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage()
await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded' }); await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(2500)
await page.selectOption('select', 'teacher'); await page.fill('input[type=text]', email); await page.fill('input[type=password]', PASSWORD); await page.click('button[type=submit]')
const code = page.locator('input[placeholder="123456"]'); await code.waitFor({ timeout: 60000 }); await code.fill(totp(SECRETS[email])); await page.click('button[type=submit]')
await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60000 })
const skip = async () => { for (let i = 0; i < 12; i++) { const s = page.getByRole('button', { name: /skip tour/i }); if (await s.count()) await s.first().click().catch(() => {}); else break } }
const dump = async (label) => { await page.waitForTimeout(9000); await skip(); const info = await page.evaluate(() => ({ url: location.pathname, text: document.querySelector('main')?.innerText.replace(/\n{2,}/g, '\n').slice(0, 900), buttons: [...document.querySelectorAll('main button, main a')].map((e) => e.textContent.trim().replace(/\s+/g, ' ')).filter(Boolean).slice(0, 30), fields: [...document.querySelectorAll('main input, main select, main textarea')].map((e) => `${e.tagName.toLowerCase()}[${e.type}] "${(e.labels?.[0]?.textContent || e.getAttribute('placeholder') || e.name || '').trim().replace(/\s+/g, ' ').slice(0, 60)}"`) })); console.log(`\n=== ${label}: ${info.url}\n${info.text}\nFIELDS: ${info.fields.join(' ; ')}\nBUTTONS: ${info.buttons.join(' | ')}`) }
await page.goto('http://localhost:3000/teacher/new?kind=test', { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(4000); await skip()
await page.waitForSelector('main input:not([type=checkbox])', { timeout: 40000 }).catch(async () => { console.log('NO FORM. url:', page.url(), '| text:', (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 300)); process.exit(1) }); console.log('form at', page.url()); const texts = page.locator('main input:not([type=checkbox])'); await texts.nth(0).fill('QA Trial Test'); await texts.nth(1).fill('Mathematics')
await page.locator('main select').nth(1).selectOption({ label: 'Grade 9' })
await page.getByRole('button', { name: 'Create test' }).click(); await dump('after Create test'); await page.screenshot({ path: path.resolve(import.meta.dirname, 'out/exam-page.png'), fullPage: true })
const addQ = async (q, opts, correct) => {
  await page.getByRole('button', { name: '+ Add question' }).first().click(); await page.waitForSelector('textarea', { timeout: 60000 }); await page.waitForTimeout(3000)
  await page.locator('textarea').first().fill(q)
  for (let i = 0; i < 4; i++) await page.locator('input[placeholder="Option ' + (i + 1) + '"]').fill(opts[i])
  await page.locator('input[type=radio]').nth(correct).check()
  const inv = await page.evaluate(() => [...document.querySelectorAll('input,select,textarea')].filter((e) => !e.checkValidity()).map((e) => (e.name || e.placeholder || e.type) + ': ' + e.validationMessage)); console.log('invalid fields before save:', JSON.stringify(inv)); await page.screenshot({ path: path.resolve(import.meta.dirname, 'out/add-q-filled.png'), fullPage: true }); await page.getByRole('button', { name: 'Save question' }).click(); await page.waitForTimeout(7000); console.log('after save ->', page.url().replace('http://localhost:3000', ''))
}
await addQ('What is 15% of 200?', ['20', '30', '40', '45'], 1)
await addQ('Simple interest on $1000 at 5% for 2 years?', ['$50', '$100', '$150', '$200'], 1)
await addQ('Which is a right-angled triangle?', ['3,4,5', '2,3,4', '4,5,7', '5,6,8'], 0)
await dump('after adding three questions')
await page.locator('label:has-text("3-1") input, input[type=checkbox] >> nth=1').first().check().catch(() => {})
await dump('after ticking class 3-1'); await page.screenshot({ path: path.resolve(import.meta.dirname, 'out/exam-page2.png'), fullPage: true })
await b.close()
