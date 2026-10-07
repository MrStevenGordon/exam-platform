# The school day and the timetable (migrations 088 and 089)

## What it does
- **Bell times**: the school admin, vice principals and principal set the periods once (start, end, length). Monday to Friday. Heads of department can no longer change them (they can still read them and place classes).
- **Lunch by grade**: each group of grades has its own window (Manchester: Grades 7 to 9 at 11 to 12, Grades 10 to 12 at 12 to 1).
- **School events**: devotion, clubs and societies, a sports day, an exam week. Weekly ("Mondays 8 to 9") or one date or a run of dates, all day or part of the day, for every grade or chosen grades. **Nothing is pre-filled**: the school adds its own.
- **Classes that last longer**: when placing a class the head of department (or the school admin) chooses 1, 2 or 3 periods. A double period is one tall block on every timetable. A teacher or a class cannot be booked twice in any hour of it.
- **Events are an overlay.** They never delete or block classes already placed (an event added in term must not break a built timetable). The timetable shows the event or lunch in the class's place, and the **Classes that clash** list on the School day page tells the school which classes to move.
- **Cover and double periods**: a substitute must be free for every hour of the class being covered, a teacher teaching the second hour of a double is not offered as free, and an absence for one period includes any lesson that runs through it (migration 089).
- **Cafe duty (bear in mind, not built)**: teachers free during a lunch window will get cafe duty. Lunch windows are stored as rows with their own id, per grade, so a duty roster can later point at "this lunch, this day" and a teacher's free lunch time can be worked out from their classes. Nothing about cafe duty is configured now.

## Where
| Who | Page |
|---|---|
| School admin | School admin > Timetable & Report Cards > **School day** tab (`/school-admin/school-day`) |
| Principal and vice principals | Menu > **School day** (`/principal/school-day`) |
| Head of department / school admin | The Timetable builder: new section, "Lasts" (1, 2 or 3 periods), a warning if it would run into lunch or an event |
| Students and teachers | My Timetable: **Week** (days as columns on a time axis) on a laptop, **Today / Tomorrow / Week** on a phone |
| Principal | Timetable (by class or by teacher), same week view |

## Setting up Manchester
1. Apply `088_school_day.sql`, then `089_substitution_spans.sql`, in the Supabase SQL editor (each has a rollback in `scripts/migrations/rollback/`).
2. Run `scripts/data/manchester-school-day.sql`: seven one-hour periods from 8 am to 3 pm and the two lunch windows. It is safe to run twice and does not add devotion or clubs.
3. The school admin opens **School day** and adds the school's events (for example General devotion, Mondays 8 to 9; Clubs and societies, Wednesdays 8 to 9).
4. Heads of department place each teacher's classes in the Timetable builder.
Until 088 is applied the screens work exactly as before (no lunch or events, every class one period long).

## Tests
`scripts/tests/school-day/`: `tests.sql` (who may change what, class spans, lunch and events rules; 39 checks), `substitution-tests.sql` (double periods and cover; 11 checks), `schoolDayPure.test.mjs` (the day's logic; 15 tests). The SQL ones run on a throwaway database with the demo fixture (see `scripts/tests/demo-seed/README.md`) and every line should say PASS.
