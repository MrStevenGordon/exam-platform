// Builds the survey findings + improvement plan report (A4 portrait).
// Run:  NODE_PATH=<folder with docx> node build_report.js     (reads ../survey/tallies.json)
const fs = require('fs'), path = require('path')
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType, AlignmentType, Footer, PageBreak, VerticalAlign, LevelFormat, HeadingLevel } = require('docx')

const COPPER = 'D4762A', TEAL = '1F8A84', BROWN = '6B4F35', INK = '1E1208', LINE = 'D8C7AE', TINT = 'FAE8D4', PALE = 'FDF8F3'
const FONT = 'Calibri'
const A4 = { w: 11906, h: 16838 }, MARGIN = 1080, W = A4.w - 2 * MARGIN // 9746
const T = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'survey', 'tallies.json'), 'utf8'))

const border = (c = LINE, sz = 6) => ({ style: BorderStyle.SINGLE, size: sz, color: c })
const allB = (c, sz) => ({ top: border(c, sz), bottom: border(c, sz), left: border(c, sz), right: border(c, sz) })
const run = (t, o = {}) => new TextRun({ text: t, font: FONT, size: 21, color: INK, ...o })
const para = (children, o = {}) => new Paragraph({ children: Array.isArray(children) ? children : [children], spacing: { after: 120, line: 276 }, ...o })
const p = (t, o = {}) => para([run(t, o.run || {})], o.para || {})
const h1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 360, after: 140 }, children: [run(t, { size: 32, bold: true })] })
const h2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 100 }, children: [run(t, { size: 25, bold: true, color: COPPER })] })
const bullet = (parts) => new Paragraph({ numbering: { reference: 'bul', level: 0 }, spacing: { after: 80, line: 270 }, children: (Array.isArray(parts) ? parts : [parts]).map((x) => (typeof x === 'string' ? run(x) : x)) })
const b = (t) => run(t, { bold: true })

const cell = (w, kids, o = {}) => new TableCell({ width: { size: w, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 110, right: 110 }, verticalAlign: VerticalAlign.TOP, borders: allB(LINE, 6), ...o, children: kids })
const th = (w, t, fill = INK) => cell(w, [para([run(t, { size: 18, bold: true, color: 'FFFFFF' })], { spacing: { after: 0 } })], { shading: { type: ShadingType.CLEAR, fill, color: 'auto' }, verticalAlign: VerticalAlign.CENTER })
const td = (w, t, o = {}) => cell(w, (Array.isArray(t) ? t : [t]).map((x) => para(typeof x === 'string' ? [run(x, { size: 18, ...(o.run || {}) })] : x, { spacing: { after: 40, line: 250 } })), o.cell || {})

// A results table: option | count | bar made of text blocks
function results(rows, n, colour) {
  const widths = [5200, 900, 3646]
  const out = [new TableRow({ tableHeader: true, children: [th(widths[0], 'Answer'), th(widths[1], `Of ${n}`), th(widths[2], 'Share')] })]
  rows.forEach(([label, k]) => {
    const pct = Math.round((100 * k) / n)
    out.push(new TableRow({ cantSplit: true, children: [
      td(widths[0], label), td(widths[1], String(k), { run: { bold: true } }),
      td(widths[2], [[run('█'.repeat(Math.max(1, Math.round(k / n * 20))), { size: 16, color: colour }), run(`  ${pct}%`, { size: 17, color: BROWN })]]),
    ] }))
  })
  return new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: widths, rows: out })
}
const question = (title, note, rows, n, colour) => [
  new Paragraph({ keepNext: true, spacing: { before: 200, after: 40 }, children: [run(title, { bold: true, size: 22 })] }),
  ...(note ? [new Paragraph({ keepNext: true, spacing: { after: 70 }, children: [run(note, { size: 18, italics: true, color: BROWN })] })] : []),
  results(rows, n, colour), para([run('')], { spacing: { after: 60 } }),
]

