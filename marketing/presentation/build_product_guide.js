// Builds marketing/presentation/Smart-Assess-Ja-Product-Guide.docx (A4).
// Run:  NODE_PATH=<folder with docx> node build_blueprint.js
const fs = require('fs'), path = require('path')
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType, AlignmentType, Footer, PageBreak, VerticalAlign, LevelFormat, HeadingLevel, ImageRun } = require('docx')

const COPPER = 'D4762A', TEAL = '1F8A84', BROWN = '6B4F35', INK = '1E1208', LINE = 'D8C7AE', TINT = 'FAE8D4', GOLD = 'B58A00'
const FONT = 'Calibri'
const A4 = { w: 11906, h: 16838 }, MARGIN = 1080, W = A4.w - 2 * MARGIN
const OUT_DIR = __dirname

const border = (c = LINE, sz = 6) => ({ style: BorderStyle.SINGLE, size: sz, color: c })
const allB = (c, sz) => ({ top: border(c, sz), bottom: border(c, sz), left: border(c, sz), right: border(c, sz) })
const run = (t, o = {}) => new TextRun({ text: t, font: FONT, size: 21, color: INK, ...o })
const para = (children, o = {}) => new Paragraph({ children: Array.isArray(children) ? children : [children], spacing: { after: 120, line: 276 }, ...o })
const p = (t, o = {}) => para([run(t, o.run || {})], o.para || {})
const h1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, keepNext: true, spacing: { before: 360, after: 140 }, children: [run(t, { size: 32, bold: true })] })
const h2 = (t, c = COPPER) => new Paragraph({ heading: HeadingLevel.HEADING_2, keepNext: true, spacing: { before: 240, after: 100 }, children: [run(t, { size: 25, bold: true, color: c })] })
const bullet = (parts) => new Paragraph({ numbering: { reference: 'bul', level: 0 }, spacing: { after: 80, line: 270 }, children: (Array.isArray(parts) ? parts : [parts]).map((x) => (typeof x === 'string' ? run(x) : x)) })
const b = (t) => run(t, { bold: true })
const cell = (w, kids, o = {}) => new TableCell({ width: { size: w, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 110, right: 110 }, verticalAlign: VerticalAlign.TOP, borders: allB(LINE, 6), ...o, children: kids })
const th = (w, t, fill = INK) => cell(w, [para([run(t, { size: 18, bold: true, color: 'FFFFFF' })], { spacing: { after: 0 } })], { shading: { type: ShadingType.CLEAR, fill, color: 'auto' }, verticalAlign: VerticalAlign.CENTER })
const td = (w, t, o = {}) => cell(w, (Array.isArray(t) ? t : [t]).map((x) => para(typeof x === 'string' ? [run(x, { size: 18, ...(o.run || {}) })] : x, { spacing: { after: 40, line: 250 } })), o.cell || {})
const table = (widths, head, rows, headFill) => new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: widths, rows: [
  ...(head ? [new TableRow({ tableHeader: true, children: head.map((h, i) => th(widths[i], h, headFill)) })] : []),
  ...rows.map((r) => new TableRow({ cantSplit: true, children: r.map((c, i) => td(widths[i], c, i === 0 ? { run: { bold: true } } : {})) })),
] })
const img = (file, wPx) => { const buf = fs.readFileSync(path.join(OUT_DIR, 'img', file)); return new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [new ImageRun({ type: 'png', data: buf, transformation: { width: wPx, height: Math.round(wPx * 830 / 1100) }, altText: { title: file, description: 'Wireframe of the exam insight page', name: file } })] }) }
const caption = (t) => p(t, { run: { size: 17, italics: true, color: BROWN }, para: { alignment: AlignmentType.CENTER, spacing: { after: 200 } } })

const kids = []
const GREEN = '3E7A4F'
kids.push(new Paragraph({ spacing: { after: 40 }, children: [run('SMART ASSESS JA', { size: 18, bold: true, color: COPPER, characterSpacing: 60 })] }))
kids.push(new Paragraph({ spacing: { after: 100 }, children: [run('The three products and what they do', { size: 44, bold: true })] }))
kids.push(p('A plain-language guide to every feature, what it means, and whether it is available. Written 6 October 2026.', { run: { size: 22, color: BROWN } }))

