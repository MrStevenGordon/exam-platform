-- Let every HOD in a department act for that department, not just the one
-- recorded in departments.head_id.
--
-- WHY: my_supervised_department() is the single function ~25 row-level
-- security policies (exams, sessions, class assignments, report cards, ...)
-- use to decide "which department does this supervisor run?". It only looked
-- at departments.head_id, which holds ONE person per department. A department
-- with two or three HODs (Science can have three) therefore gave full powers
-- to one and silently none to the rest: they saw no exams and got a red
-- "violates row-level security" error assigning teachers to classes.
--
-- WHAT: a person who is the recorded head keeps exactly what they have today
-- (checked first). Otherwise, a profile with role 'supervisor' (the HOD role)
-- acts for the department on their own profile. Everyone else still gets
-- NULL, i.e. no department powers. Nothing else changes.
--
-- Roll back with scripts/migrations/rollback/051_multiple_hods_per_department_rollback.sql

create or replace function public.my_supervised_department()
returns uuid
language sql stable security definer
set search_path to 'public'
as $$
  select coalesce(
    (select d.id from departments d where d.head_id = auth.uid() limit 1),
    (select p.department_id from profiles p where p.id = auth.uid() and p.role = 'supervisor')
  )
$$;
