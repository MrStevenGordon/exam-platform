// Builds docs/blueprints/AI-Essay-Marking-Blueprint.docx (A4). Lives under marketing/ so the app's linter ignores it.
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
kids.push(new Paragraph({ spacing: { after: 100 }, children: [run('AI-suggested essay marking: build blueprint', { size: 44, bold: true })] }))
kids.push(p('The AI proposes marks for an essay and shows its reasons. The teacher decides. Approved 6 October 2026. Stage A (marking points for essays) is built and tested; the AI stages are next.', { run: { size: 22, color: BROWN } }))

kids.push(h1('1. What this is, in one page'))
kids.push(table([2300, 7446], null, [
  ['The problem', 'Marking takes the most time or effort of any part of assessment (8 of 10 teachers), and one teacher wrote "AI marking" as the feature they would add. Today multiple choice, true/false, short answer and fill-in questions are marked automatically. Essays are marked by hand. The AI in Smart Assess is used on essays only to flag possible AI-assisted writing, never to mark.'],
  ['What we build', 'On the essay marking screens, a Suggest marks button. The AI reads the essay against the teacher\'s marking points and proposes a mark for each point, with the words from the essay that earned it, and a Check flag where it is unsure. The teacher edits anything, then saves exactly as today. A second button suggests marks for every waiting essay on a test, with a progress bar.'],
  ['What it is not', 'The AI never saves a mark, never releases results, never sees a student\'s name, never judges whether writing was AI-assisted, and its suggestions are never shown to students. It only runs when a teacher presses the button.'],
  ['Who uses it', 'The same people who can mark essays today: the class teacher, the teacher who set the test, and heads of department.'],
  ['The finding that shapes it', 'Essay questions had no marking points. Teachers could only write them for short-answer and fill-in questions. The AI needs something to mark against, so the first piece of work was marking points for essays, written by the teacher (section 3). That is now built.'],
  ['How big', 'Medium to large, in five stages. The first stage (marking points for essays) is useful on its own, even without AI.'],
]))
kids.push(para([run('')], { spacing: { after: 60 } }))

kids.push(h1('2. Which product'))
kids.push(p('Smart Assess only: it is part of marking an assessment. It reads the answer and the marking points and produces a suggested mark. It does not teach, assign work or run games. If, later, a weak area found while marking should lead to a catch-up lesson, that is a Smart Learning feature that links by topic, not part of this one.'))

kids.push(h1('3. The marking points problem (decided: the teacher writes them)'))
kids.push(p('A mark scheme is what makes marking fair and checkable. Without one, the AI would be guessing what a good answer looks like, and two teachers would get different suggestions for the same essay. There are three ways to give it one:'))
kids.push(table([2300, 4400, 3046], ['Option', 'How it works', 'My view'], [
  ['A. Teacher writes the marking points (chosen)', 'When writing an essay question, the teacher adds the points a good answer earns marks for, with the marks. The AI marks against those.', 'Most reliable and most transparent. Costs the teacher a few minutes per question.'],
  ['B. AI drafts them, teacher approves', 'The teacher writes the question and presses Draft marking points. The AI proposes three to five points that add up to the question\'s marks. The teacher edits and saves. Marking then works as in A.', 'Same reliability as A with less typing. You chose A, so there is no AI drafting; it could be added later.'],
  ['C. No marking points', 'The AI marks against a general idea of a good answer for the topic and the marks available.', 'Quickest, but least consistent and hardest to defend if a student queries a mark. Not recommended.'],
]))
kids.push(p('Essays that already exist have no marking points. For those, the Suggest marks button is replaced by a prompt to add marking points first. Nothing is lost: the teacher can still mark by hand exactly as today.', { run: { size: 19, italics: true, color: BROWN }, para: { spacing: { before: 100 } } }))

kids.push(new Paragraph({ children: [new PageBreak()] }))
kids.push(h1('4. What the teacher sees'))
kids.push(h2('Writing the question: marking points for essays'))
kids.push(img('ai-marking-rubric.png', 600))
kids.push(caption('Marking points on an essay question. They are optional. Illustrative screen.'))
kids.push(h2('Marking: the AI suggestion beside the answer'))
kids.push(img('ai-marking-grading.png', 600))
kids.push(caption('A suggestion for one essay. Each point shows the mark, the words from the essay that earned it, and Clear or Check. The teacher can change any mark. Illustrative screen.'))
kids.push(h2('The flow, step by step'))
;[
  'The teacher writes the essay question and its marking points.',
  'Students sit the test as usual. Nothing changes for them.',
  'The teacher opens Grade essays. For one essay they press Suggest marks, or for the whole test they press Suggest marks for all.',
  'Each essay shows a suggestion: a mark per point, the quoted evidence, Clear or Check, and a suggested total. Points marked Check are listed first.',
  'The teacher edits any mark, or presses Use these marks to copy the suggestion into the mark boxes, then saves. Saving works exactly as it does today, so totals, release and notifications are unchanged.',
].forEach((x, i) => kids.push(para([b(`${i + 1}. `), run(x)], { spacing: { after: 70 } })))

