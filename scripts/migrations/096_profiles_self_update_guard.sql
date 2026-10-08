-- 096: stop people changing their own role, department, student number or other identity columns on their own profile.
--
-- WHAT IS WRONG (QA, 2026-10-07): the rule "Users can update own profile" lets anyone change ANY column of their own profile row. A student, using the app's own
-- database connection (not the normal screens), could set their own role to teacher, mark themselves as a system admin, or change their department or student
-- number (all reverted straight away). Because the whole system reads the role from this row, this is the most serious finding so far.
--
-- NOW: a guard runs before every update of a profile. Someone who is not the school admin (or a system admin, or the server itself) may still update the
-- columns the screens really use (onboarding tours seen, the single-device login lock and its timestamps, the "must change password" flag, and the heartbeat),
-- but if ANY of the other columns would change, the update is refused. Nothing the admin or the server does changes.
--
-- Roll back with scripts/migrations/rollback/096_profiles_self_update_guard_rollback.sql

begin;

create or replace function public.guard_profile_self_update() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  -- the server itself (service key) has no signed-in person; the admin and system admins may change anything
  if auth.uid() is null then return new; end if;
  if public.is_admin() or coalesce(((auth.jwt() -> 'app_metadata') ->> 'is_system_admin')::boolean, false) then return new; end if;

  if new.id is distinct from old.id
     or new.role is distinct from old.role
     or new.department_id is distinct from old.department_id
     or new.student_id is distinct from old.student_id
     or new.is_system_admin is distinct from old.is_system_admin
     or new.is_active is distinct from old.is_active
     or new.leadership_title is distinct from old.leadership_title
     or new.grade_level is distinct from old.grade_level
     or new.accommodations is distinct from old.accommodations
     or new.school_email is distinct from old.school_email
     or new.full_name is distinct from old.full_name
     or new.first_name is distinct from old.first_name
     or new.middle_name is distinct from old.middle_name
     or new.last_name is distinct from old.last_name
     or new.birth_date is distinct from old.birth_date
     or new.birth_year is distinct from old.birth_year
     or new.gender is distinct from old.gender
     or new.created_at is distinct from old.created_at
  then
    raise exception 'You cannot change that part of a profile.' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists guard_profile_self_update on public.profiles;
create trigger guard_profile_self_update before update on public.profiles
  for each row execute function public.guard_profile_self_update();

commit;

select 'Migration 096 applied' as result;
