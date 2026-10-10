// Smart Assess Ja, Manchester High School: strategy deck v2 (design E1: ruled paper, index tabs, copper/gold/teal on deep-brown ink).
// 33 slides for a 30 minute slot (the three newest Smart Learning slides are class feedback, student support and videos; videos is optional), with speaker notes and timings. Editable PowerPoint (native text, shapes, tables and charts).
// Run: NODE_PATH=<folder with pptxgenjs> node build_deck_v2.js   (needs paper.png, shot-lesson.png, shot-builder.png in ./assets-v2)
const path = require('path')
const pptxgen = require('pptxgenjs')
const A = (f) => path.join(__dirname, 'assets-v2', f)
const OUT = process.env.DECK_OUT || path.join(__dirname, 'Smart-Assess-Ja-Manchester-Presentation-v2.pptx')

const COPPER = 'D4762A', GOLD = 'E3B51E', INK = '1E1208', TEAL = '1F8A84', TINT = 'FBE9D6', PAPER = 'FDFDFB', GREY = '555555', MUTED = '8A7A62'
const HEAD = 'Impact', BODY = 'Arial', MONO = 'Courier New'

const pres = new pptxgen()
pres.layout = 'LAYOUT_WIDE' // 13.33 x 7.5
pres.title = 'Smart Assess Ja: Built for Manchester High School'
pres.author = 'Smart Assess Ja'
const SH = pres.ShapeType

// ---------- building blocks ----------
const TABS = [['SURVEY', PAPER, INK], ['ASSESS', COPPER, INK], ['LEARN', GOLD, INK], ['PLAY', INK, 'FFFFFF'], ['WHY US', PAPER, INK]]
function base(active, notes) {
  const s = pres.addSlide()
  s.background = { path: A('paper.png') }
  TABS.forEach(([name, fill, fg], i) => {
    const on = name === active, w = on ? 0.9 : 0.66
    s.addShape(SH.rect, { x: 13.333 - w, y: 0.55 + i * 1.38, w, h: 1.26, fill: { color: fill }, line: { color: INK, width: 2 } })
    s.addText(name, { x: 13.333 - w, y: 0.55 + i * 1.38, w, h: 1.26, vert: 'vert270', fontFace: MONO, fontSize: 12, bold: true, charSpacing: 3, color: fg, align: 'center', valign: 'middle', margin: 0 })
  })
  if (notes) s.addNotes(notes)
  // A little more room between the header and everything under it: anything placed from 1.7in down moves down by 0.2in.
  const DY = 0.2
  const lower = (o) => (o && typeof o === 'object' && typeof o.y === 'number' && o.y >= 1.7 ? { ...o, y: o.y + DY } : o)
  const wrap = (name, idx) => { const orig = s[name].bind(s); s[name] = (...a) => { a[idx] = lower(a[idx]); return orig(...a) } }
  wrap('addText', 1); wrap('addShape', 1); wrap('addImage', 0); wrap('addChart', 2); wrap('addTable', 1)
  return s
}
const label = (s, t, y = 0.5) => s.addText(t.toUpperCase(), { x: 1.55, y, w: 10, h: 0.3, fontFace: MONO, fontSize: 11.5, bold: true, charSpacing: 3, color: INK, margin: 0 })
const title = (s, t, o = {}) => s.addText(t.toUpperCase(), { x: 1.55, y: o.y || 0.85, w: o.w || 10.4, h: o.h || 1.1, fontFace: HEAD, fontSize: Math.round((o.size || 40) * 1.2), color: o.color || INK, margin: 0, valign: 'top', fit: 'shrink' })
const box = (s, x, y, w, h, o = {}) => s.addShape(SH.rect, { x, y, w, h, fill: { color: o.fill || 'FFFFFF' }, line: o.noLine ? { type: 'none' } : { color: INK, width: o.dash ? 2 : 2, dashType: o.dash ? 'dash' : 'solid' } })
const text = (s, t, x, y, w, h, o = {}) => s.addText(t, { x, y, w, h, fontFace: o.font || BODY, fontSize: o.size || 15, bold: !!o.bold, color: o.color || INK, align: o.align || 'left', valign: o.valign || 'top', margin: 0, charSpacing: o.cs, lineSpacingMultiple: o.ls || 1.1, italic: o.italic, fit: o.fit })
const bar = (s, t, y = 6.35, size = 15) => { s.addShape(SH.rect, { x: 1.55, y, w: 10.4, h: 0.55, fill: { color: INK }, line: { type: 'none' } }); text(s, t, 1.75, y, 10.0, 0.55, { size, bold: true, color: 'FFFFFF', valign: 'middle' }) }
const foot = (s, t) => text(s, t, 1.55, 7.0, 10.4, 0.3, { size: 9, color: GREY })
const chip = (s, t, x, y, w, fill = INK, fg = 'FFFFFF') => { s.addShape(SH.rect, { x, y, w, h: 0.34, fill: { color: fill }, line: { color: INK, width: 1.5 } }); text(s, t.toUpperCase(), x, y, w, 0.34, { font: MONO, size: 10, bold: true, color: fg, align: 'center', valign: 'middle', cs: 2 }) }
const num = (s, n, x, y, w, h, fill, fg = INK) => { s.addShape(SH.rect, { x, y, w, h, fill: { color: fill }, line: { color: INK, width: 2 } }); text(s, String(n), x, y, w, h, { font: HEAD, size: 44, color: fg, align: 'center', valign: 'middle' }) }
const note = (min, body, skip) => `${skip ? 'OPTIONAL: skip if you are short of time.\n' : ''}About ${min} minute${min === 1 ? '' : 's'}.\n\n${body}`