// ---------- mapping table ----------
const PRI = { 1: ['1  Build next', COPPER], 2: ['2  Soon after', TEAL], 3: ['3  Later', BROWN], 0: ['Already built', '3E7A4F'], 4: ['Ask first', '7A6A58'] }
const MAP = [
  { ask: 'Marking takes the most time (8 of 10 teachers). One teacher wrote "AI marking". 5 of 10 want automatic marking inside one workflow.',
    today: 'Multiple choice, true/false, short answer and fill-in-the-blank are marked automatically. Essays are marked by hand against the marking points. AI is used on essays only to flag integrity concerns, never to score.',
    gap: 'No AI-suggested essay score.', p: 1 },
  { ask: 'Know who is struggling (8 of 10), who needs support (7), and the common mistakes (7). A teacher asked for a "learning gap tracker". Class against previous assessments: 6 of 10.',
    today: 'A teacher sees each student\'s exam history. Heads of department and administrators see pass rates by subject, by department and by month. Smart Learning shows check-question results and a topic coverage grid.',
    gap: 'No teacher view of per-question results ("most missed questions") and no list of students needing support after an exam. I found neither in the code; please confirm in the app.', p: 1 },
  { ask: 'When a student misses class: identify what they missed (9 of 10), show their progress after catching up (9), lesson notes (8), catch-up quiz (5).',
    today: 'Catch-up lists are built from the register and the day a lesson was taught. Students see what to catch up on. Teachers see who has caught up. Lessons can carry check-your-understanding questions.',
    gap: 'Small. "Recommend what to do next" was the least wanted (3 of 10). Practice activities: 5 of 10.', p: 0 },
  { ask: 'Lesson planning: different activities for different ability levels (9 of 10), activities and examples (8), AI-assisted planning (8), curriculum-aligned resources (7), share and reuse (5).',
    today: 'Lesson plans use the Ministry\'s 5E template with an AI-assist draft. A cross-school lesson plan library lets teachers browse and copy published plans. Smart Learning lessons are available.',
    gap: 'No ability-level (support, core, extension) activities in lesson plans or lessons. Nothing like it found in the code.', p: 2 },
  { ask: 'Creating questions takes time (6 of 10) and 8 of 10 want it in one workflow.',
    today: 'Question bank, add-from-bank, AI polish of a written question, and AI import of questions from a PDF.',
    gap: 'No AI drafting of new questions from a topic or lesson.', p: 2 },
  { ask: 'Students want to see the topics they need to improve (9 of 12), their grades (7), a comparison with previous results (6), and progress toward goals (5).',
    today: 'A student\'s history shows an overall average, a score trend and each exam result. Report cards exist.',
    gap: 'No per-topic view and no goals. A topic list exists for schools; whether exam questions can be tagged to topics needs checking before this is scoped.', p: 2 },
  { ask: 'Flashcards: 7 of 12 students chose them for practice. Short quizzes: 6 of 12. Practice on topics I struggle with: 4 of 12.',
    today: 'Self-mock practice uses questions from exams the student has already sat with released results. Lessons carry check questions.',
    gap: 'No flashcards. A quick win: build them from a lesson\'s key points or from questions the student got wrong.', p: 2 },
  { ask: 'Games and competition: 4 of 12 ticked games. In their words: "Challenges between students online" and "quiz competitions islandwide".',
    today: 'Smart Play (board games, duels, tug of war, leaderboards) is built and waiting to be switched on. Manchester shows it as coming soon.',
    gap: 'Competition is within a school. Island-wide competition is not built and would be a later extension.', p: 3 },
  { ask: 'Offline and low data: two students (wifi, offline) and two teachers ("works with limited internet", "available offline, does not need much data").',
    today: 'During an exam, answers are saved on the device if the connection drops. The site can be added to a home screen.',
    gap: 'No offline reading of lessons or books, no low-data mode, no service worker. The platform cannot fix school wifi, but it can need less of it.', p: 3 },
  { ask: 'Organizing teaching materials: tied for the thing teachers most want help with (7 of 10). "A one stop to upload all important documents."',
    today: 'Lesson plans, Smart Learning lessons and exam folders.',
    gap: 'No general teacher space to upload and organize files by class or topic.', p: 3 },
  { ask: 'Administration: attendance (5 of 10), reports (4), "a tool to assist with administrative tasks", "easy printing and exporting".',
    today: 'Attendance, report cards and several CSV exports exist. Students sit exams on screen.',
    gap: 'No print layout for exams. Only 1 of 10 teachers ticked printing, so the demand is low.', p: 3 },
  { ask: 'Grade calculation: 8 of 10 want it in the workflow, though only 4 of 10 say calculating results takes the most effort.',
    today: 'Exam totals are calculated automatically on submission and after essays are marked.',
    gap: 'Unclear what teachers mean. I did not verify term grades or weighted averages across assessments. Ask them before building.', p: 4 },
  { ask: 'Smaller asks from students: an AI tutor (1 written, 3 of 12 ticked), notes, accessibility, upcoming assignments, "my weekly improvement".',
    today: 'An optional AI tutor with daily limits and adult review, switched on per school. Notes and bookmarks in the Library reader. A read-aloud accommodation. The student home page lists upcoming exams and tasks.',
    gap: 'A weekly improvement summary for the student is not built.', p: 3 },
]
const PROD = ['Smart Assess','Smart Assess','Smart Learning','Smart Learning','Smart Assess','Smart Assess','Smart Learning','Smart Play','Smart Learning','Smart Learning','Smart Assess','Smart Assess','Smart Learning']
const PCOL = { 'Smart Assess': COPPER, 'Smart Learning': TEAL, 'Smart Play': '9A7400' }
MAP.forEach((m, i) => { m.prod = PROD[i] })
function mapTable() {
  const widths = [2800, 2800, 2446, 1700]
  const rows = [new TableRow({ tableHeader: true, children: [th(widths[0], 'What they told us'), th(widths[1], 'What Smart Assess does today'), th(widths[2], 'The gap'), th(widths[3], 'Product and priority')] })]
  MAP.forEach((m) => rows.push(new TableRow({ cantSplit: true, children: [
    td(widths[0], m.ask), td(widths[1], m.today), td(widths[2], m.gap),
    cell(widths[3], [para([run(m.prod, { size: 18, bold: true, color: 'FFFFFF' })], { spacing: { after: 20 } }), para([run(PRI[m.p][0], { size: 17, color: 'FFFFFF' })], { spacing: { after: 0 } })], { shading: { type: ShadingType.CLEAR, fill: PCOL[m.prod], color: 'auto' }, verticalAlign: VerticalAlign.CENTER }),
  ] })))
  return new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: widths, rows })
}

