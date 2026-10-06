# Check levels tests

**1. The rules** (no database needed):

```bash
node --import ./scripts/tests/essay-marking/resolve-ts.mjs --experimental-strip-types --no-warnings --test scripts/tests/learning-levels/checkLevelsPure.test.mjs
```

**2. The database functions**, on a throwaway Postgres built as in `scripts/tests/exam-insight/README.md`. Load `scripts/tests/student-topics/seed.sql`, apply `scripts/migrations/086_check_levels.sql` after it (it needs 060 in the copied structure), then:

```bash
P -d topics -f scripts/tests/learning-levels/tests.sql      # every line PASS, last table failed = 0
```

It checks that old lessons and the old two-argument calls behave exactly as before, that the right answers never leave the database before a student submits, that only the chosen level's questions are marked, that attempts and evidence record the level, what the teacher sees, and the 10-per-level limit. To prove the tests can fail, remove `and level = v_level` from the submit loop in a copy of the migration: several checks fail. To check the rollback, run `scripts/migrations/rollback/086_check_levels_rollback.sql` and confirm old-style calls still work, then re-apply 086.