// ---------- 1. title ----------
{
  const s = base('', note(1, 'Welcome everyone. The ice breaker answers on page 1 of your guide will come back at the end. Today: a short film (already shown), then this strategy section, then a live demo, then questions.'))
  s.addShape(SH.rect, { x: 1.55, y: 0.85, w: 9.2, h: 4.6, fill: { color: INK }, line: { type: 'none' } })
  s.addShape(SH.rect, { x: 1.55, y: 5.35, w: 9.2, h: 0.14, fill: { color: GOLD }, line: { type: 'none' } })
  text(s, 'STRATEGY SESSION AND LIVE DEMONSTRATION', 2.0, 1.2, 8, 0.3, { font: MONO, size: 12, bold: true, color: GOLD, cs: 3 })
  s.addText([{ text: 'SMART\nASSESS ', options: { color: 'FFFFFF' } }, { text: 'JA', options: { color: GOLD } }], { x: 2.0, y: 1.65, w: 8.4, h: 3.5, fontFace: HEAD, fontSize: 84, margin: 0, valign: 'top', lineSpacingMultiple: 0.9 })
  text(s, 'Smarter assessments. Better learning.', 1.55, 5.9, 9.2, 0.5, { size: 24, bold: true })
  text(s, 'BUILT FOR MANCHESTER HIGH SCHOOL', 1.55, 6.55, 9, 0.3, { font: MONO, size: 12, bold: true, cs: 3 })
}
// ---------- 2. idea ----------
{
  const s = base('', note(1, 'This is the idea in one line. Schools run on many separate tools. We built one connected system around how a school actually works: assess, learn, practise.'))
  label(s, 'Why we built it')
  s.addText('TECHNOLOGY FINALLY ORGANISED AROUND HOW A SCHOOL ACTUALLY WORKS.', { x: 1.55, y: 1.3, w: 10.2, h: 3.2, fontFace: HEAD, fontSize: 60, color: INK, margin: 0, valign: 'top', lineSpacingMultiple: 0.95 })
  text(s, 'That is the idea behind Smart Assess Ja.', 1.55, 4.75, 9, 0.5, { size: 24, bold: true })
  ;[['ASSESS', COPPER, INK], ['LEARN', GOLD, INK], ['PRACTISE', INK, 'FFFFFF']].forEach(([t, f, c], i) => chip(s, t, 1.55 + i * 2.0, 5.65, 1.8, f, c))
  text(s, 'One school. One set of people. One shared topic list.', 1.55, 6.3, 10, 0.4, { size: 16, color: GREY })
}
// ---------- 3. paper ----------
{
  const s = base('', note(1.5, 'Walk the eight steps. The assessment itself may take one hour; the work around it takes much longer. Ask: where does the time go in your department? (Their ice breaker answers may already mention it.)'))
  label(s, 'The problem')
  title(s, 'Every term, learning travels onto paper, and back again', { size: 36 })
  const steps = [['Create', 'Teacher creates the exam'], ['Print', 'Copies are printed'], ['Copy', 'Enough papers are prepared'], ['Administer', 'Students sit the exam'], ['Collect', 'Papers come back'], ['Mark', 'Teacher marks'], ['Record', 'Grades are entered'], ['Analyse', 'Results are interpreted']]
  steps.forEach(([h, b], i) => {
    const x = 1.55 + (i % 4) * 2.62, y = 2.15 + Math.floor(i / 4) * 1.85
    box(s, x, y, 2.45, 1.65)
    s.addShape(SH.rect, { x, y, w: 0.7, h: 1.65, fill: { color: i === 7 ? COPPER : TINT }, line: { color: INK, width: 2 } })
    text(s, String(i + 1), x, y, 0.7, 1.65, { font: HEAD, size: 36, align: 'center', valign: 'middle' })
    text(s, h.toUpperCase(), x + 0.82, y + 0.25, 1.55, 0.4, { font: HEAD, size: 20 })
    text(s, b, x + 0.82, y + 0.75, 1.55, 0.8, { size: 12.5, color: GREY })
  })
  bar(s, 'This consumes time, money, paper and administrative effort.', 5.95)
  text(s, 'The assessment itself may take one hour. The work around it can take much longer.', 1.55, 6.6, 10.4, 0.35, { size: 14, color: GREY })
}
// ---------- 4. one school ----------
{
  const s = base('', note(1, 'Manchester High School is about 1,800 students and more than 100 members of staff. Every test, lesson and class produces information. The question is whether teachers and leaders can see it, in time to act.'))
  label(s, 'Your school')
  title(s, 'One school of about 1,800 students and 100+ staff', { size: 36 })
  box(s, 1.55, 1.95, 4.2, 4.1, { fill: COPPER })
  text(s, '≈1,800', 1.8, 2.05, 3.8, 1.1, { font: HEAD, size: 66, color: INK })
  text(s, 'STUDENTS', 1.8, 3.1, 3.7, 0.45, { font: HEAD, size: 24 })
  text(s, '100+', 1.8, 3.6, 3.8, 1.0, { font: HEAD, size: 66, color: INK })
  text(s, 'MEMBERS OF STAFF', 1.8, 4.6, 3.7, 0.45, { font: HEAD, size: 24 })
  text(s, 'Every test, lesson and class creates information. Can teachers and leaders see it?', 1.8, 5.2, 3.7, 0.8, { size: 13, bold: true })
  ;[['Students', 'Take work, see results, catch up'], ['Teachers', 'Set, mark and teach'], ['Heads of department', 'See a whole department'], ['Principal and administrators', 'See the whole school']].forEach(([h, b], i) => {
    const y = 1.95 + i * 1.05
    box(s, 6.0, y, 5.95, 0.92)
    text(s, h.toUpperCase(), 6.2, y + 0.12, 5.6, 0.35, { font: HEAD, size: 20 })
    text(s, b, 6.2, y + 0.5, 5.6, 0.35, { size: 13, color: GREY })
  })
}
// ---------- 5. students survey ----------
{
  const s = base('SURVEY', note(1.5, 'Twelve students filled in a short paper survey. A small sample, so read it as a signal, not a verdict. Step-by-step explanations came first, then practice questions. Ask the room: do these sound like your students? Wifi and offline access came up unprompted.'))
  label(s, 'What Manchester students told us')
  title(s, 'Students want to be shown how', { size: 38 })
  const opts = (c) => ({ barDir: 'bar', chartColors: [c], catAxisOrientation: 'maxMin', valAxisHidden: true, valGridLine: { style: 'none' }, catGridLine: { style: 'none' }, showValue: true, dataLabelFontFace: HEAD, dataLabelFontSize: 14, dataLabelColor: INK, catAxisLabelFontFace: BODY, catAxisLabelFontSize: 12, catAxisLabelColor: INK, barGapWidthPct: 45, showLegend: false, valAxisMaxVal: 105, valAxisMinVal: 0, dataLabelFormatCode: '0"%"' })
  text(s, 'WHAT WOULD HELP YOU LEARN A DIFFICULT TOPIC?', 1.55, 1.85, 5.2, 0.3, { font: MONO, size: 10.5, bold: true, cs: 1 })
  s.addChart(pres.charts.BAR, [{ name: 'Percent of students', labels: ['Step-by-step explanations', 'Practice questions', 'Quizzes', 'Games or challenges', 'Examples', 'Study at my own pace'], values: [92, 58, 50, 33, 25, 25] }], { x: 1.45, y: 2.15, w: 5.4, h: 3.5, ...opts(COPPER) })
  text(s, 'WHAT WOULD YOU WANT TO SEE ABOUT YOUR PROGRESS?', 7.0, 1.85, 5.0, 0.3, { font: MONO, size: 10.5, bold: true, cs: 1 })
  s.addChart(pres.charts.BAR, [{ name: 'Percent of students', labels: ['Topics I need to improve', 'Grades', 'Compare with previous results', 'Strongest topics', 'Progress toward goals'], values: [75, 58, 50, 42, 42] }], { x: 6.9, y: 2.15, w: 5.1, h: 3.5, ...opts(TEAL) })
  bar(s, '83% want help studying for exams. 58% chose flashcards for practice.', 5.85)
  foot(s, 'Manchester High School student survey, 12 students, who ticked as many answers as they liked. A small sample: read it as a signal.')
}
// ---------- 6. teachers survey ----------
{
  const s = base('SURVEY', note(1.5, 'Ten teachers. Marking is the biggest time cost (80% of teachers). 90% want the system to show what an absent student missed, and 90% want activities for different ability levels. 80% want AI-assisted lesson planning. Everything on this slide is something we have now built; the last two slides before the demo show how.'))
  label(s, 'What Manchester teachers told us')
  title(s, 'Marking is where the time goes', { size: 38 })
  text(s, 'WHICH PARTS OF ASSESSMENT TAKE THE MOST TIME OR EFFORT?', 1.55, 1.85, 6.2, 0.3, { font: MONO, size: 10.5, bold: true, cs: 1 })
  s.addChart(pres.charts.BAR, [{ name: 'Percent of teachers', labels: ['Marking', 'Creating questions', 'Analysing performance', 'Calculating results', 'Recording grades'], values: [80, 60, 50, 40, 30] }], { x: 1.45, y: 2.15, w: 6.2, h: 3.3, barDir: 'bar', chartColors: [COPPER], catAxisOrientation: 'maxMin', valAxisHidden: true, valGridLine: { style: 'none' }, showValue: true, dataLabelFontFace: HEAD, dataLabelFontSize: 14, dataLabelColor: INK, catAxisLabelFontFace: BODY, catAxisLabelFontSize: 12, catAxisLabelColor: INK, barGapWidthPct: 45, showLegend: false, valAxisMaxVal: 105, valAxisMinVal: 0, dataLabelFormatCode: '0"%"' })
  ;[['90%', 'of teachers', 'want the system to show what an absent student missed'], ['90%', 'of teachers', 'want different activities for different ability levels'], ['80%', 'of teachers', 'want AI-assisted lesson planning']].forEach(([n, o, t], i) => {
    const y = 1.95 + i * 1.2
    box(s, 8.0, y, 3.95, 1.05, { fill: i === 0 ? COPPER : i === 1 ? GOLD : TINT })
    text(s, n, 8.15, y, 1.45, 1.05, { font: HEAD, size: 40, valign: 'middle' })
    text(s, t, 9.6, y, 2.25, 1.05, { size: 11, bold: true, valign: 'middle' })
  })
  bar(s, '"A learning gap tracker that analyses assessment results and suggests activities for reteaching and practice."', 5.7, 13)
  foot(s, 'Manchester High School teacher survey, 10 teachers, who could tick as many answers as they liked. A small sample, so read it as a signal.')
}
// ---------- 7. three products ----------
{
  const s = base('ASSESS', note(1, 'One platform, three products with three different jobs. Assess measures learning. Learning delivers and recovers it. Play makes practice engaging. Two are already built and in use at Manchester; Play is built and held back until you choose to launch it.'))
  label(s, 'One platform, three products')
  title(s, 'Already built. Ready to use.', { size: 42 })
  const rows = [['1', 'Smart Assess', 'Measure learning. Set, sit, mark and understand tests, exams and results.', 'Already built', COPPER], ['2', 'Smart Learning', 'Deliver and recover learning. Lessons, plans, study support and catch-up.', 'Already built', GOLD], ['3', 'Smart Play', 'Engage and reinforce learning. Quick games, duels and rewards.', 'Coming soon', PAPER]]
  rows.forEach(([n, h, b, tag, f], i) => {
    const y = 2.0 + i * 1.45
    box(s, 1.55, y, 10.4, 1.3, { dash: i === 2 })
    s.addShape(SH.rect, { x: 1.55, y, w: 1.3, h: 1.3, fill: { color: f }, line: { color: INK, width: 2 } })
    text(s, n, 1.55, y, 1.3, 1.3, { font: HEAD, size: 56, color: i === 2 ? 'BBBBBB' : INK, align: 'center', valign: 'middle' })
    text(s, h.toUpperCase(), 3.1, y + 0.18, 5.4, 0.5, { font: HEAD, size: 28 })
    text(s, b, 3.1, y + 0.72, 6.3, 0.5, { size: 14.5, color: GREY })
    chip(s, tag, 9.65, y + 0.48, 2.1, i === 2 ? PAPER : INK, i === 2 ? INK : 'FFFFFF')
  })
  text(s, 'They share one school, one set of people and one topic list.', 1.55, 6.45, 10.4, 0.4, { size: 15, bold: true })
}
// ---------- product introductions ----------
function intro(active, accent, accentFg, n, name, tagline, summary, points, who, status, statusFill, notes) {
  const s = base(active, notes)
  label(s, 'Meet the product')
  box(s, 1.55, 1.9, 4.3, 4.3, { fill: accent })
  text(s, String(n), 1.8, 2.0, 3.8, 1.6, { font: HEAD, size: 96, color: accentFg })
  text(s, name.toUpperCase().replace(' ', '\n'), 1.8, 3.55, 3.8, 1.5, { font: HEAD, size: 44, color: accentFg, ls: 0.95 })
  text(s, tagline, 1.8, 5.2, 3.8, 0.9, { size: 18, bold: true, color: accentFg })
  text(s, summary, 6.15, 1.95, 5.8, 1.7, { size: 16, bold: true, ls: 1.15 })
  text(s, 'WHAT IT DOES', 6.15, 3.85, 5.8, 0.3, { font: MONO, size: 11, bold: true, cs: 2 })
  points.forEach((t, i) => { const y = 4.22 + i * 0.6; box(s, 6.15, y, 5.8, 0.52, { fill: i % 2 ? TINT : 'FFFFFF' }); text(s, t, 6.35, y, 5.45, 0.52, { size: 13, bold: true, valign: 'middle' }) })
  text(s, who, 6.15, 6.1, 3.6, 0.5, { size: 12, color: GREY, valign: 'middle' })
  chip(s, status, 9.85, 6.17, 2.1, statusFill, statusFill === INK ? 'FFFFFF' : INK)
  return s
}
intro('ASSESS', COPPER, INK, 1, 'Smart Assess', 'Measure learning.',
  'Set, sit, mark and understand tests and exams in one secure record. Teachers save time on marking, students see exactly what to work on, and leaders see how every class and department is doing.',
  ['Build tests and exams, with AI help you always review', 'Mark automatically, with AI-suggested essay marks you decide on', 'See what the class missed and who needs support'],
  'For teachers, students, heads of department and leaders.', 'Already built', INK,
  'About half a minute. One line: Smart Assess is for assessment only. The next four slides show building, marking, results and security. 80% of teachers named marking as their biggest time cost, so that is where we start.')
