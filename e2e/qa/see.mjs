import { chromium } from 'playwright-core'
import fs from 'node:fs'; import path from 'node:path'
import { totp } from '../../scripts/lib/totp.mjs'
const ROOT = path.resolve(import.meta.dirname, '../..')
const PASSWORD = fs.readFileSync(path.join(ROOT, 'scripts/dev-test-school.mjs'), 'utf8').match(/const PASSWORD = '([^']+)'/)[1]
const SECRETS = JSON.parse(fs.readFileSync(path.join(ROOT, '.qa-totp.json'), 'utf8'))
const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
const page = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage()
await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded' }); await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(2000)
await page.selectOption('select', 'supervisor'); await page.fill('input[type=text]', 'testing.hod@mhs.smartassess'); await page.fill('input[type=password]', PASSWORD); await page.click('button[type=submit]')
const code = page.locator('input[placeholder="123456"]'); await code.waitFor({ timeout: 60000 }); await code.fill(totp(SECRETS['testing.hod@mhs.smartassess'])); await page.click('button[type=submit]')
await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60000 })
await page.goto('http://localhost:3000' + process.argv[2], { waitUntil: 'domcontentloaded' }); await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(3000)
console.log((await page.locator('body').innerText()).slice(0, 700)); await b.close()
