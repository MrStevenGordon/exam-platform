const fs = require('fs'), path = require('path')
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType, AlignmentType, ImageRun, Footer, VerticalAlign } = require('docx')
const COPPER = 'D4762A', TEAL = '1F8A84', BROWN = '6B4F35', INK = '1E1208', TINT = 'FAE8D4', LINE = 'E4D3BA', F = 'Calibri'
const W = 11906 - 2 * 850 // content width on A4 with 0.59in margins = 10206
const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
const nb = { top: none, bottom: none, left: none, right: none }
const r = (t, o = {}) => new TextRun({ text: t, font: F, size: 19, color: INK, ...o })
const p = (kids, o = {}) => new Paragraph({ children: Array.isArray(kids) ? kids : [kids], spacing: { after: 50 }, ...o })
const h = (t, color = COPPER) => p([r(t, { bold: true, size: 22, color })], { spacing: { before: 60, after: 50 } })
const bl = (t) => new Paragraph({ children: [r(t)], bullet: { level: 0 }, spacing: { after: 30 } })
const bold = (a, b) => new Paragraph({ children: [r(a, { bold: true }), r(b)], bullet: { level: 0 }, spacing: { after: 30 } })
const cell = (kids, w, o = {}) => new TableCell({ width: { size: w, type: WidthType.DXA }, borders: nb, margins: { top: 40, bottom: 40, left: 90, right: 90 }, verticalAlign: VerticalAlign.TOP, children: kids, ...o })
const img = (file, w) => new ImageRun({ type: 'png', data: fs.readFileSync(path.join(__dirname, 'shots', file)), transformation: { width: w, height: Math.round(w * 900 / 1440) }, altText: { title: file, description: 'Library concept screen', name: file } })

const half = Math.floor(W / 2)
const doc = new Document({
  creator: 'Smart Assess Ja', title: 'Smart Learning Library: a concept for Manchester High School',
  styles: { default: { document: { run: { font: F, size: 19 } } } },
  sections: [{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 640, bottom: 600, left: 850, right: 850 } } },
    footers: { default: new Footer({ children: [p([r('Smart Assess Ja   |   Built for Manchester High School   |   Concept for discussion. Not yet available.', { size: 15, color: BROWN })])] }) },
    children: [
      p([r('SMART LEARNING   |   CONCEPT FOR DISCUSSION', { size: 16, bold: true, color: COPPER, characterSpacing: 40 })], { spacing: { after: 20 } }),
      p([r('The Smart Learning Library', { size: 46, bold: true })], { spacing: { after: 20 } }),
      p([r('Books students can read or listen to, for school and for fun.', { size: 24, color: BROWN })], { spacing: { after: 90 } }),
      new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: [W], rows: [new TableRow({ children: [new TableCell({ width: { size: W, type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, fill: TINT, color: 'auto' }, borders: nb, margins: { top: 80, bottom: 80, left: 160, right: 160 }, children: [p([r('Status: planned. ', { bold: true, color: 'A85A18' }), r('The Library is not built yet. These pages and screens are a concept, with sample titles, shared so that Manchester High School can shape it before anything is built.')], { spacing: { after: 0 } })] })] })] }),
      p([r('')], { spacing: { after: 20 } }),
      new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: [half, W - half], rows: [new TableRow({ children: [
        cell([h('What students could do'), bold('Two shelves: ', 'Curriculum books by subject and topic, and Read for fun.'), bold('Read or listen: ', 'in the browser, with audio that remembers where they stopped.'), bold('Save for offline ', 'when the connection is poor.'), bold('Pick up assigned reading ', 'from their teachers, with the due date shown.'), bold('Keep going: ', 'bookmarks, notes and reading streaks (rewards through Smart Play could come later).')], half),
        cell([h('What teachers and leaders could get', TEAL), bold('Assign reading ', 'to a class: a book, a section, a date, and optional check-your-understanding questions.'), bold('See progress: ', 'who has started, who has finished, and whether they read or listened.'), bold('Link to the curriculum: ', 'books tied to the same topics used in lessons and assessments.'), bold('Stay in control: ', 'the school chooses which shelves and age bands to switch on, and can hide any title.')], W - half),
      ] })] }),
      new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: [half, W - half], rows: [new TableRow({ children: [
        cell([h('Where the books come from'), p([r('Rights come first. Smart Assess Ja would curate the catalog centrally, and every title shows its licence and source.')]), bl('Free and open books: public-domain classics, openly licensed textbooks, volunteer audio recordings.'), bl('Material the school owns or has permission to share.'), bl('Later, partnerships for set texts and modern Caribbean authors, which are mostly under copyright.')], half),
        cell([h('Safe and private by design', TEAL), bl('Students cannot upload anything; only approved titles appear.'), bl('Nothing is published until its licence is confirmed.'), bl('Reading activity is for the class teacher and department head, not the public.'), bl('The "for fun" shelf is curated and grouped by age.')], W - half),
      ] })] }),
      new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: [half, W - half], rows: [new TableRow({ children: [
        cell([p([r('')], { spacing: { after: 20 } }), p([img('1-student-library.png', 232)], { alignment: AlignmentType.CENTER, spacing: { after: 20 } }), p([r('Student view: the Library home', { size: 16, color: BROWN })], { alignment: AlignmentType.CENTER, spacing: { after: 0 } })], half),
        cell([p([r('')], { spacing: { after: 20 } }), p([img('6-teacher-progress.png', 232)], { alignment: AlignmentType.CENTER, spacing: { after: 20 } }), p([r('Teacher view: class reading progress', { size: 16, color: BROWN })], { alignment: AlignmentType.CENTER, spacing: { after: 0 } })], W - half),
      ] })] }),
      h('What we would like to learn from you'),
      bl('Which subjects and set texts would help your students most, first?'),
      bl('What does your school library offer today, in print or digitally, and what is missing?'),
      bl('Do students have the devices and connection to read or listen at home and at school?'),
      bl('Who at Manchester would champion this, and which classes could try it first?'),
      h('A suggested first step', TEAL),
      p([r('Choose a small set of titles together, in one or two subjects plus a short "for fun" shelf. Try it with a few classes, and let students and teachers tell us what works before we widen it. Sample titles and screens shown are for the concept only.')], { spacing: { after: 0 } }),
    ],
  }],
})
Packer.toBuffer(doc).then((b) => { fs.writeFileSync(path.join(__dirname, 'Smart-Learning-Library-Concept.docx'), b); console.log('written') })
