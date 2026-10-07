// Opens a page as a role, clicks the named buttons/links in order (waiting between), and prints the page text and controls after each. Usage: node qa/click.mjs <hod|teacher|principal|admin|english> /path "Button A" "Button B"
import { b, log, session } from './lib.mjs'
const W = { teacher: ['teacher', 'testing.teacher@mhs.smartassess'], hod: ['supervisor', 'testing.hod@mhs.smartassess'], principal: ['principal', 'testing.principal@mhs.smartassess'], admin: ['school_admin', 'testing.admin@mhs.smartassess'], english: ['teacher', 'testing.english@mhs.smartassess'] }
const [who, p, ...clicks] = process.argv.slice(2); const [sel, email] = W[who]
const s = await session(sel, email); const wait = (ms) => s.page.waitForTimeout(ms)
const show = async (label) => { const ctl = await s.page.evaluate(() => [...document.querySelectorAll('main button, main a, main input, main select, main textarea')].map((e) => (e.tagName === 'A' || e.tagName === 'BUTTON' ? e.textContent.trim().replace(/\s+/g, ' ') : `${e.tagName.toLowerCase()}[${e.type}]`)).filter(Boolean).slice(0, 40)); log(`--- ${label} (${new URL(s.page.url()).pathname})\n${(await s.text()).slice(0, 900).replace(/\n/g, ' / ')}\nCONTROLS: ${ctl.join(' | ')}`) }
await s.page.goto('http://localhost:3000' + p, { waitUntil: 'domcontentloaded', timeout: 180000 }); await wait(9000); await s.skip(); await show('opened')
for (const c of clicks) { await s.page.getByRole('button', { name: c }).or(s.page.getByRole('link', { name: c })).or(s.page.getByText(c, { exact: true })).first().click({ timeout: 30000 }).catch(() => log(`   (could not click "${c}")`)); await wait(6000); await show(`after "${c}"`) }
log('errors:', s.errs.join(' ; ') || 'none'); await b.close()
