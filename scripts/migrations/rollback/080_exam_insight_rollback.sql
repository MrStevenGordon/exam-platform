-- Rolls back 080_exam_insight.sql. Safe at any time: the function only reads, and nothing depends on it except the Insight page,
-- which hides itself when exam_insight_ready() is missing.
begin;
drop function if exists public.exam_insight_list();
drop function if exists public.exam_insight_data(text, uuid);
drop function if exists public.exam_insight_ready();
commit;
select 'Migration 080 rolled back' as result;
