// Builds one personalised session guide per person (A4 portrait, 6 pages, so it prints double-sided as a booklet).
// Run: node build_guides.js   Output: guides/word/*.docx (then convert with the shell step in guides/README.md)
const fs = require('fs'), path = require('path')
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType, AlignmentType, Footer, PageBreak, VerticalAlign, LevelFormat } = require('docx')

const COPPER = 'D4762A', TEAL = '1F8A84', BROWN = '6B4F35', INK = '1E1208', LINE = 'D8C7AE', TINT = 'FAE8D4', TEALTINT = 'DDF0EE', DEEP = 'A85A18'
const FONT = 'Calibri'
const A4 = { w: 11906, h: 16838 }, MARGIN = 1000, CW = A4.w - 2 * MARGIN   // content width 9906
const SITE = 'mhs.smartassessja.com', PASSWORD = 'Staff.Default1'

// ---------- who gets a guide ----------
const T = { Mr: 'Mr.', Miss: 'Miss', Mrs: 'Mrs.' }
const staff = (name, hon, last) => ({ name, title: 'Teacher', kind: 'teacher', loginRole: 'Teacher', hon, last })
const PEOPLE = [
  staff('Kevin Palmer', T.Mr, 'Palmer'), staff('Nicholas Simpson', T.Mr, 'Simpson'), staff('Daisja Langley', T.Miss, 'Langley'), staff('Ashley Russell', T.Miss, 'Russell'),
  staff('Denvor Green', T.Mr, 'Green'), staff('Shannalee Clarke', T.Miss, 'Clarke'), staff('Rameish Brooks', T.Mr, 'Brooks'), staff('Anthony Davis', T.Mr, 'Davis'),
  staff('Shereka Shaw', T.Miss, 'Shaw'), staff('Nikeisha McLean', T.Mrs, 'McLean'), staff('Tyreke Howell', T.Mr, 'Howell'), staff('Ansel Robinson', T.Mr, 'Robinson'),
  staff('Sandra Wright-Malcolm', T.Mrs, 'Wright-Malcolm'), staff('Sherieka Powell', T.Miss, 'Powell'),
  { name: 'Shelley-Ann Bruce-Reid', title: 'Head of Department', kind: 'hod', loginRole: 'HOD (Head of Department)', hon: T.Mrs, last: 'Bruce-Reid' },
  { name: 'Jasford Gabriel', title: 'Principal', kind: 'leader', loginRole: 'Principal / Vice Principal', hon: T.Mr, last: 'Gabriel' },
  { name: 'Hillary Morgan', title: 'Vice Principal', kind: 'leader', loginRole: 'Principal / Vice Principal', hon: T.Mrs, last: 'Morgan' },
  { name: 'Nigel Palmer', title: 'Vice Principal', kind: 'leader', loginRole: 'Principal / Vice Principal', hon: T.Mr, last: 'Palmer' },
  { name: 'Hopeton Thompson', title: 'System Administrator', kind: 'admin', loginRole: null, hon: T.Mr, last: 'Thompson' },
]
const address = (p) => (p.hon ? `${p.hon} ${p.last}` : p.name.split(' ')[0])

const ICE = {
  staff: 'Picture a school with a remarkable software that can automate your workload, from teaching to assessing to even building stronger habits.',
  leader: 'Picture a school where leaders can see how every class, test and lesson is going, without chasing paper, and where the software takes care of the routine work.',
  staffQ: 'What are some features you would want this software to have?',
  leaderQ: 'What would you want it to show you, and what would you want it to do for you and your staff?',
}

