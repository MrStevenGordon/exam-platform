-- 095: (A) only staff can create exams, questions, exam class links and report card comments; (B) a head of department can save review comments.
--
-- (A) WHAT WAS WRONG (QA, 2026-10-07): the rules on draft_exams, questions, draft_exam_class_groups and report_card_comments said only "the row is yours".
-- A student, using the app's own database connection (not the normal screens), could create an exam, mark it published, link it to their class and add
-- questions; another student in that class could then see it. NOW: the same rules, and the person must also be a teacher, a head of department or the
-- school admin. Nothing is deleted and nothing staff do today changes.
--
-- (B) WHAT WAS WRONG: the exam review page saved the head of department's comments with a plain update on the questions table, and no rule lets a head
-- of department update questions, so "Send feedback" saved nothing (and, with several updates at once, timed out). NOW: one secured function,
-- save_exam_review_comments(exam, comments), checks the person may review that exam (the head of that department, the school admin, or a senior team
-- lead for that subject and grade) and that the exam is waiting for review, then writes ONLY the comment column, for that exam's questions only.
--
-- Roll back with scripts/migrations/rollback/095_staff_only_exams_and_hod_comments_rollback.sql

begin;

-- ---------- (A) staff only ----------
drop policy if exists "Teachers manage own drafts" on public.draft_exams;
create policy "Teachers manage own drafts" on public.draft_exams for all
  using (created_by = auth.uid() and public.my_role() in ('teacher', 'supervisor', 'admin'))
  with check (created_by = auth.uid() and public.my_role() in ('teacher', 'supervisor', 'admin'));

drop policy if exists "Teachers manage own questions" on public.questions;
create policy "Teachers manage own questions" on public.questions for all
  using (created_by = auth.uid() and public.my_role() in ('teacher', 'supervisor', 'admin'))
  with check (created_by = auth.uid() and public.my_role() in ('teacher', 'supervisor', 'admin'));

drop policy if exists "Teachers manage class group links for own drafts" on public.draft_exam_class_groups;
create policy "Teachers manage class group links for own drafts" on public.draft_exam_class_groups for all
  using (public.owns_draft_exam(draft_exam_id) and public.my_role() in ('teacher', 'supervisor', 'admin'))
  with check (public.owns_draft_exam(draft_exam_id) and public.my_role() in ('teacher', 'supervisor', 'admin'));

drop policy if exists "Teachers manage own report card comments" on public.report_card_comments;
create policy "Teachers manage own report card comments" on public.report_card_comments for all
  using (teacher_id = auth.uid() and public.my_role() in ('teacher', 'supervisor', 'admin'))
  with check (teacher_id = auth.uid() and public.my_role() in ('teacher', 'supervisor', 'admin'));

-- ---------- (B) head of department comments ----------
create or replace function public.save_exam_review_comments(p_exam uuid, p_comments jsonb)
returns integer
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  e draft_exams;
  v_role text := public.my_role();
  v_ok boolean := false;
  k text; v text; n integer := 0;
begin
  if auth.uid() is null then raise exception 'Please sign in again.' using errcode = '28000'; end if;
  if p_comments is null or jsonb_typeof(p_comments) <> 'object' then raise exception 'No comments were sent.' using errcode = 'P0001'; end if;
  select * into e from draft_exams where id = p_exam;
  if not found then raise exception 'That exam was not found.' using errcode = 'P0001'; end if;
  if e.status <> 'submitted' then raise exception 'This exam is not waiting for review.' using errcode = 'P0001'; end if;

  -- the same people the review step allows: the school admin, the head of the exam's department, a senior team lead for its subject and grade
  if v_role = 'admin' or coalesce(((auth.jwt() -> 'app_metadata') ->> 'is_system_admin')::boolean, false) then v_ok := true;
  elsif v_role = 'supervisor' and e.department_id is not null and e.department_id = public.my_supervised_department() then v_ok := true;
  else
    v_ok := exists (select 1 from senior_team_lead_appointments s where s.teacher_id = auth.uid() and s.subject = e.subject and (s.year_grade is null or s.year_grade = e.target_grade));
  end if;
  if not v_ok then raise exception 'You cannot review this exam.' using errcode = '42501'; end if;

  for k, v in select key, value from jsonb_each_text(p_comments) loop
    if length(coalesce(v, '')) > 2000 then raise exception 'Please keep each comment under 2000 characters.' using errcode = 'P0001'; end if;
    update questions set supervisor_comment = nullif(btrim(coalesce(v, '')), '')
      where id = k::uuid and draft_exam_id = p_exam;
    if found then n := n + 1; end if;
  end loop;
  return n;
end $$;
revoke all on function public.save_exam_review_comments(uuid, jsonb) from public, anon;
grant execute on function public.save_exam_review_comments(uuid, jsonb) to authenticated;

commit;

select 'Migration 095 applied' as result;
