// Builds the Manchester High School deck: Part 1 (strategy) + Part 2 (hands-on demo).
// Run:  NODE_PATH=<folder with pptxgenjs, react-icons, sharp> node build_deck.js
const path = require('path')
const pptxgen = require('pptxgenjs')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const sharp = require('sharp')
const tb = require('react-icons/tb')
const SKILL = '/Users/boxerboychris/Library/Application Support/Claude/local-agent-mode-sessions/skills-plugin/67fa1c82-d928-4618-8afd-fe3b43fbb5bf/4d12757b-7839-4cd3-a0e3-ea327ac6ead7/skills/pptx'
const { applyTheme } = require(SKILL + '/scripts/apply_theme.js')

const A = (f) => path.join(__dirname, 'assets', f)
const OUT = path.join(__dirname, 'Smart-Assess-Ja-Manchester-Presentation.pptx')

const THEME = {
  name: 'Smart Assess Ja',
  headFontFace: 'Calibri', bodyFontFace: 'Calibri',
  colors: { dk1: '1E1208', lt1: 'FFFFFF', dk2: '14100C', lt2: 'FDF8F3', accent1: 'D4762A', accent2: '1F8A84', accent3: 'F2C230', accent4: 'A85A18', accent5: '6B4F35', accent6: 'BFB09C', hlink: 'D4762A', folHlink: '6B4F35' },
}
const HEX = { panel: '1E1710', panelLine: '3A2E22', border: 'EAD9C4', copperLt: 'EC924A', tealLt: '3DB5AB', gold: 'F2C230', goldDk: '8A6A00', brown: '6B4F35', muted: 'BFB09C', paper: 'F6EDE0', cream: 'FDF8F3', ink: '14100C' }

const pres = new pptxgen()
pres.layout = 'LAYOUT_WIDE' // 13.33 x 7.5
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace }
pres.title = 'Smart Assess Ja: Built for Manchester High School'
pres.author = 'Smart Assess Ja'
pres.company = 'Smart Assess Ja'
const C = pres.SchemeColor
const SH = pres.ShapeType
pres.addSection({ title: 'Part 1: The strategy' })
pres.addSection({ title: 'Part 2: Hands-on session' })

// ---------- layouts ----------
const FOOT = 'SMART ASSESS JA   |   BUILT FOR MANCHESTER HIGH SCHOOL'
pres.defineSlideMaster({
  title: 'LIGHT', background: { color: HEX.cream },
  objects: [
    { placeholder: { options: { name: 'title', type: 'title', x: 0.7, y: 0.6, w: 11.93, h: 1.1, fontSize: 34, bold: true, color: C.text1, align: 'left', valign: 'top', margin: 0 }, text: '' } },
    { text: { text: FOOT, options: { x: 0.7, y: 7.02, w: 8, h: 0.3, fontSize: 10, color: C.accent5, charSpacing: 3, margin: 0, isTextBox: true } } },
  ],
  slideNumber: { x: 12.0, y: 7.02, w: 0.63, h: 0.3, fontSize: 10, color: C.accent5, align: 'right' },
})
pres.defineSlideMaster({
  title: 'DARK', background: { path: A('bg-dark-right.png') },
  objects: [
    { placeholder: { options: { name: 'title', type: 'title', x: 0.7, y: 0.6, w: 11.93, h: 1.1, fontSize: 34, bold: true, color: C.background1, align: 'left', valign: 'top', margin: 0 }, text: '' } },
    { text: { text: FOOT, options: { x: 0.7, y: 7.02, w: 8, h: 0.3, fontSize: 10, color: C.accent6, charSpacing: 3, margin: 0, isTextBox: true } } },
  ],
  slideNumber: { x: 12.0, y: 7.02, w: 0.63, h: 0.3, fontSize: 10, color: C.accent6, align: 'right' },
})
pres.defineSlideMaster({ title: 'DARK_BARE', background: { path: A('bg-dark-center.png') }, objects: [], slideNumber: { x: 12.0, y: 7.02, w: 0.63, h: 0.3, fontSize: 10, color: C.accent6, align: 'right' } })

// ---------- helpers ----------
const iconCache = new Map()
async function icon(name, color) {
  const key = name + color
  if (iconCache.has(key)) return iconCache.get(key)
  const svg = renderToStaticMarkup(React.createElement(tb[name], { color: '#' + color, size: 256 }))
  const buf = await sharp(Buffer.from(svg)).resize(256, 256).png().toBuffer()
  const data = 'image/png;base64,' + buf.toString('base64')
  iconCache.set(key, data); return data
}
const shadow = () => ({ type: 'outer', color: '000000', opacity: 0.10, blur: 10, offset: 2, angle: 90 })
const T = (s, text, x, y, w, h, o = {}) => s.addText(text, Object.assign({ x, y, w, h, margin: 0, valign: 'top', isTextBox: true, fontSize: 16, color: C.text1 }, o))
async function iconDot(s, name, x, y, d, fill, color, name2) {
  s.addShape(SH.ellipse, { x, y, w: d, h: d, fill: { color: fill }, line: { color: fill, width: 0 }, objectName: name2 || 'icon circle' })
  const p = d * 0.22
  s.addImage({ data: await icon(name, color), x: x + p, y: y + p, w: d - 2 * p, h: d - 2 * p, objectName: 'icon' })
}
function lightCard(s, x, y, w, h, fill) { s.addShape(SH.roundRect, { x, y, w, h, rectRadius: 0.12, fill: { color: fill || 'FFFFFF' }, line: { color: HEX.border, width: 1 }, shadow: shadow(), objectName: 'card' }) }
function darkCard(s, x, y, w, h) { s.addShape(SH.roundRect, { x, y, w, h, rectRadius: 0.12, fill: { color: HEX.panel }, line: { color: HEX.panelLine, width: 1 }, objectName: 'card' }) }
function chip(s, text, x, y, w, h, fill, color, fs) { s.addShape(SH.roundRect, { x, y, w, h, rectRadius: h / 2, fill: { color: fill }, line: { color: fill, width: 0 }, objectName: 'chip' }); T(s, text, x, y, w, h, { align: 'center', valign: 'middle', fontSize: fs || 11, bold: true, color }) }
function arrow(s, x1, y1, x2, y2, color, w) { s.addShape(SH.line, { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1), flipH: x2 < x1, flipV: y2 < y1, line: { color, width: w || 2, endArrowType: 'triangle' }, objectName: 'arrow' }) }
function eyebrow(s, text, dark) { T(s, text, 0.7, 0.28, 9, 0.25, { fontSize: 11, bold: true, color: dark ? HEX.copperLt : C.accent1, charSpacing: 4 }) }
function bullets(s, items, x, y, w, h, o = {}) {
  s.addText(items.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i < items.length - 1 } })), Object.assign({ x, y, w, h, margin: 0, valign: 'top', isTextBox: true, fontSize: 16, color: C.text1, paraSpaceAfter: 8 }, o))
}
function part1(title, ey, dark, bg) {
  const s = pres.addSlide({ masterName: dark ? 'DARK' : 'LIGHT', sectionTitle: 'Part 1: The strategy' })
  if (dark && bg) s.background = { path: A(bg) }
  eyebrow(s, ey || 'PART 1   |   THE STRATEGY', dark)
  if (title) s.addText(title, { placeholder: 'title' })
  return s
}
function part2(title, ey, dark, bg) {
  const s = pres.addSlide({ masterName: dark ? 'DARK' : 'LIGHT', sectionTitle: 'Part 2: Hands-on session' })
  if (dark && bg) s.background = { path: A(bg) }
  eyebrow(s, ey || 'PART 2   |   HANDS-ON SESSION', dark)
  if (title) s.addText(title, { placeholder: 'title' })
  return s
}
function bare(section, bg) {
  const s = pres.addSlide({ masterName: 'DARK_BARE', sectionTitle: section })
  if (bg) s.background = { path: A(bg) }
  return s
}
const orbs = (s, x, y, d) => { // the three-product motif
  const cols = [['D4762A', 0], ['1F8A84', 0.62], ['F2C230', 1.24]]
  cols.forEach(([c, off]) => s.addShape(SH.ellipse, { x: x + off * d, y, w: d, h: d, fill: { color: c, transparency: 18 }, line: { color: c, width: 0 }, objectName: 'product circle' }))
}