kids.push(h1('The idea in one page'))
kids.push(p('Smart Assess Ja is one platform made of three products that share one school, one set of people and one list of topics. Each product has one job, and a feature belongs to only one of them:'))
const prodRows = [
  ['Smart Assess', COPPER, 'Measure learning. Everything about setting, sitting, marking and analysing tests and exams, and the results that come out of them.', 'In use at Manchester'],
  ['Smart Learning', TEAL, 'Teach and recover learning. Lessons, lesson plans, study support, catch-up for absent students, and the Library. It acts on what Smart Assess finds.', 'Switched on at Manchester'],
  ['Smart Play', GOLD, 'Make practice engaging. Classroom games, duels and competitions. It never holds a school\'s official results.', 'Built, not yet switched on (shown as "coming soon")'],
]
const pw0 = [1900, 5400, 2446]
kids.push(new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: pw0, rows: [
  new TableRow({ tableHeader: true, children: [th(pw0[0], 'Product'), th(pw0[1], 'Its one job'), th(pw0[2], 'Status')] }),
  ...prodRows.map(([n, c, d, st]) => new TableRow({ cantSplit: true, children: [cell(pw0[0], [para([run(n, { size: 20, bold: true, color: 'FFFFFF' })], { spacing: { after: 0 } })], { shading: { type: ShadingType.CLEAR, fill: c, color: 'auto' }, verticalAlign: VerticalAlign.CENTER }), td(pw0[1], d), td(pw0[2], st)] })),
] }))
kids.push(p('The three share one list of topics (each topic has a permanent code), so a weak topic found in Smart Assess can lead to a lesson in Smart Learning or a game in Smart Play without any product reaching into another\'s data. Besides the three products there are school tools that every product relies on (attendance, timetable, staff management and so on). They are listed last.', { para: { spacing: { before: 120 } } }))
kids.push(h2('What the status words mean', BROWN))
kids.push(table([2300, 7446], ['Status', 'Meaning'], [
  ['Live', 'Built, working and in use at Manchester.'],
  ['On per school', 'Built and working, but a school has to be switched on for it (by us, in the owner console). Manchester has it unless noted.'],
  ['Needs a database update', 'The code is built and tested, but a database update has to be run on the school first. Until then it stays hidden.'],
  ['Built, not switched on', 'Finished and tested, but held back until we choose to launch it.'],
  ['Planned', 'Agreed or proposed, not built yet.'],
]))

// ---------- Smart Assess
const FEAT = (rows, color) => {
  const w = [2500, 5846, 1400]
  return new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: w, rows: [
    new TableRow({ tableHeader: true, children: [th(w[0], 'Feature', color), th(w[1], 'What it does and what it means', color), th(w[2], 'Status', color)] }),
    ...rows.map(([a, c, st]) => new TableRow({ cantSplit: true, children: [td(w[0], a, { run: { bold: true } }), td(w[1], c), td(w[2], st)] })),
  ] })
}
const sub = (t, c) => h2(t, c)

