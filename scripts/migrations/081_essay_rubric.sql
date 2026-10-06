-- 081: marking points for essay questions (Smart Assess).
--
-- Teachers can write marking points for an essay: what a good answer earns marks for, and how many. Today only short-answer and
-- fill-in questions have them (questions.marking_points).
--
-- WHY A NEW COLUMN: the exam submit code (score_answer in migration 066, and the older path in src/lib/examApi.ts) marks ANY question
-- that has marking_points by keyword, whatever its type. An essay with marking_points would be auto-marked, probably zero, and the
-- exam would be marked fully graded, so the essay would never reach the teacher. A separate column cannot trigger that, and the
-- submit code never reads it. It is also never sent to students while they sit an exam (student_exam_questions lists its columns).
--
-- WHAT: one nullable jsonb column, a list of {"text": "...", "marks": n} (1 to 12 items), allowed only on essay questions.
-- Nothing existing changes. The app only offers the editor once this column exists.
-- Roll back with scripts/migrations/rollback/081_essay_rubric_rollback.sql

begin;

alter table public.questions add column if not exists essay_rubric jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'questions_essay_rubric_shape') then
    alter table public.questions add constraint questions_essay_rubric_shape check (
      essay_rubric is null
      or (jsonb_typeof(essay_rubric) = 'array' and jsonb_array_length(essay_rubric) between 1 and 12 and question_type = 'essay')
    );
  end if;
end $$;

comment on column public.questions.essay_rubric is 'Marking points for an essay: [{"text": "what earns the mark", "marks": 2}, ...]. Essays only. Not read by exam scoring.';

commit;

select 'Migration 081 applied' as result;
