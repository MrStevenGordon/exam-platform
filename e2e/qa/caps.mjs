// Finds text that a style changes when shown (e.g. "x" shown as "X"): compares each element's source text with what is displayed.
import { b, log, session, admin } from './lib.mjs'
const detect = () => {
  const out = []
  for (const el of document.querySelectorAll('main *, [class*=content] *')) {
    if (el.children.length > 0 && ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue
    const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').replace(/\s+/g, ' ').trim()
    if (!own || own.length < 2) continue
    const cs = getComputedStyle(el).textTransform
    if (cs === 'capitalize' || cs === 'uppercase') {
      const shown = own.replace(/(^|[\s(\-/])([a-z])/g, (m, a, c) => a + c.toUpperCase())
      if (cs === 'capitalize' && shown !== own) out.push(`${cs}: "${own.slice(0, 60)}" -> "${shown.slice(0, 60)}"`)
    }
  }
  return [...new Set(out)].slice(0, 6)
}
const check = async (s, label, path) => { await s.page.goto('http://localhost:3000' + path, { waitUntil: 'domcontentloaded' }); await s.page.waitForTimeout(8000); await s.skip(); const r = await s.page.evaluate(detect); log(`${label.padEnd(34)} ${path}\n   ${r.length ? r.join('\n   ') : 'nothing changed'}`) }
const q = async (sql) => sql
const st = await session('student', '54328@mhs.smartassess')
const sessn = (await admin.from('exam_sessions').select('draft_exam_id,final_exam_id,status').eq('student_id', (await admin.from('profiles').select('id').eq('student_id', '54328').single()).data.id).eq('status', 'completed')).data
const dEx = sessn.find((x) => x.draft_exam_id)?.draft_exam_id, fEx = sessn.find((x) => x.final_exam_id)?.final_exam_id
const mock = (await admin.from('self_mocks').select('id').limit(1)).data?.[0]?.id
if (mock) await check(st, 'student mock exam', `/student/self-mock/${mock}`)
if (dEx) await check(st, 'student test review', `/student/direct-exam/${dEx}/review`)
if (fEx) await check(st, 'student exam review', `/student/exam/${fEx}/review`)
const lesson = (await admin.from('learning_check_questions').select('lesson_id').limit(1)).data?.[0]?.lesson_id
if (lesson) await check(st, 'student lesson with checks', `/learning/lesson/${lesson}`)
await admin.from('profiles').update({ active_login_token: null }).eq('student_id', '54328')
const t = await session('teacher', 'testing.teacher@mhs.smartassess')
const d2 = (await admin.from('draft_exams').select('id').eq('subject', 'Mathematics').limit(1)).data[0].id
const bq = (await admin.from('questions').select('id,draft_exam_id').eq('question_type', 'multiple_choice').not('draft_exam_id', 'is', null).limit(1)).data[0]
await check(t, 'teacher exam page', `/teacher/exam/${d2}`)
await check(t, 'teacher edit question', `/teacher/exam/${bq.draft_exam_id}/edit-question/${bq.id}`)
await check(t, 'teacher question bank', `/teacher/bank`)
const h = await session('supervisor', 'testing.hod@mhs.smartassess')
await check(h, 'HOD exam review', `/supervisor/exam/dd000000-0000-4000-8000-000000001300`)
await b.close()
