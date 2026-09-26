-- Restores what 068 removed: migrations 047, 048 and 049 exactly as they were.
begin;

create policy "Students view bank questions" on public.questions
  for select using (
    is_bank_question = true
    and exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'student')
  );

create or replace function public.is_question_eligible_for_self_mock(p_question_id uuid)
returns boolean
language sql
stable security definer
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
  ) or exists (
    -- Question bank: a teacher already marked this reusable, independent of
    -- whether the requesting student ever sat the exam it originated from.
    select 1 from questions q where q.id = p_question_id and q.is_bank_question = true
  );
$$;

create or replace function public.get_bank_question_subjects()
returns table (question_id uuid, subject text, topic text, points integer)
language sql
stable security definer
set search_path to 'public'
as $$
  select q.id, d.subject, q.topic, q.points
  from questions q
  join draft_exams d on d.id = q.draft_exam_id
  where q.is_bank_question = true
    and exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'student');
$$;

grant execute on function public.get_bank_question_subjects() to authenticated;

commit;
