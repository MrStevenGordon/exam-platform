# AI-suggested essay marking (Smart Assess): what to switch on, in order

This is being built in stages. **Stage A, marking points for essays, is ready.** The AI suggestions themselves (stages B to D) are not built yet; this guide grows as they are.

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

## Undoing it

`scripts/migrations/rollback/081_essay_rubric_rollback.sql` removes the column. Essays and their marks are untouched; only the marking points are deleted.

## Tests

`scripts/tests/essay-marking/`: `essayRubricPure.test.mjs` (the rules) and `rubric-tests.sql` (on a throwaway database built as in `scripts/tests/exam-insight/README.md`, after applying 080 and 081 and loading the exam insight `seed.sql`). The key check submits the same exam with and without marking points on an essay and confirms the result is identical: the essay stays unmarked and the exam is not marked complete.
