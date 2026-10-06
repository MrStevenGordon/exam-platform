# Student results by topic: "My topics" (Smart Assess)

Students asked for "topics I need to improve" (9 of 12 in the Manchester survey). This adds a **My Topics** page to the student menu.

## What a student sees
- Every topic they have questions on, weakest first, as a bar with its percent: **Needs work** (under 50%), **Getting there**, **Strong** (75% and over).
- A short "Work on these first" list of up to three weak topics.
- Improving, steady or slipping, comparing the latest exam on that topic with earlier ones (needs at least 2 questions each side and a 15 point gap).
- A topic with fewer than 3 questions is listed separately as "not enough questions yet" and is not judged.
- **Practise this topic** builds a practice mock (up to 10 random non-essay questions) from past questions on that topic, using the existing Mock Exams.

## What counts, and what never does
- Only the student's own results, only from exams the teacher has **released**, only questions already **marked**. An essay waiting to be marked is left out, never counted as zero.
- The page only gets topic names, marks and question ids. It never gets question wording, correct answers, the student's answers or anyone else's results.
- A topic merged into another counts as the topic it became.
- Questions with no topic are not shown, and the page says so. **Topic tagging is up to teachers**: until they tag questions (the topic list on each question), a student sees "Your teachers have not added topics yet".

## Set up (Manchester)
1. Apply `scripts/migrations/083_student_topics.sql` (needs the topic list, migration 058, already installed). `pbcopy < scripts/migrations/083_student_topics.sql`
2. Push. "My Topics" appears in the student menu once the migration is installed; before that nothing changes.
3. Walk QA 7k.

## Undoing it
`scripts/migrations/rollback/083_student_topics_rollback.sql` removes the two functions. Nothing is stored, so nothing is lost.

## Tests
See `scripts/tests/student-topics/README.md`.
