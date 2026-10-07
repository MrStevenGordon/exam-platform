import { chromium } from 'playwright-core'
import fs from 'node:fs'
const PASSWORD = fs.readFileSync('/Users/boxerboychris/exam-platform/scripts/dev-test-school.mjs', 'utf8').match(/const PASSWORD = '([^']+)'/)[1]
const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage()
await p.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded' }); await p.waitForLoadState('networkidle').catch(() => {}); await p.waitForTimeout(2500)
await p.fill('input[type=text]', '54323@mhs.smartassess'); await p.fill('input[type=password]', PASSWORD); await p.click('button[type=submit]'); await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60000 })
await p.goto('http://localhost:3000/learning/feedback', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(6000)
for (let i = 0; i < 9; i++) { const s = p.getByRole('button', { name: /skip tour/i }); if (await s.count()) await s.first().click().catch(() => {}); else break }
console.log((await p.locator('main').innerText()).replace(/\n{2,}/g, '\n').slice(0, 700)); await b.close()
