-- Topic Mastery (gamification, localhost dev only until approved) needs to
-- generate practice sets from the question bank, not just from exams a
-- student has already sat -- otherwise there is nothing to practice until
-- after the first real exam. is_bank_question is already the "explicitly
-- safe to reuse" signal everywhere else in the app (add-from-bank lets any
-- teacher reuse these with no eligibility check at all); extending self-mock
-- eligibility to match is consistent with that, not a new exposure.

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
