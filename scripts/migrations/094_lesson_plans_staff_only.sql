-- 094: lesson plans can only be written by staff.
--
-- WHAT WAS WRONG: the rule on lesson_plans said only "the row is yours" (teacher_id = the signed-in person), so any signed-in account, a student included,
-- could create a lesson plan for themselves. Found in QA on 2026-10-07: a student's insert was accepted.
-- NOW: the same rule, and the person must also be a teacher, a head of department or the school admin (the roles that can use the lesson plan page and the
-- AI drafting route). A student, or anyone else, is refused. Existing plans written by staff are not changed. Nothing is deleted.
--
-- Roll back with scripts/migrations/rollback/094_lesson_plans_staff_only_rollback.sql

begin;

drop policy if exists "Teachers manage their own lesson plans" on public.lesson_plans;
create policy "Teachers manage their own lesson plans" on public.lesson_plans for all
  using (teacher_id = auth.uid() and public.my_role() in ('teacher', 'supervisor', 'admin'))
  with check (teacher_id = auth.uid() and public.my_role() in ('teacher', 'supervisor', 'admin'));

commit;

select 'Migration 094 applied' as result;
