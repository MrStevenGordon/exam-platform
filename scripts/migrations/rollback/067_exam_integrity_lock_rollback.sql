-- Rolls back 067: removes the student write guards and restores the student read access to questions.
-- Restores the state before 067 exactly (the same policy and function definitions). Roll back 067 before 066.

begin;

drop trigger if exists exam_sessions_student_guard on public.exam_sessions;
drop trigger if exists responses_student_guard on public.responses;
drop function if exists public.exam_sessions_student_guard();
drop function if exists public.responses_student_guard();
drop function if exists public.exam_session_start_problem(uuid, uuid, uuid, int, uuid);
drop function if exists public.exam_session_is_open(uuid);
drop function if exists public.exam_session_has_question(uuid, uuid);
drop function if exists public.exam_caller_is_staff();

drop policy if exists "Students view questions for their enrolled exams" on public.questions;
create policy "Students view questions for their enrolled exams" on public.questions
  for select using (
    (exists (
      select 1
        from final_exam_questions feq
        join final_exam_class_groups fecg on fecg.final_exam_id = feq.final_exam_id
        join enrollments e on e.class_group_id = fecg.class_group_id
       where feq.question_id = questions.id and e.student_id = auth.uid()
    ))
    or (exists (
      select 1
        from draft_exams d
        join draft_exam_class_groups dcg on dcg.draft_exam_id = d.id
        join enrollments e on e.class_group_id = dcg.class_group_id
       where d.id = questions.draft_exam_id and d.direct_published = true and e.student_id = auth.uid()
    ))
  );

create or replace function public.student_completed_question_exam(q_id uuid)
returns boolean
language sql stable security definer
set search_path to 'public'
as $$
  select exists (
    select 1
    from questions q
    join exam_sessions s on s.draft_exam_id = q.draft_exam_id
    where q.id = q_id
      and s.student_id = auth.uid()
      and s.status = 'completed'
  ) or exists (
    select 1
    from final_exam_questions feq
    join exam_sessions s on s.final_exam_id = feq.final_exam_id
    where feq.question_id = q_id
      and s.student_id = auth.uid()
      and s.status = 'completed'
  );
$$;

commit;
