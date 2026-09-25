-- Removes Smart Learning catch-up: the manual add/remove choices and the taught-on dates (all deleted).
begin;
drop function if exists public.learning_student_catchup();
drop function if exists public.learning_catchup_set(uuid, uuid, text);
drop function if exists public.learning_catchup(uuid);
drop function if exists public.learning_absent_reason(uuid, date, uuid, text);
drop table if exists public.learning_catchup_overrides;
alter table public.learning_assignments drop column if exists taught_on;
commit;
