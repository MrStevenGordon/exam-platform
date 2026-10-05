-- Undoes migration 077: drops the reading-progress table and its function. Anyone's saved place in a book is lost.
begin;
drop function if exists public.library_save_progress(uuid, text, text, text, text, text, uuid, integer, integer, integer, integer, integer);
drop table if exists public.library_progress;
commit;

select 'Migration 077 rolled back' as result;
