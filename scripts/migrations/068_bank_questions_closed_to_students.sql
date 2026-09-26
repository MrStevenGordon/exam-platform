-- 068: question-bank answers are no longer readable by students (exam integrity finding E5).
--
-- DECISION NEEDED BEFORE APPLYING: this makes bank questions invisible to students through the database's
-- public interface, including their correct answers and marking points. Apply it if bank questions may ever
-- be used in a real exam (or you would simply rather students cannot read answers). Do NOT apply it if you
-- rely on students reading bank questions directly. Smart Play is not affected: it keeps its own copy of the
-- questions on its own server.
--
-- What it removes (all came from the Smart Play branch's migrations 047 to 049, which are already applied):
--   * the policy "Students view bank questions"  (048)
--   * the bank clause of is_question_eligible_for_self_mock  (047), leaving the two "completed and released" clauses
--   * get_bank_question_subjects()  (049), which only the exam-side Topic Mastery page used, and that page
--     is not part of the app any more.
-- Roll back with scripts/migrations/rollback/068_bank_questions_closed_to_students_rollback.sql.

begin;

drop policy if exists "Students view bank questions" on public.questions;

create or replace function public.is_question_eligible_for_self_mock(p_question_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select exists (
    select 1
    from final_exam_questions feq
    join exam_sessions es on es.final_exam_id = feq.final_exam_id
    where feq.question_id = p_question_id
      and es.student_id = auth.uid()
      and es.status = 'completed'
      and es.results_released = true
  ) or exists (
    select 1
    from questions q
    join exam_sessions es on es.draft_exam_id = q.draft_exam_id
    where q.id = p_question_id
      and es.student_id = auth.uid()
      and es.status = 'completed'
      and es.results_released = true
  );
$$;

drop function if exists public.get_bank_question_subjects();

commit;