kids.push(new Paragraph({ children: [new PageBreak()] }))
kids.push(new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 120, after: 80 }, children: [run('Smart Assess', { size: 34, bold: true, color: COPPER })] }))
kids.push(p('For assessments only: set them, sit them, mark them, and understand the results.', { run: { italics: true, color: BROWN } }))
kids.push(sub('Building tests and exams', COPPER))
kids.push(FEAT([
  ['Test and exam types', 'Pop quizzes, class tests, weekly tests, midterms, monthly, end-of-term and end-of-year exams. Also assignments, homework and group projects.', 'Live'],
  ['Question types', 'Multiple choice, true/false, short answer, fill in the blank and essay. Questions can carry an image, audio or video.', 'Live'],
  ['Maths notation and calculator', 'A toolbar and symbol picker for writing equations and symbols, and an optional on-screen scientific calculator inside an exam.', 'Live'],
  ['Question bank', 'A teacher saves a question once and reuses it in future tests. Questions can be tagged to a topic from the shared topic list.', 'Live'],
  ['Import questions from a PDF', 'The AI reads a PDF of an exam and turns it into questions. The teacher reviews every one. Limited per teacher each month.', 'Live'],
  ['Polish a question with AI', 'The AI suggests clearer wording for a question. The teacher decides whether to use it. Limited per teacher each month.', 'Live'],
  ['Exam settings', 'Time limit, pass mark, access password, questions per page, the dates it is open, target year, and shuffled answer options.', 'Live'],
  ['Marking points for essays', 'A teacher writes what a good essay earns marks for, and how many. Marking then gives a box for each point. Optional.', 'Needs a database update'],
], COPPER))
kids.push(sub('School exams (standardised across a department)', COPPER))
kids.push(FEAT([
  ['Team lead exams', 'A team lead drafts a standardised exam (monthly, midterm, end of term) and submits it for review.', 'Live'],
  ['Vetting and publishing', 'Heads of department review, comment on and approve exams, then publish them to chosen classes. Several heads of one department can act together.', 'Live'],
  ['Exam sections', 'An exam can be split into sections, for example one for multiple choice and one for essays.', 'Live'],
], COPPER))
kids.push(sub('Sitting an exam: security and fairness', COPPER))
kids.push(FEAT([
  ['Secure exam page', 'Switching to another tab is counted and logged, pasting is blocked, and a student can be signed in on only one device at a time.', 'Live'],
  ['Desktop app (kiosk mode)', 'A Windows and Mac app that locks the screen to the exam while it is being sat.', 'Live'],
  ['Protected against dropped connections', 'Answers are saved on the device while a student works, so a lost connection does not lose the exam. Late submissions are still accepted but flagged for the teacher.', 'Live'],
  ['Server-side protection', 'The database controls when an exam can start, how long it runs and who can change marks, so a student cannot alter their own answers or scores.', 'Needs a database update'],
  ['Student accommodations', 'A teacher or admin can switch on supports for a student, such as read-aloud.', 'Live'],
  ['Writing integrity flags', 'For essays, the platform notes how the answer was typed (for example unusually uniform typing or text that appeared in one jump). A teacher can ask for an AI second opinion. These are only prompts. A person always decides.', 'Live'],
], COPPER))
kids.push(sub('Marking and results', COPPER))
kids.push(FEAT([
  ['Automatic marking', 'Multiple choice, true/false, short answer and fill-in answers are marked as soon as a student submits. Short answers can use marking points with keywords.', 'Live'],
  ['Grading essays', 'A teacher marks essays on a dedicated page, or student by student on a review page, and can override any mark.', 'Live'],
  ['Releasing results', 'Results are held back until the teacher releases them. Students are emailed when results are released.', 'Live'],
  ['Student results and trends', 'Each student sees their past results, their average and how their scores are changing.', 'Live'],
  ['Self-mock practice', 'A student can practise on questions from exams they have already sat, once results are released.', 'Live'],
  ['Report cards', 'Term reports built from a student\'s results, viewable by teachers, heads of department and the school admin.', 'Live'],
  ['Department and school analytics', 'Pass rates by subject, by month and by department, so leaders can see which subjects are struggling.', 'Live'],
  ['Integrity dashboard', 'Flagged exam sessions and writing-integrity flags in one place for heads of department and admins.', 'Live'],
  ['Exam insight', 'For each test: which questions the class missed, the wrong answer most students chose, which students may need support and why, and how the class compares with its last five tests. Downloadable as a spreadsheet.', 'Live'],
], COPPER))
kids.push(sub('External exams', COPPER))
kids.push(FEAT([
  ['Organisation exams', 'A separate service for companies and groups to run one-off exams for their own respondents, with an exam code and password. It is not tied to a school.', 'Live'],
], COPPER))
kids.push(sub('Coming next', COPPER))
kids.push(FEAT([
  ['AI-suggested essay marking', 'The AI proposes a mark for each marking point, with the words from the essay that earned it, and flags where it is unsure. The teacher edits and saves. The AI never saves a mark, never sees a student\'s name, and runs only when a teacher asks. Off by default and switched on per school.', 'Planned'],
  ['Student results by topic', 'A student\'s own view of which topics they scored badly on, built from their exam results.', 'Planned'],
  ['AI question drafting', 'The AI drafts test questions from a topic, for the teacher to review.', 'Planned'],
], COPPER))

