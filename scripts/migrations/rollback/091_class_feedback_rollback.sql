-- Removes weekly class feedback and teacher reflections. All students' answers and teachers' reflections are deleted.
begin;
drop function if exists public.class_feedback_reminder_candidates(date);
drop table if exists public.weekly_feedback_reminder_log;
drop function if exists public.class_feedback_status(date);
drop function if exists public.class_feedback_report(date, date);
drop function if exists public.class_feedback_submit(date, text, uuid, integer, integer, integer, integer, integer, uuid, boolean, text, text);
drop function if exists public.class_feedback_my_week(date);
drop function if exists public.class_feedback_ready();
drop trigger if exists weekly_class_reflections_guard on public.weekly_class_reflections;
drop function if exists public.trg_weekly_class_reflections_guard();
drop table if exists public.weekly_class_reflections;
drop table if exists public.weekly_class_feedback;
drop function if exists public.fb_teacher_in_my_department(uuid);
commit;
select 'Migration 091 rolled back' as result;
