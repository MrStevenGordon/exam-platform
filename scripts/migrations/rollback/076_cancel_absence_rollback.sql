-- Undoes migration 076: drops cancel_teacher_absence(). Absences already cancelled stay cancelled.
begin;
drop function if exists public.cancel_teacher_absence(uuid);
commit;

select 'Migration 076 rolled back' as result;
