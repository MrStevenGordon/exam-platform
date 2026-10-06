// Builds the printable challenge sheet (A4 portrait, 3 pages) and the feedback capture sheet (A4 landscape, 2 pages).
const fs = require('fs'), path = require('path')
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType, AlignmentType, PageOrientation, Footer, Header, PageBreak, VerticalAlign } = require('docx')

const COPPER = 'D4762A', TEAL = '1F8A84', BROWN = '6B4F35', INK = '1E1208', LINE = 'D8C7AE', TINT = 'FAE8D4'
const FONT = 'Calibri'
const A4 = { w: 11906, h: 16838 }
const border = (c = LINE, sz = 6) => ({ style: BorderStyle.SINGLE, size: sz, color: c })
const noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
const allB = (c, sz) => ({ top: border(c, sz), bottom: border(c, sz), left: border(c, sz), right: border(c, sz) })
const run = (t, o = {}) => new TextRun({ text: t, font: FONT, size: 22, color: INK, ...o })
const para = (children, o = {}) => new Paragraph({ children: Array.isArray(children) ? children : [children], ...o })
const footer = (label) => new Footer({ children: [para([run(label, { size: 16, color: BROWN })], { alignment: AlignmentType.LEFT })] })

function checkRow(task, widths, accent) {
  const cell = (w, kids, o = {}) => new TableCell({ width: { size: w, type: WidthType.DXA }, margins: { top: 140, bottom: 140, left: 140, right: 140 }, verticalAlign: VerticalAlign.CENTER, borders: allB(LINE, 6), ...o, children: kids })
  return new TableRow({ height: { value: 760, rule: 'atLeast' }, children: [
    cell(widths[0], [para([run('', { size: 22 })])], { borders: { top: border(LINE), bottom: border(LINE), left: border(LINE), right: border(accent, 12) } }),
    cell(widths[1], [para([run(task, { size: 26, bold: true })])]),
    cell(widths[2], [para([run('')])]),
  ] })
}
function box(accent) { // the tick box is drawn as a small bordered cell inside the first column
  return new Table({ width: { size: 500, type: WidthType.DXA }, columnWidths: [500], alignment: AlignmentType.CENTER, rows: [new TableRow({ height: { value: 440, rule: 'exact' }, children: [new TableCell({ width: { size: 500, type: WidthType.DXA }, borders: allB(accent, 12), children: [para([run('')])] })] })] })
}
function challengePage(role, accent, intro, tasks, isLast) {
  const widths = [900, 5300, 3426] // 9626 content width
  const rows = [new TableRow({ tableHeader: true, children: [
    ['Done', widths[0]], ['I can...', widths[1]], ['Notes: what I tried, what was confusing', widths[2]],
  ].map(([t, w]) => new TableCell({ width: { size: w, type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, fill: accent, color: 'auto' }, margins: { top: 100, bottom: 100, left: 140, right: 140 }, borders: allB(accent, 6), children: [para([run(t, { size: 20, bold: true, color: 'FFFFFF' })])] })) })]
  tasks.forEach((t) => rows.push(new TableRow({ height: { value: 1100, rule: 'atLeast' }, children: [
    new TableCell({ width: { size: widths[0], type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER, margins: { top: 120, bottom: 120, left: 140, right: 140 }, borders: allB(LINE, 6), children: [box(accent)] }),
    new TableCell({ width: { size: widths[1], type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER, margins: { top: 120, bottom: 120, left: 160, right: 140 }, borders: allB(LINE, 6), children: [para([run(t, { size: 26, bold: true })])] }),
    new TableCell({ width: { size: widths[2], type: WidthType.DXA }, margins: { top: 120, bottom: 120, left: 140, right: 140 }, borders: allB(LINE, 6), children: [para([run('')])] }),
  ] })))
  const kids = [
    para([run('SMART ASSESS JA   |   HANDS-ON CHALLENGE SHEET', { size: 18, bold: true, color: COPPER, characterSpacing: 40 })], { spacing: { after: 200 } }),
    para([run(role, { size: 60, bold: true, color: accent })], { spacing: { after: 120 } }),
    para([run(intro, { size: 24, color: BROWN })], { spacing: { after: 360 } }),
    new Table({ width: { size: 9626, type: WidthType.DXA }, columnWidths: widths, rows }),
    para([run('')], { spacing: { after: 280 } }),
    new Table({ width: { size: 9626, type: WidthType.DXA }, columnWidths: [9626], rows: [new TableRow({ children: [new TableCell({ width: { size: 9626, type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, fill: TINT, color: 'auto' }, margins: { top: 200, bottom: 200, left: 240, right: 240 }, borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder }, children: [
      para([run('Stuck? ', { size: 24, bold: true, color: 'A85A18' }), run('Say what you are trying to do. The facilitator will guide you, not take over your screen. Everything you find confusing is useful feedback.', { size: 24 })]),
    ] })] })] }),
  ]
  if (!isLast) kids.push(new Paragraph({ children: [new PageBreak()] }))
  return kids
}

const challenge = new Document({
  creator: 'Smart Assess Ja', title: 'Hands-on challenge sheet',
  styles: { default: { document: { run: { font: FONT, size: 22 } } } },
  sections: [{
    properties: { page: { size: { width: A4.w, height: A4.h }, margin: { top: 1080, bottom: 1080, left: 1140, right: 1140 } } },
    footers: { default: footer('Smart Assess Ja   |   Built for Manchester High School   |   Demo accounts and data only: do not use real student information') },
    children: [
      ...challengePage('Teacher', COPPER, 'Log in with your own account and see how many of these you can find in 10 minutes.', ['Find your class', 'Find or create an assessment', 'Find the question bank', 'Find lesson planning', 'Find student results', 'Find progress information'], false),
      ...challengePage('Student', TEAL, 'Log in with the demo student account you were given. Do not use real student information.', ['Find your assigned work', 'Complete an assessment', 'Submit it', 'Find your progress and results'], false),
      ...challengePage('Head of department or administrator', 'A85A18', 'Log in with your own account and see what you can find about your department and school.', ['Find department information', 'Find analytics', 'Find attendance', 'Find student and teacher information'], true),
    ],
  }],
})

// ---------- feedback capture sheet (landscape) ----------
const LW = 16838 - 2 * 900 // content width in landscape = 15038
function feedbackDoc() {
  const cols = [500, 2000, 1500, 3900, 4538, 2600] // 15038
  const head = ['#', 'Category', 'Role', 'What they were trying to do', 'What happened or what they said', 'Priority']
  const hrow = new TableRow({ tableHeader: true, children: head.map((t, i) => new TableCell({ width: { size: cols[i], type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, fill: INK, color: 'auto' }, margins: { top: 90, bottom: 90, left: 120, right: 120 }, borders: allB(INK, 6), children: [para([run(t, { size: 20, bold: true, color: 'FFFFFF' })])] })) })
  const rows = [hrow]
  for (let i = 1; i <= 7; i++) rows.push(new TableRow({ height: { value: 700, rule: 'atLeast' }, children: cols.map((w, c) => new TableCell({ width: { size: w, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 }, borders: allB(LINE, 6), verticalAlign: VerticalAlign.CENTER, children: [para([run(c === 0 ? String(i) : c === 5 ? 'High   Med   Low' : '', { size: c === 5 ? 18 : 20, color: c === 5 ? BROWN : INK })])] })) }))
  const cats = ['Confusing navigation', 'Missing information', 'Question', 'Bug', 'Feature request', 'Teacher concern', 'Student concern', 'Administrative concern']
  const catCells = cats.map((c) => new TableCell({ width: { size: Math.floor(LW / 4), type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 140, right: 140 }, borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder }, shading: { type: ShadingType.CLEAR, fill: TINT, color: 'auto' }, children: [para([run(c, { size: 20, bold: true, color: 'A85A18' })])] }))
  const catTable = new Table({ width: { size: Math.floor(LW / 4) * 4, type: WidthType.DXA }, columnWidths: Array(4).fill(Math.floor(LW / 4)), rows: [new TableRow({ children: catCells.slice(0, 4) }), new TableRow({ children: catCells.slice(4) })] })

  const Q = ['What currently takes the most time when preparing an examination?', 'How much printing does assessment require?', 'How long does it normally take before teachers can analyze results?', 'What happens when a student misses an important lesson?', 'How do HODs currently identify learning gaps across classes?', 'What information would leadership like to see that is difficult to get today?', 'Which part of this workflow would save teachers the most time?', 'Which feature would you want your department to use first?']
  const qrows = [new TableRow({ tableHeader: true, children: [['Question', 6200], ['Answers from the room', 8838]].map(([t, w]) => new TableCell({ width: { size: w, type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, fill: INK, color: 'auto' }, margins: { top: 90, bottom: 90, left: 120, right: 120 }, borders: allB(INK, 6), children: [para([run(t, { size: 20, bold: true, color: 'FFFFFF' })])] })) })]
  Q.forEach((q, i) => qrows.push(new TableRow({ height: { value: 800, rule: 'atLeast' }, children: [
    new TableCell({ width: { size: 6200, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER, margins: { top: 80, bottom: 80, left: 140, right: 140 }, borders: allB(LINE, 6), children: [para([run(`${i + 1}.  ${q}`, { size: 22, bold: true })])] }),
    new TableCell({ width: { size: 8838, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 140, right: 140 }, borders: allB(LINE, 6), children: [para([run('')])] }),
  ] })))
  const adopt = ['People', 'Process', 'Technology', 'Training', 'Data', 'Implementation']
  const adoptCells = adopt.map((a) => new TableCell({ width: { size: Math.floor(LW / 6), type: WidthType.DXA }, verticalAlign: VerticalAlign.TOP, margins: { top: 100, bottom: 100, left: 140, right: 140 }, borders: allB(LINE, 6), children: [para([run(a, { size: 20, bold: true, color: COPPER })]), para([run('')]), para([run('')]), para([run('')]), para([run('')])] }))

  return new Document({
    creator: 'Smart Assess Ja', title: 'Feedback capture sheet',
    styles: { default: { document: { run: { font: FONT, size: 22 } } } },
    sections: [{
      properties: { page: { size: { width: A4.w, height: A4.h, orientation: PageOrientation.LANDSCAPE }, margin: { top: 800, bottom: 800, left: 900, right: 900 } } },
      footers: { default: footer('Smart Assess Ja   |   Built for Manchester High School   |   Feedback capture sheet') },
      children: [
        para([run('SMART ASSESS JA   |   FEEDBACK CAPTURE SHEET', { size: 18, bold: true, color: COPPER, characterSpacing: 40 })], { spacing: { after: 100 } }),
        para([run('What the room told us', { size: 44, bold: true })], { spacing: { after: 100 } }),
        para([run('Facilitator: ______________________      Date: ______________      Group or table: ______________________', { size: 22, color: BROWN })], { spacing: { after: 220 } }),
        para([run('Write what you see, in the participant\'s words where possible. Do not fix it during the session; log it. Categories:', { size: 20, color: BROWN })], { spacing: { after: 100 } }),
        catTable,
        para([run('')], { spacing: { after: 160 } }),
        new Table({ width: { size: LW, type: WidthType.DXA }, columnWidths: cols, rows }),
        para([run('Questions for the room', { size: 44, bold: true })], { spacing: { after: 100 }, pageBreakBefore: true }),
        para([run('Write down what people say, and who said it (role only is fine).', { size: 22, color: BROWN })], { spacing: { after: 200 } }),
        new Table({ width: { size: 15038, type: WidthType.DXA }, columnWidths: [6200, 8838], rows: qrows }),
        para([run('What would need to be true for Manchester High School to adopt this?', { size: 40, bold: true })], { spacing: { after: 100 }, pageBreakBefore: true }),
        para([run('Capture the discussion under each heading, then note the starting point the room chose.', { size: 22, color: BROWN })], { spacing: { after: 200 } }),
        new Table({ width: { size: Math.floor(LW / 6) * 6, type: WidthType.DXA }, columnWidths: Array(6).fill(Math.floor(LW / 6)), rows: [new TableRow({ height: { value: 5200, rule: 'atLeast' }, children: adoptCells })] }),
        para([run('')], { spacing: { after: 200 } }),
        para([run('Where would the room start?  ', { size: 26, bold: true, color: COPPER }), run('______________________________________________________________________________________', { size: 24, color: LINE })]),
      ],
    }],
  })
}

;(async () => {
  const out = __dirname
  fs.writeFileSync(path.join(out, 'Challenge-Sheet.docx'), await Packer.toBuffer(challenge))
  fs.writeFileSync(path.join(out, 'Feedback-Capture-Sheet.docx'), await Packer.toBuffer(feedbackDoc()))
  console.log('sheets written')
})()
