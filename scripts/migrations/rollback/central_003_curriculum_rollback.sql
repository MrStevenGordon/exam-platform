-- Removes the curriculum text and its search. The documents themselves are the Ministry's PDFs and are not stored here.
begin;
drop function if exists public.curriculum_search(text, integer, text, integer);
drop function if exists public.curriculum_subject_matches(text, text[], text);
drop table if exists public.curriculum_chunks;
drop table if exists public.curriculum_documents;
commit;
select 'Central migration 003 rolled back' as result;
