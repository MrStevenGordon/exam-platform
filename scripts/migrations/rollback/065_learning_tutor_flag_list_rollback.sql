-- Removes the school-wide flagged tutor list and the flagged_at date (flags themselves are kept).
begin;
drop function if exists public.learning_tutor_flagged_counts();
drop function if exists public.learning_tutor_flagged();
drop function if exists public.learning_tutor_oversight();
drop trigger if exists learning_tutor_flagged_at on public.learning_tutor_conversations;
drop function if exists public.trg_learning_tutor_flagged_at();
drop index if exists public.learning_tutor_conversations_flagged_at_idx;
alter table public.learning_tutor_conversations drop column if exists flagged_at;
commit;
