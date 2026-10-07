# Bug log (QA of the test school)

Found by walking the app as each role on the **test project** (see `docs/qa-test-school.md`). Status: **fixed** (committed, not yet pushed), **open**, or **not a bug** (checked and intended).
Severity: **high** (a feature fails or data could be exposed), **medium** (a feature is slow, confusing or wrong in a common case), **low** (cosmetic or rare).

| # | Where | What happened | Severity | Status |
|---|---|---|---|---|
| B-001 | Integrity dashboard (HOD Analytics > Integrity, school admin) | The page fetched **every exam session with every answer** and filtered on screen. On a test school with 178 sittings it made the database time out (error 57014, 15 to 30 seconds, then a blank page). A real school with thousands of sittings would never load it. | high | **fixed**: asks the database only for flagged essay answers (one query, about 1.2 seconds, flagged answer still shown) |
| B-002 | Every page | Each page asks the sign-in service "who is this?" 8 to 10 times (one call per component), about 1 second each on this connection. Slows every page load, most on phones. | low | open (needs one shared user lookup) |

## Checked and not a bug
- `cancel_teacher_absence` returns an error on the report-absence and substitution pages: it is a deliberate "is this installed?" check.
- `/principal/ai-tutor` 403 on school settings and `/school-admin/library` 403: both are school switches that are off in the test school.
- Pages that redirect (`/supervisor/classes` to classrooms, `/supervisor/exams` to the teacher's tests, `/teacher/vetting` to the home page for a non-vetting teacher, and similar): intended.
- Phone width: all 124 pages in every role open without sideways scrolling.
