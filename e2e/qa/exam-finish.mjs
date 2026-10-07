import { b, log, session, admin } from './lib.mjs'
const [STUDENT, EXAM] = process.argv.slice(2)
const s = await session('student', `${STUDENT}@mhs.smartassess`)
await s.page.goto(`http://localhost:3000/student/direct-exam/${EXAM}/take`, { waitUntil: 'domcontentloaded', timeout: 180000 }); await s.page.waitForSelector('text=Submit exam', { timeout: 120000 }); await s.page.waitForTimeout(2000); await s.skip()
const pick = async (q, label) => { await s.page.locator(`xpath=//div[contains(.,"${q}")][.//input[@type="radio"]][last()]`).last().getByText(label, { exact: true }).click(); await s.page.waitForTimeout(700) }
await s.page.getByText('30', { exact: true }).first().click(); await s.page.waitForTimeout(800)
await s.page.getByText('$100', { exact: true }).first().click(); await s.page.waitForTimeout(800)
await s.page.getByText('4,5,7', { exact: true }).first().click(); await s.page.waitForTimeout(1500)
log('answered:', (await s.text()).match(/\d of 3 answered/)?.[0])
await s.page.reload({ waitUntil: 'domcontentloaded' }); await s.page.waitForSelector('text=Submit exam', { timeout: 120000 }); await s.page.waitForTimeout(3000)
log('after a reload:', (await s.text()).match(/\d of 3 answered/)?.[0], '| ticked:', await s.page.locator('input[type=radio]:checked').count())
s.page.on('dialog', (d) => { log('   [dialog]', d.message().slice(0, 100)); d.accept() })
await s.page.getByRole('button', { name: /Submit exam/i }).click(); await s.page.waitForTimeout(3000)
const confirm = s.page.getByRole('button', { name: /^(Yes|Submit|Confirm)/i }); if (await confirm.count()) { log('   confirm buttons:', (await confirm.allInnerTexts()).join(' | ')); await confirm.last().click() }
await s.page.waitForURL((u) => /submitted/.test(u.pathname), { timeout: 60000 }).catch(() => log('   (no submitted page)'))
await s.page.waitForTimeout(3000); log('after submit ->', new URL(s.page.url()).pathname, '|', (await s.text()).slice(0, 300).replace(/\n/g, ' / ')); log('errors:', s.errs.join(' ; ') || 'none')
await s.page.screenshot({ path: 'qa/out/student-submitted.png' }); await admin.from('profiles').update({ active_login_token: null }).eq('student_id', STUDENT); await b.close()
