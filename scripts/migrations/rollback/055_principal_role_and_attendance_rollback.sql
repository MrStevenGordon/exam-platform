-- Removes principal accounts' access, the attendance tables (and their data!)
-- and every 055 function/policy, restoring is_staff() / list_staff_directory()
-- and the role check to how they were.
--
-- BEFORE running: change or delete any profile whose role is 'principal',
-- otherwise re-adding the original role check fails.
begin;

drop function if exists public.student_attendance_detail(uuid, date, date);
drop function if exists public.student_attendance_summary(date, date);
drop function if exists public.teacher_punctuality(date, date);
drop function if exists public.truancy_report(date, date);
drop function if exists public.section_attendance(uuid, date);
drop function if exists public.attendance_board(date);
drop function if exists public.require_oversight();
drop function if exists public.mark_morning_register(uuid, jsonb);
drop function if exists public.mark_class_attendance(uuid, jsonb);
drop function if exists public.start_class(uuid);

drop policy if exists "Principals view all section enrollments" on public.section_enrollments;
drop policy if exists "Principals view all timetable sections" on public.timetable_sections;
drop policy if exists "Principals view all teacher subjects" on public.teacher_subjects;
drop policy if exists "Principals view all teacher class assignments" on public.teacher_class_groups;
drop policy if exists "Principals view all enrollments" on public.enrollments;
drop policy if exists "Principals view all class groups" on public.class_groups;
drop policy if exists "Principals view all profiles" on public.profiles;

drop table if exists public.class_attendance;
drop table if exists public.class_sessions;
drop table if exists public.daily_attendance;

drop function if exists public.is_hod_of_section(uuid);
drop function if exists public.attendance_late_minutes();
drop function if exists public.period_start(date, time);
drop function if exists public.school_year_for(date);
drop function if exists public.school_today();

create or replace function public.is_staff()
returns boolean
language sql stable security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role in ('teacher', 'supervisor', 'admin')
  );
$$;

create or replace function public.list_staff_directory()
returns table(id uuid, full_name text, role text)
language sql security definer
set search_path to 'public'
as $$
  select p.id, p.full_name, p.role
  from profiles p
  where p.role in ('teacher', 'supervisor', 'admin')
  and coalesce(p.is_active, true) = true
  and public.is_staff()
  order by p.full_name;
$$;

drop function if exists public.is_principal();

delete from public.password_reset_requests where user_type = 'principal';
alter table public.password_reset_requests drop constraint password_reset_requests_user_type_check;
alter table public.password_reset_requests add constraint password_reset_requests_user_type_check
  check (user_type = any (array['student'::text, 'teacher'::text, 'supervisor'::text]));

alter table public.profiles drop column if exists leadership_title;
alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role = any (array['student'::text, 'teacher'::text, 'supervisor'::text, 'admin'::text]));

commit;
