-- Hardening found during a student-data-isolation review, not a live incident: "Users can read
-- relevant profiles" (profiles, defined before this migrations/ folder existed) lets a caller read
-- any profile whose department_id matches their own — meant for staff in the same department to
-- see each other. Today this can never expose a student to another student, only because
-- department_id is never set on a student row (confirmed in code and in the live data) — the
-- policy itself doesn't say so, it just happens to be true. That's a silent invariant, not a
-- guarantee: the day anything ever sets department_id on a student profile for an unrelated
-- reason, this clause would start leaking that student's profile to every other person who shares
-- the same department, with no code change to this policy at all.
--
-- This makes the protection explicit instead of implicit: department-based visibility now only
-- ever applies to non-student rows. Every other student-facing profiles policy (their own row,
-- their teachers, a supervisor's own students, a teacher's own class) is unaffected and already
-- correctly scoped to auth.uid() or a real relationship — reviewed and confirmed as part of the
-- same pass.
--
-- Roll back with scripts/migrations/rollback/072_profiles_department_excludes_students_rollback.sql

begin;

drop policy if exists "Users can read relevant profiles" on public.profiles;

create policy "Users can read relevant profiles" on public.profiles
for select
using (
  auth.uid() = id
  or is_admin()
  or (((auth.jwt() -> 'app_metadata') ->> 'is_system_admin'))::boolean = true
  or (department_id = my_profile_department_id() and role <> 'student')
  or (my_role() = 'supervisor' and department_id = my_supervised_department())
);

commit;
