// Builds docs/blueprints/Teacher-Exam-Insight-Blueprint.docx (A4). Lives under marketing/ so the app's linter ignores it.
// Run:  NODE_PATH=<folder with docx> node build_blueprint.js
const fs = require('fs'), path = require('path')
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType, AlignmentType, Footer, PageBreak, VerticalAlign, LevelFormat, HeadingLevel, ImageRun } = require('docx')

const COPPER = 'D4762A', TEAL = '1F8A84', BROWN = '6B4F35', INK = '1E1208', LINE = 'D8C7AE', TINT = 'FAE8D4', GOLD = 'B58A00'
const FONT = 'Calibri'
const A4 = { w: 11906, h: 16838 }, MARGIN = 1080, W = A4.w - 2 * MARGIN
const OUT_DIR = path.join(__dirname, '..', '..', 'docs', 'blueprints')

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
kids.push(new Paragraph({ spacing: { after: 40 }, children: [run('SMART ASSESS', { size: 18, bold: true, color: COPPER, characterSpacing: 60 })] }))
kids.push(new Paragraph({ spacing: { after: 100 }, children: [run('Teacher exam insight: build blueprint', { size: 44, bold: true })] }))
kids.push(p('Which questions did the class miss, which mistakes were common, and which students may need support. Approved 5 October 2026. Stages A to D are built and tested; waiting for you to apply migration 080 and push.', { run: { size: 22, color: BROWN } }))

// ---------------- 1
kids.push(h1('1. What this is, in one page'))
kids.push(table([2300, 7446], null, [
  ['The problem', 'Marking is the biggest cost for teachers (8 of 10), and what they want most afterwards is to know who is struggling (8 of 10), who needs support (7), what the common mistakes were (7) and how the class compares with earlier tests (6). Today Smart Assess shows a teacher each student\'s result, but nothing across the class. One teacher asked for "a learning gap tracker that analyses assessment results and identifies areas where students need support".'],
  ['What we build', 'An "Insight" page for every completed test or exam. Three tabs: Questions (hardest first, with the wrong answer most students chose), Students (who may need support, and why), and Class over time (this test against the last five). Plus a score for each topic and a CSV download.'],
  ['What it is not', 'It uses no AI, asks teachers to enter nothing, writes nothing to the database and shows nothing to students. It does not recommend lessons or assign work: that belongs to Smart Learning (section 2).'],
  ['Who sees it', 'The teacher who set the test, the teacher of the class for a school exam, the head of department and the school admin, each seeing only the students they can already see today. Principals are included, read only, as you decided.'],
  ['How big', 'Medium. One new database function, one calculation library, one page with three tabs. Roughly four stages, each safe to ship on its own.'],
]))
kids.push(para([run('')], { spacing: { after: 60 } }))

