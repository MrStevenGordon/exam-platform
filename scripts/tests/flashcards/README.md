# Flashcard tests

**1. The rules** (no database needed):

```bash
node --import ./scripts/tests/essay-marking/resolve-ts.mjs --experimental-strip-types --no-warnings --test scripts/tests/flashcards/flashcardsPure.test.mjs
```

**2. Privacy and limits in the database**, on a throwaway Postgres built as in `scripts/tests/exam-insight/README.md`. Load `scripts/tests/student-topics/seed.sql` (it has the people the tests use), apply `scripts/migrations/084_flashcards.sql` after it, then:

```bash
P -d topics -f scripts/tests/flashcards/tests.sql      # every line PASS, last table failed = 0
```

It checks that no one but the owning student (not a teacher, the admin, the principal, another student, or a signed-out caller) can read or change a deck or card, that a card cannot be planted in someone else's deck, the 50 deck and 500 card limits, the text length rules, and that deleting a deck deletes its cards. To prove the tests can fail, replace the cards policy in a copy of the migration with `using (true)` and rerun: nine checks fail.
