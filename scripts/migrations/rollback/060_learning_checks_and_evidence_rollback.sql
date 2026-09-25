-- Removes Smart Learning check questions, attempts and the shared evidence feed (ALL of it is deleted).
begin;
drop function if exists public.learning_check_item_stats(uuid);
drop function if exists public.learning_check_results(uuid);
drop function if exists public.learning_submit_check(uuid, jsonb);
drop function if exists public.learning_get_check(uuid);
drop function if exists public.evidence_topic_summary(uuid);
drop function if exists public.record_evidence(uuid, text, uuid, uuid, text, int, numeric, numeric, jsonb);
drop table if exists public.learning_check_attempts;
drop table if exists public.learning_check_questions;
drop table if exists public.student_evidence;
drop function if exists public.trg_learning_check_questions_guard();
drop function if exists public.trg_student_evidence_append_only();
commit;