// ---------------- 2
kids.push(h1('2. Which product every improvement belongs to'))
kids.push(p('Each improvement from the survey now sits under one product only, using this rule:'))
;[
  [b('Smart Assess is for assessments only. '), run('Setting, sitting, marking and analysing tests and exams, and the results that come out of them.')],
  [b('Smart Learning is for learning only. '), run('Lessons, practice, study tools, catch-up and reading. It acts on what Smart Assess finds, but it does not make or mark assessments.')],
  [b('Smart Play is for playing games only. '), run('Game boards, duels and competitions. It never holds the school\'s official results.')],
].forEach((x) => kids.push(bullet(x)))
kids.push(p('The three share one list of topics (each topic has a permanent code), so a weak topic found in Smart Assess can later point to a lesson in Smart Learning or a game in Smart Play without any of them reaching into the others\' data.'))
const cat = (c) => ({ cell: { shading: { type: ShadingType.CLEAR, fill: c, color: 'auto' } }, run: { bold: true, color: 'FFFFFF' } })
const catWidths = [1500, 3200, 5046]
const rowsCat = [
  ['Smart Assess', COPPER, [
    ['Teacher exam insight', 'This blueprint. Most-missed questions, common wrong answers, students needing support, class over time.'],
    ['AI-suggested essay marking', 'The AI proposes a score for each marking point; the teacher confirms. Marking is the top time cost (8 of 10).'],
    ['AI question drafting', 'Draft test questions from a topic, reviewed by the teacher.'],
    ['Student results by topic', 'A student\'s own view of which topics they scored badly on, built only from their exam results. ("Topics I need to improve": 9 of 12 students.)'],
    ['Exam printing and export', 'Print layout for an exam. Low demand (1 of 10). Later.'],
    ['Grade calculation', 'Ask teachers what they mean before building (8 of 10 ticked it).'],
  ]],
  ['Smart Learning', TEAL, [
    ['Flashcards', 'Cards from a lesson\'s key points and from questions a student got wrong. 7 of 12 students chose them.'],
    ['Ability-level activities', 'Support, core and extension activities in lessons and lesson plans. 9 of 10 teachers asked.'],
    ['Results to catch-up loop', 'From a weak topic found in Smart Assess, assign a catch-up lesson or practice set. The finding is Assess; the assigning is Learning.'],
    ['Offline and low-data use', 'Lessons and Library books readable offline, lighter pages. (Protecting an exam in progress already exists inside Smart Assess.)'],
    ['Teacher resource space', 'Upload and organise teaching documents by class and topic.'],
    ['Weekly improvement summary', 'A short weekly note to the student about their learning progress.'],
  ]],
  ['Smart Play', GOLD, [
    ['Quiz challenges between students', 'Head-to-head and class challenges. 4 of 12 chose games and two wrote about it.'],
    ['Island-wide competitions', '"Quiz competitions islandwide". A later extension of Smart Play, after the school version is switched on.'],
  ]],
]
const catRows = []
rowsCat.forEach(([prod, col, items]) => items.forEach(([a, c], i) => catRows.push(new TableRow({ cantSplit: true, children: [
  i === 0 ? cell(catWidths[0], [para([run(prod, { size: 19, bold: true, color: 'FFFFFF' })], { spacing: { after: 0 } })], { shading: { type: ShadingType.CLEAR, fill: col, color: 'auto' }, rowSpan: items.length }) : null,
  td(catWidths[1], a, { run: { bold: true } }), td(catWidths[2], c),
].filter(Boolean) }))))
kids.push(new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: catWidths, rows: [new TableRow({ tableHeader: true, children: [th(catWidths[0], 'Product'), th(catWidths[1], 'Improvement'), th(catWidths[2], 'What it is')] }), ...catRows] }))
kids.push(p('One thing to decide later, not now: student self-mock practice (questions from exams a student has already sat) lives inside the Smart Assess student area today but is practice, not assessment. It is left where it is.', { run: { size: 19, italics: true, color: BROWN }, para: { spacing: { before: 100, after: 100 } } }))

// ---------------- 3
kids.push(new Paragraph({ children: [new PageBreak()] }))
kids.push(h1('3. What the teacher sees'))
kids.push(p('Reached from a new Insight button next to Results on a test, and from a list of school exams for the teacher\'s classes. The screens below are illustrative: invented students and numbers.'))
kids.push(h2('Questions tab'))
kids.push(img('exam-insight-questions.png', 610))
kids.push(caption('Questions, hardest first. Each shows how many got full marks, the wrong answer most students chose, and its topic.'))
kids.push(h2('Students and Class over time'))
kids.push(img('exam-insight-students.png', 610))
kids.push(caption('Students who may need support, with the reasons shown, and the class average over its last five tests.'))

