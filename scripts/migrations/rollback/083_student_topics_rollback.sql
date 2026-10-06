-- Rolls back 083_student_topics.sql. Safe at any time: the functions only read, and nothing depends on them except the
-- student "My topics" page, which hides itself when student_topics_ready() is missing.
begin;
drop function if exists public.my_topic_results();
drop function if exists public.student_topics_ready();
commit;
select 'Migration 083 rolled back' as result;
