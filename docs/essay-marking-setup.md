# AI-suggested essay marking (Smart Assess): what to switch on, in order

This is built in stages. **Stage A (marking points for essays) is live. Stages B and C (the AI engine) and stage D (the Suggest marks button and panel teachers see) are built and tested.** Stage E is the accuracy trial with Manchester teachers. Nothing teacher-facing appears until a school's switch is on, so applying the migrations is safe.

## Stage A: marking points for essay questions

A teacher can now write marking points for an essay: what a good answer earns marks for, and how many. When they mark, they get a box for each point instead of one score box. They add up to the question's points. Marking points are optional; an essay without them is marked with a single score exactly as before.

### 1. Apply the migration

In the school's Supabase **SQL editor**, run `scripts/migrations/081_essay_rubric.sql`. Copy it with `pbcopy < scripts/migrations/081_essay_rubric.sql`. You should see a row saying **Migration 081 applied**. Until it is applied, the marking points box does not appear and everything works as before.

Why a separate column: the exam submit code marks any question that has `marking_points` by keyword, whatever its type. An essay with marking points stored there would be marked zero at submission and the exam marked complete, so the essay would never reach the teacher. Essay marking points live in their own column, `essay_rubric`, which the submit code never reads. This was tested on a private copy of the database.

### 2. Where teachers find it

- **Add question** (and **Edit question**, and editing a **bank question**): choose type **Essay**, and a **Marking points** box appears. Add a description and marks for each point. The question's points are set from the total.
- **Grade essay responses:** an essay with marking points shows a box for each point. Every box must be filled (0 if the answer earns nothing), so a blank is never saved as a zero by accident. **Save all points** saves the total as before.
- **Review page for one student:** the marking points are listed for reference above the score box.
- **Adding an essay from the question bank** to a test brings its marking points with it.

### 3. Who can read the marking points

The teacher who set the question, and the department head and other staff who can already read that question. A student cannot read an essay question through the database, so they cannot read its marking points. Note: until migration 067 is applied on a school, students can still read other question columns (including answer keys) for exams they are enrolled in; that is a separate, existing issue.

## Stages B and C: the engine (no teacher-facing button yet)

Built and tested, but nothing is visible to teachers until stage D, so applying these is safe and changes nothing on screen.

### 1. Apply the migration

Run `scripts/migrations/082_essay_ai_marking.sql` in the school's SQL editor (`pbcopy < scripts/migrations/082_essay_ai_marking.sql`). You should see **Migration 082 applied**. It adds one table, `essay_ai_marking`, that stores each AI suggestion and, later, the marks the teacher finally gave.

Who can read it: only staff who can already read that student's response (the teacher who set the test, the class teacher, the head of department, the school admin). **A student cannot read it, including on their own essay**, which is why it is a separate table and not a column on the response. Teachers can record their final marks on it but cannot change what the AI suggested. Only the server writes suggestions. Tested on a private database, including that a weakened rule is caught.

### 2. The school switch (owner console)

**Owner console, Configure school tools:** a new box, *AI-suggested essay marking in Smart Assess*. It is off by default and saves with the rest of the school's settings. Switch it on only for a school that has agreed, after its principal has been told exactly what is sent: the question, the marking points and the essay text, with no name, number or class, go to Anthropic's AI service. Remember to **load the school's current settings before saving** (saving replaces the whole set).

### 3. The AI account

The server needs `ANTHROPIC_API_KEY` set in the school's Vercel project, with credit on the Anthropic account. If it is missing or out of credit, a teacher sees "The AI service is not available at the moment" and marks by hand as normal. The key in the local `.env.local` was rejected (invalid) when last tried, so the live prompt has not yet been tried on real calls. Once a working key is available, run `scripts/tests/essay-marking/live-try.mjs` (instructions at the top of that file): four invented essays, about a cent each, to check behaviour and cost before stage D.

### 4. Limits

300 AI suggestions per teacher per month (counted in the existing `ai_polish_usage` table under `essay_marking`), and 30 per minute. A blank answer earns zero without using the AI or the allowance. Looking at a suggestion again is free; asking for a new one uses another.

### What the server checks on every AI reply

Marks are clamped to each point's maximum and rounded to half marks; a quote that is not actually in the essay is dropped and its point flagged; a reply that does not cover every marking point is refused rather than guessed at; an essay that tries to instruct the marker is flagged and every point is marked for the teacher to check. The AI never writes a mark.

## Stage D: what teachers see (only when the school's switch is on)

- **Grade essay responses:** an essay that has marking points gets a **Suggest marks** button and, once asked, a panel: each marking point with the AI's mark, a quote from the essay, and Clear or Check. Points to check come first. **Use these marks** copies them into the teacher's own boxes; nothing is saved until the teacher saves. **Suggest again** asks for a fresh one (uses another allowance).
- **Suggest marks for all (N):** asks for every waiting essay that has marking points, three at a time, with progress. It stops by itself and says why if the allowance, the AI service or the school switch runs out.
- **Review page for one student:** the same panel; **Use this total** fills the score box.
- **Final marks are kept beside the suggestion** when the teacher saves, so we can measure how often teachers change a suggestion (stage E uses this).
- An essay without marking points shows a hint to add them; there is no button.
- **Privacy page** now lists essay mark suggestions and the AI tutor and says a teacher decides every mark. Please read the wording before it goes live: it is public.

### To switch it on for a school

1. Migrations 081 and 082 applied on the school.
2. `ANTHROPIC_API_KEY` set on the school's Vercel project with credit on the account.
3. Tell the school's principal exactly what is sent (the question, the marking points and the essay text, with no name, number or class) and get their agreement.
4. Owner console, Configure school tools: **load the school's current settings**, tick *AI-suggested essay marking*, save.
5. Walk through QA checklist 7j with invented essays.

## Undoing it

`scripts/migrations/rollback/081_essay_rubric_rollback.sql` removes the marking points column (essays and marks untouched). `scripts/migrations/rollback/082_essay_ai_marking_rollback.sql` removes every stored suggestion (marks untouched). Untick the owner console box to switch AI marking off for a school without losing anything.

## Tests

Run the calculation and decision tests with:

```bash
node --import ./scripts/tests/essay-marking/resolve-ts.mjs --experimental-strip-types --no-warnings --test scripts/tests/essay-marking/essayMarkingPure.test.mjs scripts/tests/essay-marking/essayMarkingCore.test.mjs scripts/tests/essay-marking/essayRubricPure.test.mjs
```

The database tests (`rubric-tests.sql`, `marking-table-tests.sql`) run on a throwaway database as described below; apply 082 after the exam insight `seed.sql`.


`scripts/tests/essay-marking/`: `essayRubricPure.test.mjs` (the rules) and `rubric-tests.sql` (on a throwaway database built as in `scripts/tests/exam-insight/README.md`, after applying 080 and 081 and loading the exam insight `seed.sql`). The key check submits the same exam with and without marking points on an essay and confirms the result is identical: the essay stays unmarked and the exam is not marked complete.