kids.push(h2('How each number is worked out'))
kids.push(table([2200, 4546, 3000], ['Shown', 'How it is worked out', 'When it is hidden'], [
  ['Got it right', 'Students who earned full marks on the question, divided by students who sat the test. For essays and multi-mark questions, the average share of marks instead.', 'Fewer than 5 students sat the test: show counts only, no percentages.'],
  ['Most missed', 'The questions at the bottom of the list, flagged when under 40% got them right.', 'Fewer than 8 students.'],
  ['What they chose instead', 'For multiple choice and true/false: the wrong answer chosen most, when at least 3 students (and a quarter of the class) chose it.', 'Never shown for essays or written answers.'],
  ['Check this question', 'Flagged when students who scored highest overall did no better on the question than those who scored lowest. That often means a wrong answer key or an unclear question.', 'Fewer than 15 students.'],
  ['By topic', 'Marks earned on a topic\'s questions divided by marks available, using the shared topic list. Questions with no topic are counted and listed as left out.', 'Topic with no tagged questions.'],
  ['May need support', 'Any of: below the exam\'s own pass mark; 15 or more percentage points under their own average on at least two earlier tests in the subject; did not sit the test; or under 40% on a topic with at least three questions. Reasons are always shown beside the name.', 'Students whose essays are still unmarked are listed as "waiting for marking" instead.'],
  ['Class over time', 'Average score of the same class group on its last five finished tests in the subject, oldest to newest.', 'Fewer than 2 earlier tests.'],
]))

// ---------------- 4
kids.push(h1('4. Rules we are building in'))
;[
  [b('Advisory only. '), run('Nothing is concluded about a student automatically. The wording is "may need support", the reasons are shown, and the list is a prompt for the teacher, the same principle as the integrity flags.')],
  [b('Teachers, heads of department and admins see nothing new. '), run('Access is checked inside the database, using the same rules that already control who can read exam sessions and responses. A class teacher sees their own classes\' students, even on an exam sat by a whole year group. Principals cannot read raw exam results today, so this page gives them a read-only view. You approved that.')],
  [b('Unmarked work is never counted as zero. '), run('Essays still waiting for marks are left out of averages and flagged, so a teacher is not shown an artificially low class.')],
  [b('Honest about small groups. '), run('Thresholds in the table above stop a class of six from producing confident-looking percentages.')],
  [b('Not just colour. '), run('Every bar carries its number and a word, so it still reads in black and white and for colour-blind teachers.')],
].forEach((x) => kids.push(bullet(x)))
kids.push(h2('Who can open an Insight page'))
kids.push(table([3000, 3373, 3373], ['Person', 'Test they set themselves (direct)', 'School exam (final)'], [
  ['Teacher who set it', 'Yes, all students who sat it', 'Only for the classes they teach'],
  ['Class teacher of the subject', 'No (not their test)', 'Yes, only students in classes they teach'],
  ['Head of department', 'Yes, their department', 'Yes, their department'],
  ['School admin', 'Yes', 'Yes'],
  ['Principal, vice principal', 'Yes, read only (your decision 1)', 'Yes, read only (your decision 1)'],
  ['Students, other departments, signed-out', 'No', 'No'],
]))
kids.push(p('This matches the existing rules for reading exam sessions and responses. The one addition, principals, is read-only and was your decision 1.', { run: { size: 19, italics: true, color: BROWN }, para: { spacing: { before: 100 } } }))

