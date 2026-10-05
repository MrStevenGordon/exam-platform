-- Undoes migration 078: removes reading assignments and the functions that read them. Reading progress (077) is untouched.
begin;
drop function if exists public.library_assignment_progress(uuid);
drop function if exists public.library_assignment_summaries();
drop function if exists public.library_my_assignments();
drop table if exists public.library_assignments;
drop function if exists public.library_can_view_assignment(uuid);
commit;

select 'Migration 078 rolled back' as result;
