-- Puts the four rules back to "the row is yours" and removes the review-comments function.
begin;
drop function if exists public.save_exam_review_comments(uuid, jsonb);
drop policy if exists "Teachers manage own drafts" on public.draft_exams;
create policy "Teachers manage own drafts" on public.draft_exams for all using (created_by = auth.uid()) with check (created_by = auth.uid());
drop policy if exists "Teachers manage own questions" on public.questions;
create policy "Teachers manage own questions" on public.questions for all using (created_by = auth.uid()) with check (created_by = auth.uid());
drop policy if exists "Teachers manage class group links for own drafts" on public.draft_exam_class_groups;
create policy "Teachers manage class group links for own drafts" on public.draft_exam_class_groups for all using (public.owns_draft_exam(draft_exam_id));
drop policy if exists "Teachers manage own report card comments" on public.report_card_comments;
create policy "Teachers manage own report card comments" on public.report_card_comments for all using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());
commit;
select 'Migration 095 rolled back' as result;
