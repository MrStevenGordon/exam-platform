import { chromium } from 'playwright-core'
import fs from 'node:fs'
const PASSWORD = fs.readFileSync('../scripts/dev-test-school.mjs', 'utf8').match(/const PASSWORD = '([^']+)'/)[1]
const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
const p = await b.newPage()
p.on('console', (m) => console.log('console', m.type(), m.text().slice(0, 200)))
p.on('response', (r) => { if (r.status() >= 400) console.log('http', r.status(), r.url().slice(0, 140)) })
await p.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded' })
await p.waitForLoadState('networkidle'); await p.waitForTimeout(2000); await p.selectOption('select', 'teacher'); await p.waitForTimeout(500); console.log('button:', await p.locator('button[type=submit]').innerText()); await p.fill('input[type=text]', 'testing.teacher@mhs.smartassess'); await p.fill('input[type=password]', PASSWORD)
await p.click('button[type=submit]'); await p.waitForTimeout(15000)
console.log('URL', p.url()); console.log((await p.locator('body').innerText()).slice(0, 600))
await b.close()