// ---------- 8. assess overview ----------
{
  const s = base('ASSESS', note(1.5, 'Smart Assess is for assessments only: set it, sit it, mark it, understand it. Walk the six cards quickly. The demo will show building a test and the results screens.'))
  label(s, 'Smart Assess')
  title(s, 'Every assessment, one secure record', { size: 38 })
  chip(s, 'Already built', 10.0, 0.55, 1.9, COPPER, INK)
  const cards = [['Exams, tests and tasks', 'Pop quizzes to end-of-year exams, plus assignments and homework. Five question types, with images and audio.'], ['Question bank', 'Save a question once, tag it to a topic, reuse it in future tests.'], ['Subject tools', 'Built for each subject, starting with an equation toolbar and calculator for maths.'], ['PDF import and AI drafting', 'Turn an exam PDF into questions, or draft questions from a topic. You review every one.'], ['Secure sitting', 'One device, tab-switch logging, blocked pasting, a desktop lock-down app, saved answers.'], ['Marking and results', 'Automatic marking, essay marking points, controlled release and report cards.']]
  cards.forEach(([h, b], i) => {
    const x = 1.55 + (i % 3) * 3.5, y = 1.95 + Math.floor(i / 3) * 2.15
    box(s, x, y, 3.3, 1.95); s.addShape(SH.rect, { x, y, w: 3.3, h: 0.12, fill: { color: COPPER }, line: { type: 'none' } })
    text(s, h.toUpperCase(), x + 0.2, y + 0.3, 2.9, 0.65, { font: HEAD, size: 17 })
    text(s, b, x + 0.2, y + 0.95, 2.9, 0.95, { size: 12.5, color: GREY })
  })
  bar(s, 'For assessment only. Lessons belong to Smart Learning, games to Smart Play.', 6.3, 14)
}
// ---------- 9. marking ----------
{
  const s = base('ASSESS', note(1.5, 'This answers the biggest survey signal: marking. Objective questions are marked the moment a student submits. For essays the teacher defines marking points; the AI can suggest a mark for each point with the words that earned it, flags where it is unsure, and the teacher edits and saves. The AI never saves a mark, never sees a student name, and only runs when a teacher asks. It is switched on per school.'))
  label(s, 'Smart Assess')
  title(s, 'Marking that saves time', { size: 40 })
  const steps = [['Student submits', 'Answers are saved as they go'], ['Objective items marked', 'Instantly, with no teacher time'], ['Essays: marking points', 'The teacher writes what earns marks'], ['AI suggests, you decide', 'Words that earned each mark, flagged where unsure'], ['Release when ready', 'Students are emailed']]
  steps.forEach(([h, b], i) => {
    const x = 1.55 + i * 2.1
    box(s, x, 2.0, 1.95, 2.7, { fill: i === 3 ? TINT : 'FFFFFF' })
    num(s, i + 1, x, 2.0, 1.95, 0.9, i === 3 ? COPPER : GOLD)
    text(s, h.toUpperCase(), x + 0.14, 3.05, 1.7, 0.7, { font: HEAD, size: 15 })
    text(s, b, x + 0.14, 3.8, 1.7, 0.85, { size: 11, color: GREY })
  })
  box(s, 1.55, 4.95, 10.4, 1.15, { fill: INK })
  text(s, 'THE AI NEVER SAVES A MARK.', 1.8, 5.07, 9.9, 0.4, { font: HEAD, size: 22, color: GOLD })
  text(s, 'It never sees a student\'s name, and it runs only when a teacher asks. The school switches it on.', 1.8, 5.5, 9.9, 0.5, { size: 14, color: 'FFFFFF', bold: true })
  text(s, '80% of teachers named marking as the biggest drain on their time.', 1.55, 6.35, 10.4, 0.4, { size: 14, color: GREY })
}
// ---------- 10. results ----------
{
  const s = base('ASSESS', note(1.5, 'Teachers asked who is struggling and what the common mistakes are (80% and 70%). Exam insight shows, per test, which questions the class missed, the wrong answer most students chose, which students may need support and why, and the class against its last five tests. Students get My Topics: their own results by topic, with a practise button. Leaders get department and school analytics.'))
  label(s, 'Smart Assess')
  title(s, 'Results that tell you what to do', { size: 38 })
  const cards = [['Exam insight', ['Which questions the class missed', 'The wrong answer most students chose', 'Who may need support, and why', 'Compared with the last five tests'], 'For teachers'], ['My Topics', ['Students see which topics need work', 'Built from released, marked results', '\u2018One tap\u2019 to practise a weak topic', 'Links to lessons on that topic'], 'For students'], ['School analytics', ['Pass rates by subject and department', 'Flagged exam sessions in one place', 'Report cards for every student', 'Downloadable as a spreadsheet'], 'For HODs and leaders']]
  cards.forEach(([h, items, who], i) => {
    const x = 1.55 + i * 3.5
    box(s, x, 1.95, 3.3, 4.2)
    s.addShape(SH.rect, { x, y: 1.95, w: 3.3, h: 0.9, fill: { color: [COPPER, GOLD, TINT][i] }, line: { color: INK, width: 2 } })
    text(s, h.toUpperCase(), x + 0.2, 1.95, 2.9, 0.9, { font: HEAD, size: 22, valign: 'middle' })
    text(s, items.map((t) => ({ text: t, options: { bullet: { code: '25A0' }, breakLine: true } })), x + 0.2, 3.05, 2.9, 2.2, { size: 13.5 })
    chip(s, who, x + 0.2, 5.55, 2.9, INK)
  })
  text(s, 'Teachers asked who is struggling (80%) and what mistakes are common (70%).', 1.55, 6.4, 10.4, 0.4, { size: 14, color: GREY })
}
// ---------- 11. secure ----------
{
  const s = base('ASSESS', note(1, 'Fair and secure by design. Tab switches are logged and pasting is blocked. A student can only be signed in on one device. A lost connection does not lose the exam. Teachers can switch on read-aloud support. Integrity flags are only prompts: a person always decides.', true))
  label(s, 'Smart Assess')
  title(s, 'Fair, secure and supportive of each student\'s accessibility', { size: 30 })
  const cards = [['Lock-down and tab logging', 'A desktop app for Windows and Mac locks the screen to the exam. Tab switches are logged and pasting is blocked.'], ['One device at a time', 'A student is signed in on one device only while sitting an exam.'], ['Safe if the connection drops', 'Answers are kept on the device and sent when the connection returns. Late work is flagged, not lost.'], ['Support for each student', 'A teacher can switch on read-aloud and other accommodations for a student who needs them.']]
  cards.forEach(([h, b], i) => {
    const x = 1.55 + (i % 2) * 5.25, y = 1.95 + Math.floor(i / 2) * 2.1
    box(s, x, y, 5.1, 1.9); s.addShape(SH.rect, { x, y, w: 0.14, h: 1.9, fill: { color: COPPER }, line: { type: 'none' } })
    text(s, h.toUpperCase(), x + 0.35, y + 0.2, 4.6, 0.45, { font: HEAD, size: 20 })
    text(s, b, x + 0.35, y + 0.75, 4.6, 1.1, { size: 12.5, color: GREY })
  })
  bar(s, 'A person always decides. Integrity flags are prompts for a teacher or leader, never proof.', 6.3, 14)
}
intro('LEARN', GOLD, INK, 2, 'Smart Learning', 'Deliver and recover learning.',
  'Lessons, lesson plans, catch-up and study support that act on what Smart Assess finds. Students get a clear path back in after a missed lesson, and teachers plan faster with AI help they always review.',
  ['Five-step lessons with checks at three levels', 'Catch-up for absent students, flashcards and the Library', 'AI lesson plans shaped by Jamaica and the national curriculum'],
  'For teachers, students, heads of department and leaders.', 'Already built', INK,
  'About half a minute. Assessment tells you what happened; Smart Learning helps you act on it. The next slides cover lessons, catch-up, study support and the Library.')