// ---------- Smart Learning
kids.push(new Paragraph({ children: [new PageBreak()] }))
kids.push(new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 120, after: 80 }, children: [run('Smart Learning', { size: 34, bold: true, color: TEAL })] }))
kids.push(p('For learning only: lessons, study, catch-up and reading. It acts on what Smart Assess finds but does not make or mark assessments.', { run: { italics: true, color: BROWN } }))
kids.push(sub('Lessons and planning', TEAL))
kids.push(FEAT([
  ['Lessons', 'A teacher builds a lesson in five steps (Engage, Explore, Explain, Elaborate, Evaluate, the "5E" model used in the national curriculum) and assigns it to a class. Students work through it at their own pace and their progress is recorded.', 'On per school'],
  ['Check-your-understanding questions', 'Short questions inside a lesson. A teacher sees how each student did and which questions were missed.', 'On per school'],
  ['Catch-up for absent students', 'A teacher records the day a lesson was taught. Students marked absent that day are offered the lesson as a catch-up, and the teacher sees who has caught up.', 'On per school'],
  ['Coverage grid', 'Shows, by class and topic, which lessons have been taught and which classes are behind, so teachers and heads of department can see gaps. Downloadable as a spreadsheet.', 'On per school'],
  ['Lesson plans', 'A teacher drafts a full plan using the national curriculum 5E template. An AI button drafts the plan from a subject, grade and topic, and the teacher reviews it. Plans can be organised in units and are private to their author.', 'Live'],
  ['Shared lesson plan library', 'Teachers at different schools can browse and copy each other\'s published plans.', 'Live'],
  ['Topics', 'One shared list of subject topics by grade. Teachers can propose a topic and heads of department approve, rename or merge them. Lessons, questions and games all point at the same topics.', 'On per school'],
], TEAL))
kids.push(sub('Support for students', TEAL))
kids.push(FEAT([
  ['AI tutor', 'A student can ask questions about a lesson they are working on. It has daily limits, students are told their teacher can read the conversation, and worrying conversations are flagged for an adult. The school decides whether it is on, and the principal can switch it off at any time.', 'On per school, optional'],
  ['Tutor safety list', 'Conversations that raise a wellbeing or safety concern are collected for a teacher or principal to read.', 'On per school, optional'],
], TEAL))
kids.push(sub('The Library', TEAL))
kids.push(FEAT([
  ['Reading and listening', 'Students read books page by page or listen to audio recordings, and the Library remembers where they stopped. There is a shelf for books in the curriculum and a shelf for reading for fun.', 'Live, no books added yet'],
  ['Curated centrally', 'Smart Assess Ja chooses and clears every title (public domain or openly licensed). Schools do not upload books. A title can only be published once its rights are confirmed.', 'Live'],
  ['Reading assignments', 'A teacher assigns a book or a chapter to a class with a due date and sees who has finished it.', 'Live'],
  ['Bookmarks and notes', 'A student can bookmark pages and keep private notes. Teachers cannot read them.', 'Live'],
  ['School controls', 'The school admin chooses which shelves and year groups see the Library, can switch audio off, can hide any title, and decides whether teachers may assign reading.', 'Live'],
], TEAL))
kids.push(sub('Coming next', TEAL))
kids.push(FEAT([
  ['Flashcards', 'Cards built from a lesson\'s key points and from questions a student got wrong.', 'Planned'],
  ['Activities for different ability levels', 'Support, core and extension activities in lessons and lesson plans.', 'Planned'],
  ['Results to catch-up loop', 'From a weak topic found in Smart Assess, assign a catch-up lesson or practice to the students who need it.', 'Planned'],
  ['Offline and low-data use', 'Lessons and books that can be read with little or no internet.', 'Planned'],
  ['Teacher resource space', 'A place to upload and organise teaching documents by class and topic.', 'Planned'],
], TEAL))

// ---------- Smart Play
kids.push(new Paragraph({ children: [new PageBreak()] }))
kids.push(new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 120, after: 80 }, children: [run('Smart Play', { size: 34, bold: true, color: GOLD })] }))
kids.push(p('For playing games only: quick, fun practice for the classroom. It does not replace formal assessment and it never holds the school\'s official results. Built and tested, held back until we choose to launch it. Manchester sees it as "coming soon".', { run: { italics: true, color: BROWN } }))
kids.push(FEAT([
  ['Topic Mastery', 'A student practises one topic at a time and watches their mastery of it grow.', 'Built, not switched on'],
  ['Math Duels', 'Two students race through maths questions, one answering after the other, without needing to be online at the same moment.', 'Built, not switched on'],
  ['Live quiz', 'A teacher hosts a quiz on the projector and students answer on their own devices, in the style of a classroom quiz show.', 'Built, not switched on'],
  ['Jeopardy-style boards', 'A teacher runs a board of categories and points with a buzz-in, for individual students or teams.', 'Built, not switched on'],
  ['Tug of War', 'Two teams pull a rope by answering quick questions, and every student appears on the field.', 'Built, not switched on'],
  ['Rewards', 'Points (XP), day streaks, 18 badges and class leaderboards keep practice going. Teachers see badges on a class progress page.', 'Built, not switched on'],
  ['Question management', 'A teacher builds their own game questions or imports many at once from a spreadsheet.', 'Built, not switched on'],
  ['Its own sign-in', 'Play has a separate student and teacher sign-in so its data stays apart from exam data. Accounts are copied across from the school roster.', 'Built, not switched on'],
], GOLD))
kids.push(sub('Coming later', GOLD))
kids.push(FEAT([
  ['Challenges between students', 'Head-to-head and class challenges, then competitions between schools across the island.', 'Planned'],
], GOLD))

