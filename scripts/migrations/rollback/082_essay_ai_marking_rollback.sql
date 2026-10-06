-- Rolls back 082_essay_ai_marking.sql. Deletes every stored AI suggestion and the teacher's recorded final marks on them (the marks themselves are untouched).
begin;
drop table if exists public.essay_ai_marking;
commit;
select 'Migration 082 rolled back' as result;