// ---------- 12. learning overview ----------
{
  const s = base('LEARN', note(1.5, 'Smart Learning is for learning only: lessons, study support, catch-up and reading. Assessment tells you what happened; Learning helps you act on it. Lessons follow the national curriculum 5E model. Short check questions come at three levels, support, core and stretch, which answers the 90% who asked for different activities for different ability levels. The AI drafts a lesson plan from a subject, grade and topic; the teacher reviews it.'))
  label(s, 'Smart Learning')
  title(s, 'Deliver and recover learning', { size: 40 })
  chip(s, 'Already built', 10.0, 0.55, 1.9, GOLD, INK)
  text(s, 'Assessment tells you what happened. Learning helps you act on what you found.', 1.55, 1.75, 10.4, 0.4, { size: 15, bold: true, color: TEAL })
  ;['Engage', 'Explore', 'Explain', 'Elaborate', 'Evaluate'].forEach((t, i) => {
    const x = 1.55 + i * 2.1
    num(s, i + 1, x, 2.3, 0.7, 0.7, GOLD); box(s, x + 0.7, 2.3, 1.25, 0.7); text(s, t.toUpperCase(), x + 0.78, 2.3, 1.15, 0.7, { font: HEAD, size: 13, valign: 'middle' })
  })
  const cards = [['Check your understanding', 'Short questions in each lesson, at support, core and stretch levels.'], ['AI lesson plans', 'A full 5E plan with objectives and a DOK level, shaped by Jamaica. You review it.'], ['Shared plan library', 'Browse and copy published plans from teachers at other schools.'], ['Coverage grid', 'Which topics each class has been taught, and where gaps remain.'], ['Catch-up', 'Absent students are offered the lesson they missed.'], ['Teacher resources', 'Share links and files with your department, tagged by subject and topic.']]
  cards.forEach(([h, b], i) => {
    const x = 1.55 + (i % 3) * 3.5, y = 3.3 + Math.floor(i / 3) * 1.6
    box(s, x, y, 3.3, 1.45)
    text(s, h.toUpperCase(), x + 0.18, y + 0.15, 3.0, 0.4, { font: HEAD, size: 16 })
    text(s, b, x + 0.18, y + 0.6, 3.0, 0.8, { size: 12.5, color: GREY })
  })
  text(s, 'Also in Smart Learning: weekly class feedback, student support and videos (next slides). For learning only; it does not make or mark assessments.', 1.55, 6.6, 10.4, 0.35, { size: 12, color: GREY })
}
// ---------- 12b. DOK ----------
{
  const s = base('LEARN', note(1, 'DOK is Depth of Knowledge, a simple scale from 1 to 4 for how deeply a student has to think. It is about the thinking, not how hard the topic is. Level 1 is recall, level 2 is using a method, level 3 is reasoning and justifying, and level 4 is an extended investigation. Every lesson plan in Smart Learning carries a DOK level next to a general objective and specific objectives. When a teacher asks the AI to draft a plan it suggests a level, and the teacher always reviews and can change it. The point is balance: it helps a teacher see when every task has stayed at recall, without turning everything into a project. The examples use simple interest because it is in the Grade 9 mathematics topic list.'))
  label(s, 'Smart Learning')
  title(s, 'DOK: how deeply students think', { size: 40 })
  chip(s, 'Already built', 10.0, 0.55, 1.9, GOLD, INK)
  text(s, 'Every lesson plan has a general objective, specific objectives and a DOK level from 1 to 4.', 1.55, 1.72, 10.4, 0.4, { size: 15, bold: true, color: TEAL })
  const levels = [['1', 'Recall', 'Remember a fact, a term or a step.', 'State the formula for simple interest.', TINT, INK], ['2', 'Skill', 'Use a method on a familiar problem.', 'Find the interest on J$20,000 saved for 2 years at 5%.', GOLD, INK], ['3', 'Reasoning', 'Explain why, compare, and justify an answer.', 'Compare two savings accounts and justify the better one for a student.', COPPER, INK], ['4', 'Extended thinking', 'Investigate a real problem over days or weeks.', 'Plan and present a savings goal for a class trip, using real bank rates.', INK, 'FFFFFF']]
  levels.forEach(([n, h, d, ex, fill, fg], i) => {
    const x = 1.55 + i * 2.62, top = 2.9 - i * 0.15, bottom = 5.95
    box(s, x, top, 2.45, bottom - top)
    s.addShape(SH.rect, { x, y: top, w: 2.45, h: 0.8, fill: { color: fill }, line: { color: INK, width: 2 } })
    text(s, 'LEVEL ' + n, x + 0.15, top, 2.2, 0.8, { font: HEAD, size: 26, color: fg, valign: 'middle' })
    text(s, h.toUpperCase(), x + 0.15, top + 0.92, 2.2, 0.4, { font: HEAD, size: 18 })
    text(s, d, x + 0.15, top + 1.38, 2.2, 0.75, { size: 11.5, bold: true })
    text(s, 'EXAMPLE', x + 0.15, bottom - 1.2, 2.2, 0.25, { font: MONO, size: 9.5, bold: true, cs: 2, color: MUTED })
    text(s, ex, x + 0.15, bottom - 0.95, 2.2, 0.9, { size: 11, color: GREY, italic: true })
  })
  bar(s, 'The AI suggests a level. The teacher reviews it and can change it. Aim for a mix, not all level 4.', 6.35, 14)
}
// ---------- 13. catch-up ----------
{
  const s = base('LEARN', note(1.5, 'The scenario: a student misses three days. The teacher records when each lesson was taught. The absent student is offered the lesson as a catch-up, works through it at their own pace, and the teacher sees who has caught up. 90% of teachers asked for exactly this. The screen on the left is a real lesson from the Manchester demo school.'))
  label(s, 'Smart Learning')
  title(s, 'When a student misses three days', { size: 36 })
  s.addImage({ path: A('shot-lesson.png'), x: 1.55, y: 1.85, w: 5.2, h: 4.35, sizing: { type: 'contain', w: 5.2, h: 4.35 } })
  s.addShape(SH.rect, { x: 1.55, y: 1.85, w: 5.2, h: 4.35, fill: { type: 'none' }, line: { color: INK, width: 2 } })
  ;[['Mon to Wed', 'The student is away. The class moves on.'], ['The lesson is waiting', 'It is offered as a catch-up, the day it was taught.'], ['A path back in', 'Steps, check questions and progress, at their own pace.'], ['The teacher can see it', 'Who has caught up, and where they got stuck.']].forEach(([h, b], i) => {
    const y = 1.85 + i * 1.12
    num(s, i + 1, 7.05, y, 0.75, 1.0, i === 3 ? COPPER : GOLD); box(s, 7.8, y, 4.15, 1.0)
    text(s, h.toUpperCase(), 7.95, y + 0.1, 3.9, 0.35, { font: HEAD, size: 16 })
    text(s, b, 7.95, y + 0.5, 3.9, 0.5, { size: 11.5, color: GREY })
  })
  bar(s, 'Missing class should not mean losing the learning.', 6.4, 14)
  foot(s, 'A real lesson screen from the Manchester demo school, shown with demo data.')
  s.addShape(SH.rect, { x: 1.55, y: 6.4, w: 0.01, h: 0.01, fill: { color: PAPER }, line: { type: 'none' } })
}
// ---------- 14. study support ----------
{
  const s = base('LEARN', note(1.5, 'What students and teachers told us they want, and what is built: flashcards (58% of students chose them) with review spacing, so cards you miss come back sooner; support, core and stretch practice per lesson; a "Current and future" page for students and teachers (what is happening now and what is coming, including upcoming assignment reminders, with no email); and the teacher resource space. The screen on the right is a real lesson builder from the demo school, with the optional AI drafting button.'))
  label(s, 'Smart Learning')
  title(s, 'Study support that fits each student', { size: 36 })
  const items = [['Flashcards', 'Students build their own decks. Flip, then "Got it" or "Not yet". Cards you miss come back sooner.'], ['Three levels of practice', 'Support, core and stretch questions for each lesson, suggested from a student\'s topic results.'], ['Current and future', 'What is happening now and what is coming, for students and teachers, with upcoming assignment reminders. No email.'], ['Weak topic to lesson', 'From a weak topic in Smart Assess, \u2018one tap\u2019 to the lessons and practice for it.']]
  items.forEach(([h, b], i) => {
    const y = 1.85 + i * 1.12
    box(s, 1.55, y, 5.2, 1.0); s.addShape(SH.rect, { x: 1.55, y, w: 0.14, h: 1.0, fill: { color: GOLD }, line: { type: 'none' } })
    text(s, h.toUpperCase(), 1.85, y + 0.1, 4.8, 0.35, { font: HEAD, size: 16 })
    text(s, b, 1.85, y + 0.47, 4.8, 0.55, { size: 11, color: GREY })
  })
  s.addImage({ path: A('shot-builder.png'), x: 7.0, y: 1.85, w: 4.95, h: 4.95 * 680 / 1050, sizing: { type: 'contain', w: 4.95, h: 3.2 } })
  s.addShape(SH.rect, { x: 7.0, y: 1.85, w: 4.95, h: 3.2, fill: { type: 'none' }, line: { color: INK, width: 2 } })
  text(s, 'A teacher\'s lesson builder, with the optional "Draft with AI" button. Demo data.', 7.0, 5.12, 4.95, 0.5, { size: 10, color: GREY })
  bar(s, '58% of students chose flashcards. 90% of teachers asked for activities at different ability levels.', 6.3, 13)
}
// ---------- 14b. class feedback ----------
{
  const s = base('LEARN', note(1.5, 'Teachers asked how they would know whether lessons are landing. Each week, every student gives a one-minute evaluation of each class on their timetable: how well they understood, which topic was hardest, whether they want help, the pace, and what helped. Each teacher writes a short end-of-week reflection. The system then builds a progress report for each class with plain advice, for example "many students said the lessons went too fast", and an optional AI summary the teacher checks. Privacy is built into the database, not just the screen: the class teacher and head of department see names against the first three answers so they can help; everything else is anonymous and appears only once five students have answered. The principal team sees anonymous results only. A teacher who still has reflections to write gets one email on Friday afternoon.'))
  label(s, 'Smart Learning')
  title(s, 'Hear from every class, every week', { size: 38 })
  chip(s, 'Already built', 10.0, 0.55, 1.9, GOLD, INK)
  const steps = [['Students', 'One minute per class. How well did you follow? Which topic was hardest? Was the pace right? Anything that helped?'], ['Teachers', 'A short end-of-week reflection for each class: where you are against plan, what went well, what to do next.'], ['The report', 'A progress report for each class, with plain advice and an AI summary you check. Printable.']]
  steps.forEach(([h, b], i) => {
    const x = 1.55 + i * 3.5
    box(s, x, 1.95, 3.3, 2.55, { fill: i === 2 ? TINT : 'FFFFFF' })
    num(s, i + 1, x, 1.95, 3.3, 0.85, i === 2 ? COPPER : GOLD)
    text(s, h.toUpperCase(), x + 0.2, 2.9, 2.9, 0.4, { font: HEAD, size: 18 })
    text(s, b, x + 0.2, 3.38, 2.9, 1.1, { size: 12, color: GREY })
  })
  box(s, 1.55, 4.75, 10.4, 1.4, { fill: INK })
  text(s, 'PRIVATE BY DESIGN', 1.8, 4.85, 9.9, 0.4, { font: HEAD, size: 20, color: GOLD })
  text(s, 'Only the class teacher and head of department see names, and only so they can help. Everything else is anonymous and shown only when 5 or more students have answered. The principal team sees anonymous results.', 1.8, 5.3, 9.9, 0.8, { size: 13, color: 'FFFFFF', bold: true })
  bar(s, 'A teacher with reflections still to write gets one email on Friday afternoon.', 6.35, 14)
}
// ---------- 14c. student support ----------
{
  const s = base('LEARN', note(1.5, 'You asked how to focus on students below the school average. Four parts. One: a staff list that shows, in plain words, who may need help and why: results well below the school average or falling, absences, lessons left unfinished, a long time since sign-in, or asking for help in class feedback. Two: a support plan for each student with a goal, a review date and a record of what was done, and it shows whether their results moved afterwards. Three: for the student, a My progress page that compares them only with their own earlier results, never with classmates. Four: gentle nudges to the student, such as lessons past their date. The school average is only shown once five students have results. Teachers see marks only in the subjects they teach; heads of department see their department; the principal team sees all subjects. Students never see the staff list, a plan or the school average.'))
  label(s, 'Smart Learning')
  title(s, 'Help students before they fall behind', { size: 36 })
  chip(s, 'Already built', 10.0, 0.55, 1.9, GOLD, INK)
  const cards = [['A clear list for staff', 'Who may need help, and why, in plain words: marks below the school average or falling, absences, unfinished lessons.'], ['Support plans', 'A goal, a review date and what was done. Shows whether results moved: "Up 12 points in Science".'], ['My progress for students', 'Compared only with their own earlier results. Never classmates, never the school average.'], ['Gentle nudges', 'Away from school? Lessons past their date? A kind prompt with a button to the right place.']]
  cards.forEach(([h, b], i) => {
    const x = 1.55 + (i % 2) * 5.25, y = 1.95 + Math.floor(i / 2) * 1.75
    box(s, x, y, 5.15, 1.6); s.addShape(SH.rect, { x, y, w: 0.14, h: 1.6, fill: { color: i === 2 ? COPPER : GOLD }, line: { type: 'none' } })
    text(s, h.toUpperCase(), x + 0.35, y + 0.15, 4.6, 0.4, { font: HEAD, size: 16 })
    text(s, b, x + 0.35, y + 0.62, 4.6, 0.95, { size: 12, color: GREY })
  })
  box(s, 1.55, 5.5, 10.4, 0.75, { fill: INK })
  text(s, 'Teachers see marks only in the subjects they teach. Students never see the staff list, a plan or the school average.', 1.8, 5.5, 9.9, 0.75, { size: 13.5, bold: true, color: 'FFFFFF', valign: 'middle' })
  text(s, 'For staff to act on, never to label students. The school average appears only once 5 or more students have results.', 1.55, 6.45, 10.4, 0.4, { size: 12.5, color: GREY })
}
// ---------- 14d. videos ----------
{
  const s = base('LEARN', note(1, 'Videos: teachers and heads of department add links to videos that already exist on YouTube, Vimeo or Khan Academy. Nothing is uploaded or hosted by the school. A teacher\'s video waits for the head of department to approve it; a head\'s video is live at once. Students get a short-video feed by subject and for their grade, and a YouTube or Vimeo video plays right inside Smart Learning. Low-data mode shows no pictures and loads a video only when tapped, and turns on by itself for a phone that is saving data or on a slow connection. Students can report a problem: two reports hide the video until a teacher looks.', true))
  label(s, 'Smart Learning')
  title(s, 'Videos your teachers have chosen', { size: 38 })
  chip(s, 'Already built', 10.0, 0.55, 1.9, GOLD, INK)
  const it = [['Add a link', 'YouTube, Vimeo or Khan Academy. Nothing is uploaded, so the school hosts nothing.'], ['Approved first', 'A teacher\'s video waits for the head of department. A head\'s video is live at once.'], ['A short-video feed', 'By subject and grade. YouTube and Vimeo play right inside Smart Learning.'], ['Low-data mode', 'No pictures, and a video loads only when tapped. On by itself for slow connections.'], ['Report a problem', 'Two student reports hide a video until a teacher checks it.']]
  it.forEach(([h, b], i) => {
    const y = 1.9 + i * 0.86
    num(s, i + 1, 1.55, y, 0.75, 0.74, GOLD); box(s, 2.3, y, 9.65, 0.74)
    text(s, h.toUpperCase(), 2.5, y, 3.0, 0.74, { font: HEAD, size: 16, valign: 'middle' })
    text(s, b, 5.3, y, 6.5, 0.74, { size: 12.5, color: GREY, valign: 'middle' })
  })
  bar(s, 'Videos stay on their own site. Wifi was raised unprompted, so low-data mode is built in.', 6.35, 14)
}
// ---------- 15. library ----------
{
  const s = base('LEARN', note(1, 'The Library: books for the curriculum and books for the joy of reading, in the same place as the lessons. Smart Assess Ja chooses and clears every title (public domain or openly licensed), so schools do not upload books. The Library is built and switched on; titles are being added.', true))
  label(s, 'Smart Learning')
  title(s, 'The Library: read it, listen to it, assign it', { size: 36 })
  const it = [['Read or listen', 'Page by page, or audio that remembers where the student stopped.'], ['Browse your way', 'By shelf, genre or subject: curriculum books and reading for fun.'], ['Teacher assignments', 'Assign a book or chapter with a due date and see who finished.'], ['Bookmarks and notes', 'Students keep private bookmarks and notes. Teachers cannot read them.'], ['School controls', 'The school chooses shelves, year groups, audio and which titles are visible.']]
  it.forEach(([h, b], i) => {
    const y = 1.9 + i * 0.86
    num(s, i + 1, 1.55, y, 0.75, 0.74, GOLD); box(s, 2.3, y, 9.65, 0.74)
    text(s, h.toUpperCase(), 2.5, y, 3.0, 0.74, { font: HEAD, size: 16, valign: 'middle' })
    text(s, b, 5.3, y, 6.5, 0.74, { size: 12.5, color: GREY, valign: 'middle' })
  })
  bar(s, 'Every title is chosen and cleared by Smart Assess Ja. Schools do not upload books.', 6.35, 14)
}
intro('PLAY', INK, 'FFFFFF', 3, 'Smart Play', 'Make practice fun.',
  'Quick classroom games and challenges that make practice something students want to do. Games and exams are kept apart: Smart Play never holds a school\'s official results.',
  ['Duels, live quizzes, boards and team games', 'Points, streaks, badges and class leaderboards', 'Questions from the same topic list as lessons and tests'],
  'For students and teachers.', 'Coming soon', PAPER,
  'About half a minute. Built and tested, held back until the school chooses to launch it. The next slide shows the games.')
