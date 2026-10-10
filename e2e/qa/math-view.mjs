// A question with math (and a dollar amount) is typeset on the HOD exam view; the dollar question is left alone.
import { session, admin, b, log } from './lib.mjs'
const EXAM = 'dd000000-0000-4000-8000-000000001002'
const { data: ex } = await admin.from('draft_exams').select('created_by').eq('id', EXAM).single()
const base = { draft_exam_id: EXAM, created_by: ex.created_by, question_type: 'multiple_choice', points: 1, order_index: 990000 }
const { data: made, error } = await admin.from('questions').insert([
  { ...base, question_text: 'What is \\(\\frac{1}{2} + \\frac{1}{4}\\)? QA-MATH', options: ['\\(\\frac{3}{4}\\)', '\\(\\frac{2}{6}\\)', '\\(x^2\\)', '1'], correct_answer: '\\(\\frac{3}{4}\\)', order_index: 990001 },
  { ...base, question_text: 'At what rate does $400 earn $48 in 3 years? QA-MATH', options: ['4%', '5%', '6%', '8%'], correct_answer: '4%', order_index: 990002 },
]).select('id')
log('insert:', error?.message ?? made.length)
try {
  const s = await session('supervisor', 'testing.hod@mhs.smartassess')
  await s.page.goto(`http://localhost:3000/supervisor/exam/${EXAM}`, { waitUntil: 'domcontentloaded', timeout: 180000 })
  await s.page.waitForSelector('text=QA-MATH', { timeout: 120000 }); await s.page.waitForTimeout(2500)
  log('katex nodes:', await s.page.locator('.katex').count())
  const txt = await s.page.locator('text=At what rate does').first().innerText()
  log('money question text:', txt)
  await s.page.locator('text=QA-MATH').first().scrollIntoViewIfNeeded()
  await s.page.screenshot({ path: '/tmp/mv.png', fullPage: false })
  log('errs:', s.errs)
} finally {
  await admin.from('questions').delete().in('id', (made ?? []).map((m) => m.id))
  await b.close()
}
