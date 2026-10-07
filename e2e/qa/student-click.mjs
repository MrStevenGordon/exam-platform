// Opens a page as a student, clicks named things in order, prints the page after each. Usage: node qa/student-click.mjs 54321 /learning "Text A" "Text B"
import { b, log, session, admin } from './lib.mjs'
const [id, p, ...clicks] = process.argv.slice(2)
const s = await session('student', `${id}@mhs.smartassess`)
const show = async (label) => { const ctl = await s.page.evaluate(() => [...document.querySelectorAll('main button, main a, main input, main select, main textarea')].map((e) => (e.tagName === 'A' || e.tagName === 'BUTTON' ? e.textContent.trim().replace(/\s+/g, ' ') : `${e.tagName.toLowerCase()}[${e.type}]`)).filter(Boolean).slice(0, 30)); log(`--- ${label} (${new URL(s.page.url()).pathname})\n${(await s.text()).slice(0, 800).replace(/\n/g, ' / ')}\nCONTROLS: ${ctl.join(' | ')}`) }
await s.page.goto('http://localhost:3000' + p, { waitUntil: 'domcontentloaded', timeout: 180000 }); await s.page.waitForTimeout(9000); await s.skip(); await show('opened')
for (const c of clicks) { await s.page.getByRole('button', { name: c }).or(s.page.getByRole('link', { name: c })).or(s.page.getByText(c, { exact: true })).first().click({ timeout: 30000 }).catch(() => log(`   (could not click "${c}")`)); await s.page.waitForTimeout(6000); await show(`after "${c}"`) }
log('errors:', s.errs.join(' ; ') || 'none'); await admin.from('profiles').update({ active_login_token: null }).eq('student_id', id); await b.close()
