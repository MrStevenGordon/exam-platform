# To test (running list)

Tick a box when you have tested it on the live site. Each item points to its section in `docs/qa-checklist.md`. Add new items at the top when something is built. Last updated 2026-10-06.

## School day and timetable (needs a push, then 088, 089 and the Manchester school day script)
- [x] Applied 088 and 089, and ran the Manchester school day script (7 periods, 2 lunch windows), 2026-10-07
- [ ] Walk **QA 7r** (school day page, events, double periods, student/teacher/principal timetable views, phone Today view, cover with a double period)
- [ ] Pick which design details you want changed (mockups are in `docs/mockups/timetable/`)
- [ ] Tell me whether other subjects in the demo should be taught by other staff accounts (today the demo timetable is Mathematics only, by Testing Teacher)

## AI lesson plan fix (needs a push first)
- [ ] After pushing: generate an AI lesson plan with 1 lesson, then 3 lessons, on the live site. It should return a draft
- [ ] If it still says "could not finish a readable draft", open Vercel > the project > Logs and search `Lesson plan generate: unreadable reply`; the line says why (stop_reason, whether it was cut off) and shows the start and end of the reply. Send me that line
- [ ] Also try Polish with AI and Import from PDF once, since they now share the same reader

## Demo data (new)
- [ ] Run `scripts/demo/00-check-before.sql` on Manchester (read-only) and confirm the four accounts are found
- [ ] Run `node scripts/reassign-student-ids.mjs --env <manchester env file>` (dry run), check the mapping file, then run it with `--apply --project <ref>`; confirm a changed student can sign in with the new ID
- [ ] Run the seed (`pbcopy < scripts/demo/manchester-demo-seed.sql`), then sign in as Testing Teacher, Testing HOD, Testing Principal and student 54321 and walk every screen in the demo; note any that is still empty
- [ ] Upload the timetable sample so the school part (timetable, absence and cover, report cards) can be built
- [ ] The morning of the demo: run the seed again to reset

## New presentation deck (v2)
- [ ] Open `marketing/presentation/Smart-Assess-Ja-Manchester-Presentation-v2.pptx` on the machine you will present from. Fonts: Impact and Arial (installed on most Windows and Mac machines); check the headings look condensed and bold, not plain
- [ ] Read each slide's speaker notes (timings add up to 30 minutes; slides 11, 15 and 18 are marked optional)
- [ ] Check every claim on slides 5 to 22 is something you are happy to say out loud, especially the Data Protection Act line (slide 21) and the "Already built" labels
- [ ] Slide 22 shows offline as "in testing": finish QA 7q or remove that row
- [ ] Competitor slide (19): sources in `marketing/presentation/Competitor-claims-verified.md`; know the answer if someone says "Moodle can do that"
- [ ] The Manchester demo school shows mostly empty screens (no topic results, no flashcard decks, no exam insight, empty Library, no coverage topics). Seed demo data before the live demo, or the walk-through will show empty states

## Presentation day (before you print)
- [ ] Sign in once on the live site with your own staff account and follow page 6 of a guide exactly (default password, new password, authenticator). Does it match the screens?
- [ ] Check each staff account really exists with the default password still unchanged (a changed one will not work on the sheet) and that the sign-in email for each is known
- [ ] Every feature named on pages 3 to 5 works on Manchester (My Topics, flashcards, three practice levels, resources, My week, AI drafting, AI essay marking; leave offline out until tested)
- [x] AI key has credit (`npm run check:ai` passed 2026-10-06). Re-run it the day before as a cheap check
- [ ] Print `marketing/presentation/guides/All-18-guides-print.pdf` double-sided (flip on long edge); 18 guides x 6 pages
- [ ] Collect or shred the printed guides afterwards (they show the shared first-time password)

## Built, pushed, needs your testing
- [ ] **7q Offline flashcards and opened lessons** (no migration; live https site, student login, airplane mode)
- [ ] **7p Teacher resource space** (migration 087 applied; teacher, HOD, student must NOT see it)
- [ ] **7o My week (students) / This week (teachers)** (no migration)
- [ ] **7n Support / Core / Stretch practice on lesson checks** (migration 086)
- [ ] **7m Flashcards** (migration 084; also check the topic-to-lesson link, migration 085)
- [ ] **7l AI question drafting** (needs Anthropic credit; 20 a month per teacher)
- [ ] **7k Student results by topic / My Topics** (migration 083; needs teachers to tag topics on questions first)

## Earlier items still open
- [ ] **7h Exam insight** (migration 080)
- [ ] **7i Marking points for essays** (migration 081) and **7j AI essay marking** (you ran QA 7j already; tick it off here only if fully done)
- [ ] **7g Library** (live, catalog empty; test once books are loaded)
- [ ] **Substitution feature** (073 to 075): reminder cron is not scheduled and emails were never sent for real
- [ ] **Data-use fixes 1 to 7** (docs/data-audit-2026-10.md): check pages feel lighter on a phone with a poor connection

## Checks to re-run after each deploy
- [ ] Glitch checker: `HEADED=1 npm run check` in `e2e/` (all roles; send me `report.md`)
- [ ] AI key still working (`npm run check:ai`; passed 2026-10-06)

## Held back on purpose
- Smart Play go-live and integrity rollout: do not push or run live SQL for these until you say so (migrations 066/067)
- Claude watermark detection: not available from Anthropic yet

## Done
- [x] AI essay marking live on Manchester (082 applied, QA 7j passed)
- [x] AI reliability fix (check:ai passed on the Vercel key)
