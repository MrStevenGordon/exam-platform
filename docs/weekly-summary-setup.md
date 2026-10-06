# Weekly summary (Smart Learning)

Teachers and students asked for a weekly improvement summary (the survey), and the owner asked for assignment reminders to be part of it. It is a page in Smart Learning's menu: **My week** for students, **This week** for teachers and heads of department. Nothing is emailed.

## What a student sees (My week)
- A one-line headline: their average on results shared in the last 7 days, and the change on the week before.
- **What to do next** (up to 4 plain steps): finish an overdue lesson, a test that closes soon, practise their weakest topic, study due flashcards.
- **Coming up** (next 7 days): unfinished lessons that are overdue or due soon, and tests, exams and tasks that close soon, soonest first with overdue at the top. Items with no closing date appear only as "Open now", at most three.
- Results shared this week, topics that got better and topics that need work (linking to My Topics), lessons finished, lesson checks (first tries only count), and flashcards studied (cards, days) with how many are due.

## What a teacher sees (This week)
For each class they teach: the class average this week against last week; **students who may need support** (averaging under 50% over two weeks, or down 15 points or more on last week, with the reason); lessons the teacher wrote that not everyone has finished (overdue first, with how many have finished); and tests or exams closing in the next 7 days. Only **fully marked** results count.

## Rules that keep it safe
- It only summarises what the person can already see. It adds no new access and no database change. Checked on a throwaway database (`scripts/tests/week-summary/rls.sql`): a student reads only their own results, check attempts, flashcards and progress; a teacher reads their own class's students and progress on lessons they wrote; **no teacher can read any student's flashcards** (they are private); a teacher with no class sees nothing.
- A teacher's lesson list covers only lessons they wrote, because those are the only ones whose progress they are allowed to read.
- Dates use Jamaica time. "This week" is the last 7 days (not Monday to Sunday), so it is the same whichever day it is opened.

## Set up
Nothing to apply. Push, and **My week** or **This week** appears in the Smart Learning menu. It needs Smart Learning switched on for the school.

## Tests
`scripts/tests/week-summary/`: `weekSummaryPure.test.mjs` (every rule, with hand-worked numbers) and `rls.sql` (who can read what, on a throwaway database built as in `scripts/tests/exam-insight/README.md`; load `scripts/tests/student-topics/seed.sql` first, and apply migrations 084 and 086).
