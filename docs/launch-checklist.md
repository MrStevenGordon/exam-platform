# Launch checklist: from today to Manchester High going live

Your plan: build everything, clear all demo and test data, sign Manchester High up as the first official school, then run a full QA. This is that sequence, with the exact commands. Each step says who does it and how to tell it worked.

Run `node scripts/launch-verify.mjs --school manchester` at any point. It is read-only and tells you what is still outstanding.

## Stage 1: Finish building (in progress)

| Item | Status |
|---|---|
| Smart Learning (lessons, checks, catch-up, coverage, AI student-draft, AI tutor, flagged list) | Built and pushed. Hidden until its updates are applied |
| Login picker, topic list, class structure, attendance, principal portal, presence | Built and pushed |
| Launch reset and launch check tools | Built (this document) |
| Smart Play go-live | Planned (`docs/play-go-live-plan.md`). Not yet built |
| Tutor conversation retention | Needs your number of days. Not scheduled |
| Question-bank answer exposure (Play plan finding A) | Needs your decision before launch |

## Stage 2: Apply the updates to the live database (you)

In the Supabase SQL editor for the exam project, run these in order. Each is in `scripts/migrations/` and has a rollback in `scripts/migrations/rollback/`.

`055, 056, 057, 058, 059, 060, 061, 062, 063, 064, 065, 066`

Then **067** (the exam lock) only when the exam integrity steps in `docs/exam-integrity-findings.md` say so: after the new app is live and a test exam has been checked. Not while an exam is being sat.

Also run once: `scripts/data/manchester-classes.sql` (creates the 42 real classes; renames `1A` to `5A` in place).

Check: `node scripts/launch-verify.mjs --school manchester` shows PASS for all the updates (055 to 066, and 067 once applied) and "all 42 Manchester High classes exist".

## Stage 3: Decisions to make before the reset

0. **Exam integrity (LAUNCH BLOCKER, see `docs/exam-integrity-findings.md`).** Built and tested: updates 066 and 067 plus the app update. Nothing is applied to the live database or pushed yet. Follow the rollout order in that document. Decide whether a late submission should be marked and flagged (as built) or refused.
1. **Bank questions.** Covered by the same document (finding E5). Decide with your HODs whether bank questions are open practice material.
2. **Which accounts survive the reset.** The platform owner (system admin) always does. Decide whether Manchester's real principal, HODs and admins are created fresh after the reset (cleanest) or kept now with `--keep-email`.
3. **Topic list.** Have HODs review `scripts/data/mathematics-topics-draft.csv`, then import it on `/supervisor/topics` (after the reset, so it stays).
4. **AI credit.** Top up the AI account, or the AI student-draft and AI tutor will show "unavailable".
5. **AI tutor.** Whether to switch it on for launch. If yes: school sign-off on saved conversations, a named person who reads the Tutor flags page daily, and the number of days to keep conversations.

## Stage 4: Clear the demo and test data (you, with a backup)

```bash
# 1. Backup first. This cannot be undone. (The dry run prints the exact command with your connection details.)
# 2. Dry run: shows every table it will clear, everything it keeps, and which accounts it will delete.
node scripts/launch-reset.mjs --clear-storage

# 3. Read the output carefully. Then run it for real, typing the database host it prints:
node scripts/launch-reset.mjs --confirm --confirm-host <the host shown> --clear-storage
```

What it does:
- **Clears:** every exam, question, response, session, enrolment, class assignment, lesson plan, message, help chat, report card, attendance record, presence record, Smart Learning lesson/progress/check/evidence, tutor conversation, and uploaded question images and media.
- **Keeps:** school settings, departments and subjects, classes, the topic list, timetable periods, academic terms, the school logo and app downloads.
- **Never touches:** your platform-owner data (school requests, subscriptions, pitch and NDA records, investor enquiries, waitlist, billing, organisations).
- **Accounts:** deletes every account except system admins and any you pass to `--keep-email a@b.com,c@d.com` or `--keep-role admin,principal`.
- **Safety:** one transaction (all or nothing), asks you to type the host, and stops if it finds a table it does not recognise.
- Options: `--clear-terms` (also clear academic terms), `--play` with `--confirm-play-host <host>` (empty the Smart Play database).

Then: `node scripts/launch-verify.mjs --school manchester --expect-clean` should say READY.

## Stage 5: Set Manchester High up as the first official school (you)

1. Create the real accounts: school admin, principal and vice principals, HODs, teachers (`/school-admin/staff`). Give each a temporary password and make sure MFA setup works on first sign-in.
2. Import the real students with the class names `1-1` to `6A3` (`scripts/import-students.mjs` or the admin students page). Class names decide each student's grade.
3. Assign teachers to classes and subjects; set up department subjects and the timetable periods.
4. Import the topic list.
5. Set the subscription for the school (subscription active, expiry date) on the owner page `/owner/school-subscriptions`.
6. On `/owner/school-features` choose the tools for Manchester. That page saves all switches at once, so set every one each time: Smart Learning, AI tutor, Smart Play.
7. Upload the school logo (already kept).
8. `node scripts/launch-verify.mjs --school manchester --expect-clean --url https://exam-platform-chi.vercel.app` should say READY.

## Stage 6: Full QA (you)

Use `docs/qa-checklist.md`. Log every problem in the table at its end, with the page, what you did, what happened and what you expected, and send them to me in batches. I will fix, retest and push.

## Stage 7: Go live

- A final `launch-verify` run and a fresh backup.
- Tell staff first, then students. Give every teacher the sign-in steps and the phone number to call about a problem.
- Watch the first days: `/school-admin/activity`, `/school-admin/active-sessions`, and the Tutor flags page if the tutor is on.

## If something goes wrong

- A feature misbehaves: switch its school switch off on `/owner/school-features`. The feature disappears; nothing else is affected.
- An update misbehaves: run its rollback file (roll back in reverse order: 065 before 064, and so on).
- Bad code was pushed: tell me the last good commit; `main` can be pointed back at it.
