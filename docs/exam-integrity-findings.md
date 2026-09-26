# Exam integrity findings (found 26 September 2026, before launch)

While planning Smart Play's go-live I checked what students can do to the exam data with nothing but their own login. Everything below was **reproduced as a student on a copy of the live schema**, and the live security policies on the three tables involved were compared with that copy: 24 policies each, no differences. Nothing was changed on the live database.

## What is wrong

| # | Finding | Proven how |
|---|---|---|
| E1 | **A student can read the correct answers and marking guide of every question on their own published exam**, through the database's public API, before or during the exam. The take-exam pages also ask for `correct_answer` and `marking_points` for every question, so the answers arrive in the student's browser in the network traffic. | Enrolled test student ran `select correct_answer, marking_points from questions` on a published exam and got both. A student not enrolled got nothing. |
| E2 | **Exams are marked on the student's own device.** The take-exam page works out each mark and the total score in the browser and writes them to the database. | Read in `src/app/student/exam/[id]/take/page.tsx` and the direct-exam version (`points_awarded`, `total_score`, `fully_graded` set from the client). |
| E3 | **A student can write their own marks.** The security rules give students full access to their own exam sessions and responses. | Test student inserted a wrong answer with 5/5 marks, then set their session to completed with a score of 100 and `fully_graded` true. Both were accepted. |
| E4 | Students can also delete their own sessions and responses (the same full-access rules), for example to remove a bad attempt. | Policy list: "Students manage own exam sessions" and "Students manage own responses" are `ALL`. |
| E5 | **Bank-question answers are readable by every student** (migration 048, applied live because the Play branch's migrations were run on the shared database). 7 bank questions today, all with stored answers. | Live policy "Students view bank questions" exists. |

None of this needs special tools: a student with the browser's developer panel can do E1 and E3.

## Why it matters for launch

Results, report cards and the school's trust in the platform depend on marks a student can edit and answers a student can read. It is fixable before launch, and the fix does not change what students and teachers see.

## Proposed fix (three stages, each tested before the next)

The safe order is expand, then contract: new server-side functions first, the app switched to them, and only then the old permissions removed. At no point does the exam flow stop working.

**Stage 1: answers stay on the server.**
- New database functions the student pages call instead of reading `questions` directly: one returns an exam's questions **without** answers or marking guide (options and points included); one returns the answers **only after results are released** and only for the student's own sessions (for the review page); one for self-mock practice.
- Update the six student pages that read questions (take and review for final exams and direct exams; self-mock).
- Then remove the student read policies on `questions` (both the enrolled-exams one and the bank one).

**Stage 2: marks are decided by the server.**
- A `submit_exam` function that receives the student's answers, checks the session is theirs, in progress and inside the time limit, works out the marks for multiple-choice and marking-point questions from the answer key in the database, writes the responses and the session totals, and marks the session complete.
- The marking rules currently in the take-exam page are ported exactly, and an **equivalence test** runs the old browser logic and the new database logic over the same sample answers to prove they give the same marks.
- Essay and teacher-marked answers are unchanged: the teacher still marks them.

**Stage 3: lock the write access.**
- Students may still save their answers as they go (autosave) and their tab-switch counters, but can no longer set `points_awarded`, `graded_at`, `total_score`, `fully_graded` or the completed status themselves, and can no longer delete sessions or responses. Enforced by database rules that reject those changes from a student, whatever the app does.

## Testing before anything is pushed
- A sandbox suite for every rule above, as student, teacher, HOD, admin and principal, including attempts to bypass each one.
- The equivalence test for marking.
- A browser run of a full exam (final and direct) as a student, and of the review and self-mock pages, comparing results before and after.
- Rehearsal of the rollout order on the sandbox, and a rollback script for each database change.

## What I need from you
1. Approval to build this now, ahead of the Play work. It is the launch blocker.
2. The go-ahead to change the six student pages and add these database changes (nothing is applied to the live database without you running it).
3. A time when nobody is mid-exam for the rollout (a short window), or confirmation that no real exams are running yet.

---

## Status: built and tested (not applied to the live database, not pushed)

Approved on 25 September 2026 ("build the exam integrity fix now"). Two database updates and an app update, each with a rollback.

| Piece | What it does | Safe on its own? |
|---|---|---|
| **066** (`scripts/migrations/066_exam_integrity_functions.sql`) | Adds functions only. The student pages use them to load questions **without** answers or marking guide, to submit answers so that the **database marks the exam**, and to show the review (answers) **only after results are released**. Also makes `append_violation_log` refuse a student writing to someone else's session, or to their own after submitting. | Yes. Nothing existing changes for anyone. |
| **The app update** (`src/lib/examApi.ts` and the student take, start, review and group pages) | Calls the new functions. If the database does not have 066 yet, each call falls back to the old behaviour, so it makes no difference whether the app or 066 goes first. | Yes, until 067. |
| **067** (`scripts/migrations/067_exam_integrity_lock.sql`) | Closes the doors: a student can no longer read `questions` for an exam they sit; can only start a session for an exam open to them, with the exam's own time limit and a database-set start time; can save answers while the session is open but never write marks, scores, the completed status, the release flag or anything on someone else's session; cannot delete sessions or answers; practice-mock questions open only after results are released. | **Only after 066 and the new app are live and one exam has been checked end to end. Not while an exam is being sat.** |

### Rollout order (you run the SQL)
1. Apply **066** (SQL editor). Nothing changes yet.
2. I push the app update once you say so; Vercel deploys it.
3. Sit one final exam and one direct exam as a test student and check the marks and review. (`launch-verify` shows 066 and 067 as PASS or FAIL.)
4. Apply **067** at a quiet moment. Nobody mid-exam.
5. Repeat the same test exam. Then try to cheat it (the QA checklist, section 11, lists the attempts).

Rollback is 067 first, then 066 (`scripts/migrations/rollback/`). A rollback restores exactly the previous behaviour.

### How it was tested
- **Marking equivalence:** the browser's grading code and the database's marking function were run over 24,000 generated answer cases (every question type, marking points, whitespace, capitals, non-breaking spaces): **0 disagreements**. Deliberately breaking the database function made the test fail, so the test does detect a difference.
- **066 behaviour** (sandbox copy of the live schema): 60 checks as student, other student, teacher and anonymous, on final and direct exams (question order comes from the exam's links; no answer key column exists in what a student receives; server marking exactly as designed; a payload with made-up scores is ignored; wrong shapes and huge payloads are refused; homework has no time limit; two submits at the same instant give one result; review is empty until release; ownership of the violation log; rollback and re-apply).
- **067 behaviour:** 110 checks, including the original attacks reproduced first (read the answers, start a session with any time limit, complete an exam with a score of 100 and release your own results) and then refused, every field a student must not change, group projects, teacher and server writes unaffected, the practice mock, and rollback and re-apply.
- **The app module** against a recording fake of the database client (with and without 066; retries; second tab; error handling). This found one real defect (the page would have shown every marking-point question as a single box once 066 was applied), which is fixed.
- **The real take page** in the browser against a mock backend: it renders from the new function, autosaves only answers, sends one submit call, writes no marks, and ends on the submitted page; then again with the function missing (old-database case): same page, marking in the browser as before; and the review page from the new function.

### Decisions I made that you may want to change
- **A submission after the time limit is still marked**, but the session is flagged and a "late submission" line (with how many seconds late) is added to its log for the teacher. I first built it to ignore late answers, then changed it: a student who worked offline and reconnects later (the exam page saves offline and retries) would otherwise lose the whole exam. There is a five-minute grace before anything is called late. Homework and assignments have no time limit.
- **Answers longer than 100,000 characters are refused** (about 15,000 words), far above any exam essay.
- **The grading teacher chosen at the start must teach that subject.**
- **Exam start times come from the database clock**, not the student's device, and a timed exam cannot be started without its time limit.

### Still open
| # | Item | Notes |
|---|---|---|
| E5 | **Question-bank answers** are still readable by every student | Unchanged by 067 because it is your decision with the HODs. It is one small separate update when decided (drop the read policy from migration 048; keep Play working from a function). |
| E6 | A student can still read the **exam's access password** and their **own score before release** through the database's public interface | The password check happens in the browser. Fix: check the password in a function and hide the columns. Not a launch blocker for Manchester, but worth doing before the first big exam. |
| E7 | **Organisation exams** (external `org_*` tables, the `/take-exam` pages) mark in the browser and let the test-taker write their own marks, the same class of problem as E2 and E3 | Not used by schools. Fix before selling organisation exams; not part of this work. |
| | Very rare: an essay question that has marking points is marked by keyword in final exams but left for the teacher in direct exams (existing behaviour). The database marks it as final exams do. Marking points are only created for short-answer and fill-in questions, so this does not arise from the normal forms. | Noted for completeness. |

