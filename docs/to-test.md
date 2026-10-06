# To test (running list)

Tick a box when you have tested it on the live site. Each item points to its section in `docs/qa-checklist.md`. Add new items at the top when something is built. Last updated 2026-10-06.

## Presentation day (before you print)
- [ ] Sign in once on the live site with your own staff account and follow page 6 of a guide exactly (default password, new password, authenticator). Does it match the screens?
- [ ] Check each staff account really exists with the default password still unchanged (a changed one will not work on the sheet) and that the sign-in email for each is known
- [ ] Every feature named on pages 3 to 5 works on Manchester (My Topics, flashcards, three practice levels, resources, My week, AI drafting, AI essay marking; leave offline out until tested)
- [ ] AI features need Anthropic credit on the day: run `npm run check:ai` the day before
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
- [ ] Anthropic key still has credit (`npm run check:ai`)

## Held back on purpose
- Smart Play go-live and integrity rollout: do not push or run live SQL for these until you say so (migrations 066/067)
- Claude watermark detection: not available from Anthropic yet

## Done
- [x] AI essay marking live on Manchester (082 applied, QA 7j passed)
- [x] AI reliability fix (check:ai passed on the Vercel key)