// ---------- product pages ----------
const PRODUCTS = [
  {
    name: 'Smart Assess', accent: COPPER, tint: TINT, status: 'Already built',
    job: 'Measure learning. Set tests and exams, sit them securely, mark them, and understand the results.',
    points: [
      ['Build tests and exams', 'Multiple choice, true/false, short answer, fill in the blank and essay, with images, audio and a maths toolbar. Save questions in a bank and reuse them. Turn a PDF into questions, or let the AI draft questions from a topic. You review every one.'],
      ['School exams across a department', 'A team lead drafts a standardised exam, heads of department vet it, and it is published to the right classes.'],
      ['Secure sitting', 'Tab switches are logged, pasting is blocked, and a desktop app can lock the screen to the exam. Answers are saved if the connection drops.'],
      ['Marking that saves time', 'Multiple choice and short answers are marked the moment a student submits. Essays get a marking page with marking points, and an optional AI suggestion you always edit before saving.'],
      ['Results that tell you what to do', 'Release results when you are ready. See which questions the class missed, the most common wrong answer, and which students may need support. Students see their own results by topic.'],
      ['Reports and analytics', 'Report cards, pass rates by subject and department, and a dashboard of flagged exam sessions.'],
    ],
    forYou: {
      teacher: 'Less time making questions, marking and adding up marks. You decide every mark; the software does the routine work.',
      hod: 'Vet and publish your department\'s exams, then see which topics and which classes are struggling, without waiting for paper results.',
      leader: 'School-wide pass rates by subject and department, and flagged exam sessions in one place, as soon as results are released.',
      admin: 'Add staff and students, manage classes and password requests, and see the school\'s results and flagged exam sessions, all in one place.',
    },
  },
  {
    name: 'Smart Learning', accent: TEAL, tint: TEALTINT, status: 'Already built',
    job: 'Teach and recover learning. Lessons, study support, catch-up and reading. It acts on what Smart Assess finds.',
    points: [
      ['Lessons in the national 5E model', 'Build a lesson (Engage, Explore, Explain, Elaborate, Evaluate), assign it to a class, and watch each student\'s progress. Short check questions come at three levels: support, core and stretch.'],
      ['Lesson plans', 'An AI button drafts a full plan from a subject, grade and topic for you to review. Teachers across schools can share and copy published plans.'],
      ['Catch-up for absent students', 'Record the day a lesson was taught. Students who were absent are offered it, and you see who has caught up.'],
      ['Coverage', 'A grid of which classes have been taught which topics, so gaps show early.'],
      ['Student study support', 'Flashcards with review spacing, an optional AI tutor the school controls, and a Library of books to read or listen to.'],
      ['Your week at a glance', 'A weekly summary of what is due, what needs attention and which students may need support. Teachers can also share resources with their department.'],
    ],
    forYou: {
      teacher: 'Plan faster, and know which students missed a lesson and which topics need another go. Share what works with your department.',
      hod: 'See which classes are behind on coverage, approve topics, pin the resources your department should use, and spot students who need support.',
      leader: 'See coverage and weekly progress across the school. The AI tutor and the Library are your school\'s switches, and the principal can turn the tutor off at any time.',
      admin: 'You choose which shelves and year groups see the Library, and you keep the school\'s classes, staff and students in order so lessons reach the right people.',
    },
  },
  {
    name: 'Smart Play', accent: DEEP, tint: 'F3E3D0', status: 'Built and tested. Coming soon',
    job: 'Make practice engaging. Quick classroom games and challenges. It never holds a school\'s official results.',
    points: [
      ['Topic Mastery', 'A student practises one topic at a time and watches their mastery grow.'],
      ['Math Duels', 'Two students race through maths questions, without needing to be online at the same moment.'],
      ['Live quiz and Jeopardy-style boards', 'Run a quiz on the projector with students answering on their own devices, or a board of categories and points for teams.'],
      ['Tug of War', 'Two teams pull a rope by answering quick questions, and every student appears on the field.'],
      ['Rewards', 'Points, day streaks, badges and class leaderboards keep practice going.'],
      ['Questions', 'Build your own game questions or import many from a spreadsheet.'],
    ],
    forYou: {
      teacher: 'A fun way to start or end a lesson that also practises the topic you are teaching.',
      hod: 'Engaging practice for a whole department, tied to the same topic list as your lessons and tests.',
      leader: 'Student engagement without touching official results: games and exams are kept apart on purpose.',
      admin: 'Games are switched on for a school when it is ready, and they never touch official results.',
    },
  },
]

