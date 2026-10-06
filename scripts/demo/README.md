# Manchester demo data

Fills the four test accounts with realistic demo data so every screen in the live walk-through has something to show:
**Testing Teacher**, **Testing HOD**, **Testing Principal** and the **student with ID 54321**. Nothing else is touched.

## Files
| File | What it is |
|---|---|
| `00-check-before.sql` | Read-only checks to run first |
| `manchester-demo-seed.sql` | The seed (generated from `parts/`; safe to run again, it first removes its own earlier rows) |
| `manchester-demo-remove.sql` | Removes everything the seed added |
| `parts/` | The source: `00-remove`, `10-assess`, `11-assess-results`, `12-assess-responses`, `20-learning`. Edit these, then run `./build.sh` |
| `../reassign-student-ids.mjs` | Gives students with IDs like 1-1-1 a random 5-digit ID (separate, see below) |

## What it adds (all rows have ids starting `dd000000-`, so they are easy to find)
- **Grade 9 Mathematics topics** (only if missing), 6 tests over the last 6 weeks plus a **Term 1 exam vetted by the HOD**, and a **Term 2 exam waiting for the HOD to review**
- About 60 questions across 9 topics, and **results for the whole class** (about 30 students): a believable spread, a weak topic (Simple interest about 50%), two essays' worth of marking points, **about 20 essays still waiting to be marked**, 8 flagged exam sessions, results released on all but the last test (so you can release it live)
- **Testing Student**: Grade 9, in the demo class, 6 results (weak at Simple interest and Compound interest, so My Topics has something to say), 2 flashcard decks with cards due now, 3 lessons (one finished, one in progress that they were **absent for** so catch-up shows, one upcoming)
- **Learning:** 3 five-step lessons with check questions at support, core and stretch levels, student progress, check results, a coverage grid, 2 lesson plans, 5 department resources (one pinned by the HOD)
- **Attendance:** 3 weeks of morning register for the demo class (a few absent and late)

## It changes (and the remove file does NOT undo)
- Testing Student is set to **Grade 9** and moved into the demo class (their other class enrolments are removed)
- Testing Teacher is linked to the demo class and to Mathematics
- A department subject row for Mathematics is added if the department had none

## Not included yet
- **Timetable, today's classes, teacher absence and cover, principal alerts, report cards, the school admin integrity page, the Library.** The timetable waits for the sample you are uploading. These go in `parts/30-school.sql`.

## Running it
1. In Supabase SQL editor on **Manchester**: run `00-check-before.sql` (read-only) and check the four accounts show `found = 1`.
2. Copy the seed to the clipboard, paste it into the SQL editor and run it:
   ```bash
   pbcopy < scripts/demo/manchester-demo-seed.sql
   ```
   It stops with a plain message if an account is missing or the demo class is too small. If it fails, nothing is changed (it runs in one transaction).
3. Walk the demo with each login (see the rehearsal list in `docs/demo-data-plan.md`).
4. **The morning of the demo, run the seed again** to reset anything the audience changed. `manchester-demo-remove.sql` takes it all out.

## Student IDs
```bash
node scripts/reassign-student-ids.mjs --env .env.manchester                                  # dry run, writes a mapping CSV
node scripts/reassign-student-ids.mjs --env .env.manchester --apply --project <project-ref>   # makes the changes
```
It gives every student whose ID is not exactly 5 digits a random, unique 5-digit ID and updates the sign-in email (`<id>@mhs.smartassess`) with it, like the app's own change-ID route. Passwords, names, classes and results do not change. It leaves 54321 alone. Keep the mapping CSV. Run it **before** the seed, so the demo class students already have proper IDs.

## How it was tested
On a throwaway database built from the live structure plus migrations 070 to 087 (`scripts/tests/demo-seed/fixture.sql` is the stand-in school): the seed runs clean, runs twice without duplicates, the remove file leaves nothing behind, and the app's own database functions (My Topics, catch-up, student lessons, exam insight, coverage, resources) return data for the right accounts.
