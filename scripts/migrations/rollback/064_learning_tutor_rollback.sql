-- Removes the Smart Learning AI tutor's saved conversations (ALL of them are deleted).
-- If 065 (the school-wide flagged list) is applied, roll that back FIRST.
begin;
drop function if exists public.learning_tutor_purge(int);
drop function if exists public.learning_tutor_flag_counts();
drop function if exists public.learning_tutor_mark_reviewed(uuid);
drop function if exists public.learning_tutor_transcript(uuid);
drop function if exists public.learning_tutor_conversations(uuid);
drop table if exists public.learning_tutor_messages;
drop table if exists public.learning_tutor_conversations;
drop function if exists public.learning_tutor_can_read(uuid);
drop function if exists public.learning_tutor_can_review(uuid);
commit;
