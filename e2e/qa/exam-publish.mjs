import { chromium } from 'playwright-core'
import fs from 'node:fs'; import path from 'node:path'
import { totp } from '../../scripts/lib/totp.mjs'
const ROOT = path.resolve(import.meta.dirname, '../..')
const PASSWORD = fs.readFileSync(path.join(ROOT, 'scripts/dev-test-school.mjs'), 'utf8').match(/const PASSWORD = '([^']+)'/)[1]
const SECRETS = JSON.parse(fs.readFileSync(path.join(ROOT, '.qa-totp.json'), 'utf8'))
const email = 'testing.teacher@mhs.smartassess'; const EXAM = process.argv[2]
const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
const page = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage()
await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded' }); await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(2500)
await page.selectOption('select', 'teacher'); await page.fill('input[type=text]', email); await page.fill('input[type=password]', PASSWORD); await page.click('button[type=submit]')
const code = page.locator('input[placeholder="123456"]'); await code.waitFor({ timeout: 60000 }); await code.fill(totp(SECRETS[email])); await page.click('button[type=submit]')
await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60000 })
const skip = async () => { for (let i = 0; i < 12; i++) { const s = page.getByRole('button', { name: /skip tour/i }); if (await s.count()) await s.first().click().catch(() => {}); else break } }
await page.goto('http://localhost:3000/teacher/exam/' + EXAM, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(7000); await skip()
await page.getByText('3-1', { exact: true }).last().click(); await page.waitForTimeout(1500)
console.log('after ticking 3-1:', (await page.locator('main').innerText()).replace(/\n{2,}/g, '\n').split('Publish to class')[1]?.slice(0, 700) ?? (await page.locator('main').innerText()).slice(-700))
console.log('buttons:', (await page.locator('main button').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ')).join(' | '))
await page.screenshot({ path: path.resolve(import.meta.dirname, 'out/exam-publish.png'), fullPage: true }); await b.close()
