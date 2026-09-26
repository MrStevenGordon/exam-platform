-- Topic Mastery needs to list available topics from the question bank
-- before a student generates a practice set -- but the existing
-- "Students view questions for their enrolled exams" policy only covers
-- questions on a published/enrolled exam, so bank questions from an
-- unpublished or unrelated exam were invisible even though
-- is_question_eligible_for_self_mock() (047) already lets any student
-- insert them into their own practice set. This closes that gap: the read
-- policy now matches the write eligibility already granted, rather than
-- being stricter than it for no reason.

create policy "Students view bank questions" on public.questions
  for select using (
    is_bank_question = true
    and exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'student')
  );
