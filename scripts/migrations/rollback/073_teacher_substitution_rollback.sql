-- Removes the substitution tables (and their data!), submit_teacher_absence(),
-- and every policy 073 added. Nothing else was touched by 073.
begin;

drop function if exists public.submit_teacher_absence(date, date, uuid[], jsonb);

drop policy if exists "Admins view all substitution assignments" on public.substitution_assignments;
drop policy if exists "Principals view all substitution assignments" on public.substitution_assignments;
drop policy if exists "HOD views department assignments" on public.substitution_assignments;
drop policy if exists "Substitutes view their own assignments" on public.substitution_assignments;
drop policy if exists "Teachers view assignments for their own absence" on public.substitution_assignments;

drop policy if exists "Admins view all absences" on public.teacher_absences;
drop policy if exists "Principals view all absences" on public.teacher_absences;
drop policy if exists "HOD views department absences" on public.teacher_absences;
drop policy if exists "Teachers view their own absences" on public.teacher_absences;

drop table if exists public.substitution_assignments;
drop table if exists public.teacher_absences;

commit;
