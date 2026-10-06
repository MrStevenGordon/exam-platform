# Demo data for the Manchester presentation (plan)

**Why:** the Manchester demo school mostly shows empty screens today (no topic results, no flashcard decks, no exam insight, empty Library, no coverage topics, no timetable for today). A live walk-through on empty pages does not sell anything. This plan fills the school with realistic **demo** data so every screen in the walk-through has something to show.

**Rules (from how we already work):** the owner runs the live SQL, we sandbox-test first on a throwaway database, everything seeded is easy to find and remove, nothing real is touched.

## How it will be built
- **One SQL file** (`scripts/demo/seed-manchester-demo.sql`) in one transaction, plus **`remove-manchester-demo.sql`** that deletes exactly what the seed added. Tested on a throwaway copy of the live schema (like migrations 083 to 087), then handed over to run in the Supabase SQL editor (copied to the clipboard).
- **Identifiable:** every seeded row uses ids starting `dd000000-`, and every seeded exam, lesson and deck is titled with its normal name (no "[Demo]" in front, so the screens look real). The remove script deletes by those ids.
- **No schema change, no new login.** It attaches data to accounts that already exist.
- **Read-only first:** step 0 is a set of SELECT queries that count what is there now (students per grade, classes, topics, exams) so the seed fits what exists.
- Any AI step (essay suggestions, tutor) is run live on the day or beforehand through the real feature, not faked.

## What gets seeded, by screen in the walk-through
| Part of the walk-through | Needs | Seed |
|---|---|---|
| Teacher: classes and tests | A class with students, 4 to 5 tests over the last 6 weeks | Class "Grade 9B Mathematics", about 30 existing students enrolled, 5 tests (pop quiz, class tests, one end-of-term exam vetted by the HOD) with 12 to 20 questions each in mixed types, tagged to topics |
| Question bank | Saved, topic-tagged questions | About 40 questions in the teacher's bank |
| Results and marking | Marked and released results with a realistic spread | Class average about 65%, a few students under 50%, one weak topic (Simple interest about 40%), one essay waiting to be marked with marking points set |
| Exam insight | Released results on several tests | Comes from the tests above (needs at least 5 for "last five tests") |
| Student: results, My Topics | At least 3 questions per topic across released tests | Comes from the tests above, for the demo student |
| Student: Smart Learning | Lessons with progress; an absent day | 3 five-step lessons assigned to the class (checks at support, core and stretch), some finished, one overdue; 3 students marked absent the day a lesson was taught, so catch-up shows |
| Flashcards | A deck with due cards | One deck of about 12 cards for the demo student, some due today |
| This week / My week | Derived | Comes from the above |
| Lesson plans and shared library | A couple of plans | 2 plans for the teacher, 1 published to the shared library |
| Coverage grid | A topic list and taught lessons | About 12 Grade 9 Mathematics topics (permanent codes), lessons mapped to them, so the grid shows covered and behind |
| Teacher resources | A few shared items | 5 department resources (links) in Mathematics |
| HOD: analytics, final exams, coverage | Several classes and tests | Second class and teacher in the department so department pass rates and coverage compare |
| Principal: overview, attendance, timetable | A timetable and attendance | Timetable for the demo teachers (Mon to Fri), two weeks of attendance with a few lates and one truant, one teacher absence with a substitute, so "Classes today", alerts and the truancy report are not empty |
| School admin: integrity, report cards | Flagged sessions, term grades | A few tab-switch flags, one writing-integrity flag, and a term with report cards |
| Library | Some titles | Needs your decision (see below) |

## Stages
1. **Discover (read-only)**: counts and a map of what exists. 30 minutes. Needed before anything else.
2. **Assess data**: classes, topics, tests, questions, results, essays.
3. **Learning data**: lessons, checks, progress, absences, flashcards, plans, resources, coverage.
4. **School data**: timetable, attendance, absence and cover, integrity flags, term and report cards.
5. **Reset and dress rehearsal**: the remove script, plus a checklist to walk the real demo once end to end with each demo login and fix any empty screen.

Each stage is its own SQL file, tested on the sandbox, then you run it. Suggested timing: seed 2 to 3 days before, rehearse the day before, and **re-run the seed the morning of** (or restore) so participants' own changes during the hands-on do not leave the demo messy.

## Decisions (made 2026-10-06)
- The demo runs on the four test accounts (Testing Teacher, Testing HOD, Testing Principal, student 54321), each filled with data that lines up (the same class, tests and lessons appear in every portal). The 19 staff accounts are not filled.
- Student IDs like 1-1-1 are replaced with random 5-digit IDs by `scripts/reassign-student-ids.mjs`, without deleting or re-uploading anyone.
- The timetable follows the sample the owner is uploading.
- Library: not decided, left out.

## Status
Built and tested on a throwaway database: Assess data, Learning data, attendance, student ID script. Waiting for the timetable sample: timetable, today's classes, absence and cover, principal alerts, report cards, integrity page. See `scripts/demo/README.md`.

## Earlier open questions (answered above)
1. Who drives the live demo, and on which accounts? (the "Testing" demo accounts, or the real staff accounts?)
2. Should the staff's own 19 accounts see data too, so participants exploring on their own login see something?
3. Library: load two public-domain Shakespeare titles (Macbeth, A Midsummer Night's Dream, already prepared in `marketing/library-content`) as a demo, or leave the Library empty and show it from the "being stocked" state?