// ---------------- 5
kids.push(new Paragraph({ children: [new PageBreak()] }))
kids.push(h1('5. How it is built'))
kids.push(h2('Three layers'))
kids.push(table([1700, 4400, 3646], ['Layer', 'What it does', 'Why it is a separate piece'], [
  ['One secured database function', 'exam_insight_data(kind, exam_id). Checks who is asking, then returns only what that person may see: the exam, its questions, the students, each student\'s marks per question, the wrong-answer counts for multiple choice, and the class\'s last few tests.', 'Security lives in one place, in the database, next to the rules it must match. Nothing secret is sent to the browser.'],
  ['A calculation library', 'examInsightPure.ts. Pure functions that turn that data into every number above: percentages, most missed, topic scores, who may need support. No database, no screen.', 'Easy to test with hand-worked examples, and the thresholds can change without touching the database.'],
  ['The page', 'A teacher page with the three tabs and a CSV download, calling the function with the teacher\'s own sign-in.', 'Uses the same screens, styling and sign-in as the rest of the teacher area.'],
]))
kids.push(h2('What it reads (all existing)'))
kids.push(p('Exam sessions and responses (marks and answers), questions (type, points, options, answer key, topic), the exam\'s pass mark and class groups, enrolments (who was in the class, to count students who did not sit), and the shared topic list. No new tables are needed. Nothing is written.'))
kids.push(h2('What is added'))
kids.push(table([4300, 5446], ['New file', 'Purpose'], [
  ['scripts/migrations/080_exam_insight.sql (+ rollback)', 'The secured function and its small helpers. Functions only; nothing existing changes.'],
  ['src/lib/examInsightPure.ts', 'All the calculations.'],
  ['src/lib/examInsight.ts', 'Loads the data and checks whether the migration is installed, so the Insight button stays hidden until it is.'],
  ['src/app/teacher/insight/[kind]/[id]/page.tsx', 'The page. kind is direct or final.'],
  ['src/components/insight/*', 'Summary cards, questions table, topic bars, students list, class-over-time chart.'],
  ['Small edits to three existing pages', 'Insight button on the test sessions page; a school-exams list on My Classes; a link from the department Exam Results view.'],
  ['scripts/tests/examInsight.test.mjs', 'Automatic checks of every calculation (uses Node\'s built-in test runner, no new packages).'],
  ['docs/exam-insight-setup.md and a QA section', 'The order to apply and check it, in the same style as the Library guide.'],
]))
kids.push(h2('Two details that matter'))
;[
  [b('Two kinds of exam. '), run('A teacher\'s own test links its questions directly; a school exam reaches its questions through a separate link table. The function handles both, so the page does not need to care.')],
  [b('Next.js version. '), run('This project uses a newer Next.js than most documentation describes. Before writing the page, I will read the version\'s own guides in node_modules, as the project instructions require, and follow how the existing teacher pages do routing and data loading.')],
].forEach((x) => kids.push(bullet(x)))

// ---------------- 6
kids.push(h1('6. Build stages'))
kids.push(table([900, 3300, 3346, 2200], ['Stage', 'What is built', 'How we know it works', 'Your part'], [
  ['A', 'The secured function (migration 080) and the calculation library, with their tests. BUILT.', 'Access matrix proven in a private test database (71 checks, and the tests were shown to fail when a rule is broken); every calculation matches a worked example (17 checks); 300 students and 50 questions load in about 130 ms.', 'Nothing.'],
  ['B', 'The page with the summary cards and the Questions tab, and the Insight button on tests. BUILT.', 'Checked in the browser with real output from the test database, desktop and phone width; no sideways scroll; button hidden when the migration is absent.', 'Apply 080 on Manchester; push.'],
  ['C', 'Students tab, Class over time, topic scores, CSV download. BUILT.', 'Same checks, plus edge cases: nobody sat, all essays unmarked, a very small class, no topics, spreadsheet formula injection.', 'Included in the same push.'],
  ['D', 'Exam list for each portal, entries for heads of department, admin and principal, setup guide, QA checklist. BUILT.', 'List access checked for every kind of person; full production build passes. The walk-through on real Manchester data is yours (checklist 7h).', 'Walk through checklist 7h with two teachers.'],
]))
kids.push(p('As usual, I will not push code or run SQL on your live database. I will give you the exact commands, and I will test every database change on a private copy first.', { run: { size: 19, italics: true, color: BROWN }, para: { spacing: { before: 100 } } }))

