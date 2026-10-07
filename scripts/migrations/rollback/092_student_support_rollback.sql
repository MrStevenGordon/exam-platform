-- Removes the student support list and the support plans. All support plans and the actions recorded on them are deleted.
begin;
drop function if exists public.support_cases_list(text);
drop function if exists public.support_action_add(uuid, text, text, date);
drop function if exists public.support_case_close(uuid, text, text);
drop function if exists public.support_case_update(uuid, text, date, text, uuid);
drop function if exists public.support_case_open(uuid, text, text, text, date, uuid);
drop function if exists public.support_average(uuid, text, timestamptz);
drop function if exists public.support_can_edit_case(uuid);
drop function if exists public.support_staff_ok(uuid);
drop function if exists public.support_students(integer);
drop table if exists public.support_actions;
drop table if exists public.support_cases;
drop function if exists public.support_in_scope(uuid);
drop function if exists public.support_ready();
commit;
select 'Migration 092 rolled back' as result;
