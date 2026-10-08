-- 099: make the row-level rules on questions and exam sittings cheap for the database to plan (QA B-010).
--
-- WHAT WAS WRONG: the rules on `questions` and `exam_sessions` asked questions about `draft_exams`, `final_exams` and `profiles` inline. Those tables are
-- protected by rules of their own, so for every request the database first had to expand rules inside rules. Measured on the test project, BEFORE it read
-- a single row: reading questions took about 150 ms of planning, updating a question about 400 ms, updating an exam sitting about 240 ms, reading sittings
-- about 80 ms. A page that made several such requests at once (the HOD saving comments, a class submitting together) hit the 8 second limit.
--
-- NOW: each of those inline questions is a small secured helper function (the same pattern the school already uses, e.g. rls_own_session_ids). The
-- planner treats a function as one step, so the nesting disappears. WHO CAN SEE OR CHANGE WHAT IS EXACTLY THE SAME: each helper asks the same question
-- the old rule asked; the policies keep their names and their roles. Verified by comparing, for every test login, the exact set of rows visible, updatable
-- and deletable before and after.
--
-- Roll back with scripts/migrations/rollback/099_faster_exam_row_rules_rollback.sql

begin;

-- is the signed-in person a team lead for this draft exam's subject and grade?
create or replace function public.rls_exam_team_lead(p_exam uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1 from draft_exams d
    join team_lead_appointments tla on tla.year_grade = d.target_grade and tla.subject = d.subject
    where d.id = p_exam and tla.teacher_id = auth.uid())
$$;

-- is the signed-in person a senior team lead for this draft exam while it is under review?
create or replace function public.rls_exam_senior_lead_reviewing(p_exam uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1 from draft_exams d
    join senior_team_lead_appointments stla on stla.subject = d.subject and (stla.year_grade is null or stla.year_grade = d.target_grade)
    where d.id = p_exam and stla.teacher_id = auth.uid() and d.status = 'submitted')
$$;

-- is this draft exam in the signed-in head of department's department (or are they the admin)?
create or replace function public.rls_draft_exam_supervised(p_exam uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (select 1 from draft_exams d where d.id = p_exam and (d.department_id = public.my_supervised_department() or public.is_admin()))
$$;

-- did the signed-in person create this draft exam?
create or replace function public.rls_draft_exam_owned(p_exam uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (select 1 from draft_exams d where d.id = p_exam and d.created_by = auth.uid())
$$;

-- is this final exam in the signed-in head of department's department (or are they the admin)?
create or replace function public.rls_final_exam_supervised(p_final uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (select 1 from final_exams f where f.id = p_final and (f.department_id = public.my_supervised_department() or public.is_admin()))
$$;

revoke all on function public.rls_exam_team_lead(uuid), public.rls_exam_senior_lead_reviewing(uuid), public.rls_draft_exam_supervised(uuid),
  public.rls_draft_exam_owned(uuid), public.rls_final_exam_supervised(uuid) from public, anon;
grant execute on function public.rls_exam_team_lead(uuid), public.rls_exam_senior_lead_reviewing(uuid), public.rls_draft_exam_supervised(uuid),
  public.rls_draft_exam_owned(uuid), public.rls_final_exam_supervised(uuid) to authenticated;

-- ---------- questions ----------
drop policy if exists "Team leads can edit shared exam questions" on public.questions;
create policy "Team leads can edit shared exam questions" on public.questions for all
  using (public.rls_exam_team_lead(draft_exam_id));

drop policy if exists "Senior team leads can view questions for exams under review" on public.questions;
create policy "Senior team leads can view questions for exams under review" on public.questions for select
  using (public.rls_exam_senior_lead_reviewing(draft_exam_id));

drop policy if exists "Supervisors view own department questions" on public.questions;
create policy "Supervisors view own department questions" on public.questions for select
  using (public.rls_draft_exam_supervised(draft_exam_id));

drop policy if exists "Team leads can view shared exam questions" on public.questions;
create policy "Team leads can view shared exam questions" on public.questions for select
  using (public.rls_exam_team_lead(draft_exam_id));

drop policy if exists "Students sample only from exams they've completed" on public.questions;
create policy "Students sample only from exams they've completed" on public.questions for select
  using ((question_type <> 'essay'::text) and (public.my_role() = 'student'::text) and public.student_completed_question_exam(id));

-- ---------- exam_sessions ----------
drop policy if exists "Supervisors view sessions for own department direct exams" on public.exam_sessions;
create policy "Supervisors view sessions for own department direct exams" on public.exam_sessions for select
  using (public.rls_draft_exam_supervised(draft_exam_id));

drop policy if exists "Supervisors view sessions for own department exams" on public.exam_sessions;
create policy "Supervisors view sessions for own department exams" on public.exam_sessions for select
  using (public.rls_final_exam_supervised(final_exam_id));

drop policy if exists "Teachers view sessions for own direct exams" on public.exam_sessions;
create policy "Teachers view sessions for own direct exams" on public.exam_sessions for select
  using (public.rls_draft_exam_owned(draft_exam_id));

drop policy if exists "Supervisors update sessions for own department exams" on public.exam_sessions;
create policy "Supervisors update sessions for own department exams" on public.exam_sessions for update
  using (public.rls_final_exam_supervised(final_exam_id));

drop policy if exists "Teachers update sessions for own direct exams" on public.exam_sessions;
create policy "Teachers update sessions for own direct exams" on public.exam_sessions for update
  using (public.rls_draft_exam_owned(draft_exam_id));

commit;

select 'Migration 099 applied' as result;