// ---------- 16. play ----------
{
  const s = base('PLAY', note(1, 'Smart Play is built and tested but held back until you choose to launch it. Quick, fun practice for the classroom. It does not replace formal assessment and it never holds the school\'s official results. Games and exams are kept apart on purpose.'))
  label(s, 'Smart Play')
  title(s, 'Engage and reinforce learning', { size: 38 })
  chip(s, 'Coming soon', 10.0, 0.55, 1.9, INK, 'FFFFFF')
  const g = [['Topic Mastery', 'Practise one topic and watch mastery grow.'], ['Math Duels', 'Two students race through maths questions.'], ['Live quiz', 'A quiz on the projector, answered on own devices.'], ['Jeopardy-style boards', 'Categories and points, with buzz-in for teams.'], ['Tug of War', 'Two teams pull a rope by answering questions.'], ['Rewards', 'Points, streaks, badges and class leaderboards.']]
  g.forEach(([h, b], i) => {
    const x = 1.55 + (i % 3) * 3.5, y = 1.95 + Math.floor(i / 3) * 2.05
    box(s, x, y, 3.3, 1.85, { fill: i % 2 ? TINT : 'FFFFFF' })
    s.addShape(SH.rect, { x, y, w: 3.3, h: 0.12, fill: { color: INK }, line: { type: 'none' } })
    text(s, h.toUpperCase(), x + 0.2, y + 0.3, 2.9, 0.5, { font: HEAD, size: 20 })
    text(s, b, x + 0.2, y + 0.95, 2.9, 0.8, { size: 12.5, color: GREY })
  })
  bar(s, 'Quick, fun practice. It never holds the school\'s official results.', 6.2, 14)
}
// ---------- 17. loop ----------
{
  const s = base('WHY US', note(1, 'This is the point of one connected system. A weak topic found in Smart Assess leads to a lesson in Smart Learning or a game in Smart Play, then back to assessment to see if it worked. No product reaches into another product\'s data; they share the school, the people and the topic list.'))
  label(s, 'Joined up')
  title(s, 'Assess, learn, practise, improve, assess again', { size: 34 })
  ;[['Assess', COPPER, 'Find what was missed'], ['Learn', GOLD, 'Teach it again, or catch up'], ['Practise', TINT, 'Flashcards and games'], ['Improve', TEAL, 'See the change'], ['Assess again', COPPER, 'Check it worked']].forEach(([h, f, b], i) => {
    const x = 1.55 + i * 2.1
    box(s, x, 2.3, 1.9, 2.3, { fill: f }); text(s, h.toUpperCase(), x + 0.12, 2.5, 1.7, 1.0, { font: HEAD, size: 22, color: f === TEAL ? 'FFFFFF' : INK, valign: 'middle', align: 'center' })
    text(s, b, x + 0.12, 3.55, 1.7, 0.9, { size: 11.5, bold: true, color: f === TEAL ? 'FFFFFF' : INK, align: 'center' })
    if (i < 4) text(s, '→', x + 1.88, 3.1, 0.25, 0.5, { font: HEAD, size: 22 })
  })
  box(s, 1.55, 5.0, 10.4, 1.05, { fill: INK })
  text(s, 'One shared topic list connects them. A weak topic in Smart Assess leads to a lesson in Smart Learning or a game in Smart Play.', 1.8, 5.0, 9.9, 1.05, { size: 15, bold: true, color: 'FFFFFF', valign: 'middle' })
}
// ---------- 18. roles ----------
{
  const s = base('WHY US', note(1.5, 'Everyone sees what they need and nothing more. Teachers see classrooms. Heads of department see departments. Principals and administrators see the school. Each role has its own home page and menu.', true))
  label(s, 'Built around your roles')
  title(s, 'Teachers see classrooms. HODs see departments. Leaders see the school.', { size: 30, h: 1.2 })
  const cols = [['Teachers', COPPER, ['Tests and the question bank', 'Lessons, plans and catch-up', 'Marking and results', 'Attendance for their classes', 'Report an absence, request cover']], ['Heads of department', GOLD, ['Their department\'s classes and teachers', 'Analytics and flagged sessions', 'Vet and publish school exams', 'Department attendance and topics', 'Arrange cover for absent teachers']], ['Principal and administrators', TINT, ['Staff, students and the timetable', 'Attendance and alerts school-wide', 'Integrity and AI tutor oversight', 'Messages to staff', 'School setup and settings']]]
  cols.forEach(([h, f, items], i) => {
    const x = 1.55 + i * 3.5
    box(s, x, 2.3, 3.3, 3.7)
    s.addShape(SH.rect, { x, y: 2.3, w: 3.3, h: 0.8, fill: { color: f }, line: { color: INK, width: 2 } })
    text(s, h.toUpperCase(), x + 0.2, 2.3, 2.9, 0.8, { font: HEAD, size: 19, valign: 'middle' })
    text(s, items.map((t) => ({ text: t, options: { bullet: { code: '25A0' }, breakLine: true } })), x + 0.2, 3.3, 2.9, 3.0, { size: 12.5, ls: 1.25 })
  })
}
// ---------- 19. one connected system, not a stack of tools (design supplied by the presenter; wording is theirs, unchanged) ----------
{
  const s = base('WHY US', note(1.5, 'Say it as written. Many schools use different tools for different jobs. Smart Assess Ja brings assessment, learning and practice together in one platform, with one login, one set of people and one topic list. Walk down the two columns together: separate tools and one login for everything; different security and built in security; fragmented results and meaningful results; built for other contexts and made for Jamaica. The other tools do their own jobs well. We connect the jobs.'))
  // y values below are the final positions on the slide; anything from 1.9in down is entered 0.2in higher because base() lowers it again
  const at = (y) => (y >= 1.9 ? Math.round((y - 0.2) * 1000) / 1000 : y)
  const X0 = 1.2, W = 11.0
  s.addText([{ text: 'THE ', options: { color: INK } }, { text: 'DIFFERENCE', options: { color: COPPER } }], { x: X0, y: 0.4, w: 10, h: 0.3, fontFace: MONO, fontSize: 11.5, bold: true, charSpacing: 3, margin: 0 })
  s.addText([{ text: 'ONE CONNECTED SYSTEM,', options: { color: INK, breakLine: true } }, { text: 'NOT A STACK OF TOOLS.', options: { color: COPPER } }], { x: X0, y: 0.72, w: W, h: 1.35, fontFace: HEAD, fontSize: 46, margin: 0, valign: 'top', lineSpacingMultiple: 0.92 })
  text(s, 'Many schools use different tools for different jobs. Smart Assess Ja brings assessment, learning and practice together in one platform, with one login, one set of people and one topic list.', X0, at(2.15), W, 0.6, { size: 13.5, color: GREY })
  const panels = [
    { x: X0, head: 'Most schools today', sub: 'Different tools. Different logins. Different data.', headFill: 'EDE5DC', headFg: INK, subFg: GREY, border: INK, tile: 'l', items: [['Separate tools', 'Quizzes, lessons and games are often in different platforms, each with its own login and setup.'], ['Different security', 'Each tool has its own lock-down, for example managed Chromebooks, Windows Take a Test app or Safe Exam Browser.'], ['Fragmented results', 'Some tools report on each question, others only give a quiz score.'], ['Built for other contexts', 'General tools, designed differently by each company.']] },
    { x: X0 + 5.6, head: 'Smart Assess Ja', sub: 'One platform. One login. One connected view.', headFill: COPPER, headFg: 'FFFFFF', subFg: 'FFFFFF', border: COPPER, tile: 'r', items: [['One login for everything', 'Assess, learn and practice share one login, one set of people and one topic list.'], ['Built in security', 'Includes a lock-down desktop app for Windows and Mac, with integrity flags and protected exam settings.'], ['Meaningful results', 'Missed questions, common wrong answers, who needs support and results by topic, linked to lessons and practice.'], ['Made for Jamaica', 'Lesson plans in the Ministry’s 5E format, and data handled in line with Jamaica’s Data Protection Act.']] },
  ]
  const PY = 2.85, PH = 3.6, HH = 0.78, PW = 5.4
  panels.forEach((p) => {
    s.addShape(SH.rect, { x: p.x, y: at(PY), w: PW, h: PH, fill: { color: 'FFFFFF' }, line: { color: p.border, width: 2 } })
    s.addShape(SH.rect, { x: p.x, y: at(PY), w: PW, h: HH, fill: { color: p.headFill }, line: { color: p.border, width: 2 } })
    text(s, p.head.toUpperCase(), p.x + 0.25, at(PY + 0.06), PW - 0.4, 0.4, { font: HEAD, size: 21, color: p.headFg, valign: 'middle' })
    text(s, p.sub, p.x + 0.25, at(PY + 0.44), PW - 0.4, 0.3, { size: 11, color: p.subFg, valign: 'middle' })
    const rowH = (PH - HH) / 4
    p.items.forEach(([h, b], i) => {
      const y = PY + HH + i * rowH
      if (i > 0) s.addShape(SH.line, { x: p.x + 0.2, y: at(y), w: PW - 0.4, h: 0, line: { color: 'E5DDD0', width: 1 } })
      s.addImage({ path: A(`compare/${p.tile}${i + 1}.png`), x: p.x + 0.2, y: at(y + (rowH - 0.54) / 2), w: 0.54, h: 0.54 })
      text(s, h, p.x + 0.9, at(y + 0.07), PW - 1.05, 0.24, { size: 12.5, bold: true })
      text(s, b, p.x + 0.9, at(y + 0.3), PW - 1.05, rowH - 0.32, { size: 9.8, color: GREY })
    })
  })
  s.addShape(SH.rect, { x: X0, y: at(6.58), w: W, h: 0.66, fill: { color: INK }, line: { type: 'none' } })
  s.addText([{ text: 'The other tools do their own jobs well.', options: { color: 'FFFFFF', breakLine: true } }, { text: 'We connect the jobs.', options: { color: GOLD } }], { x: X0 + 0.3, y: at(6.58), w: W - 0.5, h: 0.66, fontFace: BODY, fontSize: 15, bold: true, margin: 0, valign: 'middle' })
}
// ---------- 19b. strong tools, different jobs (design supplied by the presenter; wording and every mark in the table are theirs, unchanged) ----------
{
  const s = base('WHY US', note(2, 'Walk down the table one section at a time: assessment, learning, practice and engagement, school-wide. Each platform has strengths. Smart Assess Ja is different because it brings assessment, learning and practice together in one school platform. The question is not "can another tool do one of these things?" It is "how many tools and handoffs does the school need?" Other tools are excellent in their areas. Smart Assess Ja is designed to connect the whole learning process.'))
  const at = (y) => (y >= 1.9 ? Math.round((y - 0.2) * 1000) / 1000 : y)
  const X0 = 1.25, TW = 11.1
  s.addText([{ text: 'THE ', options: { color: INK } }, { text: 'LANDSCAPE', options: { color: COPPER } }], { x: X0, y: 0.32, w: 10, h: 0.3, fontFace: MONO, fontSize: 11.5, bold: true, charSpacing: 3, margin: 0 })
  s.addText([{ text: 'STRONG TOOLS. ', options: { color: INK } }, { text: 'DIFFERENT JOBS.', options: { color: COPPER } }], { x: X0, y: 0.58, w: TW, h: 0.7, fontFace: HEAD, fontSize: 38, margin: 0, valign: 'middle' })
  text(s, 'Each platform has strengths. Smart Assess Ja is different because it brings assessment, learning and practice together in one school platform.', X0, 1.3, TW, 0.45, { size: 11.5, color: GREY })
  const Y = 1.8, LABW = 3.4, COLW = (TW - LABW) / 7
  const HEAD_H = 0.54, SEC_H = 0.16, ROW_H = 0.175
  const names = ['Google Classroom', 'Microsoft Teams', 'Moodle', 'Canvas', 'Kahoot!', 'Quizizz', 'Smart Assess Ja']
  const hc = (t, o = {}) => ({ text: t, options: { fontFace: BODY, fontSize: 6.8, bold: true, color: o.fg || INK, fill: { color: o.fill || 'FFFBF6' }, align: o.align || 'center', valign: 'bottom', margin: [0, 0.02, 0.03, 0.02] } })
  const sec = (t, fill) => [{ text: t, options: { colspan: 8, fontFace: MONO, fontSize: 6.8, bold: true, charSpacing: 2, color: INK, fill: { color: fill }, valign: 'middle', margin: [0, 0.08, 0, 0.08] } }]
  const mark = (v, last) => {
    const fill = last ? 'FFEAD8' : 'FFFFFF'
    const base = { fontFace: BODY, align: 'center', valign: 'middle', fill: { color: fill }, margin: [0, 0.02, 0, 0.02], border: [{ type: 'none' }, { type: 'none' }, { type: 'solid', pt: 0.5, color: 'E5DDD0' }, { type: 'none' }] }
    if (v === 'y') return { text: '✔', options: { ...base, fontSize: 8.5, bold: true, color: INK } }
    if (v === 'l') return { text: 'Limited', options: { ...base, fontSize: 6.8, color: MUTED } }
    return { text: '–', options: { ...base, fontSize: 8, color: MUTED } }
  }
  const row = (label, marks) => [{ text: label, options: { fontFace: BODY, fontSize: 7.4, color: INK, fill: { color: 'FFFFFF' }, valign: 'middle', margin: [0, 0.08, 0, 0.08], border: [{ type: 'none' }, { type: 'none' }, { type: 'solid', pt: 0.5, color: 'E5DDD0' }, { type: 'none' }] } }, ...marks.split('').map((m, i) => mark(m, i === 6))]
  const rows = [
    [{ text: 'FEATURE / JOB', options: { fontFace: MONO, fontSize: 6.8, bold: true, charSpacing: 2, color: INK, fill: { color: 'FFFBF6' }, valign: 'middle', margin: [0, 0.08, 0, 0.08] } }, ...names.map((n, i) => hc(n, i === 6 ? { fill: COPPER, fg: 'FFFFFF' } : {}))],
    sec('ASSESSMENT', 'FDC598'),
    row('Create and deliver exams', 'yyyynny'), row('Question bank', 'nnyylly'), row('Different question types (MC, short answer, essay, etc.)', 'yyyylyy'), row('Automatic marking (objective questions)', 'yyyyyyy'), row('Exam security and lock-down', 'yyyynly'), row('Integrity flags for essays', 'lnllnny'),
    sec('LEARNING', '98C4C3'),
    row('Lesson planning (5E format)', 'llllnny'), row('Structured lessons', 'yyyylyy'), row('Catch-up learning for absent students', 'nnllnny'), row('AI-assisted lesson creation', 'yylllly'), row('Shared lesson library', 'llyylyy'), row('Student progress by topic', 'ylyylly'),
    sec('PRACTICE AND ENGAGEMENT', 'F2CF72'),
    row('Live games and quizzes', 'llllyyy'), row('Topic Mastery and Math Duels', 'nnnnnny'), row('XP, badges, streaks, leaderboards', 'nnllyyy'),
    sec('SCHOOL-WIDE', 'C3BAAF'),
    row('One login and one topic list', 'nnnnnny'), row('Built for Jamaican schools', 'nnnnnny'), row('Attendance, timetable, staff tools (in the same platform)', 'nlllnny'),
  ]
  const rowH = rows.map((r, i) => (i === 0 ? HEAD_H : r.length === 1 ? SEC_H : ROW_H))
  s.addTable(rows, { x: X0, y: Y, w: TW, colW: [LABW, ...Array(7).fill(COLW)], rowH, border: { type: 'none' } })
  // logos sit over the header cells
  const logos = [['google', 0.27, 0.27], ['teams', 0.29, 0.27], ['moodle', 0.31, 0.26], ['canvas', 0.27, 0.27], ['kahoot', 0.52, 0.245], ['quizizz', 0.26, 0.26], ['sa', 0.26, 0.27]]
  logos.forEach(([f, w, h], i) => s.addImage({ path: A(`compare/${f}.png`), x: X0 + LABW + i * COLW + (COLW - w) / 2, y: at(Y + 0.2) + 0.0 - 0.0, w, h }))
  const barY = Y + HEAD_H + 4 * SEC_H + 18 * ROW_H + 0.12
  s.addShape(SH.rect, { x: X0, y: at(Math.max(barY, 6.45)), w: TW, h: 0.62, fill: { color: INK }, line: { type: 'none' } })
  s.addText([{ text: 'The question is not "can another tool do one of these things?"', options: { color: 'FFFFFF', breakLine: true } }, { text: 'It is "how many tools and handoffs does the school need?"', options: { color: GOLD } }], { x: X0 + 0.25, y: at(Math.max(barY, 6.45)), w: 7.3, h: 0.62, fontFace: BODY, fontSize: 12, bold: true, margin: 0, valign: 'middle' })
  s.addShape(SH.line, { x: X0 + 7.7, y: at(Math.max(barY, 6.45)) + 0.1, w: 0, h: 0.42, line: { color: GREY, width: 1 } })
  s.addText('Other tools are excellent in their areas. Smart Assess Ja is designed to connect the whole learning process.', { x: X0 + 7.9, y: at(Math.max(barY, 6.45)), w: 3.05, h: 0.62, fontFace: BODY, fontSize: 8.5, color: 'E8DFD2', margin: 0, valign: 'middle' })
}
// ---------- 19c. context (two paragraphs supplied by the presenter, word for word) ----------
{
  const P1 = 'Other platforms are good at what they do. Smart Assess JA is designed to connect assessment, learning and practice around the same students, classes and curriculum topics, while reducing the work teachers do between those activities.'
  const P2 = 'Google Classroom is useful for managing classwork. Smart Assess is designed to go further into the assessment process, from creating and administering examinations to marking, understanding results and supporting learning through connected products.'
  const s = base('WHY US', note(1.5, 'Say these two paragraphs as written.\n\n' + P1 + '\n\n' + P2))
  label(s, 'The difference in words')
  ;[[P1, COPPER, 1.45], [P2, TEAL, 3.95]].forEach(([p, accent, y]) => {
    box(s, 1.55, y, 10.4, 2.2, { fill: 'FFFFFF' })
    s.addShape(SH.rect, { x: 1.55, y, w: 0.18, h: 2.2, fill: { color: accent }, line: { type: 'none' } })
    text(s, p, 2.05, y, 9.7, 2.2, { size: 21, valign: 'middle', color: INK })
  })
}
// ---------- 20. is not ----------
{
  const s = base('WHY US', note(1, 'Be clear about what this is not. It is not a teacher replacement: teachers stay in control of questions, marking and decisions. AI can assist with drafting and review; a person decides. It is not just a PDF on a screen: it supports the work before, during and after an assessment. And it is not three disconnected apps: the products share the school, the people and the topics.'))
  label(s, 'Clarity')
  title(s, 'What Smart Assess is not', { size: 42 })
  const q = [['Not a teacher replacement', 'Teachers stay in control of questions, marking and decisions.'], ['Not AI making final decisions', 'AI can help draft and suggest. A person decides, every time.'], ['Not just a PDF on a screen', 'It supports the work before, during and after an assessment.'], ['Not three disconnected apps', 'The products share the school, the people and the topic list.']]
  q.forEach(([h, b], i) => {
    const x = 1.55 + (i % 2) * 5.25, y = 1.95 + Math.floor(i / 2) * 2.15
    box(s, x, y, 5.1, 1.95, { fill: i % 3 === 0 ? TINT : 'FFFFFF' })
    s.addShape(SH.rect, { x, y, w: 0.14, h: 1.95, fill: { color: COPPER }, line: { type: 'none' } })
    text(s, h.toUpperCase(), x + 0.4, y + 0.25, 4.5, 0.6, { font: HEAD, size: 23 })
    text(s, b, x + 0.4, y + 0.95, 4.5, 0.9, { size: 14, color: GREY })
  })
}
// ---------- 21. trust ----------
{
  const s = base('WHY US', note(1.5, 'Trust, data and AI. Each school\'s data lives in its own separate environment. Access rules are enforced by the database itself. Two-factor sign-in is required for every staff account, which you set up today. AI helps a teacher write and suggest; it never saves a mark and never decides. Every suggestion is reviewed by a person before it is used. The optional AI tutor stays inside a lesson, is switched on by the school, can be switched off by the principal at any time, and its conversations can be read by the teacher; worrying conversations are flagged for an adult.'))
  label(s, 'Trust')
  title(s, 'Trust, data and AI with a person in charge', { size: 36 })
  const cols = [['Your data', INK, 'FFFFFF', ['Each school\'s data lives in its own separate environment', 'Access rules are enforced by the database itself', 'Two-factor sign-in is required for all staff', 'Handled in line with Jamaica\'s Data Protection Act']], ['AI on a short leash', COPPER, INK, ['AI helps a teacher write: polish a question, import a PDF, draft a lesson plan', 'AI suggests essay marks. It never saves one; the teacher edits and decides', 'Every suggestion is reviewed by a person before it is used', 'The optional AI tutor stays inside a lesson; the principal can switch it off', 'AI is told to use Jamaican examples, the National Standards Curriculum and Vision 2030']]]
  cols.forEach(([h, f, fg, items], i) => {
    const x = 1.55 + i * 5.25
    box(s, x, 1.95, 5.1, 4.5)
    s.addShape(SH.rect, { x, y: 1.95, w: 5.1, h: 0.8, fill: { color: f }, line: { color: INK, width: 2 } })
    text(s, h.toUpperCase(), x + 0.25, 1.95, 4.6, 0.8, { font: HEAD, size: 24, color: fg, valign: 'middle' })
    text(s, items.map((t) => ({ text: t, options: { bullet: { code: '25A0' }, breakLine: true } })), x + 0.25, 3.0, 4.6, 3.35, { size: 13, ls: 1.2 })
  })
}
// ---------- 22. you asked, we built ----------
{
  const s = base('WHY US', note(1.5, 'This closes the loop on the survey. Left: what Manchester students and teachers told us. Right: what now exists. Be honest about the two that are not finished: step-by-step explanations are partly covered by lessons and the optional AI tutor, and offline use of flashcards and opened lessons is built and in testing.'))
  label(s, 'You asked. We built.')
  title(s, 'What you told us, and what is built', { size: 34 })
  const st = (t) => ({ text: t.toUpperCase(), options: { bold: true, fontFace: MONO, fontSize: 10, color: t === 'Built' ? INK : INK, fill: { color: t === 'Built' ? GOLD : t === 'Partly' ? TINT : 'FFFFFF' }, align: 'center', valign: 'middle' } })
  const c = (t, b) => ({ text: t, options: { fontFace: BODY, fontSize: 12, bold: !!b, color: INK, valign: 'middle', fill: { color: 'FFFFFF' } } })
  const h = (t) => ({ text: t.toUpperCase(), options: { bold: true, fontFace: MONO, fontSize: 9.5, color: 'FFFFFF', fill: { color: INK } } })
  const rows = [[h('You said'), h('What exists'), h('Status')],
    [c('Marking takes the most time (80% of teachers)'), c('Auto-marking, marking points, AI-suggested essay marks', true), st('Built')],
    [c('Who is struggling, what mistakes are common (80% and 70% of teachers)'), c('Exam insight for every test', true), st('Built')],
    [c('What a missed student missed (90% of teachers)'), c('Catch-up lessons for absent students', true), st('Built')],
    [c('Activities for different ability levels (90% of teachers)'), c('Support, core and stretch practice', true), st('Built')],
    [c('AI-assisted lesson planning (80% of teachers)'), c('AI-drafted 5E lesson plans', true), st('Built')],
    [c('Topics I need to improve (75% of students)'), c('My Topics, with a "practise this topic" button', true), st('Built')],
    [c('Flashcards (58% of students)'), c('Flashcards with review spacing', true), st('Built')],
    [c('Step-by-step explanations (92% of students)'), c('5E lessons and the optional AI tutor, with more to come', true), st('Partly')],
    [c('Wifi and offline access (raised unprompted)'), c('Flashcards and opened lessons offline', true), st('In testing')]]
  s.addTable(rows, { x: 1.55, y: 1.65, w: 10.4, colW: [4.6, 4.5, 1.3], border: { type: 'solid', pt: 1, color: INK }, margin: [0.04, 0.1, 0.04, 0.1], rowH: 0.5 })
}
// ---------- 23. pathway ----------
{
  const s = base('WHY US', note(1, 'A starting proposal, not a plan handed down. Today is step one: experience it. Then choose where to start, pilot it with real classes, review the evidence together, and decide how to widen it. Scope, timing and measures are decided with you.'))
  label(s, 'The next step')
  title(s, 'A pathway we can shape together', { size: 40 })
  ;[['Experience', 'Today: use it hands-on and tell us what you see.'], ['Choose a start', 'Pick departments, classes and assessment types.'], ['Pilot', 'Run it for a defined period with real classes.'], ['Review', 'Look at the evidence together.'], ['Expand', 'Decide how and when to widen it.']].forEach(([h, b], i) => {
    const x = 1.55 + i * 2.1
    box(s, x, 1.95, 1.95, 2.35, { fill: i === 0 ? TINT : 'FFFFFF' }); num(s, i + 1, x, 1.95, 1.95, 0.85, i === 0 ? COPPER : GOLD)
    text(s, h.toUpperCase(), x + 0.14, 2.9, 1.7, 0.4, { font: HEAD, size: 17 })
    text(s, b, x + 0.14, 3.4, 1.7, 0.9, { size: 11.5, color: GREY })
  })
  text(s, 'HOW WE WOULD MEASURE SUCCESS', 1.55, 4.65, 10, 0.3, { font: MONO, size: 11, bold: true, cs: 2 })
  ;['Teacher hours saved marking and preparing', 'Paper no longer printed and copied', 'Time from exam to usable results', 'Learning gaps found and acted on', 'Teacher and student feedback'].forEach((t, i) => {
    const x = 1.55 + i * 2.1
    box(s, x, 5.05, 1.95, 1.1, { fill: TINT }); text(s, t, x + 0.12, 5.05, 1.72, 1.1, { size: 11, bold: true, valign: 'middle' })
  })
  text(s, 'Scope, timing and measures are decided with you. This is a starting proposal.', 1.55, 6.45, 10.4, 0.4, { size: 14, color: GREY })
}
// ---------- 24. live ----------
{
  const s = base('', note(0.5, 'Hand over to the live demo. Teacher, student, leadership. Everyone signs in using page 6 of their guide. Remind them the password changes on first sign-in and that they will need their authenticator app. The system administrator is signed in by the facilitator. The questions page of the guide is for anything that comes up; we come back to questions at the end.'))
  s.addShape(SH.rect, { x: 1.55, y: 0.85, w: 10.4, h: 4.3, fill: { color: INK }, line: { type: 'none' } })
  s.addShape(SH.rect, { x: 1.55, y: 5.05, w: 10.4, h: 0.14, fill: { color: GOLD }, line: { type: 'none' } })
  text(s, 'YOU\'VE SEEN IT.', 2.0, 1.3, 9.4, 1.4, { font: HEAD, size: 68, color: 'FFFFFF' })
  text(s, 'NOW SEE IT LIVE.', 2.0, 2.75, 9.4, 1.4, { font: HEAD, size: 68, color: GOLD })
  text(s, 'Teacher. Student. Leadership.', 2.0, 4.25, 9.4, 0.5, { size: 22, bold: true, color: 'FFFFFF' })
  text(s, 'Open page 6 of your guide and sign in at', 1.55, 5.6, 10, 0.4, { size: 18 })
  text(s, 'mhs.smartassessja.com', 1.55, 6.05, 10, 0.8, { font: HEAD, size: 40, color: COPPER })
}

pres.writeFile({ fileName: OUT }).then(() => console.log('Wrote', OUT))
