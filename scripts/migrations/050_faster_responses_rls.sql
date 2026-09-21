-- Faster row-level security on responses and exam_sessions, plus a fix for
-- class teachers not being able to reach their own exams' sessions/responses.
--
-- WHY (speed): every policy on responses used to contain a sub-select on
-- exam_sessions (and draft_exams / final_exams). Those tables have their own
-- policies, and those call helpers that read profiles (11 policies of its
-- own), so Postgres had to expand a deep chain of nested policies before it
-- could even plan a query on a 6-row table. Measured as a teacher against the
-- live database: 1-18 SECONDS for `select count(*) from responses`, against
-- ~80 ms without row-level security.
--
-- WHY (bug): the "assigned classes" policies looked up final_exams *under
-- final_exams' own policies*, which a teacher cannot pass (only the exam's
-- department HOD/admin, or an enrolled student, can read a final exam). So the
-- policies granted a class teacher nothing on responses, and only the
-- `assigned_teacher_id = me` half worked on exam_sessions; the "I teach this
-- class and subject" half never did. Those helpers now read final_exams
-- directly, which is what the policies always meant to do.
--
-- WHAT: each policy asks a SECURITY DEFINER helper instead of expanding the
-- nested chain. Behaviour is unchanged EXCEPT the bug fix above: a teacher now
-- reaches sessions/responses for (a) sessions assigned to them and (b) final
-- exams in a class they teach, in a subject they teach. Nobody else gains or
-- loses anything (proved by scripts/... equivalence test, see PR notes).
--
-- Roll back with scripts/migrations/rollback/050_faster_responses_rls_rollback.sql

begin;

-- ---- session-id sets (evaluated once per query) ------------------------------

create or replace function public.rls_own_session_ids()
returns setof uuid
language sql stable security definer
set search_path = public, pg_temp
as $$
  select s.id from exam_sessions s where s.student_id = auth.uid()
$$;

-- The leading "gate" conditions do not change the result; they let Postgres
-- skip the table scans entirely for callers who are not an HOD / admin.
create or replace function public.rls_supervised_direct_session_ids()
returns setof uuid
language sql stable security definer
set search_path = public, pg_temp
as $$
  select s.id
  from exam_sessions s
  join draft_exams d on d.id = s.draft_exam_id
  where ((select my_supervised_department()) is not null or (select is_admin()))
    and (d.department_id = (select my_supervised_department()) or (select is_admin()))
$$;

create or replace function public.rls_supervised_final_session_ids()
returns setof uuid
language sql stable security definer
set search_path = public, pg_temp
as $$
  select s.id
  from exam_sessions s
  join final_exams f on f.id = s.final_exam_id
  where ((select my_supervised_department()) is not null or (select is_admin()))
    and (f.department_id = (select my_supervised_department()) or (select is_admin()))
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

-- ---- per-row checks for the class-teacher route ------------------------------
-- (Per row rather than a whole set, so the check only runs for rows that no
-- cheaper policy already allowed.)

-- responses: is the caller the assigned teacher, or a teacher of this final
-- exam's class + subject, for the session this response belongs to?
create or replace function public.rls_is_class_teacher_of_session(p_session_id uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from exam_sessions s
    join final_exams f on f.id = s.final_exam_id
    where s.id = p_session_id
      and (s.assigned_teacher_id = auth.uid()
           or is_class_subject_teacher(auth.uid(), s.student_id, f.subject))
  )
$$;

-- exam_sessions: does the caller teach this student's class in this final
-- exam's subject?
create or replace function public.rls_teaches_final_exam_student(p_final_exam_id uuid, p_student_id uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from final_exams f
    where f.id = p_final_exam_id
      and is_class_subject_teacher(auth.uid(), p_student_id, f.subject)
  )
$$;

-- ---- responses policies -------------------------------------------------------

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
  for select using (public.rls_is_class_teacher_of_session(session_id));

drop policy "Teachers grade responses for own direct exams" on public.responses;
create policy "Teachers grade responses for own direct exams" on public.responses
  for update using (session_id in (select public.rls_own_direct_exam_session_ids()));

drop policy "Teachers grade responses for their assigned classes" on public.responses;
create policy "Teachers grade responses for their assigned classes" on public.responses
  for update using (public.rls_is_class_teacher_of_session(session_id));

-- ---- exam_sessions: class-teacher policies (bug fix) ---------------------------

drop policy "Teachers view sessions for their assigned classes" on public.exam_sessions;
create policy "Teachers view sessions for their assigned classes" on public.exam_sessions
  for select using (
    assigned_teacher_id = auth.uid()
    or public.rls_teaches_final_exam_student(final_exam_id, student_id)
  );

drop policy "Teachers update sessions for their assigned classes" on public.exam_sessions;
create policy "Teachers update sessions for their assigned classes" on public.exam_sessions
  for update using (
    assigned_teacher_id = auth.uid()
    or public.rls_teaches_final_exam_student(final_exam_id, student_id)
  );

commit;