const S = T.students, TE = T.teachers
const lab = (q, arr) => arr
const kids = []
kids.push(new Paragraph({ spacing: { after: 40 }, children: [run('SMART ASSESS JA', { size: 18, bold: true, color: COPPER, characterSpacing: 60 })] }))
kids.push(new Paragraph({ spacing: { after: 100 }, children: [run('What Manchester told us, and what to build next', { size: 44, bold: true })] }))
kids.push(p('Survey findings and an improvement plan for the Smart Assess Ja platform. Manchester High School, October 2026. 12 students and 10 teachers.', { run: { size: 22, color: BROWN } }))

kids.push(h1('The short version'))
;[
  [b('Marking is the biggest cost for teachers. '), run('8 of 10 named it as the part of assessment that takes the most time. Auto-marking already covers objective questions. Essays are still marked by hand.')],
  [b('Teachers want to know who needs help, and why. '), run('Who is struggling (8 of 10), who needs support (7) and the common mistakes (7). That is the most valuable thing we do not yet show.')],
  [b('Missed-class support is already what they asked for. '), run('9 of 10 want a platform to identify what a student missed and to show progress after catching up. Both are built.')],
  [b('Students want to study and to see what to fix. '), run('11 of 12 want step-by-step explanations, 9 of 12 want to see the topics they need to improve, and 7 of 12 chose flashcards.')],
  [b('Access matters. '), run('Four people raised wifi, offline use or limited data without being asked. Smart Assess works only while connected, apart from protecting an exam in progress.')],
].forEach((x) => kids.push(bullet(x)))

