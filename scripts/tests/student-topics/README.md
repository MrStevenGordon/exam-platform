# Student topics tests

**1. The calculations** (no database needed):

```bash
node --import ./scripts/tests/essay-marking/resolve-ts.mjs --experimental-strip-types --no-warnings --test scripts/tests/student-topics/studentTopicsPure.test.mjs
```

**2. The database function, on a throwaway Postgres.** Build the throwaway database exactly as in `scripts/tests/exam-insight/README.md` (name it `topics`), then:

```bash
P -d topics -v ON_ERROR_STOP=1 -f scripts/tests/student-topics/seed.sql
P -d topics -v ON_ERROR_STOP=1 -f scripts/migrations/083_student_topics.sql     # after the seed
P -d topics -f scripts/tests/student-topics/tests.sql                            # every line PASS, last table failed = 0
```

The seed is two students with hand-worked marks (Fractions 7 of 10 = 70%), a merged-away topic, a free-text topic, an untagged question, an unmarked essay, a session whose results are not released and an unfinished retake. To prove the tests can fail, delete the `results_released = true` or `points_awarded is not null` lines in a copy of the migration and rerun: five checks fail.

The practice button uses the existing practice-mock rules (migration 022): a student can add released-exam questions to a mock and is refused questions from an exam whose results are not released. To check this by hand in the sandbox, insert the `self_mocks` row and its `self_mock_questions` rows as two separate statements (one statement cannot see its own new mock).
