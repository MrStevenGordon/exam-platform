-- Removes lesson study guides. THIS DELETES EVERY GUIDE AND EVERY STUDENT REPORT ABOUT ONE. Lessons and check questions are untouched.
begin;
drop function if exists public.learning_guides_ready();
drop function if exists public.learning_guide_clear_reports(uuid);
drop function if exists public.learning_guide_report_counts(uuid);
drop function if exists public.learning_guide_stale(uuid);
drop function if exists public.learning_report_guide_item(uuid, text, int, text);
drop function if exists public.learning_get_guide(uuid);
drop table if exists public.learning_guide_reports;
drop table if exists public.learning_lesson_guides;
drop function if exists public.trg_learning_lesson_guides_guard();
drop function if exists public.learning_lesson_text_hash(uuid);
drop function if exists public.learning_guide_valid(jsonb, jsonb, jsonb);
commit;
select 'Migration 100 rolled back' as result;
