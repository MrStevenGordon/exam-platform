begin;
drop trigger if exists guard_profile_self_update on public.profiles;
drop function if exists public.guard_profile_self_update();
commit;
select 'Migration 096 rolled back' as result;
