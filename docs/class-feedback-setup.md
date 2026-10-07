# Weekly class feedback (Smart Learning)

Students give a short evaluation for every class on their timetable each week. Teachers write an end-of-week reflection for each class. The system turns the answers into a progress report per class, with plain-language advice and an optional AI-written summary.

Product: **Smart Learning**. It needs the school timetable (sections and student enrolments) to know which classes a student has.

## Turn it on
1. Apply `scripts/migrations/091_class_feedback.sql` on the school's Supabase project (SQL editor). It only adds tables and functions; nothing existing is changed. Undo: `scripts/migrations/rollback/091_class_feedback_rollback.sql`.
2. Push the code. The **Class feedback** link appears in the Smart Learning menu for students, teachers, heads of department, principal team and school admin. Until 091 is applied, no link shows.
3. Optional demo data: `scripts/demo/manchester-demo-seed.sql` now adds two weeks of feedback for the demo class and a reflection for Testing Teacher.

## Who sees what
| Person | Sees |
|---|---|
| Student | Their own classes and their own answers. Can change them for this week and last week |
| Teacher | Their own classes: all figures, **student names** for the "understood", "hardest topic" and "asked for help" answers, anonymous comments |
| Head of department | The same, for their department's teachers |
| Principal, vice principals, school admin | Every class, **no student names**, and a class's figures appear only after **5** students have answered |

Anonymous questions (pace, taking part, clear explanations, able to ask for help, and the two comments) are never shown for a class with fewer than 5 answers, and never with a name. The answers table can only be read by the student who wrote the row; everything else goes through the report function.

## What students are asked (about a minute per class)
- How well did you understand this week? (required: Not at all / A little / Mostly / Very well)
- Which topic was hardest? (optional, from the curriculum topics for their grade and subject)
- I would like my teacher to help me (checkbox)
- Anonymous: pace, taking part, clear explanations, able to ask for help, what helped, what would make lessons better

Students can answer for this week or last week only. A student who has two teachers for one subject gives one answer per teacher.

## Teacher reflection
Per class and week: ahead / on track / behind plan, what was covered, what went well, what was difficult, support needed, next steps. Teachers write it for this week or last week, only for a class they teach on the timetable.

## Report and AI summary
- **Class feedback > week** shows each class with the figures, advice (for example "Many students said they did not follow this week", "Understanding fell compared with last week"), hardest topics, who may need help, comments and the reflection. **Print report** prints a clean page.
- **Write a progress summary with AI** drafts a short overview, what is going well, what to watch and next steps. It is a draft to check, saved nowhere. The AI is sent figures and anonymous comments only, never student names. Limit: 40 summaries per person per month.
- The **Current and future** page shows a reminder card ("2 of your 5 classes are waiting for your feedback").

## Tests
- Database: `scripts/tests/class-feedback/tests.sql` (68 checks, run on a sandbox copy of the schema)
- Logic and AI prompt: `node --import ./scripts/tests/essay-marking/resolve-ts.mjs --experimental-strip-types --no-warnings --test scripts/tests/class-feedback/classFeedbackPure.test.mjs`
