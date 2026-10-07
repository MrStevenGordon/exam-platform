begin;
drop table if exists public.ai_reply_problems;
commit;
select 'Migration 090 rolled back' as result;