;(async () => {
  // preload icons
  const need = { dark: 'F6EDE0', ink: '1E1208', copper: 'D4762A', white: 'FFFFFF', teal: '1F8A84' }
  for (const n of ['TbFileText', 'TbDatabase', 'TbCloudOff', 'TbReportAnalytics', 'TbChartBar', 'TbShieldCheck', 'TbUsers', 'TbSchool', 'TbBook', 'TbRoute', 'TbDeviceGamepad2', 'TbTrophy', 'TbFlame', 'TbMedal', 'TbBolt', 'TbEye', 'TbLock', 'TbCircleCheck', 'TbPrinter', 'TbPencil', 'TbListCheck', 'TbClock', 'TbUser', 'TbUserCheck', 'TbRobot', 'TbVolume', 'TbDevices', 'TbFlag', 'TbBrain', 'TbBulb', 'TbBooks', 'TbBuildingCommunity', 'TbKey', 'TbRefresh', 'TbTarget', 'TbCalendarEvent', 'TbReplace', 'TbMessageCircle', 'TbHandClick', 'TbSparkles', 'TbChecklist', 'TbLayoutDashboard', 'TbClipboardList', 'TbWifiOff', 'TbDeviceLaptop', 'TbAward', 'TbSwords'])
    for (const col of ['FFFFFF', '1E1208', 'D4762A']) await icon(n, col)

  // =================== PART 1 ===================
  // 1. Title
  {
    const s = bare('Part 1: The strategy', 'bg-dark-left.png')
    s.addImage({ path: A('photo-campus.jpg'), x: 6.3, y: 0, w: 7.03, h: 7.5, sizing: { type: 'cover', w: 7.03, h: 7.5 }, altText: 'Aerial view of a hillside school at sunrise', objectName: 'campus photo' })
    s.addShape(SH.roundRect, { x: 0.7, y: 0.7, w: 1.05, h: 1.05, rectRadius: 0.2, fill: { color: HEX.paper }, line: { color: HEX.paper, width: 0 }, objectName: 'logo plate' })
    s.addImage({ path: A('logo-mark.png'), x: 0.84, y: 0.86, w: 0.77, h: 0.72, altText: 'Smart Assess Ja logo', objectName: 'logo' })
    T(s, 'SMART ASSESS JA', 0.7, 2.55, 5.5, 1.0, { fontSize: 38, bold: true, color: C.background1, charSpacing: 5 })
    T(s, 'Smarter Assessments.\nBetter Learning.', 0.7, 3.6, 5.4, 1.2, { fontSize: 28, color: HEX.copperLt })
    T(s, 'Built for Manchester High School', 0.7, 5.5, 5.4, 0.4, { fontSize: 20, color: C.background1 })
    T(s, 'Strategic presentation and hands-on session', 0.7, 6.4, 5.4, 0.3, { fontSize: 14, color: HEX.muted })
    s.addNotes('TIMING: this slide appears right after the opening video (about 1.5 minutes). Allow 1 minute here.\n\nSAY: Thank you for your time. The film showed an idea. In the next 30 minutes I will show how that idea is built for a real school, and then you will experience it yourselves.\n\nNOTE: The picture is an AI-generated impression of a hillside school, used in the film. It is not a photograph of Manchester High School.')
  }

  // 2. Agenda
  {
    const s = part1('Today: the strategy, then the experience')
    const cols = [
      { x: 0.7, ic: 'TbRoute', col: 'D4762A', h: 'Part 1: The strategy', m: 'About 30 minutes', l: ['The problem, and the scale of it', 'Smart Assess, Smart Learning and Smart Play', 'How it fits the roles in your school', 'A pilot pathway we can shape together'] },
      { x: 6.85, ic: 'TbHandClick', col: '1F8A84', h: 'Part 2: Hands-on session', m: 'About 40 minutes', l: ['Experience it as a teacher, a student and a leader', 'Explore on your own for 10 minutes', 'Tell us what works and what does not', 'Decide together where it could start'] },
    ]
    for (const c of cols) {
      lightCard(s, c.x, 1.95, 5.78, 3.6)
      await iconDot(s, c.ic, c.x + 0.4, 2.3, 0.7, c.col, 'FFFFFF')
      T(s, c.h, c.x + 1.3, 2.3, 4.2, 0.4, { fontSize: 22, bold: true })
      T(s, c.m, c.x + 1.3, 2.75, 4.2, 0.3, { fontSize: 14, color: C.accent5 })
      bullets(s, c.l, c.x + 0.4, 3.4, 4.98, 2.0, { fontSize: 16 })
    }
    s.addShape(SH.roundRect, { x: 0.7, y: 5.8, w: 11.93, h: 0.9, rectRadius: 0.12, fill: { color: '1E1208' }, line: { color: '1E1208', width: 0 }, objectName: 'goal banner' })
    T(s, 'By the end: a shared view of where Smart Assess Ja could start at Manchester High School.', 1.1, 5.8, 11.1, 0.9, { fontSize: 18, bold: true, color: C.background1, valign: 'middle' })
    s.addNotes('TIMING: 1 minute.\n\nSAY: Two parts. First, the strategy: why this matters and what the three products are. Then the part I am most looking forward to: you will log in and use it.\n\nSET EXPECTATIONS: There is no contract to sign today. By the end I want us to have a shared view of where Smart Assess Ja could start at Manchester High School, if anywhere.')
  }

  // 3. Statement
  {
    const s = bare('Part 1: The strategy', 'bg-dark-right.png')
    T(s, 'Technology finally organized around how a school actually works.', 0.9, 2.1, 7.4, 2.8, { fontSize: 42, bold: true, color: C.background1 })
    T(s, 'That is the idea behind Smart Assess Ja.', 0.9, 5.0, 8, 0.5, { fontSize: 20, color: HEX.copperLt })
    orbs(s, 8.6, 2.7, 1.9)
    s.addNotes('TIMING: 45 seconds. Pause on this slide.\n\nSAY: Schools do not work like generic software. They work through people and roles: students, teachers, heads of department, administrators, leadership. Smart Assess Ja is organized around that structure rather than asking a school to bend around a tool.\n\nThe three circles are the three products you are about to see.')
  }

  // 4. The problem
  {
    const s = part1('Every term, learning travels onto paper, and back again')
    s.addImage({ path: A('photo-teacher-dusk.jpg'), x: 0.7, y: 1.95, w: 4.2, h: 4.15, sizing: { type: 'cover', w: 4.2, h: 4.15 }, altText: 'A teacher marking a pile of exam scripts at dusk', objectName: 'teacher photo' })
    const steps = ['Teacher creates the exam', 'Exam is printed', 'Copies multiply', 'Students sit the exam', 'Papers are collected', 'Teacher marks', 'Grades are recorded', 'Results are analyzed', 'Who needs help?']
    const x0 = 5.2, w = 2.3, g = 0.215, h = 1.25, gy = 0.2
    steps.forEach((t, i) => {
      const x = x0 + (i % 3) * (w + g), y = 1.95 + Math.floor(i / 3) * (h + gy), last = i === 8
      s.addShape(SH.roundRect, { x, y, w, h, rectRadius: 0.12, fill: { color: last ? 'D4762A' : 'FFFFFF' }, line: { color: last ? 'D4762A' : HEX.border, width: 1 }, shadow: shadow(), objectName: 'step ' + (i + 1) })
      s.addShape(SH.ellipse, { x: x + 0.18, y: y + 0.2, w: 0.38, h: 0.38, fill: { color: last ? 'FFFFFF' : 'FAE8D4' }, line: { color: last ? 'FFFFFF' : 'FAE8D4', width: 0 }, objectName: 'number' })
      T(s, String(i + 1), x + 0.18, y + 0.2, 0.38, 0.38, { align: 'center', valign: 'middle', fontSize: 13, bold: true, color: last ? 'A85A18' : 'A85A18' })
      T(s, t, x + 0.18, y + 0.66, w - 0.36, 0.5, { fontSize: 15, bold: true, color: last ? C.background1 : C.text1 })
    })
    T(s, 'Time.   Cost.   Paper.   Administration.   Fragmentation.', 5.2, 6.4, 7.4, 0.35, { fontSize: 16, bold: true, color: C.accent1, charSpacing: 1 })
    s.addNotes('TIMING: 2 minutes.\n\nSAY: This is not a criticism of how anyone here works. It is what exams require when everything moves through paper. Walk the chain: create, print, copy, sit, collect, mark, record, analyze. And only at the end, if there is time, do we ask the question that matters most: who needs help?\n\nASK THE ROOM (optional): "Which of these steps takes your department the longest?"\n\nPicture: AI-generated, from the film.')
  }

  // 5. Scale
  {
    const s = part1('One school of about 1,800 students', undefined, true, 'bg-dark-center.png')
    T(s, '≈1,800', 0.7, 2.2, 4.6, 1.3, { fontSize: 80, bold: true, color: HEX.copperLt })
    T(s, 'students', 0.7, 3.5, 4.6, 0.5, { fontSize: 26, color: C.background1 })
    T(s, 'Every test, lesson and class creates information. The question is whether teachers and leaders can see it.', 0.7, 4.5, 4.4, 1.6, { fontSize: 18, color: HEX.muted })
    // network
    const cx = 8.8, cy = 4.0
    const nodes = [['Students', -2.5, 0.1, 'D4762A'], ['Teachers', -1.45, -1.9, 'EC924A'], ['HODs', 1.45, -1.9, '3DB5AB'], ['Administrators', 2.5, 0.1, 'F2C230'], ['Leadership', 0, 1.9, 'F6EDE0']]
    nodes.forEach(([l, dx, dy, col]) => s.addShape(SH.line, { x: Math.min(cx, cx + dx), y: Math.min(cy, cy + dy), w: Math.abs(dx), h: Math.abs(dy), flipH: dx < 0, flipV: dy < 0, line: { color: HEX.panelLine, width: 1.5 }, objectName: 'link' }))
    s.addShape(SH.ellipse, { x: cx - 0.95, y: cy - 0.95, w: 1.9, h: 1.9, fill: { color: HEX.panel }, line: { color: 'D4762A', width: 2 }, objectName: 'school' })
    T(s, 'Manchester\nHigh School', cx - 0.95, cy - 0.95, 1.9, 1.9, { align: 'center', valign: 'middle', fontSize: 15, bold: true, color: C.background1 })
    nodes.forEach(([l, dx, dy, col]) => {
      s.addShape(SH.ellipse, { x: cx + dx - 0.2, y: cy + dy - 0.2, w: 0.4, h: 0.4, fill: { color: col }, line: { color: col, width: 0 }, objectName: 'node' })
      T(s, l, cx + dx - 1.0, cy + dy + 0.3, 2.0, 0.34, { fontSize: 16, bold: true, color: C.background1, align: 'center' })
    })
    s.addNotes('TIMING: 1.5 minutes.\n\nSAY: About 1,800 students, and around them teachers, heads of department, administrators and school leadership. Every one of those people creates and needs information, every day.\n\nThe figure of about 1,800 students is the school size we were given. Correct it if the number has changed.')
  }

  // 5b. What students told us / 5c. What teachers told us (survey run at Manchester High School, handwritten forms read from scans)
  const surveyChart = (s, title, labels, values, x, y, w, h, color, total) => {
    T(s, title, x, y, w, 0.5, { fontSize: 13, bold: true, color: C.text1 })
    s.addChart(pres.charts.BAR, [{ name: title, labels, values }], {
      x, y: y + 0.5, w, h: h - 0.5, barDir: 'bar', chartColors: [color], catAxisOrientation: 'maxMin', valAxisMinVal: 0, valAxisMaxVal: total,
      valAxisHidden: true, valGridLine: { style: 'none' }, catGridLine: { style: 'none' }, showLegend: false, showValue: true, dataLabelPosition: 'outEnd',
      dataLabelFontSize: 12, dataLabelFontBold: true, dataLabelColor: '1E1208', catAxisLabelFontSize: 12, catAxisLabelColor: '1E1208', barGapWidthPct: 45,
    })
  }
  {
    const s = part1('What 12 Manchester students told us')
    surveyChart(s, 'What would help you learn a difficult topic?', ['Step-by-step explanations', 'Practice questions', 'Quizzes', 'Games / challenges', 'Examples', 'Study at my own pace'], [11, 7, 6, 4, 3, 3], 0.7, 1.9, 4.45, 3.5, '1F8A84', 12)
    surveyChart(s, 'If a platform showed your progress, what would you want to see?', ['Topics I need to improve', 'Grades', 'Compare with my previous results', 'Strongest subjects', 'Progress toward goals'], [9, 7, 6, 5, 5], 5.35, 1.9, 4.3, 3.5, 'D4762A', 12)
    s.addShape(SH.roundRect, { x: 9.95, y: 1.95, w: 2.68, h: 3.4, rectRadius: 0.12, fill: { color: '1E1208' }, line: { color: '1E1208', width: 0 }, objectName: 'quotes panel' })
    T(s, 'IN THEIR WORDS', 10.2, 2.12, 2.2, 0.25, { fontSize: 10, bold: true, color: HEX.copperLt, charSpacing: 4 })
    T(s, [
      { text: '"Interactive quiz competitions where you could compete with students islandwide."', options: { breakLine: true, fontSize: 12, color: 'FFFFFF' } },
      { text: ' ', options: { breakLine: true, fontSize: 5 } },
      { text: '"It should be offline as well as online."', options: { breakLine: true, fontSize: 12, color: 'FFFFFF' } },
      { text: ' ', options: { breakLine: true, fontSize: 5 } },
      { text: '"Better wifi access."', options: { breakLine: true, fontSize: 12, color: 'FFFFFF' } },
      { text: ' ', options: { breakLine: true, fontSize: 5 } },
      { text: '"Challenges between students online."', options: { breakLine: true, fontSize: 12, color: 'FFFFFF' } },
      { text: ' ', options: { breakLine: true, fontSize: 5 } },
      { text: '"AI tutor."', options: { fontSize: 12, color: 'FFFFFF' } },
    ], 10.2, 2.5, 2.25, 2.7, { margin: 0, valign: 'top', isTextBox: true, italic: true })
    s.addShape(SH.roundRect, { x: 0.7, y: 5.6, w: 11.93, h: 0.72, rectRadius: 0.12, fill: { color: 'FAE8D4' }, line: { color: HEX.border, width: 1 }, objectName: 'takeaway' })
    T(s, '10 of 12 want help studying for exams. 7 of 12 chose flashcards for practice. Wifi and offline access came up in their own words.', 0.95, 5.6, 11.4, 0.72, { fontSize: 15, bold: true, color: C.text1, valign: 'middle', fit: 'shrink' })
    T(s, 'Manchester High School student survey. 12 students, who could tick as many answers as they liked. A small sample, so read it as a signal, not a verdict.', 0.7, 6.5, 11.9, 0.35, { fontSize: 10, italic: true, color: C.accent5 })
    s.addNotes('TIMING: 1.5 minutes (this adds about 3 minutes to Part 1 together with the next slide).\n\nSAY: Before we built anything for Manchester, we asked. Twelve students filled in a paper survey. They could tick as many answers as they liked, so these are counts of students, out of twelve.\n\nREAD THE CHARTS: 11 of 12 said step-by-step explanations would help them learn a difficult topic. When asked what they would want to see about their own progress, 9 of 12 said the topics they need to improve. In the right-hand box are three of their own written answers, lightly corrected for spelling.\n\nBOTTOM LINE: 10 of 12 want help studying for exams; 7 of 12 picked flashcards as a way to practise; and wifi and offline access were raised in their own words by two students.\n\nBE HONEST: twelve students is a small sample from one school. It is a signal about what matters to them, not a measurement of the whole school. Do not describe it as representative.\n\nCONNECT: step-by-step lessons and check-your-understanding questions are what Smart Learning is built around; showing students the topics they need to improve is on our list and not built yet. Flashcards are not built yet either. Say so if asked.')
  }
  {
    const s = part1('What 10 Manchester teachers told us')
    surveyChart(s, 'Which parts of assessment take the most time or effort?', ['Marking', 'Creating questions', 'Analyzing performance', 'Calculating results', 'Recording grades'], [8, 6, 5, 4, 3], 0.7, 1.9, 4.45, 3.5, 'D4762A', 10)
    surveyChart(s, 'What should a platform tell you about your students?', ['Students who are struggling', 'Students needing support', 'Common mistakes', 'Students who are improving', 'Class vs previous assessments'], [8, 7, 7, 6, 6], 5.35, 1.9, 4.3, 3.5, '1F8A84', 10)
    s.addShape(SH.roundRect, { x: 9.95, y: 1.95, w: 2.68, h: 3.4, rectRadius: 0.12, fill: { color: '1E1208' }, line: { color: '1E1208', width: 0 }, objectName: 'stats panel' })
    T(s, 'AND ALSO', 10.2, 2.12, 2.2, 0.25, { fontSize: 10, bold: true, color: HEX.copperLt, charSpacing: 4 })
    ;[['9 of 10', 'want a platform to show what a student missed'], ['9 of 10', 'want activities for different ability levels'], ['8 of 10', 'want AI-assisted lesson planning']].forEach(([n, d], i) => {
      T(s, n, 10.2, 2.5 + i * 0.98, 2.3, 0.45, { fontSize: 24, bold: true, color: 'FFFFFF' })
      T(s, d, 10.2, 2.96 + i * 0.98, 2.3, 0.45, { fontSize: 11, color: HEX.muted })
    })
    s.addShape(SH.roundRect, { x: 0.7, y: 5.6, w: 11.93, h: 0.72, rectRadius: 0.12, fill: { color: 'FAE8D4' }, line: { color: HEX.border, width: 1 }, objectName: 'takeaway' })
    T(s, '"A learning gap tracker that analyses assessment results, identifies areas where students need support and suggests suitable activities for reteaching and practice."', 0.95, 5.6, 11.4, 0.72, { fontSize: 14, italic: true, bold: true, color: C.text1, valign: 'middle', fit: 'shrink' })
    T(s, 'Manchester High School teacher survey. 10 teachers, who could tick as many answers as they liked. A small sample, so read it as a signal, not a verdict.', 0.7, 6.5, 11.9, 0.35, { fontSize: 10, italic: true, color: C.accent5 })
    s.addNotes('TIMING: 1.5 minutes.\n\nSAY: Ten teachers answered the same kind of survey. Marking was the part of assessment that takes the most time or effort: 8 of 10. Creating questions came next at 6 of 10.\n\nWhen we asked what a platform should tell them about students, the top answers were who is struggling, who needs support and what mistakes are common: 7 or 8 of 10 each.\n\nRight-hand box: 9 of 10 want a platform that shows what a student missed; 9 of 10 want activities for different ability levels; 8 of 10 want AI-assisted lesson planning.\n\nThe quote at the bottom is one teacher\'s own answer to "If you could add ONE feature to improve teaching at your school, what would it be?".\n\nBE HONEST: ten teachers is a small sample. Say this is what the people who answered told us, and invite the room to add to it.\n\nCONNECT: missed-class catch-up and AI-assisted lesson plans exist today. Essay marking is still by hand (AI only flags integrity concerns), and a per-question "most missed" view for a teacher is not built yet. Do not promise either.')
  }

  // 6. Three products
  {
    const s = part1('Three products. One ecosystem', undefined, true, 'bg-dark-center.png')
    const P = [
      { n: 'SMART ASSESS', t: 'Measure learning.', d: 'Exams, tests and tasks, results, report cards and department insight.', c: 'EC924A', ic: 'TbFileText', chipT: 'Available now', chipF: 'EC924A' },
      { n: 'SMART LEARNING', t: 'Deliver and recover learning.', d: 'Structured lessons, check-your-understanding, and a path back for students who miss class.', c: '3DB5AB', ic: 'TbBooks', chipT: 'Switched on at Manchester', chipF: '3DB5AB' },
      { n: 'SMART PLAY', t: 'Engage and reinforce learning.', d: 'Practice that feels like play: Topic Mastery, Math Duels, live games and rewards.', c: 'F2C230', ic: 'TbDeviceGamepad2', chipT: 'Coming soon', chipF: 'F2C230' },
    ]
    for (let i = 0; i < 3; i++) {
      const p = P[i], x = 0.7 + i * 4.1
      darkCard(s, x, 1.95, 3.75, 4.55)
      await iconDot(s, p.ic, x + 0.35, 2.3, 0.8, p.c, '14100C')
      T(s, p.n, x + 0.35, 3.4, 3.1, 0.35, { fontSize: 15, bold: true, color: p.c, charSpacing: 4 })
      T(s, p.t, x + 0.35, 3.8, 3.1, 0.9, { fontSize: 22, bold: true, color: C.background1 })
      T(s, p.d, x + 0.35, 4.75, 3.1, 1.1, { fontSize: 14, color: HEX.muted })
      chip(s, p.chipT, x + 0.35, 5.9, p.chipT.length > 14 ? 2.5 : 1.5, 0.34, p.chipF, '14100C', 11)
    }
    s.addNotes('TIMING: 2 minutes.\n\nSAY: Assess measures learning. Learning is what we do about the results. Play keeps practice engaging between assessments. They share one school, one set of people and one set of data.\n\nSTATUS (be precise): Smart Assess is in use. Smart Learning is switched on at Manchester. Smart Play is coming soon. Do not describe Smart Play as live.')
  }

  // 7. Smart Assess
  {
    const s = part1('Smart Assess: every assessment, one secure record')
    T(s, 'From a five-minute pop quiz to a formal end-of-year exam, built once and kept in one place.', 0.7, 1.95, 3.6, 1.6, { fontSize: 18, color: C.accent5 })
    chip(s, 'Teachers stay in control of marking', 0.7, 3.75, 3.6, 0.42, 'FAE8D4', 'A85A18', 13)
    const F = [
      ['TbFileText', 'Exams, tests and tasks', 'Pop quizzes through final exams'],
      ['TbDatabase', 'Question bank', 'Reusable, so nothing starts from zero'],
      ['TbCloudOff', 'Saved as students work', 'Answers keep safe if the connection drops'],
      ['TbReportAnalytics', 'Results and report cards', 'Released when the teacher is ready'],
      ['TbChartBar', 'Department analytics', 'How classes performed, at a glance'],
      ['TbShieldCheck', 'Integrity checks', 'Flags go to a person to review'],
    ]
    for (let i = 0; i < 6; i++) {
      const x = 4.75 + (i % 2) * 4.0, y = 1.95 + Math.floor(i / 2) * 1.5
      lightCard(s, x, y, 3.85, 1.35)
      await iconDot(s, F[i][0], x + 0.22, y + 0.3, 0.7, 'D4762A', 'FFFFFF')
      T(s, F[i][1], x + 1.1, y + 0.28, 2.65, 0.4, { fontSize: 16, bold: true })
      T(s, F[i][2], x + 1.1, y + 0.7, 2.65, 0.55, { fontSize: 13, color: C.accent5 })
    }
    s.addNotes('TIMING: 2 minutes.\n\nSAY: Smart Assess is the foundation. A teacher builds an assessment once, assigns it to a class, and students sit it on a device. Answers save as students work, including when the connection is unreliable.\n\nACCURACY: Objective questions can be marked by the system. Written answers are marked by the teacher. Say "teachers stay in control of marking"; never say everything is marked automatically.\n\nIntegrity checks produce flags for a person to review. They do not decide anything about a student.')
  }

  // 8. Roles
  {
    const s = part1('Built around the roles already inside your school')
    const R = [
      ['TbUser', 'Student', 'Takes assigned work, sees results and progress.'],
      ['TbPencil', 'Teacher', 'Creates and assigns assessments, marks, plans lessons.'],
      ['TbBuildingCommunity', 'Head of department', 'Reviews and publishes, sees the whole department.'],
      ['TbSchool', 'Principal and administrators', 'Sets up the school and sees across it.'],
    ]
    for (let i = 0; i < 4; i++) {
      const x = 0.7 + i * 3.02
      lightCard(s, x, 1.95, 2.85, 2.9)
      await iconDot(s, R[i][0], x + 0.3, 2.25, 0.8, i === 0 ? '1F8A84' : 'D4762A', 'FFFFFF')
      T(s, R[i][1], x + 0.3, 3.2, 2.3, 0.7, { fontSize: 18, bold: true })
      T(s, R[i][2], x + 0.3, 3.9, 2.3, 0.85, { fontSize: 13, color: C.accent5 })
    }
    T(s, 'Your school chooses how exams are reviewed', 0.7, 5.15, 8, 0.4, { fontSize: 18, bold: true })
    const W = [['Direct publish', 'A teacher writes and publishes to their class.'], ['Department review', 'A head of department reviews and publishes.'], ['Multi-stage review', 'Team lead, senior lead, then department head.']]
    W.forEach(([h, d], i) => {
      const x = 0.7 + i * 4.05
      s.addShape(SH.roundRect, { x, y: 5.65, w: 3.85, h: 1.1, rectRadius: 0.1, fill: { color: 'FAE8D4' }, line: { color: 'FAE8D4', width: 0 }, objectName: 'workflow option' })
      T(s, h, x + 0.25, 5.8, 3.4, 0.3, { fontSize: 15, bold: true, color: 'A85A18' })
      T(s, d, x + 0.25, 6.15, 3.4, 0.5, { fontSize: 13, color: C.text1 })
    })
    s.addNotes('TIMING: 2 minutes.\n\nSAY: Everyone in a school has a different relationship with an assessment. The student sits it. The teacher writes and marks it. The head of department makes sure it is good. Leadership needs the picture across the school.\n\nThe review chain is the school\'s choice. Some schools publish directly; others want department review or a multi-stage review for formal exams.\n\nASK: "Which of these would fit how Manchester runs its formal exams today?"')
  }

  // 9. Integrity & accessibility
  {
    const s = part1('Fair, secure and accessible by design')
    const F = [
      ['TbLock', 'Fullscreen lock and tab-switch detection', 'The exam notices when a student leaves the window.'],
      ['TbKey', 'Single-device sign-in', 'A student is signed in on one device at a time.'],
      ['TbWifiOff', 'Safe if the connection drops', 'Answers are kept on the device and sync when it returns.'],
      ['TbVolume', 'Read-aloud support', 'A teacher can switch it on for a student who needs it.'],
    ]
    for (let i = 0; i < 4; i++) {
      const x = 0.7 + (i % 2) * 6.05, y = 1.95 + Math.floor(i / 2) * 1.75
      lightCard(s, x, y, 5.88, 1.55)
      await iconDot(s, F[i][0], x + 0.3, y + 0.38, 0.8, 'D4762A', 'FFFFFF')
      T(s, F[i][1], x + 1.4, y + 0.3, 4.3, 0.4, { fontSize: 17, bold: true })
      T(s, F[i][2], x + 1.4, y + 0.78, 4.3, 0.6, { fontSize: 14, color: C.accent5 })
    }
    s.addShape(SH.roundRect, { x: 0.7, y: 5.6, w: 11.93, h: 1.05, rectRadius: 0.12, fill: { color: '1E1208' }, line: { color: '1E1208', width: 0 }, objectName: 'principle' })
    await iconDot(s, 'TbEye', 1.0, 5.82, 0.6, 'D4762A', 'FFFFFF')
    T(s, 'A person always decides. Integrity flags are for a teacher or leader to review; nothing is concluded about a student automatically.', 1.85, 5.78, 10.5, 0.7, { fontSize: 16, bold: true, color: C.background1, valign: 'middle' })
    s.addNotes('TIMING: 1.5 minutes.\n\nSAY: Integrity and fairness matter most for formal exams. The platform makes it harder to switch away from an exam, limits a student to one device, and protects their work if the connection drops. A teacher can also switch on a read-aloud accommodation.\n\nThe principle on the bottom: flags are for people to review. We never want a system to accuse a student.\n\nIf asked about the desktop kiosk app or exact settings, say you will confirm details after the session rather than guess.')
  }

  // 10. Smart Learning
  {
    const s = part1('Smart Learning: deliver and recover learning')
    T(s, 'Assessment tells us what happened. Learning tells us what we do next.', 0.7, 1.9, 11.9, 0.5, { fontSize: 20, italic: true, color: C.accent2, bold: true })
    const E = [['Engage', 'Spark interest'], ['Explore', 'Investigate together'], ['Explain', 'Build understanding'], ['Elaborate', 'Go deeper'], ['Evaluate', 'Check what was learned']]
    E.forEach(([n, d], i) => {
      const x = 0.7 + i * 2.43
      s.addShape(SH.ellipse, { x: x + 0.1, y: 2.65, w: 0.7, h: 0.7, fill: { color: '1F8A84' }, line: { color: '1F8A84', width: 0 }, objectName: '5E circle' })
      T(s, String(i + 1), x + 0.1, 2.65, 0.7, 0.7, { align: 'center', valign: 'middle', fontSize: 20, bold: true, color: C.background1 })
      if (i < 4) s.addShape(SH.line, { x: x + 0.9, y: 3.0, w: 1.43, h: 0, line: { color: '1F8A84', width: 2, dashType: 'dash' }, objectName: 'link' })
      T(s, n, x, 3.5, 2.2, 0.35, { fontSize: 18, bold: true })
      T(s, d, x, 3.88, 2.2, 0.35, { fontSize: 14, color: C.accent5 })
    })
    const F = [['TbListCheck', 'Check-your-understanding questions'], ['TbTarget', 'Student progress through each lesson'], ['TbLayoutDashboard', 'Topic coverage for teachers and HODs'], ['TbRefresh', 'Catch-up for students who were absent'], ['TbBooks', 'A Library to read and listen to'], ['TbRobot', 'Optional AI tutor, with adult oversight']]
    for (let i = 0; i < 6; i++) {
      const x = 0.7 + i * 2.026
      lightCard(s, x, 4.6, 1.9, 2.05)
      await iconDot(s, F[i][0], x + 0.2, 4.85, 0.6, '1F8A84', 'FFFFFF')
      T(s, F[i][1], x + 0.2, 5.62, 1.55, 0.95, { fontSize: 13, bold: true })
    }
    s.addNotes('TIMING: 2 minutes.\n\nSAY: Assessment tells us what happened. Smart Learning is about what we do next. Lessons follow the five-E model: Engage, Explore, Explain, Elaborate, Evaluate. Each lesson can carry check-your-understanding questions, so a teacher can see how a student is progressing. Beside the lessons sits the Library, which the next-but-one slide shows.\n\nStatus: Smart Learning is switched on at Manchester. The AI tutor is a separate, optional switch; do not say it is active unless the school has switched it on. Where it is on, it works inside a lesson, has daily limits, and conversations that raise a wellbeing or safety concern are flagged for an adult to read.\n\nCatch-up works when the teacher records the day a lesson was taught and assigns it to the class; students absent on that day are then offered the catch-up.')
  }

  // 11. Missed class
  {
    const s = part1('When a student misses three days', undefined, true, 'bg-dark-teal.png')
    s.addImage({ path: A('photo-student.jpg'), x: 0.7, y: 1.95, w: 5.0, h: 4.7, sizing: { type: 'cover', w: 5.0, h: 4.7 }, altText: 'A student catching up on a lesson at home', objectName: 'student photo' })
    const L = [['Mon to Wed', 'The student is away. The class moves on.'], ['The lesson is waiting', 'The teacher assigned it with the day it was taught.'], ['A path back in', 'Steps, check questions and progress, at their own pace.'], ['The teacher can see it', 'Who has caught up, and where they got stuck.']]
    L.forEach(([h, d], i) => {
      const y = 1.95 + i * 1.18
      s.addShape(SH.ellipse, { x: 6.2, y: y + 0.02, w: 0.46, h: 0.46, fill: { color: '3DB5AB' }, line: { color: '3DB5AB', width: 0 }, objectName: 'timeline dot' })
      if (i < 3) s.addShape(SH.line, { x: 6.43, y: y + 0.5, w: 0, h: 0.68, line: { color: HEX.panelLine, width: 2 }, objectName: 'timeline' })
      T(s, h, 6.95, y, 5.6, 0.35, { fontSize: 19, bold: true, color: C.background1 })
      T(s, d, 6.95, y + 0.4, 5.6, 0.6, { fontSize: 15, color: HEX.muted })
    })
    T(s, 'Designed so that missing class does not mean missing the learning.', 6.2, 6.45, 6.4, 0.45, { fontSize: 15, bold: true, color: HEX.tealLt, fit: 'shrink' })
    s.addNotes('TIMING: 2 minutes.\n\nSAY: A student is out for three days with illness. In most schools the catch-up depends on the student asking, or the teacher finding time. Smart Learning is designed to give that student a clear path back into the lesson.\n\nACCURACY: This works when (1) the teacher assigns the lesson to the class, (2) records the day it was taught, and (3) the student\'s absence is recorded. Say "designed to", and explain that the teacher stays in the loop.\n\nASK THE ROOM: "What happens today when a student misses an important lesson?" Listen; write answers down. They are useful later.\n\nPicture: AI-generated, from the film.')
  }

  // 11b. Library
  {
    const s = part1('The Library: read it, listen to it')
    T(s, 'Books for the curriculum and books for the joy of reading, in the same place as the lessons.', 0.7, 1.75, 11.9, 0.45, { fontSize: 18, italic: true, bold: true, color: C.accent2 })
    const frame = (img, x, y, w, name) => {
      s.addShape(SH.roundRect, { x: x - 0.06, y: y - 0.06, w: w + 0.12, h: w * 0.625 + 0.12, rectRadius: 0.08, fill: { color: 'FFFFFF' }, line: { color: HEX.border, width: 1 }, shadow: shadow(), objectName: name + ' frame' })
      s.addImage({ path: A(img), x, y, w, h: w * 0.625, altText: name, objectName: name })
    }
    frame('lib-shelf.png', 0.76, 2.4, 6.0, 'Library shelf screen')
    frame('lib-reader.png', 3.45, 4.35, 3.7, 'Reader screen')
    chip(s, 'ILLUSTRATIVE SCREENS', 0.76, 6.52, 2.1, 0.28, HEX.paper, C.accent5, 9)
    const P = [
      ['TbBook', 'Read or listen', 'Page-by-page reading with bookmarks and notes, and audio that remembers where you stopped.'],
      ['TbBooks', 'Two shelves', 'Curriculum titles such as the set Shakespeare plays, and a read-for-fun shelf.'],
      ['TbClipboardList', 'Teachers assign reading', 'Pick a book, a class and a due date. The teacher sees who has read it.'],
      ['TbShieldCheck', 'The school stays in control', 'Switch the Library on, choose shelves and forms, hide any title.'],
    ]
    for (let i = 0; i < 4; i++) {
      const y = 2.4 + i * 1.02
      await iconDot(s, P[i][0], 7.55, y + 0.04, 0.55, '1F8A84', 'FFFFFF')
      T(s, P[i][1], 8.3, y, 4.3, 0.3, { fontSize: 16, bold: true })
      T(s, P[i][2], 8.3, y + 0.32, 4.3, 0.62, { fontSize: 12.5, color: C.accent5 })
    }
    s.addShape(SH.roundRect, { x: 7.55, y: 6.42, w: 5.08, h: 0.48, rectRadius: 0.1, fill: { color: '1E1208' }, line: { color: '1E1208', width: 0 }, objectName: 'sourcing' })
    T(s, 'Every title is chosen and cleared by Smart Assess Ja. Public domain or openly licensed.', 7.7, 6.42, 4.8, 0.48, { fontSize: 11.5, bold: true, color: C.background1, valign: 'middle', fit: 'shrink' })
    s.addNotes('TIMING: 2 minutes (this adds about 2 minutes to Part 1).\n\nSAY: Smart Learning is not only lessons. Students also have a Library. It has a curriculum shelf, which includes set texts such as Shakespeare, and a read-for-fun shelf. A student can read a book page by page, bookmark a page, keep a private note, or listen to an audio recording, and the Library remembers where they stopped.\n\nTeachers can assign a reading to a class with a due date, optionally with check-your-understanding questions, and see who has read it. Nothing about the Library is forced on a school: the school switches it on, chooses which shelves and forms see it, can switch audio off, and can hide any title.\n\nSOURCING (say this if asked about copyright): Smart Assess Ja chooses and clears every title centrally. We use public-domain works (in Jamaica a work enters the public domain 95 years after the author\'s death), openly licensed texts and volunteer recordings. Schools do not upload books. A title is only published after rights are confirmed.\n\nSTATUS (be precise): the Library is built and tested, but it is switched on school by school. Confirm that it is on at Manchester and that real titles are published before you describe it as live. The screens on this slide are illustrative, not photographs of a live school account. Offline reading is NOT built; do not promise it.')
  }

  // 12. Smart Play (mock screens A)
  {
    const s = part1('Smart Play: engage and reinforce learning', undefined, true, 'bg-dark-gold.png')
    chip(s, 'Coming soon', 10.6, 0.18, 2.0, 0.38, 'F2C230', '14100C', 13)
    // Mock 1: Topic Mastery
    const xs = [0.7, 4.8, 8.9], W = 3.75, Y = 1.95, H = 3.85
    for (const x of xs) darkCard(s, x, Y, W, H)
    T(s, 'Topic Mastery', xs[0] + 0.3, Y + 0.25, 3, 0.35, { fontSize: 17, bold: true, color: C.background1 })
    T(s, 'Fractions', xs[0] + 0.3, Y + 0.62, 3, 0.3, { fontSize: 13, color: HEX.muted })
    s.addChart(pres.charts.DOUGHNUT, [{ name: 'Mastery', labels: ['Mastered', 'To go'], values: [72, 28] }], { x: xs[0] + 0.7, y: Y + 1.0, w: 2.35, h: 2.0, holeSize: 72, chartColors: ['F2C230', '3A2E22'], showLegend: false, showPercent: false, showValue: false, showLabel: false, dataBorder: { pt: 0, color: HEX.panel }, objectName: 'mastery ring' })
    T(s, '72%', xs[0] + 0.7, Y + 1.72, 2.35, 0.5, { align: 'center', fontSize: 26, bold: true, color: C.background1 })
    T(s, 'mastery', xs[0] + 0.7, Y + 2.2, 2.35, 0.3, { align: 'center', fontSize: 12, color: HEX.muted })
    chip(s, '7 day streak', xs[0] + 0.3, Y + 3.2, 1.6, 0.36, '3A2E22', 'F2C230', 11)
    chip(s, '+120 XP', xs[0] + 2.05, Y + 3.2, 1.3, 0.36, '3A2E22', 'F2C230', 11)
    // Mock 2: Math Duels
    T(s, 'Math Duels', xs[1] + 0.3, Y + 0.25, 3, 0.35, { fontSize: 17, bold: true, color: C.background1 })
    T(s, 'Same questions, compare scores', xs[1] + 0.3, Y + 0.62, 3.2, 0.3, { fontSize: 13, color: HEX.muted })
    ;[['You', '8', 'F2C230'], ['Classmate', '6', 'EC924A']].forEach(([n, sc, c], i) => {
      const bx = xs[1] + 0.3 + i * 1.7
      s.addShape(SH.roundRect, { x: bx, y: Y + 1.05, w: 1.55, h: 0.62, rectRadius: 0.1, fill: { color: '2A2018' }, line: { color: c, width: 1 }, objectName: 'player' })
      T(s, n, bx + 0.12, Y + 1.12, 0.95, 0.48, { fontSize: 12, color: C.background1, valign: 'middle' })
      T(s, sc, bx + 1.0, Y + 1.12, 0.45, 0.48, { fontSize: 20, bold: true, color: c, align: 'right', valign: 'middle' })
    })
    s.addShape(SH.roundRect, { x: xs[1] + 0.3, y: Y + 1.85, w: 3.15, h: 0.65, rectRadius: 0.1, fill: { color: '2A2018' }, line: { color: HEX.panelLine, width: 1 }, objectName: 'question' })
    T(s, '7 × 8 = ?', xs[1] + 0.3, Y + 1.85, 3.15, 0.65, { align: 'center', valign: 'middle', fontSize: 22, bold: true, color: C.background1 })
    ;['54', '56', '63', '48'].forEach((a, i) => {
      const bx = xs[1] + 0.3 + (i % 2) * 1.6, by = Y + 2.7 + Math.floor(i / 2) * 0.55, hit = a === '56'
      s.addShape(SH.roundRect, { x: bx, y: by, w: 1.55, h: 0.45, rectRadius: 0.1, fill: { color: hit ? 'F2C230' : '2A2018' }, line: { color: hit ? 'F2C230' : HEX.panelLine, width: 1 }, objectName: 'answer' })
      T(s, a, bx, by, 1.55, 0.45, { align: 'center', valign: 'middle', fontSize: 15, bold: true, color: hit ? '14100C' : C.background1 })
    })
    // Mock 3: Live quiz
    T(s, 'Live Quiz', xs[2] + 0.3, Y + 0.25, 3, 0.35, { fontSize: 17, bold: true, color: C.background1 })
    T(s, 'On the projector, answered on devices', xs[2] + 0.3, Y + 0.62, 3.3, 0.3, { fontSize: 13, color: HEX.muted })
    chip(s, 'Join code  4 8 2 1', xs[2] + 0.3, Y + 1.05, 2.0, 0.36, 'F2C230', '14100C', 12)
    T(s, '24 joined', xs[2] + 2.45, Y + 1.05, 1.0, 0.36, { fontSize: 12, color: HEX.muted, valign: 'middle' })
    T(s, 'Which fraction equals 1/2?', xs[2] + 0.3, Y + 1.6, 3.2, 0.4, { fontSize: 15, bold: true, color: C.background1 })
    ;[['2/4', 'D4762A'], ['3/5', '1F8A84'], ['2/3', 'B58A00'], ['1/3', '6B4F35']].forEach(([a, c], i) => {
      const bx = xs[2] + 0.3 + (i % 2) * 1.6, by = Y + 2.15 + Math.floor(i / 2) * 0.72
      s.addShape(SH.roundRect, { x: bx, y: by, w: 1.55, h: 0.62, rectRadius: 0.1, fill: { color: c }, line: { color: c, width: 0 }, objectName: 'answer tile' })
      T(s, a, bx, by, 1.55, 0.62, { align: 'center', valign: 'middle', fontSize: 18, bold: true, color: C.background1 })
    })
    const cap = ['Practise one topic at a time and watch mastery grow.', 'Challenge a student in your grade to the same questions.', 'Enter the code on the teacher\'s screen and race the class.']
    cap.forEach((c, i) => T(s, c, xs[i] + 0.1, 5.95, 3.55, 0.6, { fontSize: 14, color: C.background1 }))
    T(s, 'Illustrative mock-ups of planned Smart Play screens. Practice and reinforcement, not a replacement for formal assessment.', 0.7, 6.65, 11.9, 0.3, { fontSize: 11, color: HEX.muted })
    s.addNotes('TIMING: 2 minutes.\n\nSAY: Not every learning activity should feel like an examination. Smart Play is where practice becomes engaging: single-player topic practice, head-to-head Math Duels between students in the same grade, and live quizzes the teacher runs on the projector while students answer on their own devices.\n\nSTATUS: Smart Play is coming soon at Manchester. These are illustrative mock-ups, not live screens. Say so plainly. All numbers on the screens are examples.\n\nSmart Play does not replace formal assessment. It reinforces learning between assessments.')
  }

  // 13. Ecosystem loop
  {
    const s = part1('Assess, learn, practice, improve, assess again', undefined, true, 'bg-dark-center.png')
    const cx = 4.3, cy = 4.4, r = 1.85
    const N = [['Assess', 'EC924A'], ['Learn', '3DB5AB'], ['Practice', 'F2C230'], ['Improve', 'F6EDE0'], ['Assess again', 'EC924A']]
    const pos = N.map((_, i) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5; return [cx + r * Math.cos(a), cy + r * Math.sin(a)] })
    s.addShape(SH.ellipse, { x: cx - r, y: cy - r, w: 2 * r, h: 2 * r, fill: { color: '000000', transparency: 100 }, line: { color: HEX.panelLine, width: 2, dashType: 'dash' }, objectName: 'loop ring' })
    N.forEach(([l, c], i) => {
      const [px, py] = pos[i]
      s.addShape(SH.ellipse, { x: px - 0.28, y: py - 0.28, w: 0.56, h: 0.56, fill: { color: c }, line: { color: '14100C', width: 3 }, objectName: 'loop node' })
      const lw = 2.2
      const lx = i === 0 ? px - lw / 2 : i === 1 || i === 2 ? px + 0.42 : px - 0.42 - lw
      const ly = i === 0 ? py - 0.75 : py - 0.17
      T(s, l, lx, ly, lw, 0.34, { fontSize: 17, bold: true, color: C.background1, align: i === 0 ? 'center' : i === 1 || i === 2 ? 'left' : 'right' })
    })
    T(s, 'One view\nof learning', cx - 1.0, cy - 0.5, 2.0, 1.0, { align: 'center', valign: 'middle', fontSize: 17, bold: true, color: HEX.copperLt })
    // data flows up
    T(s, 'Information flows to the right people', 8.0, 1.95, 4.6, 0.4, { fontSize: 16, bold: true, color: HEX.muted })
    const tiers = [['Student', '3A2E22', 'F6EDE0'], ['Teacher', '3A2E22', 'F6EDE0'], ['Head of department', '3A2E22', 'F6EDE0'], ['School leadership', 'D4762A', 'FFFFFF']]
    tiers.forEach(([l, f, tc], i) => {
      const y = 5.35 - i * 1.0
      s.addShape(SH.roundRect, { x: 8.0, y, w: 4.6, h: 0.72, rectRadius: 0.12, fill: { color: f }, line: { color: f, width: 0 }, objectName: 'tier ' + l })
      T(s, l, 8.3, y, 4.0, 0.72, { fontSize: 18, bold: true, color: tc, valign: 'middle' })
      if (i < 3) arrow(s, 10.3, y - 0.05, 10.3, y - 0.25, HEX.muted, 2)
    })
    s.addNotes('TIMING: 2 minutes.\n\nSAY: The point of three products is the loop. Assess tells you where students are. Learn helps them recover and move forward. Practice reinforces it. Improve, and assess again to see whether it worked.\n\nOn the right: the same information is useful to different people at different levels. The student sees their own progress. The teacher sees the class. The head of department sees the department. Leadership gets the broader view.\n\nThis is the "one view of learning" idea from the film.')
  }

  // 14. What each person sees
  {
    const s = part1('Teachers see classrooms. HODs see departments. Leaders see the school')
    const C3 = [
      { h: 'Teachers', c: 'D4762A', ic: 'TbPencil', l: ['Tests, tasks and the question bank', 'Lesson plans and Smart Learning lessons', 'Marking and results', 'Attendance for their classes', 'Report an absence and see cover'] },
      { h: 'Heads of department', c: '1F8A84', ic: 'TbBuildingCommunity', l: ['Classrooms and teachers in the department', 'Analytics and flagged sessions', 'Final exams and report cards', 'Department attendance and topics', 'Arrange cover for absent teachers'] },
      { h: 'Principal and administrators', c: 'A85A18', ic: 'TbSchool', l: ['Staff, students and timetable', 'Attendance and alerts across the school', 'Integrity and AI tutor oversight', 'Messages across staff', 'School setup and settings'] },
    ]
    for (let i = 0; i < 3; i++) {
      const x = 0.7 + i * 4.06, c = C3[i]
      lightCard(s, x, 1.95, 3.85, 4.75)
      await iconDot(s, c.ic, x + 0.3, 2.25, 0.7, c.c, 'FFFFFF')
      T(s, c.h, x + 1.15, 2.25, 2.5, 0.7, { fontSize: 18, bold: true, valign: 'middle' })
      bullets(s, c.l, x + 0.3, 3.3, 3.3, 3.3, { fontSize: 16, paraSpaceAfter: 14 })
    }
    s.addNotes('TIMING: 1.5 minutes.\n\nSAY: Different people need different views. A teacher needs their classrooms. A head of department needs the department. Leadership needs the school.\n\nACCURACY: Everything on this slide corresponds to a screen that exists in the platform today, but what each person sees depends on the roles and features switched on at Manchester. During the hands-on session, use only screens that are actually available to the accounts in the room.')
  }

  // 15. Trust, data and AI
  {
    const s = part1('Trust, data and AI with a person in charge')
    lightCard(s, 0.7, 1.95, 5.88, 4.75)
    await iconDot(s, 'TbShieldCheck', 1.0, 2.25, 0.7, '1F8A84', 'FFFFFF')
    T(s, 'Your data', 1.9, 2.25, 4.3, 0.7, { fontSize: 22, bold: true, valign: 'middle' })
    bullets(s, ['Each school\'s data lives in its own separate environment', 'Access rules are enforced by the database itself', 'Two-factor sign-in is required for all staff', 'Handled in line with Jamaica\'s Data Protection Act'], 1.0, 3.3, 5.3, 3.2, { fontSize: 17, paraSpaceAfter: 18 })
    lightCard(s, 6.75, 1.95, 5.88, 4.75)
    await iconDot(s, 'TbRobot', 7.05, 2.25, 0.7, 'D4762A', 'FFFFFF')
    T(s, 'AI on a short leash', 7.95, 2.25, 4.4, 0.7, { fontSize: 22, bold: true, valign: 'middle' })
    bullets(s, ['AI helps a teacher write: polish a question, import from a PDF, draft a lesson plan', 'AI never grades a student', 'Every suggestion is reviewed by a person before it is used', 'The optional AI tutor stays inside a lesson, with adult review of flagged conversations'], 7.05, 3.3, 5.3, 3.2, { fontSize: 17, paraSpaceAfter: 18 })
    s.addNotes('TIMING: 2 minutes.\n\nSAY: Leadership will want to know where student data lives and what the AI does. Each school gets its own separate environment. Staff accounts require two-factor sign-in. AI is used to help teachers draft, and a person always reviews.\n\nThe AI tutor is optional and switched on school by school. Where it is on, flagged conversations go to an adult to read.\n\nIf asked for detail on the Data Protection Act or hosting, say you will send a written summary after the session. Do not improvise legal claims.')
  }

  // 16. Pilot pathway
  {
    const s = part1('A pathway we can shape together')
    const P = [['Experience', 'Today: use it hands-on and tell us what you see.'], ['Choose a start', 'Pick departments, classes and assessment types.'], ['Pilot', 'Run it for a defined period with real classes.'], ['Review', 'Look at the evidence together.'], ['Expand', 'Decide how and when to widen it.']]
    P.forEach(([h, d], i) => {
      const x = 0.7 + i * 2.43
      s.addShape(SH.roundRect, { x, y: 1.95, w: 2.25, h: 2.4, rectRadius: 0.12, fill: { color: i === 0 ? 'D4762A' : 'FFFFFF' }, line: { color: i === 0 ? 'D4762A' : HEX.border, width: 1 }, shadow: shadow(), objectName: 'pathway step' })
      T(s, String(i + 1), x + 0.25, 2.15, 0.5, 0.5, { fontSize: 28, bold: true, color: i === 0 ? 'FFFFFF' : 'D4762A' })
      T(s, h, x + 0.25, 2.8, 1.8, 0.4, { fontSize: 18, bold: true, color: i === 0 ? C.background1 : C.text1 })
      T(s, d, x + 0.25, 3.25, 1.8, 1.0, { fontSize: 13, color: i === 0 ? 'FFFFFF' : C.accent5 })
      if (i < 4) arrow(s, x + 2.27, 3.15, x + 2.41, 3.15, 'D4762A', 2)
    })
    T(s, 'How we would measure success', 0.7, 4.75, 8, 0.4, { fontSize: 18, bold: true })
    const M = ['Teacher hours saved preparing and marking', 'Paper no longer printed and copied', 'Time from exam to usable results', 'Learning gaps found and acted on', 'Teacher and student feedback']
    M.forEach((m, i) => {
      const x = 0.7 + i * 2.43
      s.addShape(SH.roundRect, { x, y: 5.3, w: 2.25, h: 1.2, rectRadius: 0.1, fill: { color: 'FAE8D4' }, line: { color: 'FAE8D4', width: 0 }, objectName: 'measure' })
      T(s, m, x + 0.2, 5.4, 1.85, 1.0, { fontSize: 13, bold: true, color: 'A85A18', valign: 'middle' })
    })
    T(s, 'Scope, timing and measures are decided with you. This is a starting proposal.', 0.7, 6.65, 11.9, 0.3, { fontSize: 12, italic: true, color: C.accent5 })
    s.addNotes('TIMING: 2 minutes.\n\nSAY: I do not want to hand you a contract. This is a pathway. Step 1 is what we are doing today. Step 2 is for you to choose a starting point that matters: which departments, which classes, which kinds of assessment. Then a pilot of a defined length, a review against measures you care about, and only then a decision on how to widen it.\n\nEverything on this slide is a proposal for discussion. Do not commit to dates, scope or numbers here. Leave the final slide of Part 2 to draw out where the room would start.\n\nThe measures are examples of what to track, not claims about results.')
  }

  // 17. Transition
  {
    const s = bare('Part 1: The strategy', 'bg-dark-center.png')
    T(s, 'Now, experience it.', 0, 2.3, 13.33, 1.2, { align: 'center', fontSize: 60, bold: true, color: C.background1 })
    T(s, 'Teacher.   Student.   Leadership.', 0, 3.8, 13.33, 0.6, { align: 'center', fontSize: 26, color: HEX.copperLt })
    orbs(s, 5.62, 5.0, 1.15)
    s.addNotes('TIMING: 30 seconds.\n\nSAY: That is the strategy. Now you are going to experience it. Everyone will see Smart Assess from a different seat.\n\nBefore moving on: confirm everyone has their login details, a device, and the sign-in page open. Hand out the printed challenge sheets (one page per role) and the feedback capture sheet to whoever is taking notes.')
  }

  // =================== PART 2 ===================
  // 18. Overview timeline
  {
    const s = part2('The hands-on session: about 40 minutes')
    const ph = [['Orientation', 3, '1E1208'], ['Teacher', 10, 'D4762A'], ['Student', 7, '1F8A84'], ['Results', 5, 'A85A18'], ['Smart Learning', 5, '1F8A84'], ['Smart Play', 5, 'B58A00'], ['Leadership', 5, '6B4F35']]
    const total = 40, x0 = 0.7, W = 11.93
    let acc = 0
    ph.forEach(([n, m, c], i) => {
      const w = (m / total) * W, x = x0 + (acc / total) * W; acc += m
      s.addShape(SH.rect, { x, y: 2.2, w: w - 0.04, h: 1.1, fill: { color: c }, line: { color: c, width: 0 }, objectName: 'phase ' + n })
      T(s, String(m), x + 0.1, 2.28, w - 0.24, 0.5, { fontSize: 24, bold: true, color: 'FFFFFF' })
      T(s, 'min', x + 0.1, 2.78, w - 0.24, 0.3, { fontSize: 12, color: 'FFFFFF' })
      T(s, `${i + 1}`, x + 0.05, 3.4, 0.4, 0.3, { fontSize: 12, bold: true, color: C.accent5 })
      T(s, n, x + 0.05, 3.7, w - 0.1, 0.6, { fontSize: w < 1.3 ? 11 : 13, bold: true, color: C.text1 })
    })
    lightCard(s, 0.7, 4.75, 5.88, 1.9)
    await iconDot(s, 'TbHandClick', 1.0, 5.0, 0.6, '1F8A84', 'FFFFFF')
    T(s, 'Then: explore on your own', 1.8, 5.0, 4.5, 0.4, { fontSize: 18, bold: true })
    T(s, '10 minutes to try the challenge sheet for your role.', 1.8, 5.45, 4.5, 0.9, { fontSize: 14, color: C.accent5 })
    lightCard(s, 6.75, 4.75, 5.88, 1.9)
    await iconDot(s, 'TbMessageCircle', 7.05, 5.0, 0.6, 'D4762A', 'FFFFFF')
    T(s, 'And finally: decide together', 7.85, 5.0, 4.5, 0.4, { fontSize: 18, bold: true })
    T(s, 'What would need to be true, and where would you start?', 7.85, 5.45, 4.5, 0.9, { fontSize: 14, color: C.accent5 })
    s.addNotes('TIMING: 1 minute.\n\nSAY: Here is the plan for the next 40 minutes: orientation, then the teacher view, the student view, results, Smart Learning, Smart Play, and the leadership view. After that you explore on your own for 10 minutes, and we finish with a group discussion.\n\nThe bar is drawn to scale. If time is short, shorten Phase 2 or Phase 7 rather than dropping the hands-on exploration.\n\nFACILITATOR RULE: during hands-on testing do not take over anyone\'s screen. Ask: "What are you trying to do?" and guide from there. Write down what you see.')
  }

  // 19. Phase 1 orientation
  {
    const s = bare('Part 2: Hands-on session', 'bg-dark-center.png')
    T(s, 'PHASE 1   |   ORIENTATION   |   3 MIN', 0.7, 0.28, 9, 0.25, { fontSize: 11, bold: true, color: HEX.copperLt, charSpacing: 4 })
    T(s, 'Everyone will experience Smart Assess from a different perspective', 0.7, 0.8, 11.9, 1.3, { fontSize: 38, bold: true, color: C.background1 })
    const V = [['TbPencil', 'Teacher', 'Create, assign, mark', 'D4762A'], ['TbUser', 'Student', 'Take it, submit it, see progress', '1F8A84'], ['TbSchool', 'Leadership', 'See across classes and departments', 'F2C230']]
    for (let i = 0; i < 3; i++) {
      const x = 0.7 + i * 4.1
      darkCard(s, x, 2.7, 3.75, 2.75)
      await iconDot(s, V[i][0], x + 0.35, 3.0, 0.9, V[i][3], '14100C')
      T(s, V[i][1], x + 0.35, 4.1, 3.1, 0.45, { fontSize: 24, bold: true, color: C.background1 })
      T(s, V[i][2], x + 0.35, 4.6, 3.1, 0.7, { fontSize: 14, color: HEX.muted })
    }
    T(s, 'The ecosystem connects these experiences.', 0.7, 5.95, 11.9, 0.5, { fontSize: 22, color: HEX.copperLt, bold: true })
    s.addNotes('TIMING: 3 minutes.\n\nSAY: Everyone is going to experience Smart Assess from a different perspective. If you have a teacher account, you will see how an assessment is built and marked. If you have a student account, you will take one. If you are in leadership, you will see what school-wide information looks like.\n\nThe ecosystem connects these experiences: what a teacher builds, a student completes, and a leader reviews is the same assessment.\n\nSETUP CHECK: staff use their own real accounts. Student accounts and data are demo data only. Remind everyone not to use real student information during the exercise.')
  }

  // 20. Phase 2 teacher
  {
    const s = part2('Teacher experience: ten things to find', 'PHASE 2   |   TEACHER   |   10 MIN')
    const st = ['Log in', 'Explore the teacher dashboard', 'Identify the assessment tools', 'Explore the question bank', 'Open or create an assessment', 'Review the question types', 'Explore class assignment', 'Explore marking and results', 'Explore lesson planning', 'Observe the whole workflow']
    st.forEach((t, i) => {
      const col = i < 5 ? 0 : 1, row = i % 5, x = 0.7 + col * 3.75, y = 1.95 + row * 0.92
      s.addShape(SH.ellipse, { x, y, w: 0.5, h: 0.5, fill: { color: 'D4762A' }, line: { color: 'D4762A', width: 0 }, objectName: 'step number' })
      T(s, String(i + 1), x, y, 0.5, 0.5, { align: 'center', valign: 'middle', fontSize: 15, bold: true, color: 'FFFFFF' })
      T(s, t, x + 0.65, y, 2.9, 0.5, { fontSize: 15, valign: 'middle' })
    })
    s.addShape(SH.roundRect, { x: 8.5, y: 1.95, w: 4.13, h: 4.55, rectRadius: 0.14, fill: { color: '1E1208' }, line: { color: '1E1208', width: 0 }, objectName: 'ask panel' })
    T(s, 'At every stage, ask:', 8.85, 2.3, 3.5, 0.35, { fontSize: 14, color: HEX.copperLt, bold: true })
    T(s, 'How much time would this normally take?', 8.85, 2.75, 3.5, 1.7, { fontSize: 26, bold: true, color: C.background1 })
    T(s, 'Then compare with the paper way: write, print, copy, collect, mark.', 8.85, 4.85, 3.5, 1.2, { fontSize: 14, color: HEX.muted })
    s.addNotes('TIMING: 10 minutes.\n\nFACILITATE: Teachers log in with their own accounts. Walk through the list in order, but let people wander. At each stage, ask: "How much time would this normally take?" and connect the answer to the paper workflow (write, print, copy, collect, mark).\n\nDO NOT take over anyone\'s screen. Ask "What are you trying to do?" and guide.\n\nCAPTURE: Write down confusing navigation, missing information, questions, and concerns on the feedback sheet.\n\nQUESTIONS TO USE HERE: (1) "What currently takes the most time when preparing an examination?" (2) "How much printing does assessment require?"')
  }

  // 21. Phase 3 student
  {
    const s = part2('Student experience: take it, submit it, see it', 'PHASE 3   |   STUDENT   |   7 MIN')
    const st = ['Log in', 'Open assigned work', 'Experience the assessment', 'Answer the questions', 'Navigate the assessment', 'Submit', 'See the result or progress view']
    st.forEach((t, i) => {
      const y = 1.95 + i * 0.68
      s.addShape(SH.ellipse, { x: 0.7, y, w: 0.46, h: 0.46, fill: { color: '1F8A84' }, line: { color: '1F8A84', width: 0 }, objectName: 'step number' })
      T(s, String(i + 1), 0.7, y, 0.46, 0.46, { align: 'center', valign: 'middle', fontSize: 14, bold: true, color: 'FFFFFF' })
      T(s, t, 1.35, y, 4.6, 0.46, { fontSize: 16, valign: 'middle' })
    })
    s.addShape(SH.roundRect, { x: 6.5, y: 1.95, w: 6.13, h: 2.5, rectRadius: 0.14, fill: { color: '1E1208' }, line: { color: '1E1208', width: 0 }, objectName: 'key message' })
    T(s, 'Smart Assess is not simply digitizing a PDF.', 6.9, 2.35, 5.3, 1.2, { fontSize: 28, bold: true, color: C.background1 })
    T(s, 'It is a structured digital assessment workflow.', 6.9, 3.65, 5.3, 0.6, { fontSize: 16, color: HEX.copperLt })
    lightCard(s, 6.5, 4.7, 2.95, 1.9)
    T(s, 'What the teacher sees', 6.75, 4.9, 2.5, 0.35, { fontSize: 15, bold: true })
    T(s, 'Builds, assigns, marks and reviews results.', 6.75, 5.35, 2.5, 1.1, { fontSize: 13, color: C.accent5 })
    lightCard(s, 9.68, 4.7, 2.95, 1.9)
    T(s, 'What the student sees', 9.93, 4.9, 2.5, 0.35, { fontSize: 15, bold: true })
    T(s, 'Only their own work, in a focused view they can save and submit.', 9.93, 5.35, 2.5, 1.1, { fontSize: 13, color: C.accent5 })
    s.addNotes('TIMING: 7 minutes.\n\nFACILITATE: Anyone with a student account logs in and takes the demo assessment. Students (or staff using student demo accounts) open the assigned work, answer, navigate between questions, and submit.\n\nSAY: This is not a PDF on a screen. The platform saves answers as students work, keeps a record, and passes the responses to marking and results.\n\nDEMO DATA: Student accounts and data are demo data only. If anyone asks, confirm no real student information is used.\n\nThen ask: "How is this different from the teacher experience?"')
  }

  // 22. Phase 4 results
  {
    const s = part2('From assessment to performance information', 'PHASE 4   |   RESULTS   |   5 MIN')
    const F = [['Assessment', 'D4762A'], ['Student responses', 'D4762A'], ['Marking', 'D4762A'], ['Results', 'D4762A'], ['Performance information', '1F8A84']]
    F.forEach(([l, c], i) => {
      const w = 2.12, x = 0.7 + i * 2.45
      s.addShape(SH.roundRect, { x, y: 2.0, w, h: 1.25, rectRadius: 0.12, fill: { color: c }, line: { color: c, width: 0 }, objectName: 'flow ' + l })
      T(s, l, x + 0.12, 2.0, w - 0.24, 1.25, { align: 'center', valign: 'middle', fontSize: 16, bold: true, color: 'FFFFFF' })
      if (i < 4) arrow(s, x + w + 0.03, 2.62, x + 2.42, 2.62, '6B4F35', 2)
    })
    lightCard(s, 0.7, 3.85, 6.9, 2.7)
    T(s, 'Ask the room', 1.0, 4.1, 6.3, 0.35, { fontSize: 14, bold: true, color: C.accent1, charSpacing: 3 })
    T(s, 'What would you normally do after receiving these results?', 1.0, 4.55, 6.3, 1.5, { fontSize: 26, bold: true })
    arrow(s, 7.7, 5.2, 8.5, 5.2, '1F8A84', 3)
    s.addShape(SH.roundRect, { x: 8.6, y: 3.85, w: 4.03, h: 2.7, rectRadius: 0.14, fill: { color: '1F8A84' }, line: { color: '1F8A84', width: 0 }, objectName: 'next step' })
    T(s, 'Then connect it to Smart Learning', 8.9, 4.2, 3.5, 1.2, { fontSize: 22, bold: true, color: 'FFFFFF' })
    T(s, 'Results show what happened. Learning decides what happens next.', 8.9, 5.4, 3.5, 1.0, { fontSize: 14, color: 'FFFFFF' })
    s.addNotes('TIMING: 5 minutes.\n\nFACILITATE: Return to the teacher or administrator view. Show the path: assessment, student responses, marking, results, performance information. Show how the information could support instructional decisions: which questions were missed, which classes struggled.\n\nASK: "What would you normally do after receiving these results?" Listen for answers like re-teaching, extra classes, or nothing, because there was no time. Then connect to Smart Learning.\n\nQUESTION TO USE HERE: "How long does it normally take before teachers can analyze results?"\n\nACCURACY: Show only the screens that exist for the accounts in the room.')
  }

  // 23. Phase 5 Smart Learning
  {
    const s = part2('Assessment tells us what happened. Learning tells us what we do next', 'PHASE 5   |   SMART LEARNING   |   5 MIN')
    T(s, 'Show, where enabled:', 0.7, 1.95, 6, 0.35, { fontSize: 16, bold: true, color: C.accent2 })
    const L = ['The 5E lesson', 'Topic', 'Student progress', 'Check-your-understanding', 'Coverage', 'The Library, if on']
    L.forEach((t, i) => {
      const x = 0.7 + (i % 2) * 3.2, y = 2.45 + Math.floor(i / 2) * 1.0
      s.addShape(SH.roundRect, { x, y, w: 3.0, h: 0.82, rectRadius: 0.12, fill: { color: 'FFFFFF' }, line: { color: HEX.border, width: 1 }, shadow: shadow(), objectName: 'item' })
      T(s, t, x + 0.25, y, 2.6, 0.82, { fontSize: 15, bold: true, valign: 'middle' })
    })
    s.addShape(SH.roundRect, { x: 7.35, y: 1.95, w: 5.28, h: 4.55, rectRadius: 0.14, fill: { color: '1F8A84' }, line: { color: '1F8A84', width: 0 }, objectName: 'scenario' })
    T(s, 'THE MANCHESTER SCENARIO', 7.75, 2.3, 4.5, 0.3, { fontSize: 12, bold: true, color: 'FFFFFF', charSpacing: 4 })
    T(s, 'A student misses three days of school.', 7.75, 2.75, 4.6, 1.6, { fontSize: 28, bold: true, color: 'FFFFFF' })
    T(s, 'Show how Smart Learning is designed to give that student a path back into the learning.', 7.75, 4.5, 4.6, 1.4, { fontSize: 16, color: 'FFFFFF' })
    T(s, 'Smart Learning is switched on at Manchester. Demonstrate only what is enabled.', 0.7, 5.75, 6.4, 0.8, { fontSize: 13, italic: true, color: C.accent5 })
    s.addNotes('TIMING: 5 minutes.\n\nSAY: Assessment tells us what happened. Learning tells us what we do next.\n\nFACILITATE: Open a Smart Learning lesson. Show the structure (the five steps), the topic, student progress, a check-your-understanding question, and the coverage view. Then tell the Manchester scenario: a student misses three days. Show how the lesson, once assigned with the day it was taught, is offered to that student as a catch-up.\n\nLIBRARY: if the Library is switched on for the demo accounts, open it from the student menu: show the two shelves, open a book, turn a page, add a bookmark. For the teacher account, show Assign reading. If the Library menu item is not there, say it is switched on school by school and show the Library slide from Part 1 instead.\n\nACCURACY: Smart Learning is switched on at Manchester, so you can demo it live. The AI tutor is a separate switch. Only show it if it is enabled; otherwise describe it as optional.\n\nQUESTION TO USE HERE: "What happens when a student misses an important lesson?"')
  }

  // 24. Phase 6 Smart Play (mock screens B)
  {
    const s = part2('Not every learning activity should feel like an examination', 'PHASE 6   |   SMART PLAY   |   5 MIN', true, 'bg-dark-gold.png')
    chip(s, 'Coming soon', 10.6, 0.18, 2.0, 0.38, 'F2C230', '14100C', 13)
    const xs = [0.7, 4.8, 8.9], W = 3.75, Y = 1.95, H = 3.85
    for (const x of xs) darkCard(s, x, Y, W, H)
    // Board
    T(s, 'Jeopardy-style board', xs[0] + 0.3, Y + 0.25, 3.2, 0.35, { fontSize: 17, bold: true, color: C.background1 })
    const cats = ['Fractions', 'Algebra', 'Shapes', 'Data']
    cats.forEach((c, ci) => {
      const bx = xs[0] + 0.25 + ci * 0.8
      s.addShape(SH.rect, { x: bx, y: Y + 0.8, w: 0.74, h: 0.36, fill: { color: '3A2E22' }, line: { color: '3A2E22', width: 0 }, objectName: 'category' })
      T(s, c, bx, Y + 0.8, 0.74, 0.36, { align: 'center', valign: 'middle', fontSize: 9, bold: true, color: 'F2C230' })
      ;[100, 200, 300, 400].forEach((v, ri) => {
        const gone = (ci === 1 && ri === 0) || (ci === 3 && ri === 1) || (ci === 0 && ri === 0)
        s.addShape(SH.rect, { x: bx, y: Y + 1.22 + ri * 0.52, w: 0.74, h: 0.46, fill: { color: gone ? '2A2018' : 'D4762A' }, line: { color: gone ? '2A2018' : 'D4762A', width: 0 }, objectName: 'tile' })
        if (!gone) T(s, String(v), bx, Y + 1.22 + ri * 0.52, 0.74, 0.46, { align: 'center', valign: 'middle', fontSize: 12, bold: true, color: 'FFFFFF' })
      })
    })
    T(s, 'Students buzz in from their own devices', xs[0] + 0.3, Y + 3.38, 3.2, 0.35, { fontSize: 12, color: HEX.muted })
    // Tug of war
    T(s, 'Tug of War', xs[1] + 0.3, Y + 0.25, 3.2, 0.35, { fontSize: 17, bold: true, color: C.background1 })
    s.addShape(SH.roundRect, { x: xs[1] + 0.25, y: Y + 0.85, w: 3.25, h: 2.2, rectRadius: 0.1, fill: { color: '2D6A3F' }, line: { color: '2D6A3F', width: 0 }, objectName: 'field' })
    s.addShape(SH.line, { x: xs[1] + 1.875, y: Y + 0.9, w: 0, h: 2.1, line: { color: 'FFFFFF', width: 1.5, dashType: 'dash' }, objectName: 'centre line' })
    s.addShape(SH.line, { x: xs[1] + 0.55, y: Y + 1.95, w: 2.65, h: 0, line: { color: 'E8D8B0', width: 4 }, objectName: 'rope' })
    ;[[0.7, 1.55], [1.05, 2.3], [1.4, 1.55], [0.7, 2.3], [1.4, 2.3]].forEach(([dx, dy]) => s.addShape(SH.ellipse, { x: xs[1] + dx, y: Y + dy - 0.15, w: 0.3, h: 0.3, fill: { color: '3DB5AB' }, line: { color: 'FFFFFF', width: 1 }, objectName: 'team A' }))
    ;[[2.3, 1.55], [2.65, 2.3], [2.95, 1.55], [2.3, 2.3], [2.95, 2.3]].forEach(([dx, dy]) => s.addShape(SH.ellipse, { x: xs[1] + dx, y: Y + dy - 0.15, w: 0.3, h: 0.3, fill: { color: 'EC924A' }, line: { color: 'FFFFFF', width: 1 }, objectName: 'team B' }))
    T(s, 'Team A', xs[1] + 0.3, Y + 0.95, 1.2, 0.3, { fontSize: 12, bold: true, color: 'FFFFFF' })
    T(s, 'Team B', xs[1] + 2.25, Y + 0.95, 1.2, 0.3, { fontSize: 12, bold: true, color: 'FFFFFF', align: 'right' })
    T(s, 'Every student appears on the field', xs[1] + 0.3, Y + 3.38, 3.2, 0.35, { fontSize: 12, color: HEX.muted })
    // Rewards
    T(s, 'XP, badges, streaks, leaderboards', xs[2] + 0.3, Y + 0.25, 3.3, 0.35, { fontSize: 17, bold: true, color: C.background1 })
    s.addShape(SH.roundRect, { x: xs[2] + 0.3, y: Y + 0.85, w: 3.15, h: 0.22, rectRadius: 0.11, fill: { color: '3A2E22' }, line: { color: '3A2E22', width: 0 }, objectName: 'XP track' })
    s.addShape(SH.roundRect, { x: xs[2] + 0.3, y: Y + 0.85, w: 2.1, h: 0.22, rectRadius: 0.11, fill: { color: 'F2C230' }, line: { color: 'F2C230', width: 0 }, objectName: 'XP fill' })
    T(s, 'Weekly XP', xs[2] + 0.3, Y + 1.12, 2, 0.3, { fontSize: 11, color: HEX.muted })
    s.addImage({ data: await icon('TbFlame', 'F2C230'), x: xs[2] + 0.3, y: Y + 1.55, w: 0.55, h: 0.55, objectName: 'streak icon' })
    T(s, '7 day streak', xs[2] + 0.95, Y + 1.55, 1.6, 0.55, { fontSize: 13, bold: true, color: C.background1, valign: 'middle' })
    for (let i = 0; i < 3; i++) s.addImage({ data: await icon(['TbMedal', 'TbAward', 'TbTrophy'][i], 'F2C230'), x: xs[2] + 2.0 + i * 0.5, y: Y + 1.58, w: 0.42, h: 0.42, objectName: 'badge' })
    ;[['Student A', 3.0], ['Student B', 2.4], ['Student C', 1.8]].forEach(([n, w], i) => {
      const y = Y + 2.35 + i * 0.4
      T(s, n, xs[2] + 0.3, y, 0.95, 0.3, { fontSize: 11, color: C.background1, valign: 'middle' })
      s.addShape(SH.roundRect, { x: xs[2] + 1.25, y: y + 0.04, w: w * 0.7, h: 0.22, rectRadius: 0.11, fill: { color: i === 0 ? 'F2C230' : 'D4762A' }, line: { color: 'D4762A', width: 0 }, objectName: 'leaderboard bar' })
    })
    const cap = ['Pick categories and run a buzz-in board on the projector.', 'Two teams race through quick questions and pull the rope.', 'Rewards that keep practice going.']
    cap.forEach((c, i) => T(s, c, xs[i] + 0.1, 5.95, 3.55, 0.6, { fontSize: 14, color: C.background1 }))
    T(s, 'Illustrative mock-ups of planned Smart Play screens. Not live at Manchester.', 0.7, 6.65, 11.9, 0.3, { fontSize: 11, color: HEX.muted })
    s.addNotes('TIMING: 5 minutes.\n\nSAY: Not every learning activity should feel like an examination. Smart Play turns reinforcement and practice into something students want to do.\n\nSTATUS: Smart Play is coming soon at Manchester, so you are showing illustrative mock-ups on this slide, not a live environment. Say that plainly. Do not pretend it is live.\n\nWalk through: the Jeopardy-style board (the teacher picks categories and runs a buzz-in board on the projector), Tug of War (two teams race through quick questions, every student appears on the field), and the rewards that keep practice going: XP, streaks, badges and class leaderboards. All names and numbers here are examples.\n\nREMIND: Smart Play is not a replacement for formal assessment.')
  }

  // 25. Phase 7 leadership
  {
    const s = part2('Leadership: a broader view of the school', 'PHASE 7   |   LEADERSHIP   |   5 MIN')
    const tiers = [['Teachers see their classrooms', 3.2, 'D4762A'], ['HODs see their departments', 4.7, '1F8A84'], ['Leadership gets a broader view of the school', 6.4, 'A85A18']]
    tiers.forEach(([l, w, c], i) => {
      const y = 4.95 - i * 1.5, x = 0.7
      s.addShape(SH.roundRect, { x, y, w: w, h: 1.3, rectRadius: 0.12, fill: { color: c }, line: { color: c, width: 0 }, objectName: 'tier ' + l })
      T(s, l, x + 0.3, y, w - 0.5, 1.3, { fontSize: 18, bold: true, color: 'FFFFFF', valign: 'middle' })
    })
    lightCard(s, 7.4, 1.95, 5.23, 4.7)
    T(s, 'Show, where appropriate', 7.7, 2.2, 4.6, 0.4, { fontSize: 18, bold: true })
    bullets(s, ['Department information', 'Analytics', 'Attendance', 'Student performance', 'Teacher and class information', 'Curriculum and topic coverage', 'Leadership oversight'], 7.7, 2.8, 4.6, 3.7, { fontSize: 18, paraSpaceAfter: 12 })
    s.addNotes('TIMING: 5 minutes.\n\nFACILITATE: For the principal, vice principal and heads of department: log in with their own accounts and look at what is available to them. Teachers see their classrooms; HODs see their departments; leadership gets a broader view of the school.\n\nACCURACY: Show only screens and permissions that are actually implemented for these accounts. If something on the list is not available at Manchester yet (for example, attendance if not set up), say so; do not demonstrate or promise it.\n\nQUESTIONS TO USE HERE: (5) "How do HODs currently identify learning gaps across classes?" (6) "What information would leadership like to see that is difficult to get today?"')
  }

  // 26. Aha 1
  {
    const s = bare('Part 2: Hands-on session', 'bg-dark-right.png')
    T(s, 'THE "AHA" MOMENT', 0.7, 0.28, 9, 0.25, { fontSize: 11, bold: true, color: HEX.copperLt, charSpacing: 4 })
    T(s, 'Think about the current process for creating, printing, administering, marking and analyzing an examination.', 0.9, 1.0, 11.5, 2.0, { fontSize: 34, bold: true, color: C.background1 })
    const st = ['Create', 'Print', 'Copy', 'Administer', 'Collect', 'Mark', 'Record', 'Analyze']
    st.forEach((t, i) => {
      const x = 0.7 + i * 1.5
      s.addShape(SH.roundRect, { x, y: 3.9, w: 1.38, h: 0.9, rectRadius: 0.1, fill: { color: HEX.panel }, line: { color: HEX.panelLine, width: 1 }, objectName: 'old step' })
      T(s, t, x, 3.9, 1.38, 0.9, { align: 'center', valign: 'middle', fontSize: 15, bold: true, color: HEX.muted })
    })
    T(s, 'How many steps just disappeared?', 0.9, 5.4, 11.5, 0.9, { fontSize: 40, bold: true, color: HEX.copperLt })
    s.addNotes('TIMING: 2 minutes. Stop the demonstration here.\n\nSAY: Pause. Close the laptops for a moment. Think about how an examination works today: creating, printing, administering, marking and analyzing.\n\nASK: "How many steps just disappeared?"\n\nLet the room answer. Do not give a number yourself and do not claim a specific figure; only name what you actually demonstrated (for example: printing, copying, collecting, and manual recording).')
  }

  // 27. Aha 2
  {
    const s = bare('Part 2: Hands-on session', 'bg-dark-center.png')
    T(s, 'And what becomes possible when assessment data is connected to learning and reinforcement?', 0.9, 0.7, 11.5, 2.0, { fontSize: 34, bold: true, color: C.background1 })
    const P = [['SMART ASSESS', 'Measure', 'EC924A', 'TbFileText'], ['SMART LEARNING', 'Teach', '3DB5AB', 'TbBooks'], ['SMART PLAY', 'Engage', 'F2C230', 'TbDeviceGamepad2']]
    for (let i = 0; i < 3; i++) {
      const y = 3.0 + i * 1.3
      darkCard(s, 3.3, y, 6.7, 1.05)
      await iconDot(s, P[i][3], 3.6, y + 0.17, 0.7, P[i][2], '14100C')
      T(s, P[i][0], 4.5, y, 3.6, 1.05, { fontSize: 20, bold: true, color: P[i][2], valign: 'middle', charSpacing: 3 })
      T(s, P[i][1], 8.1, y, 1.7, 1.05, { fontSize: 20, color: C.background1, valign: 'middle', align: 'right' })
      if (i < 2) arrow(s, 6.65, y + 1.07, 6.65, y + 1.27, HEX.muted, 2)
    }
    s.addNotes('TIMING: 1.5 minutes.\n\nSAY: And what becomes possible when assessment data is connected to learning and reinforcement? Results from Smart Assess tell a teacher who needs help. Smart Learning gives those students a structured way back in. Smart Play keeps practice going between assessments.\n\nThis is the ecosystem. Then move straight to the hands-on exercise.')
  }

  // 28. Hands-on
  {
    const s = part2('Your turn: 10 minutes to explore', 'HANDS-ON EXERCISE   |   10 MIN')
    const R = [
      { h: 'Teacher', c: 'D4762A', l: ['Find your class', 'Find or create an assessment', 'Find the question bank', 'Find lesson planning', 'Find student results', 'Find progress information'] },
      { h: 'Student', c: '1F8A84', l: ['Find your assigned work', 'Complete an assessment', 'Submit', 'Find your progress and results'] },
      { h: 'HOD or administrator', c: 'A85A18', l: ['Find department information', 'Find analytics', 'Find attendance', 'Find student and teacher information'] },
    ]
    for (let i = 0; i < 3; i++) {
      const x = 0.7 + i * 4.06, r = R[i]
      lightCard(s, x, 1.95, 3.85, 4.2)
      s.addShape(SH.roundRect, { x: x + 0.25, y: 2.2, w: 3.35, h: 0.5, rectRadius: 0.25, fill: { color: r.c }, line: { color: r.c, width: 0 }, objectName: 'role header' })
      T(s, r.h, x + 0.25, 2.2, 3.35, 0.5, { align: 'center', valign: 'middle', fontSize: 16, bold: true, color: 'FFFFFF' })
      r.l.forEach((t, j) => {
        const y = 2.95 + j * 0.52
        s.addShape(SH.roundRect, { x: x + 0.3, y: y + 0.05, w: 0.26, h: 0.26, rectRadius: 0.05, fill: { color: 'FFFFFF' }, line: { color: r.c, width: 1.5 }, objectName: 'checkbox' })
        T(s, t, x + 0.75, y, 2.9, 0.38, { fontSize: 14, valign: 'middle' })
      })
    }
    T(s, 'Stuck? Say what you are trying to do. We will guide you rather than take over your screen.', 0.7, 6.3, 11.9, 0.4, { fontSize: 15, italic: true, color: C.accent5 })
    s.addNotes('TIMING: 10 minutes.\n\nFACILITATE: Everyone works independently on the challenge sheet for their role. Hand out the printed sheets. Walk the room.\n\nRULES: Do NOT immediately take over someone\'s screen. Ask: "What are you trying to do?" and guide. Write down: confusing navigation, missing information, questions, bugs, feature requests, and teacher, student and administrator concerns on the feedback capture sheet. These become post-meeting product feedback.\n\nKEEP IT LIGHT: This is exploration, not a test of the participants. If someone cannot find something, that is feedback about the product.')
  }

  // 29. Questions for the room
  {
    const s = part2('Eight questions to keep the conversation open', 'QUESTIONS FOR THE ROOM')
    const Q = [
      ['What currently takes the most time when preparing an examination?', 'Phase 2'],
      ['How much printing does assessment require?', 'Phase 2'],
      ['How long does it normally take before teachers can analyze results?', 'Phase 4'],
      ['What happens when a student misses an important lesson?', 'Phase 5'],
      ['How do HODs currently identify learning gaps across classes?', 'Phase 7'],
      ['What information would leadership like to see that is difficult to get today?', 'Phase 7'],
      ['Which part of this workflow would save teachers the most time?', 'Any time'],
      ['Which feature would you want your department to use first?', 'Any time'],
    ]
    Q.forEach(([q, p], i) => {
      const x = 0.7 + (i % 2) * 6.05, y = 1.95 + Math.floor(i / 2) * 1.2
      lightCard(s, x, y, 5.88, 1.05)
      T(s, q, x + 0.3, y, 4.3, 1.05, { fontSize: 14, bold: true, valign: 'middle' })
      chip(s, p, x + 4.75, y + 0.35, 0.95, 0.34, 'FAE8D4', 'A85A18', 11)
    })
    s.addNotes('TIMING: reference slide; not shown for long.\n\nUSE: These eight questions make the session collaborative rather than a one-way pitch. Ask them at the phase shown on each card (or any time the conversation allows). Write the answers down on the feedback sheet; they are the raw material for the next implementation conversation.\n\nDo not rush to answer. Silence is fine.')
  }

  // 30. Discussion
  {
    const s = part2('What would need to be true for Manchester High School to adopt this?', 'FINAL DISCUSSION')
    const B = [
      ['TbUsers', 'People', 'Who would lead? Who needs to be on board?'],
      ['TbRoute', 'Process', 'What changes in how exams are set, marked and reviewed?'],
      ['TbDevices', 'Technology', 'Devices, connectivity, sign-ins and support.'],
      ['TbBooks', 'Training', 'Who needs training, and when?'],
      ['TbChartBar', 'Data', 'What do leaders need to see, and how is it protected?'],
      ['TbCalendarEvent', 'Implementation', 'Where does it start, and what is the first term like?'],
    ]
    for (let i = 0; i < 6; i++) {
      const x = 0.7 + (i % 3) * 4.06, y = 2.05 + Math.floor(i / 3) * 2.3
      lightCard(s, x, y, 3.85, 2.1)
      await iconDot(s, B[i][0], x + 0.3, y + 0.28, 0.65, i % 2 ? '1F8A84' : 'D4762A', 'FFFFFF')
      T(s, B[i][1], x + 1.15, y + 0.28, 2.5, 0.65, { fontSize: 20, bold: true, valign: 'middle' })
      T(s, B[i][2], x + 0.3, y + 1.1, 3.3, 0.9, { fontSize: 14, color: C.accent5 })
    }
    s.addNotes('TIMING: 8 to 10 minutes.\n\nASK: "What would need to be true for Manchester High School to successfully adopt this?"\n\nFACILITATE: Capture the answers on a whiteboard or flip chart under six headings: People, Process, Technology, Training, Data, Implementation. Let the room fill them in; use the prompts on the cards only if the room goes quiet.\n\nThen discuss a potential pilot or adoption pathway (see the pathway slide in Part 1). Do not pitch a contract.')
  }

  // 31. Final
  {
    const s = bare('Part 2: Hands-on session', 'bg-dark-center.png')
    T(s, 'WHAT COULD MANCHESTER HIGH SCHOOL LOOK LIKE WITH SMART ASSESS JA?', 0.7, 0.55, 11.9, 1.3, { fontSize: 30, bold: true, color: C.background1, charSpacing: 1 })
    const P = [['SMART ASSESS', 'Measure learning.', 'EC924A'], ['SMART LEARNING', 'Deliver and recover learning.', '3DB5AB'], ['SMART PLAY', 'Engage and reinforce learning.', 'F2C230']]
    P.forEach(([n, t, c], i) => {
      const x = 0.7 + i * 4.1
      darkCard(s, x, 2.15, 3.75, 1.9)
      T(s, n, x + 0.35, 2.45, 3.1, 0.35, { fontSize: 15, bold: true, color: c, charSpacing: 4 })
      T(s, t, x + 0.35, 2.95, 3.1, 0.9, { fontSize: 20, bold: true, color: C.background1 })
    })
    T(s, 'ONE SCHOOL.   ONE ECOSYSTEM.   ONE CONNECTED LEARNING EXPERIENCE.', 0.7, 4.5, 11.9, 0.5, { fontSize: 19, bold: true, color: HEX.muted, charSpacing: 2 })
    T(s, 'Where would you start?', 0.7, 5.35, 11.9, 1.1, { fontSize: 54, bold: true, color: HEX.copperLt })
    s.addNotes('TIMING: as long as the room needs.\n\nASK: "Where would you start?"\n\nThen stop talking. Do not immediately pitch a contract. Let the room identify the highest-value starting point. Their answers decide the next implementation conversation: which department, which kind of assessment, which problem hurts most.\n\nBefore you leave: collect the feedback sheets, photograph any whiteboard notes, and agree who will follow up and by when.')
  }

  await pres.writeFile({ fileName: OUT })
  await applyTheme(OUT, THEME)
  console.log('wrote', OUT)
})().catch((e) => { console.error(e); process.exit(1) })