kids.push(h2('Recommended order, by product'))
kids.push(p('Each improvement belongs to one product only. Smart Assess is for assessments, Smart Learning for learning, Smart Play for games.', { run: { size: 19, italics: true, color: BROWN } }))
;[
  [b('Smart Assess. '), run('1. Exam insight for teachers (most-missed questions, who may need support). 2. AI-suggested essay marking, which the teacher confirms. 3. Student results by topic. Later: AI question drafting.')],
  [b('Smart Learning. '), run('1. Flashcards. 2. Ability-level activities in lessons. 3. A catch-up and practice loop that starts from the weak topics Smart Assess finds. Later: offline and low-data use, a teacher resource space.')],
  [b('Smart Play. '), run('Switch on the school version first. Challenges between students and island-wide competitions come after that.')],
].forEach((x) => kids.push(bullet(x)))

kids.push(h1('About this survey'))
kids.push(new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: [2600, 7146], rows: [
  ['Who', '12 students and 10 teachers at Manchester High School, on paper.'],
  ['How the answers were read', 'The completed forms were scanned. I read the ticks, circles and slashes by eye from the scans and typed them in. A few marks were faint or ambiguous, so a count could be off by one in places.'],
  ['How they were counted', 'Every tick counts as a response. The "select up to 3" and "select one" limits printed on the forms were not applied, as agreed. Six of 12 students ticked more than one box on the "select one" question about catching up.'],
  ['What the forms do not tell us', 'There is no school, form, subject or date on the forms, and I do not know how many students and teachers were invited. This report therefore gives counts, not response rates.'],
  ['Weight', 'Twelve students and ten teachers from one school are a small sample. Read the results as a strong signal about what these people want, not as a measurement of the whole school.'],
].map(([a, c]) => new TableRow({ cantSplit: true, children: [cell(2600, [para([run(a, { size: 19, bold: true })], { spacing: { after: 0 } })], { shading: { type: ShadingType.CLEAR, fill: TINT, color: 'auto' } }), td(7146, c)] }))}))

kids.push(new Paragraph({ children: [new PageBreak()] }))
kids.push(h1('What students said'))
kids.push(p('Twelve students. They could tick as many answers as they liked.'))
const qS = {
  q1: ['1. If your school had one platform to make school life easier, what would you most want it to help with?', S.q.q1],
  q2: ['2. When a subject or topic is difficult, what would help you learn it better?', S.q.q2],
  q3: ['3. If you missed several classes, what would be most useful from a learning platform?', S.q.q3],
  q4: ['4. How would you prefer to practise for tests and exams?', S.q.q4],
  q5: ['5. If a platform showed your progress, what would you want to see?', S.q.q5],
}
Object.values(qS).forEach(([t, rows]) => kids.push(...question(t, null, rows, S.n, TEAL)))
kids.push(p('Two students left question 5 blank. One student wrote "everything" under "Other" for question 1.', { run: { size: 18, italics: true, color: BROWN } }))

kids.push(new Paragraph({ children: [new PageBreak()] }))
kids.push(h1('What teachers said'))
kids.push(p('Ten teachers. They could tick as many answers as they liked.'))
const qT = {
  q1: '1. If your school had one platform to make teaching easier, what would you most want it to help with?',
  q2: '2. Which parts of assessment currently take the most time or effort?',
  q3: '3. What would you want a teaching platform to tell you about your students?',
  q4: '4. When a student misses several classes, how would you want a platform to help you support them?',
  q5: '5. How would you want a platform to support your lesson planning and teaching?',
  q6: '6. If assessment could be handled through one digital workflow, which parts would you want it to manage?',
}
Object.entries(qT).forEach(([k, t]) => kids.push(...question(t, null, TE.q[k], TE.n, COPPER)))
kids.push(p('One teacher\'s faint pencil ticks were read with moderate confidence. One teacher ticked nearly every option on questions 1 and 4.', { run: { size: 18, italics: true, color: BROWN } }))

