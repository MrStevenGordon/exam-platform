-- Performance fix: mark read-only RLS helper functions STABLE.
--
-- These 10 functions were left VOLATILE (Postgres's default when
-- unspecified), even though every one of them only reads data and never
-- writes. They're referenced across ~40 RLS policies. A VOLATILE function's
-- result can't be cached across rows within a single query, so Postgres was
-- re-running each of these as a fresh subquery against profiles/departments
-- for every row a policy checked, instead of once per query. That's fine on
-- a handful of demo rows; it's real, felt latency (seconds, not
-- milliseconds) once a school has hundreds of profiles.
--
-- Purely a planner hint -- auth.uid() is constant within a single query or
-- transaction either way, so this changes nothing about what any of these
-- return, only how often Postgres re-derives it.
--
-- Every already-provisioned school runs its own Supabase project cloned
-- from the same base schema (see 038_shared_lesson_plans.sql), so this same
-- migration needs to be run against each of those projects individually --
-- this only reaches whichever project DATABASE_URL points at.

alter function public.is_admin() stable;
alter function public.is_supervisor() stable;
alter function public.is_teacher() stable;
alter function public.is_system_admin() stable;
alter function public.my_role() stable;
alter function public.my_department_id() stable;
alter function public.my_profile_department_id() stable;
alter function public.my_supervised_department() stable;
alter function public.is_enrolled_in(uuid) stable;
alter function public.is_direct_published(uuid) stable;
alter function public.owns_draft_exam(uuid) stable;
