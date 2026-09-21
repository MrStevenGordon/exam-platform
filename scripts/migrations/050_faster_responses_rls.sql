-- Speed up row-level security on public.responses.
--
-- WHY: every policy on responses used to contain a sub-select on exam_sessions
-- (and draft_exams / final_exams). Those tables have their own policies, and
-- those policies call helpers that read profiles (11 policies of its own), so
-- Postgres had to expand a deep chain of nested policies before it could even
-- plan a query on a 6-row table. Measured as a teacher against the live
-- database: 1-18 SECONDS for `select count(*) from responses` vs ~80 ms
-- without row-level security.
--
-- WHAT: each policy now asks one SECURITY DEFINER helper for "the session ids
-- this user may reach by this route". The helpers read the underlying tables
-- directly, so the nested policy chain is never expanded.
--
-- BEHAVIOUR IS DELIBERATELY UNCHANGED, including one quirk: the old
-- "assigned classes" policies joined final_exams *under that table's own
-- policies*, which a plain teacher cannot pass. The class-teacher helper
-- therefore repeats final_exams' visibility rule (department head / admin, or
-- a published exam the caller is enrolled in) instead of "fixing" it, so no
-- one gains or loses access. See the equivalence test notes in the PR.
--
-- Roll back with scripts/migrations/rollback/050_faster_responses_rls_rollback.sql

begin;

create or replace function public.rls_own_session_ids()
returns setof uuid
language sql stable security definer
set search_path = public, pg_temp
as $$
  select s.id from exam_sessions s where s.student_id = auth.uid()
$$;

create or replace function public.rls_supervised_direct_session_ids()
returns setof uuid
language sql stable security definer
set search_path = public, pg_temp
as $$
  select s.id
  from exam_sessions s
  join draft_exams d on d.id = s.draft_exam_id
  where d.department_id = (select my_supervised_department()) or (select is_admin())
$$;

create or replace function public.rls_supervised_final_session_ids()
returns setof uuid
language sql stable security definer
set search_path = public, pg_temp
as $$
  select s.id
  from exam_sessions s
  join final_exams f on f.id = s.final_exam_id
  where f.department_id = (select my_supervised_department()) or (select is_admin())
$$;

create or replace function public.rls_own_direct_exam_session_ids()
returns setof uuid
language sql stable security definer
set search_path = public, pg_temp
as $$
  select s.id
  from exam_sessions s
  join draft_exams d on d.id = s.draft_exam_id
  where d.created_by = auth.uid()
$$;

create or replace function public.rls_class_teacher_session_ids()
returns setof uuid
language sql stable security definer
set search_path = public, pg_temp
as $$
  select s.id
  from exam_sessions s
  join final_exams f on f.id = s.final_exam_id
  where (
          f.department_id = (select my_supervised_department())
          or (select is_admin())
          or (f.status = 'published' and student_can_see_final_exam(f.id))
        )
    and (
          s.assigned_teacher_id = auth.uid()
          or is_class_subject_teacher(auth.uid(), s.student_id, f.subject)
        )
$$;

drop policy "Students manage own responses" on public.responses;
create policy "Students manage own responses" on public.responses
  for all using (session_id in (select public.rls_own_session_ids()));

drop policy "Supervisors view responses for own department direct exams" on public.responses;
create policy "Supervisors view responses for own department direct exams" on public.responses
  for select using (session_id in (select public.rls_supervised_direct_session_ids()));

drop policy "Supervisors view responses for own department exams" on public.responses;
create policy "Supervisors view responses for own department exams" on public.responses
  for select using (session_id in (select public.rls_supervised_final_session_ids()));

drop policy "Teachers view responses for own direct exams" on public.responses;
create policy "Teachers view responses for own direct exams" on public.responses
  for select using (session_id in (select public.rls_own_direct_exam_session_ids()));

drop policy "Teachers view responses for their assigned classes" on public.responses;
create policy "Teachers view responses for their assigned classes" on public.responses
  for select using (session_id in (select public.rls_class_teacher_session_ids()));

drop policy "Teachers grade responses for own direct exams" on public.responses;
create policy "Teachers grade responses for own direct exams" on public.responses
  for update using (session_id in (select public.rls_own_direct_exam_session_ids()));

drop policy "Teachers grade responses for their assigned classes" on public.responses;
create policy "Teachers grade responses for their assigned classes" on public.responses
  for update using (session_id in (select public.rls_class_teacher_session_ids()));

commit;