// ---------- helpers ----------
const border = (c = LINE, sz = 6) => ({ style: BorderStyle.SINGLE, size: sz, color: c })
const noB = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
const none = { top: noB, bottom: noB, left: noB, right: noB }
const all = (c, sz) => ({ top: border(c, sz), bottom: border(c, sz), left: border(c, sz), right: border(c, sz) })
const run = (t, o = {}) => new TextRun({ text: t, font: FONT, size: 22, color: INK, ...o })
const para = (kids, o = {}) => new Paragraph({ children: Array.isArray(kids) ? kids : [kids], ...o })
const fill = (c) => ({ type: ShadingType.CLEAR, fill: c, color: 'auto' })
const eyebrow = (t, c = COPPER) => para([run(t, { size: 18, bold: true, color: c, characterSpacing: 40 })], { spacing: { after: 160 } })
const pageBreak = () => new Paragraph({ children: [new PageBreak()] })
const cell = (w, kids, o = {}) => new TableCell({ width: { size: w, type: WidthType.DXA }, margins: { top: 120, bottom: 120, left: 180, right: 180 }, borders: none, ...o, children: kids })
const table = (rows, widths) => new Table({ width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA }, columnWidths: widths, rows })

// a bordered writing box made of ruled lines
function writingBox(lines, lineHeight, accent) {
  const rows = []
  for (let i = 0; i < lines; i++) {
    rows.push(new TableRow({ height: { value: lineHeight, rule: 'exact' }, children: [cell(CW, [para([run('')])], {
      margins: { top: 0, bottom: 0, left: 200, right: 200 },
      borders: { top: i === 0 ? border(accent, 12) : noB, left: border(accent, 12), right: border(accent, 12), bottom: i === lines - 1 ? border(accent, 12) : border(LINE, 4) },
    })] }))
  }
  return table(rows, [CW])
}

// ---------- pages ----------
function icePage(p) {
  const leader = p.kind === 'leader' || p.kind === 'admin'
  const flow = ['Ice breaker', 'Opening video', 'Presentation', 'Live demo', 'Questions']
  const fw = [Math.floor(CW / 5), Math.floor(CW / 5), Math.floor(CW / 5), Math.floor(CW / 5), CW - 4 * Math.floor(CW / 5)]
  return [
    eyebrow('SMART ASSESS JA   |   SESSION GUIDE   |   MANCHESTER HIGH SCHOOL'),
    para([run(p.name, { size: p.name.length > 18 ? 50 : 64, bold: true, color: COPPER })], { spacing: { after: 40 } }),
    para([run(p.title, { size: 30, bold: true, color: BROWN })], { spacing: { after: 360 } }),
    para([run('Ice breaker', { size: 22, bold: true, color: TEAL, characterSpacing: 30 })], { spacing: { after: 100 } }),
    para([run(leader ? ICE.leader : ICE.staff, { size: 28 })], { spacing: { after: 160 } }),
    para([run(leader ? ICE.leaderQ : ICE.staffQ, { size: 28, bold: true, color: COPPER })], { spacing: { after: 160 } }),
    para([run('You have 5 minutes. Write as many as you can.', { size: 24, color: BROWN })], { spacing: { after: 200 } }),
    writingBox(14, 570, COPPER),
    para([run('')], { spacing: { after: 200 } }),
    para([run('Today, in order', { size: 18, bold: true, color: BROWN, characterSpacing: 30 })], { spacing: { after: 100 } }),
    table([new TableRow({ children: flow.map((t, i) => cell(fw[i], [para([run(`${i + 1}. ${t}`, { size: 20, bold: true, color: i === 0 ? 'FFFFFF' : INK })], { alignment: AlignmentType.CENTER })], { shading: fill(i === 0 ? COPPER : TINT), borders: { ...none, right: border('FFFFFF', 18) }, verticalAlign: VerticalAlign.CENTER })) })], fw),
    pageBreak(),
  ]
}

