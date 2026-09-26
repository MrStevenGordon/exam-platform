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
