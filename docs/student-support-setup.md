# Student support (Smart Learning)

Helps staff notice students who may need extra help, keep a simple plan for each one, and see whether results moved afterwards. Students get a private **My progress** page that compares them only with their own earlier results.

Product: **Smart Learning**. It reads results (Smart Assess), attendance, lessons and class feedback; it writes only its own support plans.

## Turn it on
1. Apply migration 091 (class feedback) first, then `scripts/migrations/092_student_support.sql` on the school's Supabase project. It only adds tables and functions. Undo: `scripts/migrations/rollback/092_student_support_rollback.sql`.
2. Push the code. Staff get **Student support** in the Smart Learning menu and students get **My progress**. Until 092 is applied, neither link shows.
3. Optional demo data: `scripts/demo/manchester-demo-seed.sql` now adds an open plan (two actions recorded) and a finished plan for the demo class.

## Who sees what
| Person | Sees |
|---|---|
| Teacher | Students in the classes they teach (class groups or timetable) |
| Head of department | The same, plus students taught by anyone in their department |
| Principal, vice principals, school admin | Every student |
| Student | **None of the staff pages**, never the school average, never a plan or another student. Only My progress (their own results) |

Class-feedback signals ("asked for help") reach only the teacher the feedback was addressed to, or a head of department for their own teachers. The principal team and school admin never get them (same rule as migration 091).

**Marks are limited to the subjects the person teaches** (decided 2026-10-06). A teacher sees results only in their own subjects (their timetable and subject list); a head of department sees the subjects their department teaches; the principal team and school admin see every subject. A student's overall average, the "below the school average" reasons and the school averages all use only the subjects the person may see, and a plan's starting and current marks show only to staff who teach that subject (general plans: to the owner, whoever opened it, heads of department and the principal team). A teacher can only start a plan in a subject they teach, or a general one. Attendance, lessons and help requests are not subject-specific, so they stay visible to any staff member who can see the student. Subject names match loosely ("Maths" = Mathematics, "English" = English Language).

If a school applied 092 before this change, run `scripts/migrations/092b_support_subject_limit.sql` (safe to run more than once).

## Why a student is listed
A student appears when the reasons add up to at least 2 points. All thresholds are named constants at the top of `src/lib/supportPure.ts`.
| Reason | Rule | Points |
|---|---|---|
| Below the school average | 10 or more points under the school average in a subject (2 or more results), or overall if no subject is flagged | 2, or 3 at 20+ points |
| Low marks | Average under 50% in a subject | 2 |
| Falling | 8 or more points lower than the 60 days before | 2 |
| Absences | 3 or more absences in the last 14 days (5 or more weighs 3) | 2 or 3 |
| Late | 5 or more late arrivals in 14 days | 1 |
| Lessons | 2 or more lessons past their date and not finished | 1 |
| Not signed in | 10 or more days since last sign-in | 1 |
| Asked for help | Asked for help in class feedback, or "did not follow" two weeks running | 2 |

4 points or more is **High priority**, otherwise **Keep an eye on**. A student with an open plan is always listed. The school average is only shown when at least 5 students have results; it is the average of each student's own average over the last 60 days.

## Support plans (the tracker)
A plan has a subject (or general), the reason, a goal, an owner and a review date. When it starts, the student's average in that subject (and the school's) is recorded as the starting line. **Plans tab:** record actions (extra practice, one-to-one, small group, peer tutor, parent contact, counsellor, attendance follow-up), change the goal or review date, set the status to Open or Monitoring, and finish the plan with an outcome (improved, no change, referred, moved, other). Each plan shows how results moved since it began ("Up 12 points in Science: 46% to 58%"). **Finished tab:** plans finished in the last 6 months with a count of how many improved. Plans can be edited by their owner, whoever opened them, a head of department who can see the student, the principal team and the school admin; any staff member who can see the student can add an action.

## Student side
- **My progress:** each subject shows first, latest and best result, a small chart and a kind sentence, compared only with the student's own earlier results. No school average, no classmates.
- **Nudges** (at most three, built from the student's own data): away from school, lessons past their date, a quiet spell, flashcards due, their weakest topic. Each has a button to go to the right place.

## Tests
- Database: `scripts/tests/student-support/tests.sql` (77 checks, on a sandbox copy of the schema with the demo fixture)
- Logic: `node --import ./scripts/tests/essay-marking/resolve-ts.mjs --experimental-strip-types --no-warnings --test scripts/tests/student-support/*.test.mjs`
