-- Topic Mastery needs each bank question's subject, but subject lives on
-- draft_exams, whose own RLS is scoped much more tightly (published +
-- enrolled) than "is this question in the bank" -- widening draft_exams
-- access to students would leak unrelated exam metadata (access_password,
-- instructions, status) just to read one field. A narrow SECURITY DEFINER
-- function sidesteps that: it returns only what Topic Mastery actually
-- needs, for bank questions only, same pattern as the other predicate/
-- lookup functions in this schema (my_supervised_department,
-- is_question_eligible_for_self_mock).

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
