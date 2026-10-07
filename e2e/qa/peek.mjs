// Prints the text of a page as a role. Usage: node qa/peek.mjs <teacher|hod|principal|admin|english|science|54321> /path [maxChars]
import { chromium } from 'playwright-core'
import fs from 'node:fs'; import path from 'node:path'
import { totp } from '../../scripts/lib/totp.mjs'
const ROOT = path.resolve(import.meta.dirname, '../..')
const PASSWORD = fs.readFileSync(path.join(ROOT, 'scripts/dev-test-school.mjs'), 'utf8').match(/const PASSWORD = '([^']+)'/)[1]
const SECRETS = JSON.parse(fs.readFileSync(path.join(ROOT, '.qa-totp.json'), 'utf8'))
const W = { teacher: ['teacher', 'testing.teacher@mhs.smartassess'], hod: ['supervisor', 'testing.hod@mhs.smartassess'], principal: ['principal', 'testing.principal@mhs.smartassess'], admin: ['school_admin', 'testing.admin@mhs.smartassess'], english: ['teacher', 'testing.english@mhs.smartassess'], science: ['teacher', 'testing.science@mhs.smartassess'] }
const who = process.argv[2]; const [sel, email] = W[who] || ['student', `${who}@mhs.smartassess`]
const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
const page = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage()
await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded' }); await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(2000)
await page.selectOption('select', sel); await page.fill('input[type=text]', email); await page.fill('input[type=password]', PASSWORD); await page.click('button[type=submit]')
const code = page.locator('input[placeholder="123456"]'); await Promise.race([page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60000 }), code.waitFor({ timeout: 60000 })])
if (await code.count()) { await code.fill(totp(SECRETS[email])); await page.click('button[type=submit]'); await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60000 }) }
await page.goto('http://localhost:3000' + process.argv[3], { waitUntil: 'domcontentloaded' }); await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {}); await page.waitForTimeout(2500)
if (process.argv[5]) await page.screenshot({ path: process.argv[5] })
console.log((await page.locator('main, body').first().innerText()).replace(/\n{2,}/g, '\n').slice(0, Number(process.argv[4] || 1800))); await b.close()