kids.push(new Paragraph({ children: [new PageBreak()] }))
kids.push(h1('In their own words'))
kids.push(p('Spelling lightly corrected. Nothing else changed. Blank answers are left out.'))
kids.push(h2('Students'))
kids.push(p('What is ONE feature you would definitely want in an ideal school learning platform?', { run: { bold: true, size: 19 } }))
;['"My daily improvement." (written above: "weekly")', '"Fun and engaging PowerPoint presentations."', '"Upcoming assignments."', '"A platform that goes in depth about the specific topic, shows the things and resources you need to improve in the topic, and shows studying ideas."', '"AI tutor."', '"Challenges between students online."', '"It should be offline as well as online."', '"Interactive quiz competitions where you could compete with students islandwide."'].forEach((x) => kids.push(bullet(x)))
kids.push(p('What is ONE thing about studying at school that technology could make easier?', { run: { bold: true, size: 19 }, para: { spacing: { before: 140, after: 100 } } }))
;['"Accessibility."', '"If a topic is difficult to understand I could go on the internet to better understand the information."', '"Better wifi access."', '"Technology takes it at our own pace, so we don\'t need to be worrying about anyone or anything else."', '"Using different study platforms (AI) or games such as Kahoot."', '"Easier wifi connection."', '"Note taking."'].forEach((x) => kids.push(bullet(x)))
kids.push(h2('Teachers'))
kids.push(p('What would make a school platform genuinely useful and easy to use every day?', { run: { bold: true, size: 19 } }))
;['"A simple, reliable platform that works well on both phones and computers, even with limited internet access. For example it should keep lesson plans, attendance, assignments and grades in one place, reduce repetitive paperwork and allow easy printing and exporting."', '"An app format that is available offline, does not require much space or data, and can be useful for collaboration among teachers."', '"If it were a one-stop place to upload all important documents."', '"Tracking lessons and creating follow-up to correct content."', '"A system that truly supports teaching and learning, that allows teachers to focus on the teaching and learning process."', '"If it provides help with a little of everything."', '"Learning resources and activities at different levels: beginners, intermediate, etc."', '"One that is easily accessible and user friendly."'].forEach((x) => kids.push(bullet(x)))
kids.push(p('If you could add ONE feature to improve teaching at your school, what would it be?', { run: { bold: true, size: 19 }, para: { spacing: { before: 140, after: 100 } } }))
;['"A learning gap tracker that analyses assessment results, identifies areas where students need support and suggests suitable activities for reteaching and practice."', '"Smaller class sizes."', '"Something that shows how lesson plans can be improved to be more beneficial for students."', '"Creating lesson plans and evaluating based on the needs."', '"AI marking."', '"A tool to assist with administrative tasks."', '"Better access to technological resources."'].forEach((x) => kids.push(bullet(x)))
kids.push(p('Smaller class sizes is outside what software can change, but it is the reason several of the other asks (marking, knowing who needs help) matter so much.', { run: { italics: true, size: 19, color: BROWN } }))

kids.push(new Paragraph({ children: [new PageBreak()] }))
kids.push(h1('Findings against what Smart Assess does today'))
kids.push(p('"Today" was checked against the code on 5 October 2026, not by clicking through every screen. Where I wrote that something was not found, please confirm it in the app before planning around it.'))
kids.push(mapTable())