// ---------------- 7
kids.push(h1('7. Testing and safety'))
;[
  [b('Access. '), run('For every row of the access table, a test signs in as that kind of person in a private copy of the database and asks for insight on an exam they should and should not see. A second check proves the function never returns a student the existing rules would hide.')],
  [b('Numbers. '), run('Small invented exams with answers worked out by hand, covering partial marks, essays, true/false, blank answers, ties and a question with no topic.')],
  [b('Edge cases. '), run('No one sat, one student sat, all essays unmarked, a deleted question, a student who left the class, an exam with no pass mark set.')],
  [b('Speed. '), run('A year-group exam (300 students, 50 questions) must load in a couple of seconds. The existing exam-table security rules were once slow, so this is measured, not assumed.')],
  [b('Screens. '), run('Browser checks on desktop and phone width, with the migration present and absent.')],
].forEach((x) => kids.push(bullet(x)))

// ---------------- 8
kids.push(h1('8. Risks'))
kids.push(table([2800, 6946], ['Risk', 'What we do about it'], [
  ['Few questions are tagged with a topic, so topic scores look empty', 'First, count how many questions on Manchester have a topic (a one-line check I will give you). If few do, ship the Questions and Students tabs first and show topic scores only where they exist, with a clear note. Making topic tagging easier is a separate, later task.'],
  ['A teacher reads "may need support" as a verdict', 'Wording, visible reasons and a note on the list. No score, no label such as "at risk", nothing shown to students or parents.'],
  ['A wrong answer key makes a good question look hard', 'The "Check this question" flag exists for exactly this, and the page says so in plain words.'],
  ['The page is slow on a large exam', 'Aggregation happens in the database, the browser receives compact data, and speed is tested before release.'],
  ['Class lists are out of date, so a student appears under the wrong class', 'Only the classes the exam was set for are used. Where a student has moved, they appear only if the exam says so; the page names the class groups it used.'],
  ['The line between Assess and Learning blurs', 'This feature only reads and shows. Any action (assigning a catch-up lesson, practice, a game) is a separate Smart Learning or Smart Play feature that links by topic code.'],
]))

// ---------------- 9
kids.push(h1('9. Decisions (settled 5 October)'))
kids.push(table([2600, 7146], ['Decision', 'What you chose'], [
  ['1. Who may open it', 'Teacher, head of department and admin as today, plus principals and vice principals, read only.'],
  ['2. Which exams', 'Both: teachers\' own tests, and school exams for the classes a teacher teaches.'],
  ['3. Who is listed as "may need support"', 'All four rules: below the pass mark; 15 or more points under their own average; did not sit; weak on a whole topic.'],
  ['4. If few questions have a topic', 'Ship without topic scores, and show them only where questions are tagged, with a note on the page.'],
  ['5. Student names for leadership', 'Show names. They can already see them in results.'],
]))
kids.push(h1('10. What this unlocks'))
;['Smart Learning: the "results to catch-up" feature can start from a weak topic found here and offer a catch-up lesson or a flashcard set for the students listed.', 'Smart Assess: student results by topic reuses the same calculations, from the student\'s side.', 'The survey: we can ask teachers the same question again after they have used it, and see whether it helped.'].forEach((x) => kids.push(bullet(x)))

const doc = new Document({
  creator: 'Smart Assess Ja', title: 'Teacher exam insight: build blueprint',
  styles: { default: { document: { run: { font: FONT, size: 21 } } } },
  numbering: { config: [{ reference: 'bul', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } }] }] },
  sections: [{
    properties: { page: { size: { width: A4.w, height: A4.h }, margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } } },
    footers: { default: new Footer({ children: [para([run('SMART ASSESS   |   TEACHER EXAM INSIGHT BLUEPRINT   |   5 OCTOBER 2026', { size: 15, color: BROWN })], { spacing: { after: 0 } })] }) },
    children: kids,
  }],
})
Packer.toBuffer(doc).then((buf) => { const out = path.join(OUT_DIR, 'Teacher-Exam-Insight-Blueprint.docx'); fs.writeFileSync(out, buf); console.log('wrote', out) })
