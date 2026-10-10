# Lesson study guide tests

**1. The rules** (no database needed):

```bash
node --import ./scripts/tests/essay-marking/resolve-ts.mjs --experimental-strip-types --no-warnings --test scripts/tests/lesson-guides/lessonGuidePure.test.mjs
node --import ./scripts/tests/essay-marking/resolve-ts.mjs --experimental-strip-types --no-warnings --test scripts/tests/lesson-guides/lessonGuideHandler.test.mjs
```

The first checks the prompt (the lesson is fenced as data), reading and cleaning the AI's reply (links and markdown removed, broken items left out and counted, limits held, items not from the lesson marked for checking). The second checks the server rules around it (who may ask, the allowance, burst limit, plain-language failures, nothing counted unless a usable draft is delivered).

**2. The database rules** on a throwaway Postgres built as in `scripts/tests/exam-insight/README.md`. Use this stand-in for `auth.uid()` so it survives an empty setting left by earlier tests:

```sql
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub','')::uuid $$;
```

Load `scripts/tests/student-topics/seed.sql`, apply `scripts/migrations/100_lesson_study_guides.sql`, then:

```bash
P -d guides -f scripts/tests/lesson-guides/tests.sql      # every line PASS, last table failed = 0
```

It checks that a guide can never hold a web address or exceed its limits, that students can read a guide only through `learning_get_guide` and only when it is switched on and the lesson is open to them, that nobody but the lesson's owner can write or read guides and reports, the stale-lesson flag, and the report limits.

**3. The whole path in a browser** (test school, needs the dev server): `node e2e/qa/lesson-guide.mjs`. A teacher drafts a guide (the AI's reply is supplied by the test), reads it, switches it on and adds questions to the lesson check; a student opens it, adds the cards to their flashcards and reports an item. It removes everything it made.

**4. The real AI** (needs a working key, spends a few cents): `scripts/tests/lesson-guides/live-try.mjs` prints what the AI makes for a lesson so a teacher can judge it.