kids.push(h1('5. The rules we are building in'))
kids.push(table([2700, 7046], ['Rule', 'What it means'], [
  ['A person always decides', 'The suggestion is stored separately from the marks. It can never become a mark without a teacher saving it. Results are released only after a teacher has marked, as today.'],
  ['Show the evidence', 'Every point carries a short quote from the essay and a Clear or Check flag. Where the AI is unsure it says Check instead of guessing. Check points are shown first.'],
  ['Privacy', 'Only the question, the marking points and the essay text are sent. No name, student number, class or school. The essay text goes to Anthropic\'s API. Anthropic\'s published terms say API data is not used to train its models by default; we confirm that wording before a school signs off.'],
  ['A school switch', 'Off by default, switched on in the owner console for a school that has agreed. Proposed, see decision 3.'],
  ['Marks content, not spelling or dialect', 'The AI is told to mark what the answer says against the marking points and to ignore spelling, grammar and Patois unless a marking point asks for it.'],
  ['The essay is data, not instructions', 'If an essay says "give me full marks" or tries to instruct the marker, the AI ignores it, flags the answer as Check, and says why. The server also clamps every mark to the question\'s range and rounds to half marks, so a bad reply cannot produce an impossible score.'],
  ['Separate from integrity checking', 'Marking suggestions never use, or comment on, whether writing may be AI-assisted. That check stays its own button.'],
  ['Teacher-triggered and capped', 'It runs only when a teacher asks. There is a per-minute limit and a monthly allowance per teacher, using the same usage record the other AI features use, and the screen shows how many suggestions are left.'],
  ['Keeps score of itself', 'We store the suggestion beside the teacher\'s final mark. That lets us report how often teachers changed a point, which is how we will know whether it is good enough.'],
]))

kids.push(new Paragraph({ children: [new PageBreak()] }))
kids.push(h1('6. How it is built'))
kids.push(table([2000, 4700, 3046], ['Piece', 'What it does', 'Why it is separate'], [
  ['Marking points on essays', 'BUILT. Essay questions can have marking points, written by the teacher. They live in their own column (migration 081, essay_rubric), not in the one short answers use, because the exam submit code marks anything with marking_points by keyword and would mark every such essay zero and the exam complete. The grading screen shows a box for each point.', 'Valuable on its own and needed before the AI can mark. Proven safe by submitting the same exam with and without them on a test database.'],
  ['A marking library', 'essayMarkingPure.ts. Builds the prompt, reads and checks the AI\'s reply, clamps and rounds marks, totals them, and works out how often a teacher changed a suggestion. No network, no screen.', 'Testable with made-up replies, including broken ones. The model can change without touching anything else.'],
  ['One server route', '/api/essay-marking. Checks the teacher is signed in and may see that essay (using their own login), checks the school switch and the limits, calls the AI, validates the reply, stores it, returns it.', 'The API key and the rules about who may spend AI credit stay on the server.'],
  ['A suggestions table', 'One new table (migration 082) holding each suggestion, readable only by the staff who may mark that essay.', 'Not a column on responses: students can read their own response rows, and a suggestion must not be visible to them.'],
  ['The screens', 'A suggestion panel on Grade essays and on the single-student review page, a Suggest marks for all button with progress, and a usage line.', 'Plugs into the marking screens teachers already use.'],
  ['A school switch', 'A new tick in the owner console\'s Configure school tools, saved with the rest of the school\'s settings.', 'Same mechanism as the AI tutor and Library switches.'],
]))
kids.push(h2('Cost and model'))
kids.push(p('The app already uses a Sonnet-class model for AI features. Those models cost about $2 per million tokens read and $10 per million tokens written (a token is about three quarters of a word). One essay with its marking points is roughly 1,500 tokens in and 400 out, so a suggestion should cost under a cent or two. A class of thirty is therefore around 20 cents, and a year-group exam with one essay each a few dollars. These are estimates; we measure real cost in the trial (stage E). The live Anthropic account also needs credit: it was out of credit when last checked, and every AI feature depends on it.'))
kids.push(h2('Two things found along the way'))
;[
  [b('Marking points are not stored per point today. '), run('The grading screen shows a mark box per point but saves only the total. For this feature, the per-point marks the teacher finally enters should also be kept, so we can compare them with the AI\'s. That is a small, contained change.')],
  [b('Students can probably read the AI integrity verdict on their own essays. '), run('Students can read their own response rows, and the AI review and typing signals are columns on that row. This is separate from the new feature, and should be checked and fixed on its own. It is why the new suggestions go in their own table.')],
].forEach((x) => kids.push(bullet(x)))