function questionsPage(p) {
  return [
    eyebrow('SMART ASSESS JA   |   SESSION GUIDE'),
    para([run('Your questions', { size: 56, bold: true, color: TEAL })], { spacing: { after: 100 } }),
    para([run('Write a question the moment you think of it. We will come back to every one.', { size: 24, color: BROWN })], { spacing: { after: 280 } }),
    para([run('Ask as we go', { size: 26, bold: true })], { spacing: { after: 60 } }),
    para([run('During the video and the presentation', { size: 20, color: BROWN })], { spacing: { after: 100 } }),
    writingBox(9, 600, TEAL),
    para([run('')], { spacing: { after: 240 } }),
    para([run('Ask after the live demo', { size: 26, bold: true })], { spacing: { after: 60 } }),
    para([run('Things you saw, things you could not find, things you would change', { size: 20, color: BROWN })], { spacing: { after: 100 } }),
    writingBox(9, 600, TEAL),
    pageBreak(),
  ]
}

function productPage(prod, p) {
  const note = prod.forYou[p.kind]
  const leftW = 3000, rightW = CW - leftW
  const rows = prod.points.map(([h, b], i) => new TableRow({ cantSplit: true, children: [
    cell(leftW, [para([run(h, { size: 24, bold: true, color: prod.accent })])], { borders: { ...none, bottom: i === prod.points.length - 1 ? noB : border(LINE, 4) }, margins: { top: 150, bottom: 150, left: 0, right: 160 } }),
    cell(rightW, [para([run(b, { size: 24 })])], { borders: { ...none, bottom: i === prod.points.length - 1 ? noB : border(LINE, 4) }, margins: { top: 150, bottom: 150, left: 160, right: 0 } }),
  ] }))
  return [
    eyebrow('SMART ASSESS JA   |   SESSION GUIDE', prod.accent),
    para([run(prod.name, { size: 60, bold: true, color: prod.accent })], { spacing: { after: 60 } }),
    para([run(prod.status.toUpperCase(), { size: 18, bold: true, color: BROWN, characterSpacing: 40 })], { spacing: { after: 200 } }),
    para([run(prod.job, { size: 26, bold: true })], { spacing: { after: 240 } }),
    table(rows, [leftW, rightW]),
    para([run('')], { spacing: { after: 220 } }),
    table([new TableRow({ children: [cell(CW, [
      para([run(`What this means for you, ${address(p)}`, { size: 24, bold: true, color: prod.accent })], { spacing: { after: 60 } }),
      para([run(note, { size: 26 })]),
    ], { shading: fill(prod.tint), margins: { top: 200, bottom: 200, left: 280, right: 280 } })] })], [CW]),
    pageBreak(),
  ]
}

