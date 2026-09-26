# Smart Play: your steps, the pilot, and the whole-school launch

Everything below the line "What is already built" is done and tested locally (see `docs/play-go-live-plan.md`). Nothing is pushed, nothing is applied anywhere. Smart Play is switched off for every school and reachable by nobody.

## Your steps, in order

Each is small and reversible. Do not do a later step before an earlier one.

1. **Decide the bank-question question.** Are question-bank questions meant as open practice material for students? If any could ever appear in a real exam, apply `scripts/migrations/068_bank_questions_closed_to_students.sql` (rollback alongside). If you rely on students reading bank questions, leave it. (Smart Play keeps its own copy of questions either way.)
2. **Exam integrity first.** Play is not launched before the exam integrity updates (066, 067) are live and checked. See `docs/exam-integrity-findings.md`.
3. **Create the Play database.** A new **paid** Supabase project (separate from the exam one; free projects pause after a week of inactivity, which would break Play over a holiday; check current pricing). In its SQL editor run, in order, every file in `scripts/play/` from `001` to `012`, then `scripts/play/rollback` is only for undoing. Nothing here needs the exam database.
4. **Prove it is closed.** From this folder:
   ```bash
   node scripts/play/check_hosted.mjs --database-url "<the project's direct connection string>" --api-url "https://<project>.supabase.co" --public-key "<the project's public (anon) key>"
   ```
   It must print `PASS`. (The public key is public by design; do not paste secrets into chat.)
5. **Set three values in Vercel** (Production and Preview): `PLAY_DATABASE_URL` = the project's **pooler** address (transaction mode, port 6543), `PLAY_SESSION_SECRET` = a new random string of 32 or more characters, `NEXT_PUBLIC_SCHOOL_NAME` = the school's name as it should show in Play. Do not set `PLAY_GAME_PASSWORD_LOGIN` (it exists only for local development).
6. **Ask me to push** the branch `feature/play-golive` (after the exam integrity work is out). It ships dark: nothing changes for anyone. Check the live site behaves as before and `/play` says not found.
7. **Import the game questions.** Play has its own question list. Import from the exam bank with `scripts/play/import_bank_questions.mjs` (uses the exam database's direct connection, from your laptop, read-only), or have teachers add and import questions in Play's own screens. Topic names should match the shared topic list (Play matches by name).
8. **Choose the pilot**: two teachers and their classes, about two weeks. Get the school's sign-off on student data in Play (name, ID#, grade, classes, answers) and tell parents; Jamaica's Data Protection Act (2020) applies (a prompt to check, not legal advice).
9. **Switch it on** on `/owner/school-features` (that page saves all switches at once: set Smart Learning, AI tutor and Smart Play together). Teachers and students now see Smart Play on the sign-in page and the product menu.
10. **Rehearse before the pilot**: one class, one of each game, with you watching. Then run the load script against the real database while a class plays (`node scripts/play/load_test.mjs --database-url ... --allow-remote --games 1 --players 35`) only if you want numbers; it writes test data and cleans it up.

## During the pilot (about two weeks)

- Ask the two teachers to run at least one Live Quiz and one Topic Mastery round, and one Jeopardy board or Tug of War.
- Send me every problem with the page, what they did and what they expected. I fix and retest.
- Success means: at least three live games finished without a stall; students reach Play with no help; no one sees another class's or school's data; nothing in the exam side changed.
- To stop: switch Smart Play off on `/owner/school-features`. Play disappears; nothing else is affected.

## Whole school

Add Play to the teachers' guide and announce it. Keep the retention clean-up in mind: `node scripts/play/cleanup.mjs --days <n>` shows, and with `--confirm` removes, finished games older than n days (accounts, classes, practice progress and badges are kept). There is no default number: it is the school's decision. It is not scheduled.

---

## What is already built

- **Dark merge**: every Play page and API answers "not found" unless the school has Smart Play switched on (checked on the server, fails closed).
- **Sign-in through the exam login**: no game passwords. Students and teachers only. The account is created when they first open Play and updated each time (name, grade, classes). Deactivated accounts are refused. Deleting a student on the exam side deletes their Play data.
- **Hosted-database hardening and its check**, connection pool sized for serverless.
- **Load reduction** for Live Quiz, Jeopardy boards and Tug of War, each proven identical in what players see; load numbers in the plan.
- **Migration 068** for the bank-question finding, ready.

## Environment values (names only)

| Name | Where | Meaning |
|---|---|---|
| `PLAY_DATABASE_URL` | Vercel | Play database, pooler address |
| `PLAY_SESSION_SECRET` | Vercel | Random 32+ characters; signs the Play session cookie |
| `NEXT_PUBLIC_SCHOOL_NAME` | Vercel | School name stored on Play accounts |
| `PLAY_DB_POOL_MAX` | Vercel (optional) | Connections per server instance (default 3) |
| `PLAY_GAME_PASSWORD_LOGIN`, `PLAY_FORCE_ENABLED` | local only | Development switches; never set in production (`PLAY_FORCE_ENABLED` is ignored in production anyway) |