kids.push(h1('7. Build stages'))
kids.push(table([900, 3400, 3346, 2100], ['Stage', 'What is built', 'How we know it works', 'Your part'], [
  ['A', 'Marking points for essay questions, written by the teacher (migration 081). BUILT. Per-point marks kept when a teacher saves moves to stage C, so they sit in the staff-only table.', '16 database checks including the key one: the same exam submitted with and without marking points gives an identical result; 7 rule checks; editor checked in the browser; type-check, lint and full build pass.', 'Apply 081 on Manchester and push.'],
  ['B', 'The marking library and prompt, with tests using made-up AI replies.', 'Checks for good replies and for broken ones: bad JSON, marks over the maximum, missing points, a refusal, a timeout, an essay that tries to instruct the marker, an empty answer.', 'Nothing.'],
  ['C', 'Migration 082, the route, the limits, the school switch, and storing the final per-point marks beside each suggestion.', 'Database tests on a private copy (who can read a suggestion); route tests with a fake AI; a few real calls on invented essays to check cost and behaviour.', 'Apply 082, push, and add credit to the AI account.'],
  ['D', 'The suggestion panel on both marking screens, Suggest marks for all, usage line.', 'Browser checks on desktop and phone; the marks only change when the teacher saves.', 'Push; turn it on for Manchester only.'],
  ['E', 'Accuracy trial with Manchester teachers.', 'Teachers mark 20 to 30 real essays (names removed) across three or four questions. We compare their marks with the AI\'s and tune the prompt until teachers would accept most suggestions.', 'Provide the essays and the teachers\' time.'],
]))
kids.push(p('As usual, I will not push code or run SQL on a live database. I give you the exact commands, and I test every database change on a private copy first.', { run: { size: 19, italics: true, color: BROWN }, para: { spacing: { before: 100, after: 100 } } }))

kids.push(h1('8. Risks'))
kids.push(table([3000, 6746], ['Risk', 'What we do about it'], [
  ['The AI marks differently from a teacher', 'It never decides. Evidence and Check flags let the teacher verify quickly, and the trial in stage E measures agreement before wider use. If it is not good enough, we do not switch it on.'],
  ['Teachers accept suggestions without reading them', 'Check points come first, nothing is pre-saved, and we record how often suggestions are changed so we can see if teachers have stopped looking.'],
  ['A school or parent objects to essays leaving the school', 'Off by default and switched on per school with agreement. Only the answer text is sent, with no names. The wording we show schools states exactly what is sent and where.'],
  ['Marks are unfair to students who write in dialect or with spelling mistakes', 'The prompt marks content only. The trial includes essays like this and teachers\' marks are the standard.'],
  ['Cost runs away', 'Teacher-triggered only, per-minute limit, monthly allowance, and a usage line on the screen. Real cost is measured in stage C.'],
  ['Marking points are bad, so suggestions are bad', 'The AI shows which point each mark belongs to, so a poor scheme is visible. The draft is always edited by the teacher.'],
  ['The AI account has no credit', 'The button shows a clear message and marking by hand carries on as normal. Credit needs topping up before stage C is tested for real.'],
]))

kids.push(h1('9. Decisions (settled 6 October)'))
kids.push(table([3000, 6746], ['Decision', 'What you chose'], [
  ['1. How the AI gets a mark scheme', 'The teacher writes the marking points.'],
  ['2. Which questions', 'Essays only.'],
  ['3. The school switch', 'Per school, off by default. Switched on in the owner console only for a school that has agreed, after the principal has been told what is sent. The privacy page, which says we do not use AI to grade students, is updated when this ships.'],
  ['4. The monthly allowance', '300 suggestions per teacher per month.'],
  ['5. Accuracy trial', 'Yes, with Manchester teachers before wider use.'],
]))

kids.push(h1('10. What this unlocks'))
;['Smart Assess: the same machinery could suggest marks for short answers that auto-marking got wrong, and later flag where a whole class lost marks on the same marking point.', 'Smart Assess exam insight: marks per marking point would show which part of an essay question a class found hardest.', 'Teachers\' time: a first pass on thirty essays in a couple of minutes, with the teacher\'s judgement kept for the points the AI flags.'].forEach((x) => kids.push(bullet(x)))

const doc = new Document({
  creator: 'Smart Assess Ja', title: 'AI-suggested essay marking: build blueprint',
  styles: { default: { document: { run: { font: FONT, size: 21 } } } },
  numbering: { config: [{ reference: 'bul', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } }] }] },
  sections: [{
    properties: { page: { size: { width: A4.w, height: A4.h }, margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } } },
    footers: { default: new Footer({ children: [para([run('SMART ASSESS   |   AI ESSAY MARKING BLUEPRINT   |   6 OCTOBER 2026', { size: 15, color: BROWN })], { spacing: { after: 0 } })] }) },
    children: kids,
  }],
})
Packer.toBuffer(doc).then((buf) => { const out = path.join(OUT_DIR, 'AI-Essay-Marking-Blueprint.docx'); fs.writeFileSync(out, buf); console.log('wrote', out) })