function signInPage(p) {
  const steps = p.kind === 'admin' ? [
    ['Open the website', 'On your phone or laptop, go to the address above and choose Sign in.'],
    ['The facilitator signs in for you', 'For this demonstration the school\'s administrator account is already set up. The facilitator will sign in on the day, so you do not need a password or an authenticator app for today.'],
    ['Follow along', 'Everything the facilitator shows you is what a school administrator sees: staff, students, classes, results and settings. Write down anything you would change.'],
  ] : [
    ['Open the website', `On your phone or laptop, go to the address above and choose Sign in.`],
    ['Choose who you are', `Next to "I am a", choose ${p.loginRole}. Under "Sign in to", choose Smart Assess.`],
    ['Enter your details', `Email: your school email address (the facilitator will confirm it on the day).\nPassword: ${PASSWORD}`],
    ['Set your own password', 'The first time, the site asks you to set a new password. Use at least 8 characters, and write it somewhere safe.'],
    ['Set up two-factor sign-in', 'All staff accounts need an authenticator app. Install Google Authenticator, Microsoft Authenticator or Authy on your phone before the session if you can. Scan the code on screen with the app, then type the 6-digit number it shows.'],
    ['Every time after that', 'You sign in with your email and password, then type the 6-digit code from the app.'],
  ]
  const nw = 700, tw = CW - nw
  const rows = steps.map(([h, b], i) => new TableRow({ cantSplit: true, children: [
    cell(nw, [para([run(String(i + 1), { size: 30, bold: true, color: 'FFFFFF' })], { alignment: AlignmentType.CENTER })], { shading: fill(COPPER), verticalAlign: VerticalAlign.CENTER, borders: { ...none, bottom: border('FFFFFF', 24) } }),
    cell(tw, [
      para([run(h, { size: 26, bold: true })], { spacing: { after: 30 } }),
      ...b.split('\n').map((line) => {
        const m = line.match(/^Password: (.*)$/)
        return para(m ? [run('Password: ', { size: 23 }), run(m[1], { size: 26, bold: true, color: DEEP, font: 'Courier New' })] : [run(line, { size: 23 })])
      }),
    ], { shading: fill('FFFFFF'), borders: { ...none, bottom: border(LINE, 6) } }),
  ] }))
  return [
    eyebrow('SMART ASSESS JA   |   SESSION GUIDE'),
    para([run('Sign in', { size: 56, bold: true, color: COPPER })], { spacing: { after: 160 } }),
    table([new TableRow({ children: [cell(CW, [
      para([run('Website', { size: 18, bold: true, color: BROWN, characterSpacing: 40 })], { spacing: { after: 40 } }),
      para([run(SITE, { size: 44, bold: true, color: INK })]),
    ], { shading: fill(TINT), margins: { top: 200, bottom: 200, left: 300, right: 300 } })] })], [CW]),
    para([run('')], { spacing: { after: 160 } }),
    table(rows, [nw, tw]),
    para([run('')], { spacing: { after: 160 } }),
    table([new TableRow({ children: [cell(CW, [
      para([run('Demo data only. ', { size: 21, bold: true, color: TEAL }), run('Everything on this site today is practice data. Please do not enter real student information. Stuck? Say what you are trying to do and the facilitator will help.', { size: 21 })]),
    ], { shading: fill(TEALTINT), margins: { top: 160, bottom: 160, left: 260, right: 260 } })] })], [CW]),
  ]
}

function build(p) {
  return new Document({
    creator: 'Smart Assess Ja', title: `Session guide: ${p.name}`,
    styles: { default: { document: { run: { font: FONT, size: 22 } } } },
    sections: [{
      properties: { page: { size: { width: A4.w, height: A4.h }, margin: { top: 900, bottom: 900, left: MARGIN, right: MARGIN } } },
      footers: { default: new Footer({ children: [para([run(`Smart Assess Ja   |   Manchester High School   |   Prepared for ${p.name}`, { size: 16, color: BROWN })])] }) },
      children: [...icePage(p), ...questionsPage(p), ...PRODUCTS.flatMap((prod) => productPage(prod, p)), ...signInPage(p)],
    }],
  })
}

const out = path.join(__dirname, 'guides', 'word')
fs.mkdirSync(out, { recursive: true })
;(async () => {
  for (const [i, p] of PEOPLE.entries()) {
    const file = `${String(i + 1).padStart(2, '0')}-${p.name.replace(/[^A-Za-z]+/g, '-')}.docx`
    fs.writeFileSync(path.join(out, file), await Packer.toBuffer(build(p)))
  }
  console.log(`Built ${PEOPLE.length} guides in ${out}`)
})()
