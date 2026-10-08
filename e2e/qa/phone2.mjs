import { b, log, session, admin } from './lib.mjs'
const VP = { width: 390, height: 844 }
const check = async (s, label, path) => {
  await s.page.goto('http://localhost:3000' + path, { waitUntil: 'domcontentloaded', timeout: 120000 }); await s.page.waitForTimeout(8000); await s.skip()
  const r = await s.page.evaluate(() => {
    const vw = document.documentElement.clientWidth, over = []
    for (const el of document.querySelectorAll('main *, .page-container *')) { const rc = el.getBoundingClientRect(); if (rc.width > 0 && (rc.right > vw + 2) && getComputedStyle(el).position !== 'fixed') over.push(`${el.tagName.toLowerCase()}.${(el.className || '').toString().slice(0, 20)} right=${Math.round(rc.right)}`) }
    const small = [...document.querySelectorAll('main button, main a, main input, main select')].filter((e) => { const rc = e.getBoundingClientRect(); return rc.width > 0 && rc.height > 0 && rc.height < 32 }).length
    return { sideways: document.documentElement.scrollWidth > vw + 2, over: [...new Set(over)].slice(0, 4), smallTargets: small }
  })
  log(`${label.padEnd(34)} sideways=${r.sideways} overflowing=${r.over.length ? r.over.join('; ') : 'none'} small-targets=${r.smallTargets}`)
  await s.page.screenshot({ path: `out/phone2-${label.replace(/\W+/g, '-')}.png`, fullPage: false })
}
const st = await session('student', '54328@mhs.smartassess', VP)
await check(st, 'student report card', '/student/report-card')
await check(st, 'student tasks', '/student/tasks')
await check(st, 'student mock exam setup', '/student/self-mock')
await check(st, 'student mock exam result', '/student/self-mock/d2d197dc-c174-4103-b620-ce99fd6ac814')
await check(st, 'student lessons', '/learning')
await admin.from('profiles').update({ active_login_token: null }).eq('student_id', '54328')
const t = await session('teacher', 'testing.teacher@mhs.smartassess', VP)
const ex = (await admin.from('draft_exams').select('id').eq('direct_published', true).limit(1)).data[0].id
await check(t, 'teacher published exam (Reveal)', '/teacher/exam/' + ex)
await check(t, 'teacher tasks', '/teacher/tasks')
await check(t, 'teacher new task form', '/teacher/new?kind=task')
const h = await session('supervisor', 'testing.hod@mhs.smartassess', VP)
const fe = (await admin.from('final_exams').select('id').limit(1)).data[0].id
await check(h, 'HOD final exam sessions', `/supervisor/final-exams/${fe}/sessions`)
await check(h, 'HOD final exams tabs', '/supervisor/final-exams')
await b.close()
