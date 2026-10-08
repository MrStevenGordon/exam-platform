-- Puts the original inline rules back on questions and exam_sessions and removes the helper functions.
begin;

drop policy if exists "Team leads can edit shared exam questions" on public.questions;
create policy "Team leads can edit shared exam questions" on public.questions for all
  using (exists (select 1 from draft_exams d join team_lead_appointments tla on tla.year_grade = d.target_grade and tla.subject = d.subject where d.id = questions.draft_exam_id and tla.teacher_id = auth.uid()));
drop policy if exists "Senior team leads can view questions for exams under review" on public.questions;
create policy "Senior team leads can view questions for exams under review" on public.questions for select
  using (exists (select 1 from draft_exams d join senior_team_lead_appointments stla on stla.subject = d.subject and (stla.year_grade is null or stla.year_grade = d.target_grade) where d.id = questions.draft_exam_id and stla.teacher_id = auth.uid() and d.status = 'submitted'));
drop policy if exists "Supervisors view own department questions" on public.questions;
create policy "Supervisors view own department questions" on public.questions for select
  using (exists (select 1 from draft_exams where draft_exams.id = questions.draft_exam_id and (draft_exams.department_id = my_supervised_department() or is_admin())));
drop policy if exists "Team leads can view shared exam questions" on public.questions;
create policy "Team leads can view shared exam questions" on public.questions for select
  using (exists (select 1 from draft_exams d join team_lead_appointments tla on tla.year_grade = d.target_grade and tla.subject = d.subject where d.id = questions.draft_exam_id and tla.teacher_id = auth.uid()));
drop policy if exists "Students sample only from exams they've completed" on public.questions;
create policy "Students sample only from exams they've completed" on public.questions for select
  using (question_type <> 'essay' and exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'student') and student_completed_question_exam(id));

drop policy if exists "Supervisors view sessions for own department direct exams" on public.exam_sessions;
create policy "Supervisors view sessions for own department direct exams" on public.exam_sessions for select
  using (exists (select 1 from draft_exams where draft_exams.id = exam_sessions.draft_exam_id and (draft_exams.department_id = my_supervised_department() or is_admin())));
drop policy if exists "Supervisors view sessions for own department exams" on public.exam_sessions;
create policy "Supervisors view sessions for own department exams" on public.exam_sessions for select
  using (exists (select 1 from final_exams where final_exams.id = exam_sessions.final_exam_id and (final_exams.department_id = my_supervised_department() or is_admin())));
drop policy if exists "Teachers view sessions for own direct exams" on public.exam_sessions;
create policy "Teachers view sessions for own direct exams" on public.exam_sessions for select
  using (exists (select 1 from draft_exams where draft_exams.id = exam_sessions.draft_exam_id and draft_exams.created_by = auth.uid()));
drop policy if exists "Supervisors update sessions for own department exams" on public.exam_sessions;
create policy "Supervisors update sessions for own department exams" on public.exam_sessions for update
  using (exists (select 1 from final_exams where final_exams.id = exam_sessions.final_exam_id and (final_exams.department_id = my_supervised_department() or is_admin())));
drop policy if exists "Teachers update sessions for own direct exams" on public.exam_sessions;
create policy "Teachers update sessions for own direct exams" on public.exam_sessions for update
  using (exists (select 1 from draft_exams where draft_exams.id = exam_sessions.draft_exam_id and draft_exams.created_by = auth.uid()));

drop function if exists public.rls_exam_team_lead(uuid);
drop function if exists public.rls_exam_senior_lead_reviewing(uuid);
drop function if exists public.rls_draft_exam_supervised(uuid);
drop function if exists public.rls_draft_exam_owned(uuid);
drop function if exists public.rls_final_exam_supervised(uuid);
commit;
select 'Migration 099 rolled back' as result;