kids.push(h1('A plan, by product'))
const PLAN = {
  'Smart Assess': [
    ['Exam insight for teachers', 'Most-missed questions for each exam, and a list of students who may need support, with the class compared against earlier tests.', 'Top teacher ask (7 to 8 of 10) and the first half of the learning gap tracker. The answers it needs are already stored. A full blueprint is written.', 'Medium'],
    ['AI-suggested essay marking', 'The AI proposes a score per marking point with its reasons. The teacher confirms or edits each one. Same advisory-only rule as the rest of the platform.', 'Marking is the top time cost (8 of 10). Needs the AI account to have credit and the same safeguards (sign-in check, monthly cap) the other AI features use.', 'Medium'],
    ['Student results by topic', 'A student view of strengths and weaknesses by topic, built only from exam results.', '9 of 12 students asked. Needs questions tagged to topics, which also strengthens the exam insight above.', 'Medium'],
    ['AI question drafting', 'Draft questions from a topic, reviewed by the teacher.', 'Creating questions takes time (6 of 10) and 8 of 10 want it in one workflow.', 'Medium'],
  ],
  'Smart Learning': [
    ['Flashcards', 'Cards built from a lesson\'s key points and from questions a student got wrong.', 'Students\' top practice choice (7 of 12) and nothing like it exists yet.', 'Small'],
    ['Ability-level activities', 'Support, core and extension activities in lesson plans and lessons. The AI-assist drafts them; the teacher edits.', '9 of 10 teachers asked. It builds on the lesson plan and AI-assist that already exist.', 'Medium'],
    ['Results to catch-up loop', 'From a weak topic found in Smart Assess, assign a catch-up lesson or practice set to the students who need it.', 'This is the "learning gap tracker" in full. Assess finds the gap; Learning acts on it.', 'Large'],
    ['Offline and low-data use', 'Lessons and Library books readable offline, lighter pages on poor connections.', 'Raised unprompted by four people. Real engineering and testing on school devices.', 'Large'],
    ['Teacher resource space', 'Upload and organize documents by class and topic.', 'Organizing teaching materials tied for the top thing teachers want help with (7 of 10).', 'Medium'],
  ],
  'Smart Play': [
    ['Switch on the school version', 'Smart Play is built and waiting to be switched on at Manchester.', 'Games and competition were chosen by 4 of 12 students.', 'Small'],
    ['Challenges between students', 'Head-to-head and class challenges, then island-wide competitions.', 'Two students wrote about it: "challenges between students online" and "quiz competitions islandwide".', 'Large'],
  ],
}
const pw = [2200, 3300, 3046, 1200]
Object.entries(PLAN).forEach(([prod, items]) => {
  kids.push(h2(prod, PCOL[prod]))
  kids.push(new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: pw, rows: [
    new TableRow({ tableHeader: true, children: [th(pw[0], 'Build', PCOL[prod]), th(pw[1], 'What it is', PCOL[prod]), th(pw[2], 'Why', PCOL[prod]), th(pw[3], 'Rough size', PCOL[prod])] }),
    ...items.map(([a, c, d, e]) => new TableRow({ cantSplit: true, children: [td(pw[0], a, { run: { bold: true } }), td(pw[1], c), td(pw[2], d), td(pw[3], e)] })),
  ] }))
  kids.push(para([run('')], { spacing: { after: 60 } }))
})
kids.push(p('"Rough size" is my first guess at effort, not a quote. It will change once each item is scoped.', { run: { italics: true, size: 18, color: BROWN }, para: { spacing: { before: 40, after: 100 } } }))
kids.push(h2('Keep and promote what exists'))
;['Missed-class catch-up: 9 of 10 teachers asked for exactly this. Make it a first-meeting demo.', 'AI-assisted lesson plans and the shared lesson plan library: 8 of 10 and 5 of 10 asked for these.', 'The AI tutor option: students ask for one, and the school keeps control of the switch.'].forEach((x) => kids.push(bullet(x)))

kids.push(h1('What to ask next'))
;['Which forms and how many students and teachers were invited? That gives a response rate.', 'What do teachers mean by "grade calculation": exam totals, term averages, or weighted grades across assessments?', 'What devices do students use, and what is the connection like at school and at home? This decides how much offline work is worth doing.', 'Repeat the survey with more teachers, and with a form for each year group, so the answers can be compared.', 'After each feature ships, ask the same two or three questions again to see whether it helped.'].forEach((x) => kids.push(bullet(x)))

const doc = new Document({
  creator: 'Smart Assess Ja', title: 'What Manchester told us, and what to build next',
  styles: { default: { document: { run: { font: FONT, size: 21 } } } },
  numbering: { config: [{ reference: 'bul', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } }] }] },
  sections: [{
    properties: { page: { size: { width: A4.w, height: A4.h }, margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } } },
    footers: { default: new Footer({ children: [para([run('SMART ASSESS JA   |   MANCHESTER HIGH SCHOOL SURVEY, OCTOBER 2026', { size: 15, color: BROWN })], { spacing: { after: 0 } })] }) },
    children: kids,
  }],
})
Packer.toBuffer(doc).then((buf) => { const out = path.join(__dirname, 'Manchester-Survey-Findings-and-Improvement-Plan.docx'); fs.writeFileSync(out, buf); console.log('wrote', out) })
