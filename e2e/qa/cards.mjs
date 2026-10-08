import { b, log, session, admin } from './lib.mjs'
const s = await session('student', '54321@mhs.smartassess')
await s.page.goto('http://localhost:3000/learning/flashcards', { waitUntil: 'domcontentloaded', timeout: 180000 }); await s.page.waitForTimeout(8000); await s.skip()
await s.page.getByText('Interest and Ratios', { exact: true }).first().click(); await s.page.waitForTimeout(6000)
log('deck page:', (await s.text()).slice(0, 380).replace(/\n/g, ' / ')); log('controls:', (await s.page.locator('main button, main a').allInnerTexts()).map((x) => x.replace(/\s+/g, ' ')).filter(Boolean).join(' | '))
const study = s.page.getByRole('link', { name: /study/i }).or(s.page.getByRole('button', { name: /study/i })).first(); await study.click({ timeout: 20000 }).catch(() => log('   (no Study control)')); await s.page.waitForTimeout(6000)
log('study page ->', new URL(s.page.url()).pathname, '|', (await s.text()).slice(0, 300).replace(/\n/g, ' / '))
for (let i = 0; i < 4; i++) {
  const flip = s.page.getByRole('button', { name: /show answer|flip|reveal/i }).first(); if (await flip.count()) { await flip.click(); await s.page.waitForTimeout(700) }
  const got = s.page.getByRole('button', { name: i % 2 ? /not yet/i : /got it/i }).first(); if (await got.count()) { await got.click(); await s.page.waitForTimeout(1000) } else { log('   (no answer buttons on card', i + 1, ')'); break }
}
log('after 4 cards:', (await s.text()).slice(0, 260).replace(/\n/g, ' / ')); log('errors:', s.errs.join(' ; ') || 'none')
await admin.from('profiles').update({ active_login_token: null }).eq('student_id', '54321'); await b.close()
