-- Rolls back 081_essay_rubric.sql. Deletes every essay's marking points (essays themselves and their marks are untouched).
begin;
alter table public.questions drop constraint if exists questions_essay_rubric_shape;
alter table public.questions drop column if exists essay_rubric;
commit;
select 'Migration 081 rolled back' as result;
