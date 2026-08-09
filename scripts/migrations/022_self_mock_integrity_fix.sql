-- Fixes a real integrity gap in the existing self-mock ("Mock Exams") feature:
-- eligibility (completed exam, results released) was enforced only in
-- src/app/student/self-mock/page.tsx client code, not by RLS. A student
-- could bypass the UI and insert a self_mock_questions row pointing at a
-- question from an exam they haven't completed (or completed but whose
-- results aren't released yet), then read its correct_answer once the
-- self-mock is "submitted" -- effectively previewing real exam answers
-- early. This migration moves the eligibility check into the database via
-- a SECURITY DEFINER function, matching the is_teacher_of_class_student()
-- pattern already used elsewhere, and adds the results_released check the
-- rest of the app already applies to this same data (see
-- src/app/student/history/page.tsx). Also caps question_count server-side
-- to match the UI's existing 1-50 range, and adds teacher read access to
-- their own students' self-mock history (previously nobody but the
-- student could see it at all).

create or replace function public.is_question_eligible_for_self_mock(p_question_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    -- Final-exam question: student completed a session for an exam this
    -- question belongs to, and results were released.
    select 1
    from final_exam_questions feq
    join exam_sessions es on es.final_exam_id = feq.final_exam_id
    where feq.question_id = p_question_id
      and es.student_id = auth.uid()
      and es.status = 'completed'
      and es.results_released = true
  ) or exists (
    -- Direct/draft-exam question: same, via the question's own draft_exam_id.
    select 1
    from questions q
    join exam_sessions es on es.draft_exam_id = q.draft_exam_id
    where q.id = p_question_id
      and es.student_id = auth.uid()
      and es.status = 'completed'
      and es.results_released = true
  );
$$;

alter table public.self_mocks
  add constraint self_mocks_question_count_range check (question_count between 1 and 50);

drop policy if exists "Students manage own self mock questions" on public.self_mock_questions;

create policy "Students view own self mock questions" on public.self_mock_questions
  for select using (
    exists (select 1 from self_mocks where self_mocks.id = self_mock_questions.self_mock_id and self_mocks.student_id = auth.uid())
  );

-- Only INSERT needs the eligibility check -- UPDATE is the student
-- recording their own answer/points_awarded after the fact, not changing
-- which question is on the mock.
create policy "Students insert eligible self mock questions" on public.self_mock_questions
  for insert with check (
    exists (select 1 from self_mocks where self_mocks.id = self_mock_questions.self_mock_id and self_mocks.student_id = auth.uid())
    and public.is_question_eligible_for_self_mock(question_id)
  );

create policy "Students update own self mock questions" on public.self_mock_questions
  for update using (
    exists (select 1 from self_mocks where self_mocks.id = self_mock_questions.self_mock_id and self_mocks.student_id = auth.uid())
  ) with check (
    exists (select 1 from self_mocks where self_mocks.id = self_mock_questions.self_mock_id and self_mocks.student_id = auth.uid())
  );

create policy "Students delete own self mock questions" on public.self_mock_questions
  for delete using (
    exists (select 1 from self_mocks where self_mocks.id = self_mock_questions.self_mock_id and self_mocks.student_id = auth.uid())
  );

-- Teacher visibility: opt-in, not a dashboard -- a teacher can look up a
-- student's mock exam history from that student's own profile page, same
-- "is this my student" check already used for viewing their profile.
create policy "Teachers view self mocks of their students" on public.self_mocks
  for select using (public.is_teacher_of_class_student(student_id));

create policy "Teachers view self mock questions of their students" on public.self_mock_questions
  for select using (
    exists (
      select 1 from self_mocks
      where self_mocks.id = self_mock_questions.self_mock_id
        and public.is_teacher_of_class_student(self_mocks.student_id)
    )
  );
