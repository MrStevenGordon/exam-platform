-- Rolls back 085_topic_lessons.sql. Safe at any time: the functions only read, and nothing depends on them except the lesson links
-- on the student "My topics" page, which hide themselves when topic_lessons_ready() is missing.
begin;
drop function if exists public.my_topic_lessons();
drop function if exists public.topic_lessons_ready();
commit;
select 'Migration 085 rolled back' as result;
