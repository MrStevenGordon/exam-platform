import { b, log, session, admin } from './lib.mjs'
const s = await session('student', '54328@mhs.smartassess')
const id = 'd2d197dc-c174-4103-b620-ce99fd6ac814'
await s.page.goto('http://localhost:3000/student/self-mock/' + id, { waitUntil: 'domcontentloaded' }); await s.page.waitForTimeout(8000); await s.skip()
// answer: first option of each multiple choice group, type 5 in number boxes
const groups = await s.page.evaluate(() => { const names = {}; document.querySelectorAll('input[type=radio]').forEach((r) => { names[r.name] = (names[r.name] || 0) + 1 }); return Object.entries(names).map(([k, v]) => `${k}:${v}`) })
log('radio groups:', groups.length, groups.slice(0, 3).join(' '))
for (const g of groups) { const name = g.split(':')[0]; await s.page.locator(`input[type=radio][name="${name}"]`).first().check().catch(() => {}) }
const inputs = s.page.locator('main input[type=text], main input[type=number], main textarea'); const n = await inputs.count(); for (let i = 0; i < n; i++) await inputs.nth(i).fill('5').catch(() => {})
log('typed into', n, 'text boxes; buttons:', (await s.page.locator('main button').allInnerTexts()).map((x) => x.trim()).filter(Boolean).join(' | '))
const submit = s.page.getByRole('button', { name: /submit|check|finish|mark/i }).first()
log('submit button:', await submit.count() ? await submit.innerText() : 'NONE')
await submit.click().catch((e) => log('click failed', e.message.slice(0, 80))); await s.page.waitForTimeout(6000)
const t = await s.text(); log('after submit:', t.slice(0, 700).replace(/\n/g, ' / '))
log('errors:', s.errs.join(' ; ') || 'none')
await s.page.screenshot({ path: 'out/mock-2.png', fullPage: true })
await admin.from('profiles').update({ active_login_token: null }).eq('student_id', '54328'); await b.close()
