-- Restores the policies on public.responses and the two class-teacher policies
-- on public.exam_sessions exactly as they were before 050 (copied from
-- pg_policies on the live database), then removes the helper functions.
-- One transaction: there is never a moment without policies.

begin;

drop policy "Students manage own responses" on public.responses;
create policy "Students manage own responses" on public.responses
  for all using (
    exists (
      select 1 from exam_sessions
      where exam_sessions.id = responses.session_id
        and exam_sessions.student_id = auth.uid()
    )
  );

drop policy "Supervisors view responses for own department direct exams" on public.responses;
create policy "Supervisors view responses for own department direct exams" on public.responses
  for select using (
    exists (
      select 1 from exam_sessions
      join draft_exams on draft_exams.id = exam_sessions.draft_exam_id
      where exam_sessions.id = responses.session_id
        and (draft_exams.department_id = my_supervised_department() or is_admin())
    )
  );

drop policy "Supervisors view responses for own department exams" on public.responses;
create policy "Supervisors view responses for own department exams" on public.responses
  for select using (
    exists (
      select 1 from exam_sessions
      join final_exams on final_exams.id = exam_sessions.final_exam_id
      where exam_sessions.id = responses.session_id
        and (final_exams.department_id = my_supervised_department() or is_admin())
    )
  );

drop policy "Teachers view responses for own direct exams" on public.responses;
create policy "Teachers view responses for own direct exams" on public.responses
  for select using (
    exists (
      select 1 from exam_sessions
      join draft_exams on draft_exams.id = exam_sessions.draft_exam_id
      where exam_sessions.id = responses.session_id
        and draft_exams.created_by = auth.uid()
    )
  );

drop policy "Teachers view responses for their assigned classes" on public.responses;
create policy "Teachers view responses for their assigned classes" on public.responses
  for select using (
    exists (
      select 1 from exam_sessions s
      join final_exams f on f.id = s.final_exam_id
      where s.id = responses.session_id
        and (s.assigned_teacher_id = auth.uid()
             or is_class_subject_teacher(auth.uid(), s.student_id, f.subject))
    )
  );

drop policy "Teachers grade responses for own direct exams" on public.responses;
create policy "Teachers grade responses for own direct exams" on public.responses
  for update using (
    exists (
      select 1 from exam_sessions
      join draft_exams on draft_exams.id = exam_sessions.draft_exam_id
      where exam_sessions.id = responses.session_id
        and draft_exams.created_by = auth.uid()
    )
  );

drop policy "Teachers grade responses for their assigned classes" on public.responses;
create policy "Teachers grade responses for their assigned classes" on public.responses
  for update using (
    exists (
      select 1 from exam_sessions s
      join final_exams f on f.id = s.final_exam_id
      where s.id = responses.session_id
        and (s.assigned_teacher_id = auth.uid()
             or is_class_subject_teacher(auth.uid(), s.student_id, f.subject))
    )
  );

drop policy "Teachers view sessions for their assigned classes" on public.exam_sessions;
create policy "Teachers view sessions for their assigned classes" on public.exam_sessions
  for select using (
    (assigned_teacher_id = auth.uid())
    or exists (
      select 1 from final_exams f
      where f.id = exam_sessions.final_exam_id
        and is_class_subject_teacher(auth.uid(), exam_sessions.student_id, f.subject)
    )
  );

drop policy "Teachers update sessions for their assigned classes" on public.exam_sessions;
create policy "Teachers update sessions for their assigned classes" on public.exam_sessions
  for update using (
    (assigned_teacher_id = auth.uid())
    or exists (
      select 1 from final_exams f
      where f.id = exam_sessions.final_exam_id
        and is_class_subject_teacher(auth.uid(), exam_sessions.student_id, f.subject)
    )
  );

drop function public.rls_is_class_teacher_of_session(uuid);
drop function public.rls_teaches_final_exam_student(uuid, uuid);
drop function public.rls_own_session_ids();
drop function public.rls_supervised_direct_session_ids();
drop function public.rls_supervised_final_session_ids();
drop function public.rls_own_direct_exam_session_ids();

commit;
