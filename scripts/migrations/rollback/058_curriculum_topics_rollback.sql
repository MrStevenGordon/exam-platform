-- Removes the shared topic list. Questions and lesson plans keep their free-text
-- topic; only the link to the list (topic_id) and the list itself are removed.
begin;
drop function if exists public.topic_usage();
drop function if exists public.merge_topics(uuid, uuid);
drop index if exists public.questions_topic_id_idx;
drop index if exists public.lesson_plans_topic_id_idx;
alter table public.questions drop column if exists topic_id;
alter table public.lesson_plans drop column if exists topic_id;
drop table if exists public.curriculum_topics;
drop function if exists public.trg_curriculum_topic_code();
drop function if exists public.topic_subject_taught_by_me(text);
drop function if exists public.topic_subject_managed_by_hod(text);
drop function if exists public.topic_slug(text);
commit;