// ---------- shared school tools
kids.push(new Paragraph({ children: [new PageBreak()] }))
kids.push(new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 120, after: 80 }, children: [run('School tools shared by all three', { size: 34, bold: true, color: BROWN })] }))
kids.push(p('These are not part of Smart Assess, Smart Learning or Smart Play. They run the school itself, and the three products rely on them.', { run: { italics: true, color: BROWN } }))
kids.push(FEAT([
  ['Roles and portals', 'Separate home pages and menus for students, teachers, heads of department, school admins and principals, so each person sees only what they need.', 'Live'],
  ['Attendance', 'Teachers register classes (start class, roll call). Heads of department see their own department\'s attendance. Principals see the live board and a truancy report.', 'Live'],
  ['Attendance alerts', 'Principals and admins are alerted when a teacher is late or has not started class, or when a student marked present in the morning is missing from a class.', 'Live'],
  ['Timetable', 'The school timetable by class or teacher.', 'Live'],
  ['Teacher absence and cover', 'A teacher reports an absence, the system finds a free substitute for each class, and heads of department and admins review and fill any gaps. An absence can be cancelled.', 'Live'],
  ['Staff messaging', 'Staff message each other directly or message the whole staff group.', 'Live'],
  ['Classes and enrolment', 'Departments, subjects, classes, who teaches what, and which students are in which class. Year promotion and class changes.', 'Live'],
  ['Staff and student management', 'Add people one at a time or from a spreadsheet. Password reset requests, active sessions and an activity log for the school admin.', 'Live'],
  ['Principal and vice principal portal', 'A school-wide view: alerts, attendance, staff, students, and a read-only view of each teacher\'s work.', 'Live'],
  ['Help assistant', 'A "?" chat helper that explains how the platform works. It cannot see anyone\'s account or data.', 'Live'],
  ['Owner console', 'For Smart Assess Ja staff only: set up schools, switch features on per school, manage subscriptions and billing, and manage the Library catalogue.', 'Live'],
], BROWN))

kids.push(h1('Words used in this guide'))
kids.push(table([2500, 7246], ['Word', 'What it means'], [
  ['HOD', 'Head of department. Reviews exams, sees their department\'s results and attendance, and also teaches classes.'],
  ['Direct test or exam', 'A test a teacher sets and publishes to their own classes, with no approval step.'],
  ['School exam (final exam)', 'A standardised exam written by a team lead, approved by the head of department and published to several classes.'],
  ['Marking point', 'One thing a good answer earns marks for, with the marks it is worth. A short answer can have several.'],
  ['5E', 'The five-step lesson model in the national curriculum: Engage, Explore, Explain, Elaborate, Evaluate.'],
  ['Catch-up', 'A lesson offered to a student who was absent on the day it was taught.'],
  ['Coverage', 'Whether each class has been taught each topic.'],
  ['Topic', 'A named piece of the curriculum for one subject and grade, for example "Simple interest, Grade 9". The shared topic list ties the three products together.'],
  ['Integrity flag', 'A prompt for a teacher to look closer at something, such as switching tabs during an exam. It is never proof, and a person always decides.'],
  ['Kiosk mode', 'The desktop app locking the screen to the exam while it is being sat.'],
  ['Per-school switch', 'A setting the owner console turns on for one school at a time. A feature that is "on per school" is available only where its switch is on.'],
]))
kids.push(p('Statuses reflect the code as of 6 October 2026. Whether a given school has a feature switched on is a setting, so confirm it in the owner console before promising it.', { run: { italics: true, size: 18, color: BROWN }, para: { spacing: { before: 140 } } }))

const doc = new Document({
  creator: 'Smart Assess Ja', title: 'The three products and what they do',
  styles: { default: { document: { run: { font: FONT, size: 21 } } } },
  numbering: { config: [{ reference: 'bul', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } }] }] },
  sections: [{
    properties: { page: { size: { width: A4.w, height: A4.h }, margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } } },
    footers: { default: new Footer({ children: [para([run('SMART ASSESS JA   |   PRODUCT GUIDE   |   6 OCTOBER 2026', { size: 15, color: BROWN })], { spacing: { after: 0 } })] }) },
    children: kids,
  }],
})
Packer.toBuffer(doc).then((buf) => { const out = path.join(OUT_DIR, 'Smart-Assess-Ja-Product-Guide.docx'); fs.writeFileSync(out, buf); console.log('wrote', out) })
